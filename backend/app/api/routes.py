"""FastAPI routes for simulation API.

This module defines the REST API endpoints for:
- Starting simulations
- Retrieving simulation results
- Health checks
"""

import traceback
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.connection import check_db_connection, get_db, get_db_stats
from app.schemas.sim_config import (ErrorResponse, SimulationConfig,
                                    SimulationResult, SimulationStatus)
from app.simulation.engine import SimulationOrchestrator, compare_results
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, Any]:
    """Health check endpoint.

    Returns:
        dict: Health status including database connectivity.
    """
    db_healthy = check_db_connection()

    return {
        "status": "healthy" if db_healthy else "degraded",
        "version": settings.app_version,
        "environment": settings.environment,
        "database": "connected" if db_healthy else "disconnected",
    }


@router.get("/stats")
async def get_stats() -> dict[str, Any]:
    """Get system statistics.

    Returns:
        dict: Database pool stats and system info.
    """
    return {
        "database_pool": get_db_stats(),
        "settings": {
            "max_duration_days": settings.simulation_max_duration_days,
            "default_seed": settings.simulation_default_seed,
        },
    }


@router.get("/stations")
async def get_stations() -> list[dict[str, Any]]:
    """Get all stations loaded from real data.

    Loads station data from Partners.xlsx, enriched with inventory
    from BatteryLogs.xlsx if available.

    Returns:
        list: List of station configurations with id, name, location, etc.
    """
    from app.data_loader import load_real_network

    stations, _ = load_real_network()
    logger.info("stations_endpoint_called", station_count=len(stations))
    return stations


@router.post(
    "/start",
    response_model=SimulationResult,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid configuration"},
        500: {"model": ErrorResponse, "description": "Simulation failed"},
    },
)
async def start_simulation(
    config: SimulationConfig,
    db: Session = Depends(get_db),
) -> SimulationResult:
    """Execute a simulation and return aggregated results.

    This endpoint runs the simulation in headless mode (synchronously)
    and returns the complete results including all KPIs.

    Args:
        config: Complete simulation configuration.
        db: Database session (injected).

    Returns:
        SimulationResult: Aggregated KPIs and station metrics.

    Raises:
        HTTPException: 400 if config invalid, 500 if simulation fails.

    Example:
        ```json
        POST /start
        {
            "duration_days": 1,
            "random_seed": 42,
            "demand_multiplier": 1.0,
            "stations": [
                {
                    "id": "station_01",
                    "location": {"lat": 28.6139, "lon": 77.2090},
                    "total_batteries": 20,
                    "charger_count": 4
                }
            ]
        }
        ```
    """
    # Validate duration against max
    if config.duration_days > settings.simulation_max_duration_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Duration exceeds maximum of {settings.simulation_max_duration_days} days",
        )

    logger.info(
        "simulation_requested",
        duration_days=config.duration_days,
        station_count=len(config.stations),
        scenario=config.scenario.name if config.scenario else None,
    )

    try:
        # Create and run orchestrator
        orchestrator = SimulationOrchestrator(config)
        result = orchestrator.run()

        logger.info(
            "simulation_success",
            run_id=str(result.run_id),
            total_swaps=result.city_total_swaps,
            lost_swaps=result.city_lost_swaps,
            compute_time_ms=result.compute_time_ms,
        )

        return result

    except ValueError as e:
        logger.error("simulation_config_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    except RuntimeError as e:
        logger.exception("simulation_runtime_error", error=str(e))
        error_detail = str(e)
        if settings.debug:
            error_detail += f"\n\nTraceback:\n{traceback.format_exc()}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail,
        ) from e

    except Exception as e:
        logger.exception("simulation_unexpected_error", error=str(e))
        error_response = ErrorResponse(
            error="SimulationError",
            message="An unexpected error occurred during simulation",
            detail=str(e),
            traceback=traceback.format_exc() if settings.debug else None,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump(),
        ) from e


@router.post(
    "/compare",
    response_model=SimulationResult,
    status_code=status.HTTP_200_OK,
)
async def compare_scenarios(
    baseline_config: SimulationConfig,
    scenario_config: SimulationConfig,
) -> SimulationResult:
    """Run baseline and scenario simulations and compare results.

    Executes both configurations with the same random seed for
    fair comparison, then returns the scenario results with
    baseline comparison metrics.

    Args:
        baseline_config: Baseline configuration (no interventions).
        scenario_config: Scenario with interventions to test.

    Returns:
        SimulationResult: Scenario results with baseline comparison.
    """
    logger.info(
        "comparison_requested",
        baseline_stations=len(baseline_config.stations),
        scenario_name=(
            scenario_config.scenario.name if scenario_config.scenario else "unnamed"
        ),
    )

    # Ensure same seed for fair comparison
    baseline_config.random_seed = scenario_config.random_seed

    try:
        # Run baseline
        baseline_orchestrator = SimulationOrchestrator(baseline_config)
        baseline_result = baseline_orchestrator.run()

        # Run scenario
        scenario_orchestrator = SimulationOrchestrator(scenario_config)
        scenario_result = scenario_orchestrator.run()

        # Calculate comparison
        comparison = compare_results(baseline_result, scenario_result)

        # Attach comparison to scenario result
        scenario_result.baseline_comparison = comparison

        logger.info(
            "comparison_complete",
            wait_time_delta=comparison.wait_time_delta_pct,
            lost_swaps_delta=comparison.lost_swaps_delta,
        )

        return scenario_result

    except Exception as e:
        logger.exception("comparison_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e


@router.get("/example-config")
async def get_example_config() -> dict[str, Any]:
    """Get an example simulation configuration.

    Returns a sample configuration that can be used as a template
    for the POST /start endpoint.

    Returns:
        dict: Example SimulationConfig as JSON.
    """
    return {
        "duration_days": 1,
        "random_seed": 42,
        "demand_multiplier": 1.0,
        "stations": [
            {
                "id": "station_downtown",
                "name": "Downtown Hub",
                "location": {"lat": 28.6139, "lon": 77.2090},
                "total_batteries": 25,
                "charger_count": 6,
                "charge_power_kw": 60.0,
                "swap_time_seconds": 90,
                "cooldown_seconds": 60,
            },
            {
                "id": "station_sector5",
                "name": "Sector 5 Station",
                "location": {"lat": 28.5900, "lon": 77.2100},
                "total_batteries": 15,
                "charger_count": 4,
                "charge_power_kw": 60.0,
                "swap_time_seconds": 90,
            },
        ],
        "demand_curve": {
            "base_arrivals_per_hour": [
                5,
                3,
                2,
                2,
                3,
                6,  # 0-5 (night/early morning)
                12,
                25,
                35,
                30,
                25,
                20,  # 6-11 (morning rush)
                15,
                18,
                20,
                22,
                28,
                40,  # 12-17 (afternoon/evening start)
                45,
                38,
                25,
                15,
                10,
                7,  # 18-23 (evening rush/night)
            ],
            "multipliers": {},
        },
        "scenario": {
            "name": "diwali_surge_test",
            "description": "Testing network under Diwali festival demand surge",
            "interventions": [
                {
                    "type": "DEMAND_MULTIPLIER",
                    "parameters": {
                        "multiplier": 1.4,
                        "scope": "global",
                    },
                },
            ],
            "demand_adjustments": {
                "18": 1.6,
                "19": 1.8,
                "20": 1.5,
            },
        },
    }
