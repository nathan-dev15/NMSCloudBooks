from fastapi import APIRouter, HTTPException, Depends
from app.core.deps import DB, CurrentUser, SuperAdmin, AdminOrAbove, PrimaryOrAbove, get_current_user, require_super_admin, require_admin_or_above, require_primary_or_above
from app.repositories.tenant_repository import TenantRepository
from app.repositories.subscription_plan_repository import SubscriptionPlanRepository
from app.schemas.tenant import TenantCreate, TenantUpdate, ModuleToggleRequest, TenantResponse

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.get("", response_model=list[TenantResponse])
async def list_tenants(db: DB, _: SuperAdmin = Depends(require_super_admin)):
    repo = TenantRepository(db)
    return await repo.list_all()


@router.post("", response_model=TenantResponse, status_code=201)
async def create_tenant(payload: TenantCreate, db: DB, _: SuperAdmin = Depends(require_super_admin)):
    repo = TenantRepository(db)
    plan_repo = SubscriptionPlanRepository(db)

    existing = await repo.get_by_slug(payload.slug)
    if existing:
        raise HTTPException(status_code=409, detail="Tenant slug already exists")

    plan = await plan_repo.get_by_id(payload.subscription_plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")

    data = payload.model_dump()
    # Auto-populate enabled_modules from the selected plan
    data["enabled_modules"] = list(plan.enabled_modules or [])

    return await repo.create(**data)


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(tenant_id: int, db: DB, _: SuperAdmin = Depends(require_super_admin)):
    repo = TenantRepository(db)
    tenant = await repo.get_by_id(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.patch("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(tenant_id: int, payload: TenantUpdate, db: DB, _: SuperAdmin = Depends(require_super_admin)):
    repo = TenantRepository(db)
    plan_repo = SubscriptionPlanRepository(db)

    tenant = await repo.get_by_id(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    data = payload.model_dump(exclude_none=True)

    # When the plan changes, sync enabled_modules from the new plan
    if "subscription_plan_id" in data:
        plan = await plan_repo.get_by_id(data["subscription_plan_id"])
        if not plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found")
        if "enabled_modules" not in data:
            data["enabled_modules"] = list(plan.enabled_modules or [])

    return await repo.update(tenant, **data)


@router.post("/{tenant_id}/modules", response_model=TenantResponse)
async def toggle_module(tenant_id: int, payload: ModuleToggleRequest, db: DB, _: SuperAdmin = Depends(require_super_admin)):
    repo = TenantRepository(db)
    tenant = await repo.get_by_id(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return await repo.toggle_module(tenant, payload.module, payload.enabled)
