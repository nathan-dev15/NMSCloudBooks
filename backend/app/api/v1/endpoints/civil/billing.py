from fastapi import APIRouter, HTTPException, Query, Depends
from app.core.deps import DB, CurrentUser, SuperAdmin, AdminOrAbove, PrimaryOrAbove, get_current_user, require_super_admin, require_admin_or_above, require_primary_or_above
from app.core.exceptions import NMSCBException
from app.services.civil.billing_service import WeeklyBillingService
from app.repositories.civil.project_repository import BlockRepository
from app.schemas.civil.billing import (
    DailyActivityCreate, DailyActivityResponse,
    WeeklyBillResponse, WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse,
)
from app.models.civil.billing import DailyActivity, WorkOrder
from sqlalchemy import select
from datetime import date

router = APIRouter(prefix="/civil/billing", tags=["Civil — Billing"])


# ── Daily Activities ───────────────────────────────────────────────────────────

@router.post("/activities", response_model=DailyActivityResponse, status_code=201)
async def log_activity(payload: DailyActivityCreate, db: DB, current_user: PrimaryOrAbove = Depends(require_primary_or_above)):
    activity = DailyActivity(logged_by_id=current_user.id, **payload.model_dump())
    db.add(activity)
    await db.flush()
    await db.refresh(activity)
    return activity


@router.get("/activities", response_model=list[DailyActivityResponse])
async def list_activities(
    db: DB, current_user: CurrentUser = Depends(get_current_user),
    block_id: int = Query(...),
    from_date: str | None = None,
    to_date: str | None = None,
):
    q = select(DailyActivity).where(DailyActivity.block_id == block_id)
    if from_date: q = q.where(DailyActivity.activity_date >= from_date)
    if to_date:   q = q.where(DailyActivity.activity_date <= to_date)
    q = q.order_by(DailyActivity.activity_date.desc())
    result = await db.execute(q)
    return list(result.scalars().all())


# ── Work Orders ───────────────────────────────────────────────────────────────

@router.post("/work-orders", response_model=WorkOrderResponse, status_code=201)
async def create_work_order(payload: WorkOrderCreate, db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    import random, string
    wo_number = "WO-" + "".join(random.choices(string.digits, k=8))
    wo = WorkOrder(wo_number=wo_number, created_by_id=current_user.id, **payload.model_dump())
    db.add(wo)
    await db.flush()
    await db.refresh(wo)
    return wo


@router.get("/work-orders", response_model=list[WorkOrderResponse])
async def list_work_orders(db: DB, current_user: CurrentUser = Depends(get_current_user), block_id: int = Query(...)):
    result = await db.execute(select(WorkOrder).where(WorkOrder.block_id == block_id))
    return list(result.scalars().all())


@router.patch("/work-orders/{wo_id}", response_model=WorkOrderResponse)
async def update_work_order(wo_id: int, payload: WorkOrderUpdate, db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    result = await db.execute(select(WorkOrder).where(WorkOrder.id == wo_id))
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(wo, k, v)
    await db.flush()
    await db.refresh(wo)
    return wo


# ── Weekly Bills ──────────────────────────────────────────────────────────────

@router.post("/weekly-bills/generate", response_model=WeeklyBillResponse)
async def generate_weekly_bill(
    db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above),
    block_id: int = Query(...),
    ref_date: str | None = Query(None, description="ISO date within the target week. Defaults to today."),
):
    service = WeeklyBillingService(db)
    try:
        parsed_date = date.fromisoformat(ref_date) if ref_date else None
        return await service.generate_for_block(block_id, parsed_date)
    except NMSCBException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/weekly-bills", response_model=list[WeeklyBillResponse])
async def list_weekly_bills(db: DB, current_user: CurrentUser = Depends(get_current_user), block_id: int = Query(...)):
    service = WeeklyBillingService(db)
    return await service.list_by_block(block_id)


@router.post("/weekly-bills/{bill_id}/submit", response_model=WeeklyBillResponse)
async def submit_weekly_bill(bill_id: int, db: DB, current_user: PrimaryOrAbove = Depends(require_primary_or_above)):
    service = WeeklyBillingService(db)
    try:
        return await service.submit_bill(bill_id)
    except NMSCBException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/weekly-bills/{bill_id}/approve", response_model=WeeklyBillResponse)
async def approve_weekly_bill(bill_id: int, db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    service = WeeklyBillingService(db)
    try:
        return await service.approve_bill(bill_id, current_user.id)
    except NMSCBException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
