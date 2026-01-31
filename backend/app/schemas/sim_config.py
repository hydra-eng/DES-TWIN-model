"""Pydantic schemas for simulation configuration and outputs.

This module defines all input/output schemas for the simulation API,
including station configuration, scenario interventions, and KPI results.
"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


# =============================================================================
# Enums
# =============================================================================

class EventType(str, Enum):
    """Types of simulation events for telemetry logging."""
    
    VEHICLE_ARRIVAL = "VEHICLE_ARRIVAL"
    SWAP_START = "SWAP_START"
    SWAP_COMPLETE = "SWAP_COMPLETE"
    LOST_SWAP = "LOST_SWAP"
    CHARGE_START = "CHARGE_START"
    CHARGE_COMPLETE = "CHARGE_COMPLETE"
    QUEUE_UPDATE = "QUEUE_UPDATE"
    STATION_STOCKOUT = "STATION_STOCKOUT"
    GRID_LIMIT_HIT = "GRID_LIMIT_HIT"


class InterventionType(str, Enum):
    """Types of scenario interventions for what-if analysis."""
    
    ADD_STATION = "ADD_STATION"
    REMOVE_STATION = "REMOVE_STATION"
    MODIFY_CHARGERS = "MODIFY_CHARGERS"
    MODIFY_INVENTORY = "MODIFY_INVENTORY"
    DEMAND_MULTIPLIER = "DEMAND_MULTIPLIER"
    POLICY_CHANGE = "POLICY_CHANGE"
    INJECT_FAULT = "INJECT_FAULT"


class SimulationStatus(str, Enum):
    """Status of a simulation run."""
    
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


# =============================================================================
# Input Schemas
# =============================================================================

class Location(BaseModel):
    """Geographic location with latitude and longitude.
    
    Attributes:
        lat: Latitude in degrees (-90 to 90).
        lon: Longitude in degrees (-180 to 180).
    """
    
    lat: float = Field(..., ge=-90, le=90, description="Latitude in degrees")
    lon: float = Field(..., ge=-180, le=180, description="Longitude in degrees")


class BatteryConfig(BaseModel):
    """Configuration for a battery unit.
    
    Attributes:
        capacity_kwh: Battery capacity in kWh.
        min_swap_soc: Minimum SoC required for swap (0-100).
        max_soc: Maximum SoC when fully charged.
        degradation_factor: Health degradation per cycle (0-1).
    """
    
    capacity_kwh: float = Field(default=5.0, gt=0, description="Battery capacity in kWh")
    min_swap_soc: float = Field(default=95.0, ge=80, le=100, description="Min SoC for swap eligibility")
    max_soc: float = Field(default=100.0, ge=95, le=100, description="Max SoC when fully charged")
    degradation_factor: float = Field(default=0.0001, ge=0, le=0.01, description="Health loss per cycle")


class StationConfig(BaseModel):
    """Configuration for a swap station node.
    
    This defines the physical and operational parameters of a single
    battery swap station in the network.
    
    Attributes:
        id: Unique station identifier.
        name: Human-readable station name.
        location: Geographic coordinates.
        total_batteries: Total battery inventory at station.
        charger_count: Number of charging bays.
        charge_power_kw: Power output per charger in kW.
        swap_time_seconds: Time to complete one swap operation.
        grid_power_limit_kw: Maximum simultaneous power draw.
        cooldown_seconds: Battery cooldown before charging begins.
    """
    
    id: str = Field(..., min_length=1, max_length=64, description="Unique station ID")
    name: str = Field(default="", max_length=255, description="Station display name")
    location: Location = Field(..., description="Geographic coordinates")
    total_batteries: int = Field(default=20, ge=1, le=500, description="Total battery inventory")
    charger_count: int = Field(default=4, ge=1, le=50, description="Number of charging bays")
    charge_power_kw: float = Field(default=60.0, gt=0, le=500, description="Charger power in kW")
    swap_time_seconds: int = Field(default=90, ge=30, le=600, description="Swap duration in seconds")
    grid_power_limit_kw: float | None = Field(
        default=None, 
        gt=0, 
        description="Max grid power draw (None = unlimited)"
    )
    cooldown_seconds: int = Field(default=60, ge=0, le=300, description="Post-swap cooldown before charging")
    battery_config: BatteryConfig = Field(default_factory=BatteryConfig)
    type: str = Field(default="SCENARIO", description="Station type: CORE or SCENARIO")
    status: str = Field(default="ACTIVE", description="Operational status: ACTIVE, INACTIVE, MAINTENANCE")
    
    @field_validator("name", mode="before")
    @classmethod
    def set_default_name(cls, v: str, info: Any) -> str:
        """Default station name to ID if not provided."""
        if not v and info.data.get("id"):
            return f"Station {info.data['id']}"
        return v
    
    @model_validator(mode="after")
    def validate_throughput_feasibility(self) -> "StationConfig":
        """Ensure station configuration is physically feasible."""
        # Calculate theoretical throughput
        swaps_per_hour = (3600 / self.swap_time_seconds) * self.charger_count
        
        # Estimate charge time (simplified linear)
        charge_time_hours = self.battery_config.capacity_kwh / self.charge_power_kw
        charges_per_hour = self.charger_count / charge_time_hours
        
        # Warn if inventory might bottleneck (not a hard error)
        if self.total_batteries < self.charger_count * 2:
            # Allow but this might cause stockouts
            pass
            
        return self


class CalibrationParams(BaseModel):
    """Parameters for tuning simulation to match historical data.
    
    Attributes:
        parking_delay_range: Random delay before swap (min, max seconds).
        charge_efficiency_factor: Ambient temperature impact on charging.
        arrival_jitter_std: Standard deviation of arrival time variance.
    """
    
    parking_delay_range: tuple[float, float] = Field(
        default=(5.0, 30.0),
        description="Random parking delay range in seconds"
    )
    charge_efficiency_factor: float = Field(
        default=0.95,
        ge=0.5,
        le=1.0,
        description="Charge speed modifier (temperature impact)"
    )
    arrival_jitter_std: float = Field(
        default=0.1,
        ge=0,
        le=0.5,
        description="Std deviation of arrival variance as fraction of mean"
    )


class DemandCurve(BaseModel):
    """Hourly demand profile for vehicle arrivals.
    
    Attributes:
        base_arrivals_per_hour: List of 24 values for each hour.
        multipliers: Optional per-hour multipliers (e.g., for festivals).
    """
    
    base_arrivals_per_hour: list[float] = Field(
        default_factory=lambda: [10.0] * 24,
        min_length=24,
        max_length=24,
        description="Base arrivals for each hour (0-23)"
    )
    multipliers: dict[int, float] = Field(
        default_factory=dict,
        description="Hour -> multiplier overrides"
    )
    
    def get_rate(self, hour: int) -> float:
        """Get arrival rate for a specific hour.
        
        Args:
            hour: Hour of day (0-23).
            
        Returns:
            float: Arrivals per hour for that time.
        """
        base = self.base_arrivals_per_hour[hour % 24]
        multiplier = self.multipliers.get(hour, 1.0)
        return base * multiplier


class Intervention(BaseModel):
    """A single scenario intervention for what-if testing.
    
    Attributes:
        type: Type of intervention.
        target_station_id: Station to modify (if applicable).
        parameters: Intervention-specific parameters.
    """
    
    type: InterventionType
    target_station_id: str | None = Field(
        default=None,
        description="Target station for station-specific interventions"
    )
    parameters: dict[str, Any] = Field(
        default_factory=dict,
        description="Intervention parameters"
    )
    
    @model_validator(mode="after")
    def validate_intervention_params(self) -> "Intervention":
        """Validate that required parameters are present for each type."""
        required_params: dict[InterventionType, list[str]] = {
            InterventionType.ADD_STATION: ["id", "location", "charger_count", "total_batteries"],
            InterventionType.REMOVE_STATION: [],
            InterventionType.MODIFY_CHARGERS: ["new_count"],
            InterventionType.MODIFY_INVENTORY: ["delta"],
            InterventionType.DEMAND_MULTIPLIER: ["multiplier"],
            InterventionType.POLICY_CHANGE: ["policy_name", "new_value"],
            InterventionType.INJECT_FAULT: ["fault_type", "duration_seconds"],
        }
        
        if self.type in (
            InterventionType.REMOVE_STATION,
            InterventionType.MODIFY_CHARGERS,
            InterventionType.MODIFY_INVENTORY,
            InterventionType.INJECT_FAULT,
        ):
            if not self.target_station_id:
                raise ValueError(f"{self.type} requires target_station_id")
        
        for param in required_params.get(self.type, []):
            if param not in self.parameters:
                raise ValueError(f"{self.type} requires parameter: {param}")
                
        return self


class ScenarioConfig(BaseModel):
    """Configuration for a what-if scenario experiment.
    
    Attributes:
        name: Human-readable scenario name.
        description: Detailed scenario description.
        base_scenario_id: Parent scenario for A/B comparison.
        interventions: List of changes to apply.
        demand_adjustments: Hour-specific demand multipliers.
    """
    
    name: str = Field(..., min_length=1, max_length=255, description="Scenario name")
    description: str = Field(default="", description="Scenario description")
    base_scenario_id: UUID | None = Field(
        default=None,
        description="Parent scenario ID for baseline comparison"
    )
    interventions: list[Intervention] = Field(
        default_factory=list,
        description="List of interventions to apply"
    )
    demand_adjustments: dict[int, float] = Field(
        default_factory=dict,
        description="Hour -> demand multiplier adjustments"
    )


class SimulationConfig(BaseModel):
    """Main configuration for running a simulation.
    
    Attributes:
        duration_days: Number of days to simulate.
        random_seed: Seed for reproducibility.
        demand_multiplier: Global demand scaling factor.
        stations: List of station configurations.
        demand_curve: Hourly arrival pattern.
        calibration: Parameters for baseline matching.
        scenario: Optional scenario configuration.
    """
    
    duration_days: int = Field(
        default=1,
        ge=1,
        le=30,
        description="Simulation duration in days"
    )
    random_seed: int = Field(
        default=42,
        ge=0,
        description="Random seed for reproducibility"
    )
    demand_multiplier: float = Field(
        default=1.0,
        gt=0,
        le=10.0,
        description="Global demand scaling factor"
    )
    stations: list[StationConfig] = Field(
        ...,
        min_length=1,
        description="Station configurations"
    )
    demand_curve: DemandCurve = Field(
        default_factory=DemandCurve,
        description="Hourly demand profile"
    )
    calibration: CalibrationParams = Field(
        default_factory=CalibrationParams,
        description="Calibration parameters"
    )
    scenario: ScenarioConfig | None = Field(
        default=None,
        description="Optional scenario for what-if analysis"
    )
    
    @field_validator("stations")
    @classmethod
    def validate_unique_station_ids(cls, v: list[StationConfig]) -> list[StationConfig]:
        """Ensure all station IDs are unique."""
        ids = [s.id for s in v]
        if len(ids) != len(set(ids)):
            raise ValueError("Station IDs must be unique")
        return v


# =============================================================================
# Output Schemas
# =============================================================================

class StationKPI(BaseModel):
    """KPI metrics for a single station.
    
    Attributes:
        station_id: Station identifier.
        total_swaps: Successful swaps completed.
        lost_swaps: Swaps lost due to stockout.
        avg_wait_time_seconds: Average customer wait time.
        max_wait_time_seconds: Maximum observed wait time.
        charger_utilization: Fraction of time chargers active (0-1).
        idle_inventory_pct: Average percentage of charged batteries unused.
        total_energy_kwh: Energy consumed for charging.
    """
    
    station_id: str
    total_swaps: int = Field(ge=0)
    lost_swaps: int = Field(ge=0)
    avg_wait_time_seconds: float = Field(ge=0)
    max_wait_time_seconds: float = Field(ge=0)
    charger_utilization: float = Field(ge=0, le=1)
    idle_inventory_pct: float = Field(ge=0, le=100)
    total_energy_kwh: float = Field(ge=0)
    peak_queue_length: int = Field(ge=0)


class BaselineComparison(BaseModel):
    """Comparison metrics between baseline and scenario.
    
    Attributes:
        wait_time_delta_pct: Percentage change in wait time.
        lost_swaps_delta: Absolute change in lost swaps.
        throughput_delta_pct: Percentage change in throughput.
        opex_delta: Change in operational cost.
        utilization_delta_pct: Change in charger utilization.
    """
    
    wait_time_delta_pct: float
    lost_swaps_delta: int
    throughput_delta_pct: float
    opex_delta: float
    utilization_delta_pct: float


class OpexBreakdown(BaseModel):
    """Detailed breakdown of operational expenses.
    
    Attributes:
        energy_cost: Cost of electricity.
        depreciation_cost: Battery degradation cost.
        logistics_cost: Fixed operational overhead.
        total: Sum of all components.
    """
    
    energy_cost: float = Field(ge=0)
    depreciation_cost: float = Field(ge=0)
    logistics_cost: float = Field(ge=0)
    total: float = Field(ge=0)


class SimulationResult(BaseModel):
    """Complete results from a simulation run.
    
    Attributes:
        run_id: Unique identifier for this run.
        scenario_name: Name of the scenario (or 'baseline').
        status: Completion status.
        duration_days: Simulated duration.
        compute_time_ms: Wall-clock execution time.
        
        city_total_swaps: Total successful swaps across network.
        city_lost_swaps: Total lost swaps (stockouts).
        city_avg_wait_time: Network-average wait time.
        city_throughput_per_hour: Average swaps per hour.
        
        total_energy_kwh: Total energy consumed.
        estimated_opex_cost: Estimated operational cost.
        avg_charger_utilization: Network average utilization.
        avg_idle_inventory_pct: Network average idle inventory.
        
        station_kpis: Per-station breakdown.
        baseline_comparison: Delta vs baseline (if applicable).
        
        started_at: Simulation start timestamp.
        completed_at: Simulation completion timestamp.
    """
    
    run_id: UUID
    scenario_name: str
    status: SimulationStatus
    duration_days: int
    compute_time_ms: int = Field(ge=0)
    
    # City-wide aggregates
    city_total_swaps: int = Field(ge=0)
    city_lost_swaps: int = Field(ge=0)
    city_avg_wait_time: float = Field(ge=0)
    city_throughput_per_hour: float = Field(ge=0)
    
    # Operational metrics
    total_energy_kwh: float = Field(ge=0)
    estimated_opex_cost: float = Field(ge=0)
    avg_charger_utilization: float = Field(ge=0, le=1)
    avg_idle_inventory_pct: float = Field(ge=0, le=100)
    
    # Breakdown
    station_kpis: list[StationKPI]
    baseline_comparison: BaselineComparison | None = None
    opex_breakdown: OpexBreakdown | None = None
    
    # Timestamps
    started_at: datetime
    completed_at: datetime


class TelemetryEvent(BaseModel):
    """A single telemetry event from simulation.
    
    Attributes:
        time: Event timestamp in simulation time.
        run_id: Simulation run identifier.
        entity_id: Entity that generated the event.
        event_type: Type of event.
        meta_data: Event-specific data.
    """
    
    time: datetime
    run_id: UUID
    entity_id: str
    event_type: EventType
    meta_data: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    """Error response for API failures.
    
    Attributes:
        error: Error type/code.
        message: Human-readable error message.
        detail: Optional detailed information.
        traceback: Stack trace (only in debug mode).
    """
    
    error: str
    message: str
    detail: str | None = None
    traceback: str | None = None
