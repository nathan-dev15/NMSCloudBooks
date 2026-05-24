from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import (
    CurrentUser, AdminOrAbove, PrimaryOrAbove,
    get_current_user, require_admin_or_above, require_primary_or_above,
)
from app.models.user import UserRole
from app.repositories.purchase_order_repository import PurchaseOrderRepository
from app.services.export_service import ExportService
from app.schemas.purchase_order import (
    POCreate, POUpdate, POResponse, POListItem, PaginatedPOs,
    POStatusUpdate, POReceive,
)

router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders"])

DB = Depends(get_db)


def _repo(db: AsyncSession = DB) -> PurchaseOrderRepository:
    return PurchaseOrderRepository(db)


def _tenant(user: CurrentUser) -> Optional[int]:
    return None if user.role == UserRole.SUPER_ADMIN else user.tenant_id


# ── List & Create ─────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedPOs)
async def list_pos(
    page:       int           = Query(1, ge=1),
    size:       int           = Query(20, ge=1, le=100),
    # Single keyword search
    search:     Optional[str] = Query(None, description="Keyword search across PO number, vendor, reference"),
    # Multi-keyword: comma-separated terms
    multi_q:    Optional[str] = Query(None, description="Comma-separated keywords (AND logic)"),
    # Dropdown filters
    status:     Optional[str] = Query(None),
    statuses:   Optional[str] = Query(None, description="Comma-separated statuses"),
    priority:   Optional[str] = Query(None),
    priorities: Optional[str] = Query(None, description="Comma-separated priorities"),
    vendor_id:  Optional[int] = Query(None),
    # Date range
    from_date:  Optional[str] = Query(None),
    to_date:    Optional[str] = Query(None),
    current_user: CurrentUser         = Depends(get_current_user),
    repo:         PurchaseOrderRepository = Depends(_repo),
):
    multi_q_list    = [t for t in multi_q.split(",") if t.strip()] if multi_q else None
    statuses_list   = [s.strip() for s in statuses.split(",") if s.strip()] if statuses else None
    priorities_list = [p.strip() for p in priorities.split(",") if p.strip()] if priorities else None

    items, total = await repo.list(
        tenant_id=_tenant(current_user),
        page=page, size=size,
        search=search,
        multi_q=multi_q_list,
        status=status,
        statuses=statuses_list,
        priority=priority,
        priorities=priorities_list,
        vendor_id=vendor_id,
        from_date=from_date,
        to_date=to_date,
    )
    return PaginatedPOs(
        items=items, total=total, page=page, size=size,
        pages=PurchaseOrderRepository.pages(total, size),
    )


@router.post("", response_model=POResponse, status_code=status.HTTP_201_CREATED)
async def create_po(
    data: POCreate,
    current_user: PrimaryOrAbove      = Depends(require_primary_or_above),
    repo:         PurchaseOrderRepository = Depends(_repo),
):
    return await repo.create(
        tenant_id=current_user.tenant_id or 1,
        created_by_id=current_user.id,
        data=data,
    )


# ── Filter options (for cascading dropdowns) ──────────────────────────────────

@router.get("/filter-options")
async def po_filter_options(
    current_user: CurrentUser         = Depends(get_current_user),
    repo:         PurchaseOrderRepository = Depends(_repo),
):
    """Returns distinct statuses and priorities for dropdown filters."""
    return await repo.filter_options(_tenant(current_user))


# ── Export (list) ─────────────────────────────────────────────────────────────

@router.get("/export", response_class=StreamingResponse)
async def export_pos(
    fmt:      str           = Query("csv", enum=["csv", "excel"]),
    search:   Optional[str] = Query(None),
    status:   Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    current_user: PrimaryOrAbove          = Depends(require_primary_or_above),
    repo:         PurchaseOrderRepository = Depends(_repo),
):
    items, _ = await repo.list(
        tenant_id=_tenant(current_user),
        page=1, size=10_000,
        search=search, status=status,
        from_date=from_date, to_date=to_date,
    )
    return ExportService.pos_list(items, fmt)


# ── Single PO ─────────────────────────────────────────────────────────────────

@router.get("/{po_id}", response_model=POResponse)
async def get_po(
    po_id: int,
    current_user: CurrentUser         = Depends(get_current_user),
    repo:         PurchaseOrderRepository = Depends(_repo),
):
    po = await repo.get(po_id, _tenant(current_user))
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po


@router.put("/{po_id}", response_model=POResponse)
async def update_po(
    po_id: int,
    data: POUpdate,
    current_user: PrimaryOrAbove      = Depends(require_primary_or_above),
    repo:         PurchaseOrderRepository = Depends(_repo),
):
    po = await repo.get(po_id, _tenant(current_user))
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    try:
        return await repo.update(po, data, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{po_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_po(
    po_id: int,
    current_user: AdminOrAbove        = Depends(require_admin_or_above),
    repo:         PurchaseOrderRepository = Depends(_repo),
):
    """Only the LATEST purchase order can be deleted. Cancel all others."""
    try:
        ok = await repo.soft_delete(po_id, _tenant(current_user), user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="Purchase order not found")


# ── Cancel (alternative to deletion) ─────────────────────────────────────────

@router.post("/{po_id}/cancel", response_model=POResponse)
async def cancel_po(
    po_id: int,
    current_user: PrimaryOrAbove      = Depends(require_primary_or_above),
    repo:         PurchaseOrderRepository = Depends(_repo),
):
    """Cancel a PO without deleting it. Allowed for any non-latest PO."""
    po = await repo.get(po_id, _tenant(current_user))
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    try:
        return await repo.cancel(po, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Download single PO as PDF ─────────────────────────────────────────────────

@router.get("/{po_id}/download", response_class=StreamingResponse)
async def download_po(
    po_id: int,
    current_user: CurrentUser         = Depends(get_current_user),
    repo:         PurchaseOrderRepository = Depends(_repo),
):
    po = await repo.get(po_id, _tenant(current_user))
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    try:
        return ExportService.po_pdf(po)
    except RuntimeError as e:
        raise HTTPException(status_code=501, detail=str(e))


# ── Workflow transitions ───────────────────────────────────────────────────────

@router.patch("/{po_id}/status", response_model=POResponse)
async def change_status(
    po_id: int,
    body:  POStatusUpdate,
    current_user: PrimaryOrAbove      = Depends(require_primary_or_above),
    repo:         PurchaseOrderRepository = Depends(_repo),
):
    po = await repo.get(po_id, _tenant(current_user))
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    try:
        return await repo.change_status(
            po, body.status, user_id=current_user.id,
            rejection_reason=body.rejection_reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Goods Receipt ─────────────────────────────────────────────────────────────

@router.post("/{po_id}/receive", response_model=POResponse)
async def receive_goods(
    po_id: int,
    data:  POReceive,
    current_user: PrimaryOrAbove      = Depends(require_primary_or_above),
    repo:         PurchaseOrderRepository = Depends(_repo),
):
    po = await repo.get(po_id, _tenant(current_user))
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    try:
        return await repo.record_receipt(po, data, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
