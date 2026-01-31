"""FastAPI application entrypoint.

This module creates and configures the FastAPI application with:
- CORS middleware
- Exception handlers
- Router registration
- Startup/shutdown events
"""

from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router as sim_router
from app.api.endpoints.optimization import router as opt_router
from app.core.config import get_settings
from app.core.logging import setup_logging, get_logger
from app.db.connection import check_db_connection

# Initialize logging
setup_logging()
logger = get_logger(__name__)

# Get settings
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager.
    
    Handles startup and shutdown events.
    
    Args:
        app: FastAPI application instance.
    """
    # Startup
    logger.info(
        "application_starting",
        app_name=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
    )
    
    # Check database connection
    if check_db_connection():
        logger.info("database_connected")
    else:
        logger.warning("database_connection_failed")
    
    yield
    
    # Shutdown
    logger.info("application_shutting_down")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="""
    Digital Twin Swap Station Sandbox API
    
    This API provides endpoints for running discrete-event simulations
    of a battery swap station network. It supports:
    
    - **Baseline simulations**: Run simulations with default configurations
    - **What-if scenarios**: Test interventions like adding stations or changing demand
    - **A/B comparisons**: Compare scenario results against baseline
    
    ## Key Features
    
    - SimPy-based discrete event simulation
    - Non-homogeneous Poisson arrival process
    - Full KPI calculation (wait times, lost swaps, utilization)
    - Scenario intervention support
    """,
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.debug else ["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    """Handle HTTP exceptions with consistent format."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTPException",
            "message": str(exc.detail),
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Handle unexpected exceptions."""
    logger.exception("unhandled_exception", error=str(exc))
    
    content: dict[str, Any] = {
        "error": "InternalServerError",
        "message": "An unexpected error occurred",
    }
    
    if settings.debug:
        import traceback
        content["detail"] = str(exc)
        content["traceback"] = traceback.format_exc()
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=content,
    )


# Register routers
app.include_router(sim_router, prefix="/api/v1", tags=["simulation"])
app.include_router(opt_router, prefix="/api/v1/optimization", tags=["optimization"])


# Root endpoint
@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint with API information."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/v1/health",
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info",
    )
