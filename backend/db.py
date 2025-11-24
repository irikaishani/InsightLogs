"""Database engine and session factory for the backend.

This version reads the connection string from the DATABASE_URL env var (used in Render),
ensures SSL is enabled for Postgres, and falls back to a local SQLite file for development.
It also exposes SessionLocal, Base (declarative base) and a FastAPI-compatible
`get_db()` dependency generator.

Save as: backend/db.py
"""
from __future__ import annotations
import os
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


def _ensure_postgres_ssl(database_url: str) -> str:
    """If the URL looks like Postgres and doesn't already include sslmode, add sslmode=require.

    Handles existing query parameters correctly.
    """
    if not database_url:
        return database_url

    lower = database_url.lower()
    if lower.startswith("postgresql://") or lower.startswith("postgres://"):
        # If sslmode already present, return unchanged
        if "sslmode=" in database_url:
            return database_url
        # Append sslmode=require preserving any existing query string
        parsed = urlparse(database_url)
        qs = parse_qs(parsed.query)
        qs["sslmode"] = ["require"]
        new_query = urlencode(qs, doseq=True)
        new = parsed._replace(query=new_query)
        return urlunparse(new)

    return database_url


# Read DATABASE_URL from environment, fallback to a local sqlite file for dev
_default_sqlite_path = os.path.join(os.path.dirname(__file__), "..", "auth_users.db")
DEFAULT_SQLITE_URL = f"sqlite:///{os.path.abspath(_default_sqlite_path)}"

DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("DB_URL") or DEFAULT_SQLITE_URL

# Normalize old-style postgres scheme to SQLAlchemy-friendly form
# (Render may provide `postgres://...` which SQLAlchemy prefers `postgresql://...`)
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# If using Postgres on Render, ensure SSL is required
DATABASE_URL = _ensure_postgres_ssl(DATABASE_URL)

# SQLAlchemy engine options
engine_kwargs = {
    "future": True,
    "pool_pre_ping": True,
}

# SQLite specific connect args
if DATABASE_URL.startswith("sqlite"):
    # `check_same_thread` is required for SQLite when using the same connection across threads
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, **engine_kwargs)
else:
    engine = create_engine(DATABASE_URL, **engine_kwargs)

# Session factory and Base
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


# FastAPI dependency - yields a session and ensures it is closed after use
def get_db():
    """FastAPI dependency that yields a SQLAlchemy session.

    Usage in a FastAPI route:

    from fastapi import Depends
    from .db import get_db

    @app.get("/items")
    def read_items(db: Session = Depends(get_db)):
        ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
