from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import SuperAdmin, require_super_admin
from app.models.logging import ErrorLog

router = APIRouter(prefix="/error-logs", tags=["Error Logs"])

DB = Depends(get_db)


# ── Schemas ───────────────────────────────────────────────────────────────────

class ErrorLogResponse(BaseModel):
    id:                int
    error_code:        Optional[str]
    error_type:        Optional[str]
    error_message:     str
    error_stack_trace: Optional[str]
    service_name:      Optional[str]
    function_name:     Optional[str]
    file_path:         Optional[str]
    line_number:       Optional[int]
    user_id:           Optional[int]
    request_id:        Optional[str]
    endpoint:          Optional[str]
    http_method:       Optional[str]
    ip_address:        Optional[str]
    entity_type:       Optional[str]
    entity_id:         Optional[int]
    severity:          Optional[str]
    is_resolved:       bool
    resolved_date:     Optional[datetime]
    resolution_notes:  Optional[str]
    resolved_by:       Optional[int]
    created_date:      datetime

    model_config = {"from_attributes": True}


class ResolveRequest(BaseModel):
    resolution_notes: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=dict)
async def list_error_logs(
    page:         int           = Query(1, ge=1),
    size:         int           = Query(50, ge=1, le=200),
    severity:     Optional[str] = Query(None, description="INFO|WARNING|ERROR|CRITICAL"),
    service_name: Optional[str] = Query(None),
    is_resolved:  Optional[bool]= Query(None),
    from_date:    Optional[str] = Query(None, description="YYYY-MM-DD"),
    to_date:      Optional[str] = Query(None, description="YYYY-MM-DD"),
    current_user: SuperAdmin    = Depends(require_super_admin),
    db: AsyncSession = DB,
):
    stmt = select(ErrorLog)
    if severity:
        stmt = stmt.where(ErrorLog.severity == severity.upper())
    if service_name:
        stmt = stmt.where(ErrorLog.service_name == service_name)
    if is_resolved is not None:
        stmt = stmt.where(ErrorLog.is_resolved == is_resolved)
    if from_date:
        stmt = stmt.where(ErrorLog.created_date >= from_date)
    if to_date:
        stmt = stmt.where(ErrorLog.created_date <= to_date + "T23:59:59")

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    stmt  = stmt.order_by(desc(ErrorLog.created_date)).offset((page - 1) * size).limit(size)
    items = (await db.execute(stmt)).scalars().all()

    return {
        "items": [ErrorLogResponse.model_validate(r) for r in items],
        "total": total,
        "page":  page,
        "size":  size,
        "pages": (total + size - 1) // size if total else 0,
        "unresolved": (await db.execute(
            select(func.count()).where(ErrorLog.is_resolved == False)
        )).scalar_one(),
    }


@router.get("/summary", response_model=dict)
async def error_log_summary(
    current_user: SuperAdmin = Depends(require_super_admin),
    db: AsyncSession = DB,
):
    """Counts grouped by severity for dashboard widgets."""
    rows = (await db.execute(
        select(ErrorLog.severity, func.count().label("count"))
        .where(ErrorLog.is_resolved == False)
        .group_by(ErrorLog.severity)
    )).all()
    return {"by_severity": {r.severity or "UNKNOWN": r.count for r in rows}}


@router.get("/{log_id}", response_model=ErrorLogResponse)
async def get_error_log(
    log_id: int,
    current_user: SuperAdmin = Depends(require_super_admin),
    db: AsyncSession = DB,
):
    entry = await db.get(ErrorLog, log_id)
    if not entry:
        raise HTTPException(404, "Error log not found")
    return entry


@router.patch("/{log_id}/resolve", response_model=ErrorLogResponse)
async def resolve_error_log(
    log_id: int,
    body:   ResolveRequest,
    current_user: SuperAdmin = Depends(require_super_admin),
    db: AsyncSession = DB,
):
    entry = await db.get(ErrorLog, log_id)
    if not entry:
        raise HTTPException(404, "Error log not found")
    entry.is_resolved      = True
    entry.resolved_date    = datetime.utcnow()
    entry.resolved_by      = current_user.id
    entry.resolution_notes = body.resolution_notes
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/{log_id}", status_code=204)
async def delete_error_log(
    log_id: int,
    current_user: SuperAdmin = Depends(require_super_admin),
    db: AsyncSession = DB,
):
    entry = await db.get(ErrorLog, log_id)
    if not entry:
        raise HTTPException(404, "Error log not found")
    await db.delete(entry)
    await db.commit()
