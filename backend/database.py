"""database.py — Async SQLAlchemy engine setup"""
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./anzen.db")

# Auto-convert asyncpg to psycopg so the environment variable doesn't need to change
if DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg://")

# aiosqlite does not use check_same_thread (it runs in a background thread internally).
# Only pass it for synchronous sqlite3 dialects.
_connect_args = {}
if "sqlite" in DATABASE_URL and "aiosqlite" not in DATABASE_URL:
    _connect_args = {"check_same_thread": False}


engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args=_connect_args,
    pool_pre_ping=True,  # Recommended for connection pools
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
