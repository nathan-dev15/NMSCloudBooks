"""
Business rule: only the most-recently-created active document can be deleted.
All other records must be Cancelled instead.
"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession


async def assert_is_latest(
    db: AsyncSession,
    model,
    record_id: int,
    tenant_id: int | None,
    label: str = "record",
) -> None:
    """
    Raise ValueError unless record_id equals the highest non-deleted id
    for this tenant. Callers catch ValueError and return HTTP 400.
    """
    stmt = select(func.max(model.id)).where(model.is_deleted == False)
    if tenant_id is not None and hasattr(model, "tenant_id"):
        stmt = stmt.where(model.tenant_id == tenant_id)

    max_id = (await db.execute(stmt)).scalar_one_or_none()
    if max_id is None or max_id != record_id:
        raise ValueError(
            f"Only the latest {label} (#{max_id}) can be deleted. "
            f"To remove #{record_id}, use the Cancel option instead."
        )
