from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import DB, CurrentUser, SuperAdmin, AdminOrAbove, PrimaryOrAbove, get_current_user, require_super_admin, require_admin_or_above, require_primary_or_above
from app.models.user import UserRole
from app.repositories.agriculture_repository import (
    FarmRepository, CropCycleRepository, AgriInvoiceRepository,
)
from app.schemas.agriculture import (
    FarmCreate, FarmUpdate, FarmResponse, FarmListItem, PaginatedFarms,
    CropCycleCreate, CropCycleUpdate, CropCycleResponse, PaginatedCycles,
    ExpenseCreate, ExpenseResponse,
    HarvestCreate, HarvestResponse,
    AgriInvoiceCreate, AgriInvoiceResponse, AgriInvoiceStatusUpdate,
)

router = APIRouter(prefix="/agriculture", tags=["Agriculture"])

DB = Depends(get_db)


def _tid(user: CurrentUser) -> Optional[int]:
    return None if user.role == UserRole.SUPER_ADMIN else user.tenant_id

def _tid_req(user: CurrentUser) -> int:
    return user.tenant_id or 1


# ── Farms ─────────────────────────────────────────────────────────────────────

@router.get("/farms", response_model=PaginatedFarms)
async def list_farms(
    page:      int            = Query(1, ge=1),
    size:      int            = Query(20, ge=1, le=100),
    search:    Optional[str]  = Query(None),
    district:  Optional[str]  = Query(None),
    state:     Optional[str]  = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    items, total = await FarmRepository(db).list(
        _tid(current_user), page, size, search, district, state, is_active,
    )
    return PaginatedFarms(items=items, total=total, page=page, size=size,
                          pages=FarmRepository.pages(total, size))


@router.post("/farms", response_model=FarmResponse, status_code=201)
async def create_farm(data: FarmCreate, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    return await FarmRepository(db).create(_tid_req(current_user), data)


@router.get("/farms/{farm_id}", response_model=FarmResponse)
async def get_farm(farm_id: int, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    farm = await FarmRepository(db).get(farm_id, _tid(current_user))
    if not farm: raise HTTPException(404, "Farm not found")
    return farm


@router.put("/farms/{farm_id}", response_model=FarmResponse)
async def update_farm(farm_id: int, data: FarmUpdate, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    repo = FarmRepository(db)
    farm = await repo.get(farm_id, _tid(current_user))
    if not farm: raise HTTPException(404, "Farm not found")
    return await repo.update(farm, data)


@router.delete("/farms/{farm_id}", status_code=204)
async def delete_farm(farm_id: int, current_user: AdminOrAbove = Depends(require_admin_or_above), db: AsyncSession = DB):
    repo = FarmRepository(db)
    farm = await repo.get(farm_id, _tid(current_user))
    if not farm: raise HTTPException(404, "Farm not found")
    await repo.soft_delete(farm, user_id=current_user.id)


# ── Crop Cycles ───────────────────────────────────────────────────────────────

@router.get("/cycles", response_model=PaginatedCycles)
async def list_cycles(
    page:         int           = Query(1, ge=1),
    size:         int           = Query(20, ge=1, le=100),
    farm_id:      Optional[int] = Query(None),
    season:       Optional[str] = Query(None),
    year:         Optional[int] = Query(None),
    status:       Optional[str] = Query(None),
    crop_name:    Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    items, total = await CropCycleRepository(db).list(
        _tid(current_user), page, size, farm_id, season, year, status, crop_name,
    )
    return PaginatedCycles(items=items, total=total, page=page, size=size,
                           pages=CropCycleRepository.pages(total, size))


@router.post("/cycles", response_model=CropCycleResponse, status_code=201)
async def create_cycle(data: CropCycleCreate, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    return await CropCycleRepository(db).create(_tid_req(current_user), current_user.id, data)


@router.get("/cycles/{cycle_id}", response_model=CropCycleResponse)
async def get_cycle(cycle_id: int, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    cycle = await CropCycleRepository(db).get(cycle_id, _tid(current_user))
    if not cycle: raise HTTPException(404, "Crop cycle not found")
    return cycle


@router.put("/cycles/{cycle_id}", response_model=CropCycleResponse)
async def update_cycle(cycle_id: int, data: CropCycleUpdate, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    repo  = CropCycleRepository(db)
    cycle = await repo.get(cycle_id, _tid(current_user))
    if not cycle: raise HTTPException(404, "Crop cycle not found")
    return await repo.update(cycle, data)


@router.delete("/cycles/{cycle_id}", status_code=204)
async def delete_cycle(cycle_id: int, current_user: AdminOrAbove = Depends(require_admin_or_above), db: AsyncSession = DB):
    repo  = CropCycleRepository(db)
    cycle = await repo.get(cycle_id, _tid(current_user))
    if not cycle: raise HTTPException(404, "Crop cycle not found")
    await repo.soft_delete(cycle, user_id=current_user.id)


# ── Expenses ──────────────────────────────────────────────────────────────────

@router.post("/cycles/{cycle_id}/expenses", response_model=ExpenseResponse, status_code=201)
async def add_expense(cycle_id: int, data: ExpenseCreate, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    repo  = CropCycleRepository(db)
    cycle = await repo.get(cycle_id, _tid(current_user))
    if not cycle: raise HTTPException(404, "Crop cycle not found")
    return await repo.add_expense(cycle, current_user.id, data)


# ── Harvest Records ───────────────────────────────────────────────────────────

@router.post("/cycles/{cycle_id}/harvests", response_model=HarvestResponse, status_code=201)
async def add_harvest(cycle_id: int, data: HarvestCreate, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    repo  = CropCycleRepository(db)
    cycle = await repo.get(cycle_id, _tid(current_user))
    if not cycle: raise HTTPException(404, "Crop cycle not found")
    return await repo.add_harvest(cycle, current_user.id, data)


# ── Agri Invoices ─────────────────────────────────────────────────────────────

@router.get("/invoices", response_model=dict)
async def list_agri_invoices(
    page:         int           = Query(1, ge=1),
    size:         int           = Query(20, ge=1, le=100),
    status:       Optional[str] = Query(None),
    cycle_id:     Optional[int] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    items, total = await AgriInvoiceRepository(db).list(
        _tid(current_user), page, size, status, cycle_id,
    )
    return {"items": items, "total": total, "page": page, "size": size,
            "pages": AgriInvoiceRepository.pages(total, size)}


@router.post("/invoices", response_model=AgriInvoiceResponse, status_code=201)
async def create_agri_invoice(data: AgriInvoiceCreate, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    try:
        return await AgriInvoiceRepository(db).create(_tid_req(current_user), current_user.id, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/invoices/{inv_id}", response_model=AgriInvoiceResponse)
async def get_agri_invoice(inv_id: int, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    inv = await AgriInvoiceRepository(db).get(inv_id, _tid(current_user))
    if not inv: raise HTTPException(404, "Invoice not found")
    return inv


@router.patch("/invoices/{inv_id}/status", response_model=AgriInvoiceResponse)
async def update_agri_invoice_status(
    inv_id: int, data: AgriInvoiceStatusUpdate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    db: AsyncSession = DB,
):
    repo = AgriInvoiceRepository(db)
    inv  = await repo.get(inv_id, _tid(current_user))
    if not inv: raise HTTPException(404, "Invoice not found")
    return await repo.update_status(inv, data)
