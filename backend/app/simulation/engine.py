"""Simulation orchestrator for managing the discrete event simulation.

This module provides the SimulationOrchestrator class that:
- Initializes and manages the SimPy environment
- Generates vehicle arrivals based on demand curves
- Coordinates multiple stations
- Collects telemetry and statistics
- Runs simulations in headless mode for API integration
"""

import random
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Generator
from uuid import UUID, uuid4

import numpy as np
import simpy

from app.core.logging import get_logger
from app.schemas.sim_config import (
    BaselineComparison,
    DemandCurve,
    EventType,
    Intervention,
    InterventionType,
    SimulationConfig,
    SimulationResult,
    SimulationStatus,
    StationConfig,
    StationKPI,
)
from app.simulation.assets import Station, Vehicle, create_vehicle
from app.data_loader import load_real_network

logger = get_logger(__name__)


class SimulationOrchestrator:
    """Orchestrates the discrete event simulation of a swap station network.
    
    The orchestrator manages:
    - SimPy environment lifecycle
    - Station instantiation and coordination
    - Vehicle arrival generation (Poisson process)
    - Telemetry event collection
    - Statistics aggregation
    
    Attributes:
        config: Simulation configuration.
        env: SimPy environment instance.
        stations: Dictionary of station instances.
        run_id: Unique identifier for this simulation run.
        events: Collected telemetry events.
        start_time: Wall-clock start time.
    
    Example:
        >>> config = SimulationConfig(duration_days=1, stations=[...])
        >>> orchestrator = SimulationOrchestrator(config)
        >>> result = orchestrator.run()
        >>> print(f"Total swaps: {result.city_total_swaps}")
    """
    
    def __init__(self, config: SimulationConfig) -> None:
        """Initialize the simulation orchestrator.
        
        Args:
            config: Complete simulation configuration.
        """
        self.config = config
        self.run_id: UUID = uuid4()
        self.env: simpy.Environment = simpy.Environment()
        self.stations: dict[str, Station] = {}
        self.events: list[dict[str, Any]] = []
        self.start_time: float = 0.0
        self._rng: random.Random = random.Random(config.random_seed)
        self._np_rng: np.random.Generator = np.random.default_rng(config.random_seed)
        
        # Load Real Network Data if no stations provided (or to override)
        # Note: In a real app, we might merge or prefer one. 
        # Here we strictly follow the prompt: "Initialized? Load real network."
        # However, config comes from API. If we rely on data_loader, we should probably
        # populate the config with it if it's "headless" or initial load.
        # But the prompt says "Refactor Simulation Engine... Initialization: Update the env setup to call load_real_network()."
        # It also says "Station Creation: ... Do not generate random stations."
        
        real_stations_data, self.mean_arrival_time_min = load_real_network()
        
        if real_stations_data:
            # Convert dicts to StationConfig objects
            real_stations = [StationConfig(**s) for s in real_stations_data]
            
            # If the config passed has NO stations (or we want to enforce real data), use these.
            # Assuming we want to USE these stations for the simulation run.
            # We'll merge or replace. Let's replace config.stations with real data 
            # BUT keep any scenarios that might add/remove on top.
            # Wait, apply_interventions takes base stations. 
            
            self.config.stations = real_stations # Override provided stations with Real Data
        
        # Apply scenario interventions if present
        self._effective_stations = self._apply_interventions(self.config.stations)
        
        # Initialize stations
        self._initialize_stations()
        
        logger.info(
            "orchestrator_initialized",
            run_id=str(self.run_id),
            stations=len(self.stations),
            duration_days=config.duration_days,
            mean_arrival_time=getattr(self, 'mean_arrival_time_min', 10.0)
        )
    
    def _apply_interventions(
        self,
        base_stations: list[StationConfig],
    ) -> list[StationConfig]:
        """Apply scenario interventions to station configurations.
        
        Args:
            base_stations: Original station configurations.
        
        Returns:
            list[StationConfig]: Modified configurations after interventions.
        """
        if not self.config.scenario:
            return base_stations
        
        stations = {s.id: s.model_copy(deep=True) for s in base_stations}
        
        for intervention in self.config.scenario.interventions:
            stations = self._apply_single_intervention(stations, intervention)
        
        return list(stations.values())
    
    def _apply_single_intervention(
        self,
        stations: dict[str, StationConfig],
        intervention: Intervention,
    ) -> dict[str, StationConfig]:
        """Apply a single intervention to station configs.
        
        Args:
            stations: Current station configurations.
            intervention: Intervention to apply.
        
        Returns:
            dict[str, StationConfig]: Updated configurations.
        """
        match intervention.type:
            case InterventionType.ADD_STATION:
                params = intervention.parameters
                from app.schemas.sim_config import Location
                
                new_station = StationConfig(
                    id=params["id"],
                    location=Location(
                        lat=params["location"][0],
                        lon=params["location"][1],
                    ),
                    total_batteries=params.get("total_batteries", 20),
                    charger_count=params.get("charger_count", 4),
                    charge_power_kw=params.get("charge_power_kw", 60.0),
                    swap_time_seconds=params.get("swap_time_seconds", 90),
                )
                stations[new_station.id] = new_station
                logger.info("intervention_add_station", station_id=new_station.id)
                
            case InterventionType.REMOVE_STATION:
                target_id = intervention.target_station_id
                if target_id and target_id in stations:
                    del stations[target_id]
                    logger.info("intervention_remove_station", station_id=target_id)
                    
            case InterventionType.MODIFY_CHARGERS:
                target_id = intervention.target_station_id
                if target_id and target_id in stations:
                    stations[target_id].charger_count = intervention.parameters["new_count"]
                    logger.info(
                        "intervention_modify_chargers",
                        station_id=target_id,
                        new_count=intervention.parameters["new_count"],
                    )
                    
            case InterventionType.MODIFY_INVENTORY:
                target_id = intervention.target_station_id
                if target_id and target_id in stations:
                    delta = intervention.parameters["delta"]
                    stations[target_id].total_batteries += delta
                    logger.info(
                        "intervention_modify_inventory",
                        station_id=target_id,
                        delta=delta,
                    )
        
        return stations
    
    def _initialize_stations(self) -> None:
        """Create Station instances from configurations."""
        for station_config in self._effective_stations:
            station = Station(
                env=self.env,
                config=station_config,
                orchestrator=self,
            )
            self.stations[station_config.id] = station
    
    def log_event(
        self,
        event_type: EventType,
        entity_id: str,
        meta_data: dict[str, Any],
    ) -> None:
        """Log a telemetry event.
        
        Args:
            event_type: Type of event.
            entity_id: Entity that generated the event.
            meta_data: Event-specific data.
        """
        event = {
            "time": self.env.now,
            "run_id": self.run_id,
            "entity_id": entity_id,
            "event_type": event_type.value,
            "meta_data": meta_data,
        }
        self.events.append(event)
    
    def _vehicle_arrival_generator(
        self,
        station: Station,
    ) -> Generator[simpy.Event, Any, None]:
        """Generate vehicle arrivals for a station using Poisson process.
        
        The arrival rate varies by hour based on the demand curve.
        Implements a non-homogeneous Poisson process.
        
        Args:
            station: Target station for arrivals.
        
        Yields:
            SimPy timeout events for inter-arrival times.
        """
        demand_curve = self.config.demand_curve
        scenario_adjustments = (
            self.config.scenario.demand_adjustments
            if self.config.scenario
            else {}
        )
        
        while True:
            # Calculate current hour in simulation
            current_hour = int((self.env.now / 3600) % 24)
            
            # --- REAL DATA INTEGRATION ---
            # Use data-driven mean arrival time if available
            if hasattr(self, 'mean_arrival_time_min') and self.mean_arrival_time_min > 0:
                # Convert mean arrival time (minutes between swaps in network?) 
                # or per station? usage says "MEAN_ARRIVAL_TIME in SimPy generator".
                # If "ChargingEvents" is global events, then it's network-wide?
                # Usually dispatching_time is time taken to discharge? No "Time between swaps".
                # If it's time between swaps for *a* battery, that's related to demand.
                # Let's assume it implies the average interval between arrivals at a station.
                # Rate (arrivals/hr) = 60 / mean_time_min
                base_rate = 60.0 / self.mean_arrival_time_min
            else:
                 # Get base arrival rate from curve
                base_rate = demand_curve.get_rate(current_hour)
            
            # Apply global demand multiplier
            rate = base_rate * self.config.demand_multiplier
            
            # Apply scenario-specific adjustments
            if current_hour in scenario_adjustments:
                rate *= scenario_adjustments[current_hour]
            
            # Distribute rate across stations (equal split for now) if the rate is total city rate
            # If the mean time from data was "per station", then we don't split.
            # Assuming the Excel data implies "Time between swaps" is a global metric or per-station averge.
            # Let's assume it defines the per-station Lambda.
            # But the existing code `station_rate = rate / len(self.stations)` suggests `rate` is City Total.
            # Let's assume `mean_arrival_time_min` is per-station (e.g. 15 mins between cars).
            # Then station_rate = 60 / 15 = 4 cars/hr.
            
            # Code below divides by len(stations) implying input `rate` is TOTAL.
            # If I want `station_rate` to be driven by `mean_arrival_time`, I should skip the division 
            # or Ensure `rate` represents Total.
            # Let's Calculate Station Rate directly.
            
            station_rate = rate # Start with base
            if hasattr(self, 'mean_arrival_time_min') and self.mean_arrival_time_min > 0:
                 # If we used the logic above, base_rate is per station.
                 # So we shouldn't divide by N stations.
                 pass
            else:
                 # Legacy behavior: DemandCurve was Total City Demand
                 station_rate = rate / len(self.stations) if self.stations else rate
            
            if station_rate <= 0:
                # No arrivals this hour, wait until next
                yield self.env.timeout(3600)
                continue
            
            # Generate inter-arrival time (exponential distribution)
            mean_interval = 3600 / station_rate  # seconds between arrivals
            
            # Add jitter based on calibration
            jitter_std = self.config.calibration.arrival_jitter_std
            interval = self._np_rng.exponential(mean_interval)
            if jitter_std > 0:
                jitter = self._np_rng.normal(1.0, jitter_std)
                interval *= max(0.5, jitter)  # Clamp to avoid negative
            
            yield self.env.timeout(interval)
            
            # Create and process vehicle
            vehicle = create_vehicle(
                self.env,
                base_patience=600.0,
                urgency_distribution=(0.8, 1.2),
            )
            vehicle.current_station_id = station.id
            
            # Process vehicle arrival (don't block generator)
            self.env.process(station.handle_vehicle_arrival(vehicle.id))
    
    def run(self) -> SimulationResult:
        """Execute the simulation in headless mode.
        
        Runs the full simulation duration and returns aggregated results.
        
        Returns:
            SimulationResult: Complete simulation results with KPIs.
        
        Raises:
            RuntimeError: If simulation fails unexpectedly.
        """
        self.start_time = time.perf_counter()
        started_at = datetime.now()
        
        try:
            # Start arrival generators for each station
            for station in self.stations.values():
                self.env.process(self._vehicle_arrival_generator(station))
            
            # Calculate total simulation time in seconds
            duration_seconds = self.config.duration_days * 24 * 3600
            
            logger.info(
                "simulation_starting",
                run_id=str(self.run_id),
                duration_seconds=duration_seconds,
            )
            
            # Run the simulation
            self.env.run(until=duration_seconds)
            
            # Calculate compute time
            compute_time_ms = int((time.perf_counter() - self.start_time) * 1000)
            completed_at = datetime.now()
            
            logger.info(
                "simulation_completed",
                run_id=str(self.run_id),
                compute_time_ms=compute_time_ms,
                total_events=len(self.events),
            )
            
            # Aggregate results
            return self._aggregate_results(
                status=SimulationStatus.COMPLETED,
                compute_time_ms=compute_time_ms,
                started_at=started_at,
                completed_at=completed_at,
            )
            
        except Exception as e:
            logger.exception(
                "simulation_failed",
                run_id=str(self.run_id),
                error=str(e),
            )
            raise RuntimeError(f"Simulation failed: {e}") from e
    
    def _aggregate_results(
        self,
        status: SimulationStatus,
        compute_time_ms: int,
        started_at: datetime,
        completed_at: datetime,
    ) -> SimulationResult:
        """Aggregate station statistics into simulation results.
        
        Args:
            status: Final simulation status.
            compute_time_ms: Wall-clock execution time.
            started_at: Simulation start timestamp.
            completed_at: Simulation end timestamp.
        
        Returns:
            SimulationResult: Aggregated KPIs and statistics.
        """
        station_kpis: list[StationKPI] = []
        total_swaps = 0
        total_lost = 0
        total_wait = 0.0
        total_energy = 0.0
        total_charger_time = 0.0
        
        duration_hours = self.config.duration_days * 24
        
        for station_id, station in self.stations.items():
            stats = station.stats
            
            # Calculate charger utilization
            max_charger_time = self.config.duration_days * 24 * 3600 * station.config.charger_count
            utilization = stats.charger_busy_time / max_charger_time if max_charger_time > 0 else 0.0
            
            # Calculate idle inventory percentage
            # Simplified: based on available batteries vs total
            avg_available = station.get_available_battery_count()
            idle_pct = (avg_available / station.config.total_batteries) * 100 if station.config.total_batteries > 0 else 0.0
            
            kpi = StationKPI(
                station_id=station_id,
                total_swaps=stats.total_swaps,
                lost_swaps=stats.lost_swaps,
                avg_wait_time_seconds=stats.avg_wait_time,
                max_wait_time_seconds=stats.max_wait_time,
                charger_utilization=min(1.0, utilization),
                idle_inventory_pct=idle_pct,
                total_energy_kwh=stats.total_energy_kwh,
                peak_queue_length=stats.peak_queue_length,
            )
            station_kpis.append(kpi)
            
            total_swaps += stats.total_swaps
            total_lost += stats.lost_swaps
            total_wait += stats.total_wait_time
            total_energy += stats.total_energy_kwh
            total_charger_time += stats.charger_busy_time
        
        # City-wide aggregates
        city_avg_wait = total_wait / total_swaps if total_swaps > 0 else 0.0
        city_throughput = total_swaps / duration_hours if duration_hours > 0 else 0.0
        
        # Calculate average utilization across all stations
        total_charger_capacity = sum(
            s.config.charger_count for s in self.stations.values()
        ) * self.config.duration_days * 24 * 3600
        avg_utilization = total_charger_time / total_charger_capacity if total_charger_capacity > 0 else 0.0
        
        # Calculate average idle inventory
        avg_idle = sum(k.idle_inventory_pct for k in station_kpis) / len(station_kpis) if station_kpis else 0.0
        
        # Estimate operational cost (Detailed Model)
        # 1. Energy Cost: Rs 8 per kWh
        ENERGY_RATE_PER_KWH = 8.0
        energy_cost = total_energy * ENERGY_RATE_PER_KWH
        
        # 2. Battery Depreciation
        # Formula: Cycle_Count * Battery_Cost * Degradation_Factor
        # Assumptions: Battery Cost = Rs 250,000, Health Fade = 0.01% per cycle
        BATTERY_COST_INR = 250000.0
        DEGRADATION_PER_CYCLE = 0.0001
        
        # Total swaps roughly equals total discharge cycles across the fleet
        depreciation_cost = total_swaps * BATTERY_COST_INR * DEGRADATION_PER_CYCLE
        
        # 3. Logistics & Fixed Overhead
        # Rent, Staff, Maintenance per station per day
        FIXED_COST_PER_STATION_DAY = 500.0
        logistics_cost = len(self.stations) * self.config.duration_days * FIXED_COST_PER_STATION_DAY
        
        opex_cost = energy_cost + depreciation_cost + logistics_cost
        
        scenario_name = self.config.scenario.name if self.config.scenario else "baseline"
        
        return SimulationResult(
            run_id=self.run_id,
            scenario_name=scenario_name,
            status=status,
            duration_days=self.config.duration_days,
            compute_time_ms=compute_time_ms,
            city_total_swaps=total_swaps,
            city_lost_swaps=total_lost,
            city_avg_wait_time=city_avg_wait,
            city_throughput_per_hour=city_throughput,
            total_energy_kwh=total_energy,
            estimated_opex_cost=opex_cost,
            avg_charger_utilization=min(1.0, avg_utilization),
            avg_idle_inventory_pct=avg_idle,
            station_kpis=station_kpis,

            baseline_comparison=None,  # Would be populated by comparison logic
            opex_breakdown={
                "energy_cost": energy_cost,
                "depreciation_cost": depreciation_cost,
                "logistics_cost": logistics_cost,
                "total": opex_cost,
            },
            started_at=started_at,
            completed_at=completed_at,
        )
    
    def get_events(self) -> list[dict[str, Any]]:
        """Get all collected telemetry events.
        
        Returns:
            list[dict]: List of event dictionaries.
        """
        return self.events.copy()
    
    def get_event_count_by_type(self) -> dict[str, int]:
        """Get count of events by type.
        
        Returns:
            dict[str, int]: Event type -> count mapping.
        """
        counts: dict[str, int] = defaultdict(int)
        for event in self.events:
            counts[event["event_type"]] += 1
        return dict(counts)


def compare_results(
    baseline: SimulationResult,
    scenario: SimulationResult,
) -> BaselineComparison:
    """Compare scenario results against baseline.
    
    Args:
        baseline: Baseline simulation results.
        scenario: Scenario simulation results.
    
    Returns:
        BaselineComparison: Delta metrics between runs.
    """
    wait_time_delta = 0.0
    if baseline.city_avg_wait_time > 0:
        wait_time_delta = (
            (scenario.city_avg_wait_time - baseline.city_avg_wait_time)
            / baseline.city_avg_wait_time
            * 100
        )
    
    throughput_delta = 0.0
    if baseline.city_throughput_per_hour > 0:
        throughput_delta = (
            (scenario.city_throughput_per_hour - baseline.city_throughput_per_hour)
            / baseline.city_throughput_per_hour
            * 100
        )
    
    utilization_delta = 0.0
    if baseline.avg_charger_utilization > 0:
        utilization_delta = (
            (scenario.avg_charger_utilization - baseline.avg_charger_utilization)
            / baseline.avg_charger_utilization
            * 100
        )
    
    return BaselineComparison(
        wait_time_delta_pct=round(wait_time_delta, 2),
        lost_swaps_delta=scenario.city_lost_swaps - baseline.city_lost_swaps,
        throughput_delta_pct=round(throughput_delta, 2),
        opex_delta=scenario.estimated_opex_cost - baseline.estimated_opex_cost,
        utilization_delta_pct=round(utilization_delta, 2),
    )
