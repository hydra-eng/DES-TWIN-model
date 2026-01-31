"""SimPy-based virtual assets for battery swap station simulation.

This module implements the core simulation entities using SimPy primitives:
- Battery: Individual battery units with SoC tracking
- Station: Swap station with charging bays and battery inventory
- Vehicle: Customer vehicles requesting battery swaps

The Station class is the central component, implementing:
- simpy.Resource for charging bay allocation
- simpy.FilterStore for battery pool management
- Background charging processes
- Lost swap tracking for stockout scenarios
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Any, Generator
from uuid import UUID, uuid4

import simpy
from app.core.logging import get_logger
from app.schemas.sim_config import BatteryConfig, EventType, StationConfig

if TYPE_CHECKING:
    from app.simulation.engine import SimulationOrchestrator

logger = get_logger(__name__)


# =============================================================================
# Battery Class
# =============================================================================


class BatteryStatus(str, Enum):
    """Current status of a battery unit."""

    AVAILABLE = "AVAILABLE"  # Ready for swap (SoC > threshold)
    CHARGING = "CHARGING"  # Currently being charged
    COOLING = "COOLING"  # Post-swap cooldown period
    DEPLETED = "DEPLETED"  # Needs charging (SoC < threshold)
    IN_SWAP = "IN_SWAP"  # Currently being swapped


@dataclass
class Battery:
    """A battery unit with state-of-charge tracking.

    Attributes:
        id: Unique battery identifier.
        soc: State of charge (0-100 percentage).
        capacity_kwh: Battery capacity in kWh.
        min_swap_soc: Minimum SoC required for swap eligibility.
        cycle_count: Number of charge/discharge cycles completed.
        health: Battery health factor (0-1, degrades over time).
        status: Current battery status.

    Example:
        >>> battery = Battery(id="batt_001", soc=95.0, capacity_kwh=5.0)
        >>> battery.is_swappable
        True
        >>> battery.energy_remaining_kwh
        4.75
    """

    id: str
    soc: float = 100.0
    capacity_kwh: float = 5.0
    min_swap_soc: float = 95.0
    cycle_count: int = 0
    health: float = 1.0
    status: BatteryStatus = BatteryStatus.AVAILABLE

    @property
    def is_swappable(self) -> bool:
        """Check if battery is eligible for swap.

        Returns:
            bool: True if SoC >= threshold and status is AVAILABLE.
        """
        return self.soc >= self.min_swap_soc and self.status == BatteryStatus.AVAILABLE

    @property
    def energy_remaining_kwh(self) -> float:
        """Calculate remaining energy in kWh.

        Returns:
            float: Energy remaining based on SoC and health.
        """
        return (self.soc / 100.0) * self.capacity_kwh * self.health

    def deplete(self, target_soc: float = 20.0) -> None:
        """Deplete battery to simulate vehicle usage.

        Args:
            target_soc: SoC after depletion (simulates vehicle range used).
        """
        self.soc = max(0.0, target_soc)
        self.status = BatteryStatus.DEPLETED
        self.cycle_count += 1

    def set_charging(self) -> None:
        """Mark battery as currently charging."""
        self.status = BatteryStatus.CHARGING

    def complete_charge(self, final_soc: float = 100.0) -> None:
        """Complete charging and mark as available.

        Args:
            final_soc: Final SoC after charging.
        """
        self.soc = min(100.0, final_soc)
        self.status = BatteryStatus.AVAILABLE


# =============================================================================
# Station Class
# =============================================================================


@dataclass
class StationStats:
    """Statistics tracked for a station during simulation.

    Attributes:
        total_swaps: Number of successful swaps.
        lost_swaps: Number of swaps lost due to stockout.
        total_wait_time: Cumulative wait time (seconds).
        max_wait_time: Maximum observed wait time.
        total_charge_time: Cumulative charging time.
        total_energy_kwh: Total energy consumed for charging.
        peak_queue_length: Maximum queue length observed.
        charger_busy_time: Total time chargers were active.
    """

    total_swaps: int = 0
    lost_swaps: int = 0
    total_wait_time: float = 0.0
    max_wait_time: float = 0.0
    total_charge_time: float = 0.0
    total_energy_kwh: float = 0.0
    peak_queue_length: int = 0
    charger_busy_time: float = 0.0

    @property
    def avg_wait_time(self) -> float:
        """Calculate average wait time per successful swap."""
        if self.total_swaps == 0:
            return 0.0
        return self.total_wait_time / self.total_swaps


class Station:
    """A battery swap station modeled as a queuing system.

    The Station class is the core simulation entity, combining:
    - simpy.Resource: Models charging bays (limited capacity)
    - simpy.FilterStore: Battery pool with SoC-based filtering
    - Background process: Continuous charging of depleted batteries

    Physics rules (from PRD.txt):
    1. Vehicle arrives and checks for available charged battery (SoC > 95%)
    2. If available: Get battery -> Wait swap_time -> Release empty battery
    3. If not available: Log "Lost Swap" -> Increment counter -> Vehicle leaves
    4. Background: Charger takes empty battery -> Wait charge_time -> Return to pool

    SimPy Yield Logic:
        The Station uses SimPy's event-driven approach:

        - `yield self.env.timeout(duration)`: Simulates passage of time
          (e.g., swap duration, charge duration)

        - `yield self.chargers.request()`: Waits for a free charging bay
          This blocks until one of the k chargers becomes available

        - `yield self.battery_pool.get(filter_fn)`: Gets a battery matching
          the filter (e.g., SoC > 95%). Blocks if none available.

        - `yield self.battery_pool.put(battery)`: Returns battery to pool
          after charging completes

    Args:
        env: SimPy simulation environment.
        config: Station configuration parameters.
        orchestrator: Parent orchestrator for event logging.

    Example:
        >>> env = simpy.Environment()
        >>> config = StationConfig(id="station_01", ...)
        >>> station = Station(env, config, orchestrator)
        >>> env.process(station.handle_vehicle_arrival("vehicle_01"))
        >>> env.run()
    """

    def __init__(
        self,
        env: simpy.Environment,
        config: StationConfig,
        orchestrator: "SimulationOrchestrator | None" = None,
    ) -> None:
        """Initialize station with SimPy resources.

        Args:
            env: SimPy simulation environment.
            config: Station configuration.
            orchestrator: Parent orchestrator for event logging.
        """
        self.env = env
        self.config = config
        self.orchestrator = orchestrator
        self.stats = StationStats()
        self.id = config.id

        # SimPy Resource: Charging bays (k servers in G/G/k queue)
        self.chargers: simpy.Resource = simpy.Resource(
            env, capacity=config.charger_count
        )

        # SimPy FilterStore: Battery pool with filtering capability
        self.battery_pool: simpy.FilterStore = simpy.FilterStore(env)

        # Queue for batteries waiting to be charged
        self.charge_queue: simpy.Store = simpy.Store(env)

        # Current queue length (for tracking)
        self.current_queue_length: int = 0

        # Initialize batteries
        self._initialize_batteries()

        # Start background charging process
        self.charging_process = env.process(self._charging_loop())

        # Track grid power usage
        self.active_chargers: int = 0

        logger.info(
            "station_initialized",
            station_id=self.id,
            chargers=config.charger_count,
            batteries=config.total_batteries,
        )

    def _initialize_batteries(self) -> None:
        """Create initial battery inventory.

        Batteries are initialized with varying SoC to simulate
        realistic starting conditions (some charged, some depleted).
        """
        battery_config = self.config.battery_config

        for i in range(self.config.total_batteries):
            # Initialize 80% as fully charged, 20% at various SoC levels
            if i < int(self.config.total_batteries * 0.8):
                initial_soc = 100.0
                status = BatteryStatus.AVAILABLE
            else:
                # Stagger initial SoC for realism
                initial_soc = 50.0 + (i % 5) * 10
                status = (
                    BatteryStatus.CHARGING
                    if initial_soc < 95
                    else BatteryStatus.AVAILABLE
                )

            battery = Battery(
                id=f"{self.id}_batt_{i:03d}",
                soc=initial_soc,
                capacity_kwh=battery_config.capacity_kwh,
                min_swap_soc=battery_config.min_swap_soc,
                status=status,
            )

            if battery.is_swappable:
                self.battery_pool.put(battery)
            else:
                self.charge_queue.put(battery)

    def handle_vehicle_arrival(
        self,
        vehicle_id: str,
        patience_seconds: float | None = None,
    ) -> Generator[simpy.Event, Any, bool]:
        """Process a vehicle arrival for battery swap.

        This is the main entry point for vehicle swap requests.
        Implements the core swap logic from PRD.txt:

        1. Check for available charged battery (SoC > 95%)
        2. If available: Perform swap
        3. If not: Log lost swap, vehicle leaves

        Args:
            vehicle_id: Unique vehicle identifier.
            patience_seconds: Max time vehicle will wait (optional).

        Yields:
            SimPy events for timing and resource acquisition.

        Returns:
            bool: True if swap successful, False if lost.

        Example:
            >>> def vehicle_generator(env, station):
            ...     while True:
            ...         yield env.timeout(random.expovariate(1/60))
            ...         env.process(station.handle_vehicle_arrival(f"v_{env.now}"))
        """
        arrival_time = self.env.now
        self.current_queue_length += 1
        self.stats.peak_queue_length = max(
            self.stats.peak_queue_length, self.current_queue_length
        )

        self._log_event(
            EventType.VEHICLE_ARRIVAL,
            vehicle_id,
            {"queue_length": self.current_queue_length},
        )

        # Check for available charged battery
        available_count = sum(1 for b in self.battery_pool.items if b.is_swappable)

        if available_count == 0:
            # STOCKOUT: No charged batteries available
            self._log_event(
                EventType.LOST_SWAP,
                vehicle_id,
                {"reason": "stockout", "queue_length": self.current_queue_length},
            )
            self.stats.lost_swaps += 1
            self.current_queue_length -= 1

            logger.warning(
                "lost_swap",
                station_id=self.id,
                vehicle_id=vehicle_id,
                reason="stockout",
            )
            return False

        # Get a charged battery from the pool
        try:
            charged_battery: Battery = yield self.battery_pool.get(
                lambda b: b.is_swappable
            )
        except simpy.Interrupt:
            self.current_queue_length -= 1
            return False

        # Calculate wait time
        wait_time = self.env.now - arrival_time
        self.stats.total_wait_time += wait_time
        self.stats.max_wait_time = max(self.stats.max_wait_time, wait_time)

        # Start swap process
        self._log_event(
            EventType.SWAP_START,
            vehicle_id,
            {
                "battery_id": charged_battery.id,
                "battery_soc": charged_battery.soc,
                "wait_time": wait_time,
            },
        )

        # Simulate swap duration
        charged_battery.status = BatteryStatus.IN_SWAP
        yield self.env.timeout(self.config.swap_time_seconds)

        # Swap complete: depleted battery returned
        self._log_event(
            EventType.SWAP_COMPLETE,
            vehicle_id,
            {
                "battery_id": charged_battery.id,
                "duration": self.config.swap_time_seconds,
            },
        )

        # Deplete the battery (simulating it was in a vehicle)
        charged_battery.deplete(target_soc=20.0)

        # Add to charging queue
        yield self.charge_queue.put(charged_battery)

        self.stats.total_swaps += 1
        self.current_queue_length -= 1

        logger.debug(
            "swap_complete",
            station_id=self.id,
            vehicle_id=vehicle_id,
            wait_time=wait_time,
        )

        return True

    def _charging_loop(self) -> Generator[simpy.Event, Any, None]:
        """Background process that continuously charges depleted batteries.

        This process runs for the entire simulation duration:
        1. Wait for a depleted battery in the charge queue
        2. Request a charger (simpy.Resource)
        3. Apply cooldown period
        4. Simulate charging time (non-linear curve)
        5. Return charged battery to the pool

        The charging time is calculated based on:
        - Current SoC
        - Target SoC (100%)
        - Charge power
        - Non-linear charging curve (fast 0-80%, slow 80-100%)

        Yields:
            SimPy events for timing and resource acquisition.
        """
        while True:
            # Wait for a battery to charge
            try:
                battery: Battery = yield self.charge_queue.get()
            except simpy.Interrupt:
                break

            # Request a charger
            with self.chargers.request() as charger_request:
                yield charger_request

                charge_start = self.env.now
                self.active_chargers += 1

                # Check grid power limit
                if self._is_grid_limited():
                    self._log_event(
                        EventType.GRID_LIMIT_HIT,
                        self.id,
                        {"active_chargers": self.active_chargers},
                    )

                # Cooldown period before charging
                if self.config.cooldown_seconds > 0:
                    battery.status = BatteryStatus.COOLING
                    yield self.env.timeout(self.config.cooldown_seconds)

                battery.set_charging()

                self._log_event(
                    EventType.CHARGE_START,
                    battery.id,
                    {"initial_soc": battery.soc},
                )

                # Calculate charge time using non-linear curve
                charge_time = self._calculate_charge_time(battery)
                yield self.env.timeout(charge_time)

                # Charging complete
                battery.complete_charge(final_soc=100.0)

                charge_duration = self.env.now - charge_start
                energy_used = self._calculate_energy_used(battery, charge_duration)

                self.stats.total_charge_time += charge_duration
                self.stats.total_energy_kwh += energy_used
                self.stats.charger_busy_time += charge_duration

                self._log_event(
                    EventType.CHARGE_COMPLETE,
                    battery.id,
                    {
                        "final_soc": battery.soc,
                        "duration": charge_duration,
                        "energy_kwh": energy_used,
                    },
                )

                self.active_chargers -= 1

            # Return charged battery to pool
            yield self.battery_pool.put(battery)

    def _calculate_charge_time(self, battery: Battery) -> float:
        """Calculate charging time with non-linear curve.

        Implements realistic charging behavior:
        - 0% to 80% SoC: Fast charging (constant power)
        - 80% to 100% SoC: Tapered charging (reduced power)

        Args:
            battery: Battery to calculate charge time for.

        Returns:
            float: Charge time in seconds.
        """
        current_soc = battery.soc
        target_soc = 100.0
        capacity = battery.capacity_kwh
        power = self.config.charge_power_kw

        # Energy needed in kWh
        energy_needed = (target_soc - current_soc) / 100.0 * capacity

        # Fast charging phase (up to 80%)
        if current_soc < 80.0:
            fast_phase_soc = min(80.0, target_soc) - current_soc
            fast_energy = fast_phase_soc / 100.0 * capacity
            fast_time = (fast_energy / power) * 3600  # Convert hours to seconds
        else:
            fast_time = 0.0
            fast_energy = 0.0

        # Slow charging phase (80% to 100%)
        slow_phase_soc = max(0, target_soc - max(current_soc, 80.0))
        if slow_phase_soc > 0:
            slow_energy = slow_phase_soc / 100.0 * capacity
            # Tapered power: 50% of rated power for 80-100% range
            slow_time = (slow_energy / (power * 0.5)) * 3600
        else:
            slow_time = 0.0

        total_time = fast_time + slow_time

        return total_time

    def _calculate_energy_used(self, battery: Battery, duration: float) -> float:
        """Calculate energy consumed during charging.

        Args:
            battery: Battery that was charged.
            duration: Charging duration in seconds.

        Returns:
            float: Energy used in kWh.
        """
        # Simplified: assume average power draw
        avg_power = self.config.charge_power_kw * 0.75  # Account for tapering
        energy = avg_power * (duration / 3600)  # Convert seconds to hours
        return energy

    def _is_grid_limited(self) -> bool:
        """Check if grid power limit is exceeded.

        Returns:
            bool: True if current power draw exceeds grid limit.
        """
        if self.config.grid_power_limit_kw is None:
            return False

        current_power = self.active_chargers * self.config.charge_power_kw
        return current_power > self.config.grid_power_limit_kw

    def _log_event(
        self,
        event_type: EventType,
        entity_id: str,
        meta_data: dict[str, Any],
    ) -> None:
        """Log a telemetry event to the orchestrator.

        Args:
            event_type: Type of event.
            entity_id: Entity that generated the event.
            meta_data: Event-specific metadata.
        """
        if self.orchestrator:
            self.orchestrator.log_event(
                event_type=event_type,
                entity_id=entity_id,
                meta_data={
                    "station_id": self.id,
                    "sim_time": self.env.now,
                    **meta_data,
                },
            )

    def get_available_battery_count(self) -> int:
        """Get count of batteries available for swap.

        Returns:
            int: Number of batteries with SoC > threshold.
        """
        return sum(1 for b in self.battery_pool.items if b.is_swappable)

    def get_charging_battery_count(self) -> int:
        """Get count of batteries currently charging.

        Returns:
            int: Number of batteries in charging state.
        """
        return len(self.charge_queue.items) + self.active_chargers


# =============================================================================
# Vehicle Class
# =============================================================================


@dataclass
class Vehicle:
    """A vehicle requesting a battery swap.

    Attributes:
        id: Unique vehicle identifier.
        arrival_time: Simulation time of arrival.
        patience_seconds: Maximum wait time before leaving.
        current_station_id: Station where vehicle is located.
        urgency: Priority level (higher = less patience).
    """

    id: str
    arrival_time: float = 0.0
    patience_seconds: float = 600.0  # 10 minutes default
    current_station_id: str | None = None
    urgency: float = 1.0

    @property
    def effective_patience(self) -> float:
        """Calculate effective patience based on urgency.

        Higher urgency reduces patience.
        """
        return self.patience_seconds / self.urgency


def create_vehicle(
    env: simpy.Environment,
    base_patience: float = 600.0,
    urgency_distribution: tuple[float, float] = (0.8, 1.2),
) -> Vehicle:
    """Factory function to create a vehicle with random attributes.

    Args:
        env: SimPy environment for arrival time.
        base_patience: Base patience in seconds.
        urgency_distribution: (min, max) range for urgency factor.

    Returns:
        Vehicle: Configured vehicle instance.
    """
    import random

    vehicle_id = f"vehicle_{uuid4().hex[:8]}"
    urgency = random.uniform(*urgency_distribution)

    return Vehicle(
        id=vehicle_id,
        arrival_time=env.now,
        patience_seconds=base_patience,
        urgency=urgency,
    )
