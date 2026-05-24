from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import DB, CurrentUser, SuperAdmin, AdminOrAbove, PrimaryOrAbove, get_current_user, require_super_admin, require_admin_or_above, require_primary_or_above
from app.models.user import UserRole
from app.repositories.general_repository import (
    ServiceCategoryRepository, ServiceRepository, PlanRepository,
    SubscriptionRepository, RecurringRepository, GenInvoiceRepository,
)
from app.schemas.general import (
    ServiceCategoryCreate, ServiceCategoryResponse,
    ServiceCreate, ServiceUpdate, ServiceResponse,
    PlanCreate, PlanUpdate, PlanResponse,
    SubscriptionCreate, SubscriptionUpdate, SubscriptionResponse, PaginatedSubscriptions,
    RecurringTemplateCreate, RecurringTemplateResponse,
    GenInvoiceCreate, GenInvoiceUpdate, GenInvoiceResponse,
    GenInvoiceListItem, PaginatedGenInvoices, GenInvoiceStatusUpdate,
    GenerateFromTemplate,
)

router = APIRouter(prefix="/general", tags=["General Billing"])

DB = Depends(get_db)


def _tid(user: CurrentUser) -> Optional[int]:
    return None if user.role == UserRole.SUPER_ADMIN else user.tenant_id

def _tid_req(user: CurrentUser) -> int:
    return user.tenant_id or 1


# ── Service Categories ────────────────────────────────────────────────────────

@router.get("/service-categories", response_model=list[ServiceCategoryResponse])
async def list_service_categories(current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    return await ServiceCategoryRepository(db).list(_tid_req(current_user))


@router.post("/service-categories", response_model=ServiceCategoryResponse, status_code=201)
async def create_service_category(data: ServiceCategoryCreate, current_user: AdminOrAbove = Depends(require_admin_or_above), db: AsyncSession = DB):
    return await ServiceCategoryRepository(db).create(_tid_req(current_user), data)


# ── Services ──────────────────────────────────────────────────────────────────

@router.get("/services", response_model=dict)
async def list_services(
    page:        int            = Query(1, ge=1),
    size:        int            = Query(50, ge=1, le=200),
    search:      Optional[str]  = Query(None),
    category_id: Optional[int]  = Query(None),
    active_only: bool           = Query(False),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    items, total = await ServiceRepository(db).list(_tid(current_user), page, size, search, category_id, active_only)
    return {"items": items, "total": total, "page": page, "size": size,
            "pages": ServiceRepository.pages(total, size)}


@router.post("/services", response_model=ServiceResponse, status_code=201)
async def create_service(data: ServiceCreate, current_user: AdminOrAbove = Depends(require_admin_or_above), db: AsyncSession = DB):
    return await ServiceRepository(db).create(_tid_req(current_user), data)


@router.get("/services/{svc_id}", response_model=ServiceResponse)
async def get_service(svc_id: int, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    svc = await ServiceRepository(db).get(svc_id, _tid(current_user))
    if not svc: raise HTTPException(404, "Service not found")
    return svc


@router.put("/services/{svc_id}", response_model=ServiceResponse)
async def update_service(svc_id: int, data: ServiceUpdate, current_user: AdminOrAbove = Depends(require_admin_or_above), db: AsyncSession = DB):
    repo = ServiceRepository(db)
    svc  = await repo.get(svc_id, _tid(current_user))
    if not svc: raise HTTPException(404, "Service not found")
    return await repo.update(svc, data)


@router.delete("/services/{svc_id}", status_code=204)
async def delete_service(svc_id: int, current_user: AdminOrAbove = Depends(require_admin_or_above), db: AsyncSession = DB):
    repo = ServiceRepository(db)
    svc  = await repo.get(svc_id, _tid(current_user))
    if not svc: raise HTTPException(404, "Service not found")
    await repo.soft_delete(svc, user_id=current_user.id)


# ── Subscription Plans ────────────────────────────────────────────────────────

@router.get("/plans", response_model=list[PlanResponse])
async def list_plans(
    active_only: bool = Query(False),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    return await PlanRepository(db).list(_tid_req(current_user), active_only)


@router.post("/plans", response_model=PlanResponse, status_code=201)
async def create_plan(data: PlanCreate, current_user: AdminOrAbove = Depends(require_admin_or_above), db: AsyncSession = DB):
    return await PlanRepository(db).create(_tid_req(current_user), data)


@router.get("/plans/{plan_id}", response_model=PlanResponse)
async def get_plan(plan_id: int, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    plan = await PlanRepository(db).get(plan_id, _tid_req(current_user))
    if not plan: raise HTTPException(404, "Plan not found")
    return plan


@router.put("/plans/{plan_id}", response_model=PlanResponse)
async def update_plan(plan_id: int, data: PlanUpdate, current_user: AdminOrAbove = Depends(require_admin_or_above), db: AsyncSession = DB):
    repo = PlanRepository(db)
    plan = await repo.get(plan_id, _tid_req(current_user))
    if not plan: raise HTTPException(404, "Plan not found")
    return await repo.update(plan, data)


# ── Client Subscriptions ──────────────────────────────────────────────────────

@router.get("/subscriptions", response_model=PaginatedSubscriptions)
async def list_subscriptions(
    page:      int           = Query(1, ge=1),
    size:      int           = Query(20, ge=1, le=100),
    status:    Optional[str] = Query(None),
    client_id: Optional[int] = Query(None),
    plan_id:   Optional[int] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    items, total = await SubscriptionRepository(db).list(_tid(current_user), page, size, status, client_id, plan_id)
    return PaginatedSubscriptions(items=items, total=total, page=page, size=size,
                                   pages=SubscriptionRepository.pages(total, size))


@router.post("/subscriptions", response_model=SubscriptionResponse, status_code=201)
async def create_subscription(data: SubscriptionCreate, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    try:
        return await SubscriptionRepository(db).create(_tid_req(current_user), current_user.id, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/subscriptions/{sub_id}", response_model=SubscriptionResponse)
async def get_subscription(sub_id: int, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    sub = await SubscriptionRepository(db).get(sub_id, _tid(current_user))
    if not sub: raise HTTPException(404, "Subscription not found")
    return sub


@router.patch("/subscriptions/{sub_id}", response_model=SubscriptionResponse)
async def update_subscription(sub_id: int, data: SubscriptionUpdate, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    repo = SubscriptionRepository(db)
    sub  = await repo.get(sub_id, _tid(current_user))
    if not sub: raise HTTPException(404, "Subscription not found")
    return await repo.update(sub, data)


# ── Recurring Templates ───────────────────────────────────────────────────────

@router.get("/recurring-templates", response_model=list[RecurringTemplateResponse])
async def list_templates(current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    return await RecurringRepository(db).list(_tid_req(current_user))


@router.post("/recurring-templates", response_model=RecurringTemplateResponse, status_code=201)
async def create_template(data: RecurringTemplateCreate, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    return await RecurringRepository(db).create(_tid_req(current_user), current_user.id, data)


@router.post("/recurring-templates/{tmpl_id}/generate", response_model=GenInvoiceResponse)
async def generate_from_template(
    tmpl_id: int,
    data: GenerateFromTemplate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    db: AsyncSession = DB,
):
    repo = RecurringRepository(db)
    tmpl = await repo.get(tmpl_id, _tid_req(current_user))
    if not tmpl: raise HTTPException(404, "Template not found")
    inv = await repo.generate_invoice(tmpl, data.invoice_date, current_user.id)
    return inv


# ── General Invoices ──────────────────────────────────────────────────────────

@router.get("/invoices", response_model=PaginatedGenInvoices)
async def list_gen_invoices(
    page:      int           = Query(1, ge=1),
    size:      int           = Query(20, ge=1, le=100),
    search:    Optional[str] = Query(None),
    status:    Optional[str] = Query(None),
    client_id: Optional[int] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    items, total = await GenInvoiceRepository(db).list(
        _tid(current_user), page, size, search, status, client_id, from_date, to_date,
    )
    return PaginatedGenInvoices(items=items, total=total, page=page, size=size,
                                pages=GenInvoiceRepository.pages(total, size))


@router.post("/invoices", response_model=GenInvoiceResponse, status_code=201)
async def create_gen_invoice(data: GenInvoiceCreate, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    return await GenInvoiceRepository(db).create(_tid_req(current_user), current_user.id, data)


@router.get("/invoices/{inv_id}", response_model=GenInvoiceResponse)
async def get_gen_invoice(inv_id: int, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    inv = await GenInvoiceRepository(db).get(inv_id, _tid(current_user))
    if not inv: raise HTTPException(404, "Invoice not found")
    return inv


@router.patch("/invoices/{inv_id}/status", response_model=GenInvoiceResponse)
async def update_gen_invoice_status(
    inv_id: int, data: GenInvoiceStatusUpdate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    db: AsyncSession = DB,
):
    repo = GenInvoiceRepository(db)
    inv  = await repo.get(inv_id, _tid(current_user))
    if not inv: raise HTTPException(404, "Invoice not found")
    return await repo.update_status(inv, data)


@router.delete("/invoices/{inv_id}", status_code=204)
async def delete_gen_invoice(inv_id: int, current_user: AdminOrAbove = Depends(require_admin_or_above), db: AsyncSession = DB):
    repo = GenInvoiceRepository(db)
    inv  = await repo.get(inv_id, _tid(current_user))
    if not inv: raise HTTPException(404, "Invoice not found")
    try:
        await repo.soft_delete(inv, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(400, str(e))
