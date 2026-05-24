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
from app.models.invoice import InvoiceStatus
from app.repositories.invoice_repository import InvoiceRepository
from app.services.invoice_service import InvoiceService
from app.services.export_service import ExportService
from app.schemas.invoice import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse, InvoiceListItem,
    PaginatedInvoices, InvoiceStatusUpdate, PaymentCreate, PaymentResponse,
)

router = APIRouter(prefix="/invoices", tags=["Invoices"])

DB = Depends(get_db)


def _svc(db: AsyncSession = DB) -> InvoiceService:
    return InvoiceService(db)


def _repo(db: AsyncSession = DB) -> InvoiceRepository:
    return InvoiceRepository(db)


def _tenant_scope(user: CurrentUser) -> Optional[int]:
    return None if user.role == UserRole.SUPER_ADMIN else user.tenant_id


# ── List & Create ─────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedInvoices)
async def list_invoices(
    page:             int           = Query(1, ge=1),
    size:             int           = Query(20, ge=1, le=100),
    # Single keyword search
    search:           Optional[str] = Query(None, description="Keyword search across number, name, reference"),
    # Multi-keyword: comma-separated terms, each must match
    multi_q:          Optional[str] = Query(None, description="Comma-separated keywords (AND logic)"),
    # Dropdown / exact filters
    status:           Optional[str] = Query(None),
    statuses:         Optional[str] = Query(None, description="Comma-separated statuses"),
    client_id:        Optional[int] = Query(None),
    invoice_type:     Optional[str] = Query(None),
    # Cascading filters
    project_id:       Optional[int] = Query(None, description="Cascading: filter by project"),
    project_block_id: Optional[int] = Query(None, description="Cascading: filter by block (requires project_id)"),
    # Date range
    from_date:        Optional[str] = Query(None),
    to_date:          Optional[str] = Query(None),
    current_user: CurrentUser     = Depends(get_current_user),
    repo: InvoiceRepository       = Depends(_repo),
):
    multi_q_list   = [t for t in multi_q.split(",") if t.strip()] if multi_q else None
    statuses_list  = [s.strip() for s in statuses.split(",") if s.strip()] if statuses else None

    items, total = await repo.list(
        tenant_id=_tenant_scope(current_user),
        page=page, size=size,
        search=search,
        multi_q=multi_q_list,
        status=status,
        statuses=statuses_list,
        client_id=client_id,
        project_id=project_id,
        project_block_id=project_block_id,
        invoice_type=invoice_type,
        from_date=from_date,
        to_date=to_date,
    )
    return PaginatedInvoices(
        items=items, total=total, page=page, size=size,
        pages=InvoiceRepository.pages(total, size),
    )


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    data: InvoiceCreate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    svc: InvoiceService          = Depends(_svc),
):
    return await svc.create(current_user.tenant_id or 1, current_user.id, data)


# ── Filter options (for cascading dropdowns) ──────────────────────────────────

@router.get("/filter-options")
async def invoice_filter_options(
    current_user: CurrentUser   = Depends(get_current_user),
    repo: InvoiceRepository     = Depends(_repo),
):
    """Returns distinct values for status, type, etc. — powers cascading dropdowns."""
    return await repo.filter_options(_tenant_scope(current_user))


# ── Export (list) ─────────────────────────────────────────────────────────────

@router.get("/export", response_class=StreamingResponse)
async def export_invoices(
    fmt:      str           = Query("csv", enum=["csv", "excel"], description="Export format"),
    search:   Optional[str] = Query(None),
    status:   Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo: InvoiceRepository      = Depends(_repo),
):
    items, _ = await repo.list(
        tenant_id=_tenant_scope(current_user),
        page=1, size=10_000,    # export all matching rows
        search=search, status=status,
        from_date=from_date, to_date=to_date,
    )
    return ExportService.invoices_list(items, fmt)


# ── Single Invoice ────────────────────────────────────────────────────────────

@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    repo: InvoiceRepository   = Depends(_repo),
):
    inv = await repo.get(invoice_id, _tenant_scope(current_user))
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: int,
    data: InvoiceUpdate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo: InvoiceRepository      = Depends(_repo),
    svc: InvoiceService          = Depends(_svc),
):
    inv = await repo.get(invoice_id, _tenant_scope(current_user))
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    try:
        return await svc.update(inv, data, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: int,
    current_user: AdminOrAbove = Depends(require_admin_or_above),
    svc: InvoiceService        = Depends(_svc),
):
    """
    Hard rule: only the LATEST invoice can be deleted.
    For all others, use POST /{id}/cancel instead.
    """
    try:
        deleted = await svc.delete(invoice_id, _tenant_scope(current_user), user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not deleted:
        raise HTTPException(status_code=404, detail="Invoice not found")


# ── Cancel (alternative to deletion) ─────────────────────────────────────────

@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
async def cancel_invoice(
    invoice_id: int,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo: InvoiceRepository      = Depends(_repo),
    svc: InvoiceService          = Depends(_svc),
):
    """
    Cancel an invoice without deleting it.
    Use this for any invoice that is not the latest.
    """
    inv = await repo.get(invoice_id, _tenant_scope(current_user))
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    try:
        return await svc.cancel(inv, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Download single invoice as PDF ────────────────────────────────────────────

@router.get("/{invoice_id}/download", response_class=StreamingResponse)
async def download_invoice(
    invoice_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    repo: InvoiceRepository   = Depends(_repo),
):
    inv = await repo.get(invoice_id, _tenant_scope(current_user))
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    try:
        return ExportService.invoice_pdf(inv)
    except RuntimeError as e:
        raise HTTPException(status_code=501, detail=str(e))


# ── Status transitions ────────────────────────────────────────────────────────

@router.patch("/{invoice_id}/status", response_model=InvoiceResponse)
async def update_status(
    invoice_id: int,
    body: InvoiceStatusUpdate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo: InvoiceRepository      = Depends(_repo),
    svc: InvoiceService          = Depends(_svc),
):
    inv = await repo.get(invoice_id, _tenant_scope(current_user))
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    try:
        return await svc.change_status(inv, body.status, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Payments ──────────────────────────────────────────────────────────────────

@router.post("/{invoice_id}/payments", response_model=PaymentResponse, status_code=201)
async def record_payment(
    invoice_id: int,
    data: PaymentCreate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo: InvoiceRepository      = Depends(_repo),
    svc: InvoiceService          = Depends(_svc),
):
    inv = await repo.get(invoice_id, _tenant_scope(current_user))
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    try:
        return await svc.record_payment(inv, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
