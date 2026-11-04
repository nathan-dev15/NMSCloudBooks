from fastapi import APIRouter, HTTPException, Depends
from app.core.deps import DB, SuperAdmin, require_super_admin
from app.repositories.subscription_plan_repository import SubscriptionPlanRepository
from app.schemas.subscription_plan import (
    SubscriptionPlanCreate, SubscriptionPlanUpdate, SubscriptionPlanResponse,
)

router = APIRouter(prefix="/subscription-plans", tags=["Subscription Plans"])


@router.get("", response_model=list[SubscriptionPlanResponse])
async def list_plans(db: DB):
    """List active subscription plans — available to all authenticated users."""
    repo = SubscriptionPlanRepository(db)
    return await repo.list_active()


@router.get("/all", response_model=list[SubscriptionPlanResponse])
async def list_all_plans(db: DB, _: SuperAdmin = Depends(require_super_admin)):
    """List all plans including inactive — Super Admin only."""
    repo = SubscriptionPlanRepository(db)
    return await repo.list_all()


@router.post("", response_model=SubscriptionPlanResponse, status_code=201)
async def create_plan(
    payload: SubscriptionPlanCreate,
    db: DB,
    _: SuperAdmin = Depends(require_super_admin),
):
    repo = SubscriptionPlanRepository(db)
    existing = await repo.get_by_slug(payload.slug)
    if existing:
        raise HTTPException(status_code=409, detail="Plan slug already exists")
    return await repo.create(**payload.model_dump())


@router.get("/{plan_id}", response_model=SubscriptionPlanResponse)
async def get_plan(plan_id: int, db: DB):
    repo = SubscriptionPlanRepository(db)
    plan = await repo.get_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    return plan


@router.patch("/{plan_id}", response_model=SubscriptionPlanResponse)
async def update_plan(
    plan_id: int,
    payload: SubscriptionPlanUpdate,
    db: DB,
    _: SuperAdmin = Depends(require_super_admin),
):
    repo = SubscriptionPlanRepository(db)
    plan = await repo.get_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    return await repo.update(plan, **payload.model_dump(exclude_none=True))


@router.delete("/{plan_id}", status_code=204)
async def delete_plan(
    plan_id: int,
    db: DB,
    _: SuperAdmin = Depends(require_super_admin),
):
    repo = SubscriptionPlanRepository(db)
    plan = await repo.get_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    # Guard: don't delete plans that have tenants
    if plan.tenants:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete — {len(plan.tenants)} tenant(s) use this plan",
        )
    await repo.delete(plan)
