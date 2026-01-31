"""Database connection and session management.

This module provides:
- Database engine configuration for TimescaleDB
- Session factory for request-scoped sessions
- Dependency injection for FastAPI routes
"""

from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models import Base
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

logger = get_logger(__name__)

# Get settings
settings = get_settings()

# Create engine with connection pooling
engine = create_engine(
    settings.database_url_sync,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    echo=settings.debug,
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for database sessions.

    Provides a request-scoped database session that is automatically
    closed after the request completes.

    Yields:
        Session: SQLAlchemy session instance.

    Example:
        >>> @router.get("/items")
        >>> async def get_items(db: Session = Depends(get_db)):
        ...     return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """Context manager for database sessions.

    Use this for non-FastAPI contexts (e.g., background tasks).

    Yields:
        Session: SQLAlchemy session instance.

    Example:
        >>> with get_db_session() as db:
        ...     db.query(Model).all()
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db() -> None:
    """Initialize database tables.

    Creates all tables defined in the models if they don't exist.
    Note: For production, use Alembic migrations instead.
    """
    logger.info("Initializing database tables")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")


def check_db_connection() -> bool:
    """Check if database connection is healthy.

    Returns:
        bool: True if connection successful, False otherwise.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error("Database connection check failed", error=str(e))
        return False


def get_db_stats() -> dict[str, Any]:
    """Get database connection pool statistics.

    Returns:
        dict: Connection pool metrics.
    """
    pool = engine.pool
    return {
        "pool_size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
    }
