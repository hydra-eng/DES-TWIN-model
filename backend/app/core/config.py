"""Application configuration using Pydantic Settings.

This module provides centralized configuration management with environment
variable support and validation.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support.

    Attributes:
        app_name: Name of the application.
        app_version: Current version string.
        debug: Enable debug mode for verbose logging.
        environment: Deployment environment (development, staging, production).

        database_url: PostgreSQL/TimescaleDB connection string.
        redis_url: Redis connection string for job queue.

        simulation_max_duration_days: Maximum allowed simulation duration.
        simulation_default_seed: Default random seed for reproducibility.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "Digital Twin Swap Station"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: Literal["development", "staging", "production"] = "development"

    # Database
    database_url: PostgresDsn = Field(
        default="postgresql://swap_admin:swap_secret_2024@localhost:5432/swap_station_twin",
        description="TimescaleDB connection string",
    )

    # Redis
    redis_url: RedisDsn = Field(
        default="redis://localhost:6379/0",
        description="Redis connection for job queue",
    )

    # Simulation Constraints
    simulation_max_duration_days: int = Field(
        default=30,
        ge=1,
        le=365,
        description="Maximum simulation duration in days",
    )
    simulation_default_seed: int = Field(
        default=42,
        description="Default random seed for reproducibility",
    )
    simulation_time_resolution_ms: int = Field(
        default=1,
        description="Simulation time resolution in milliseconds",
    )

    # Performance
    telemetry_batch_size: int = Field(
        default=100,
        ge=10,
        le=1000,
        description="Number of events to batch before DB insert",
    )

    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL string."""
        return str(self.database_url)

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings.

    Returns:
        Settings: Application configuration instance.
    """
    return Settings()
