"""Centralized audit logging. Every state-changing operation logs here."""
from enum import Enum as PyEnum
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog


def model_snapshot(obj) -> dict | None:
    """Serialize a SQLAlchemy row to a JSON-safe dict for before/after capture."""
    if obj is None:
        return None
    result = {}
    for attr in sa_inspect(type(obj)).mapper.column_attrs:
        val = getattr(obj, attr.key, None)
        if hasattr(val, "isoformat"):       # datetime / date
            val = val.isoformat()
        elif isinstance(val, PyEnum):
            val = val.value
        result[attr.key] = val
    return result


class AuditService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def log(
        self,
        *,
        action: str,                            # CREATE | UPDATE | DELETE | CANCEL | APPROVE | ...
        resource_type: str,                     # DB table name
        resource_id: str | int | None = None,   # PK of affected row
        doc_number: str | None = None,          # human-readable ref (invoice_number, po_number …)
        user_id: int | None = None,
        user_email: str | None = None,
        user_role: str | None = None,
        tenant_id: int | None = None,
        before: dict | None = None,
        after: dict | None = None,
        description: str | None = None,
        ip_address: str | None = None,
        http_method: str | None = None,
        endpoint: str | None = None,
        status: str = "SUCCESS",
    ) -> None:
        if description is None and doc_number:
            description = f"{action} {resource_type} {doc_number}"

        entry = AuditLog(
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            user_id=user_id,
            user_email=user_email,
            user_role=user_role,
            tenant_id=tenant_id,
            before_state=before,
            after_state=after,
            description=description,
            ip_address=ip_address,
            http_method=http_method,
            endpoint=endpoint,
            status=status,
        )
        self.db.add(entry)
        # Flushed inside the caller's transaction — commits with the main operation.
        # If the main operation rolls back, the audit entry rolls back too.
        await self.db.flush()
