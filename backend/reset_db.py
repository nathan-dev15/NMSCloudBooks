"""
DEV-ONLY: Drop all tables and recreate them fresh.
Run this if you see 500 errors caused by schema mismatch
(e.g., 'column created_date does not exist').

Usage:
    cd backend
    python reset_db.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
import app.models  # noqa: F401 — registers all ORM models with Base.metadata
from app.core.database import Base


async def reset():
    from sqlalchemy import text
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        print("Dropping schema (CASCADE)...")
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO postgres"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
        print("Recreating all tables with current schema...")
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("\nDone. Run the app and call POST /api/v1/auth/setup to create the first admin.")


if __name__ == "__main__":
    asyncio.run(reset())
