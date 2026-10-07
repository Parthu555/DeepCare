"""
Database engine and session configuration using SQLAlchemy.
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import StaticPool

from app.core.config import settings


def get_engine_kwargs() -> dict:
    """Build engine kwargs based on environment."""
    kwargs: dict = {
        "pool_pre_ping": True,
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
    }
    if "sqlite" in settings.DATABASE_URL:
        # For test/CI use only
        kwargs = {
            "connect_args": {"check_same_thread": False},
            "poolclass": StaticPool,
        }
    return kwargs


engine = create_engine(settings.DATABASE_URL, **get_engine_kwargs())

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables with PostgreSQL advisory lock to prevent concurrent worker races."""
    from app.models import user  # noqa: F401
    
    if "postgresql" in settings.DATABASE_URL or engine.dialect.name == "postgresql":
        with engine.connect() as conn:
            with conn.begin():
                # Advisory lock id: 729104812
                conn.exec_driver_sql("SELECT pg_advisory_xact_lock(729104812)")
                Base.metadata.create_all(bind=conn)
    else:
        Base.metadata.create_all(bind=engine)
