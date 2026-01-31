"""SQLAlchemy models for TimescaleDB persistence.

This module defines the database models for:
- TelemetryEvent: Hypertable for time-series simulation events
- SimulationRun: Individual simulation execution records
- Scenario: What-if scenario configurations
- Station: Station configuration storage
"""

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    
    type_annotation_map = {
        dict[str, Any]: JSONB,
    }


class Scenario(Base):
    """What-if scenario configuration storage.
    
    Stores scenario configurations for reproducibility and A/B testing.
    Supports parent-child relationships for scenario comparison.
    
    Attributes:
        id: Unique scenario identifier.
        name: Human-readable scenario name.
        description: Detailed scenario description.
        parent_scenario_id: Reference to baseline scenario for comparison.
        config_json: Complete scenario configuration as JSONB.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
    """
    
    __tablename__ = "scenarios"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_scenario_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("scenarios.id"),
        nullable=True,
    )
    config_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    # Relationships
    parent_scenario: Mapped["Scenario | None"] = relationship(
        "Scenario",
        remote_side=[id],
        backref="child_scenarios",
    )
    simulation_runs: Mapped[list["SimulationRun"]] = relationship(
        "SimulationRun",
        back_populates="scenario",
    )
    
    def __repr__(self) -> str:
        return f"<Scenario(id={self.id}, name='{self.name}')>"


class SimulationRun(Base):
    """Individual simulation execution record.
    
    Tracks the lifecycle and results of a single simulation run.
    
    Attributes:
        id: Unique run identifier.
        scenario_id: Reference to scenario configuration.
        status: Current run status (PENDING, RUNNING, COMPLETED, FAILED).
        started_at: Execution start timestamp.
        completed_at: Execution completion timestamp.
        compute_time_ms: Wall-clock execution time in milliseconds.
        result_summary: Aggregated results as JSONB.
        error_message: Error details if run failed.
        created_at: Record creation timestamp.
    """
    
    __tablename__ = "simulation_runs"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    scenario_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("scenarios.id"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="PENDING",
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    compute_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result_summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    
    # Relationships
    scenario: Mapped["Scenario | None"] = relationship(
        "Scenario",
        back_populates="simulation_runs",
    )
    telemetry_events: Mapped[list["TelemetryEvent"]] = relationship(
        "TelemetryEvent",
        back_populates="simulation_run",
        cascade="all, delete-orphan",
    )
    
    def __repr__(self) -> str:
        return f"<SimulationRun(id={self.id}, status='{self.status}')>"


class TelemetryEvent(Base):
    """Time-series event log for simulation telemetry.
    
    This table is configured as a TimescaleDB hypertable for efficient
    time-series storage and querying. Events are partitioned by time.
    
    Attributes:
        time: Event timestamp (primary key component).
        run_id: Reference to simulation run.
        entity_id: Entity that generated the event (station, battery, vehicle).
        event_type: Type of event (SWAP_START, CHARGE_COMPLETE, etc.).
        meta_data: Event-specific data as JSONB.
    
    Note:
        The composite primary key (time, run_id, entity_id, event_type) enables
        efficient querying by time range while maintaining uniqueness.
    """
    
    __tablename__ = "telemetry_events"
    
    time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        primary_key=True,
        nullable=False,
    )
    run_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("simulation_runs.id"),
        primary_key=True,
        nullable=False,
    )
    entity_id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(
        String(32),
        primary_key=True,
        nullable=False,
    )
    meta_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    
    # Relationships
    simulation_run: Mapped["SimulationRun"] = relationship(
        "SimulationRun",
        back_populates="telemetry_events",
    )
    
    def __repr__(self) -> str:
        return (
            f"<TelemetryEvent(time={self.time}, "
            f"entity_id='{self.entity_id}', "
            f"event_type='{self.event_type}')>"
        )


class StationModel(Base):
    """Station configuration storage.
    
    Persists station configurations for reference and replay.
    
    Attributes:
        id: Unique station identifier.
        name: Display name.
        location_lat: Latitude coordinate.
        location_lon: Longitude coordinate.
        total_batteries: Battery inventory count.
        charger_count: Number of charging bays.
        charge_power_kw: Charger power output.
        swap_time_seconds: Swap duration.
        grid_power_limit_kw: Maximum grid power draw.
        is_active: Whether station is currently active.
        created_at: Record creation timestamp.
        updated_at: Last update timestamp.
    """
    
    __tablename__ = "stations"
    
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location_lat: Mapped[float] = mapped_column(Float, nullable=False)
    location_lon: Mapped[float] = mapped_column(Float, nullable=False)
    total_batteries: Mapped[int] = mapped_column(Integer, nullable=False)
    charger_count: Mapped[int] = mapped_column(Integer, nullable=False)
    charge_power_kw: Mapped[float] = mapped_column(Float, nullable=False)
    swap_time_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    grid_power_limit_kw: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    def __repr__(self) -> str:
        return f"<StationModel(id='{self.id}', name='{self.name}')>"
