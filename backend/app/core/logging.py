"""Structured logging configuration using structlog.

This module configures structured JSON logging for production and
pretty-printed console logging for development.
"""

import logging
import sys
from typing import Any

import structlog
from structlog.types import Processor

from app.core.config import get_settings


def setup_logging() -> None:
    """Configure structured logging based on environment.
    
    In development: Pretty-printed colored console output.
    In production: JSON-formatted logs for aggregation.
    """
    settings = get_settings()
    
    # Shared processors for all environments
    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]
    
    if settings.is_production:
        # Production: JSON output
        processors: list[Processor] = [
            *shared_processors,
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Development: Pretty console output
        processors = [
            *shared_processors,
            structlog.dev.ConsoleRenderer(colors=True),
        ]
    
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    # Configure standard library logging to use structlog
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.DEBUG if settings.debug else logging.INFO,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance.
    
    Args:
        name: Logger name, typically __name__ of the module.
        
    Returns:
        BoundLogger: Configured structured logger.
    """
    return structlog.get_logger(name)


def log_simulation_event(
    logger: structlog.stdlib.BoundLogger,
    event_type: str,
    entity_id: str,
    sim_time: float,
    **kwargs: Any,
) -> None:
    """Log a simulation event with standard fields.
    
    Args:
        logger: Logger instance to use.
        event_type: Type of simulation event (e.g., SWAP_START).
        entity_id: ID of the entity (station, battery, vehicle).
        sim_time: Simulation time in seconds.
        **kwargs: Additional event-specific data.
    """
    logger.info(
        "simulation_event",
        event_type=event_type,
        entity_id=entity_id,
        sim_time=sim_time,
        **kwargs,
    )
