from fastapi import APIRouter, HTTPException, Query, Depends
from app.core.deps import DB, CurrentUser, SuperAdmin, AdminOrAbove, PrimaryOrAbove, get_current_user, require_super_admin, require_admin_or_above, require_primary_or_above
from app.repositories.civil.stock_repository import StockRepository, MaterialCatalogRepository
from app.schemas.civil.materials import (
    MaterialCatalogCreate, MaterialCatalogResponse,
    StockResponse, StockAdjustRequest, StockMovementResponse,
)

router = APIRouter(prefix="/civil/stock", tags=["Civil — Stock & Materials"])


# ── Material Catalog ───────────────────────────────────────────────────────────

@router.get("/catalog", response_model=list[MaterialCatalogResponse])
async def list_catalog(
    db: DB, current_user: CurrentUser = Depends(get_current_user),
    is_tool: bool | None = Query(None),
):
    repo = MaterialCatalogRepository(db)
    return await repo.list_by_tenant(current_user.tenant_id, is_tool=is_tool)


@router.post("/catalog", response_model=MaterialCatalogResponse, status_code=201)
async def add_material(payload: MaterialCatalogCreate, db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    repo = MaterialCatalogRepository(db)
    return await repo.create(tenant_id=current_user.tenant_id, **payload.model_dump())


@router.post("/catalog/seed-top5", response_model=list[MaterialCatalogResponse])
async def seed_top5_tools(db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    """Seed the 5 pre-configured civil construction tools for this tenant."""
    repo = MaterialCatalogRepository(db)
    return await repo.seed_top5_tools(current_user.tenant_id)


# ── Stock levels ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[StockResponse])
async def list_stock(
    db: DB, current_user: CurrentUser = Depends(get_current_user),
    project_id: int = Query(...),
):
    repo = StockRepository(db)
    return await repo.list_by_project(project_id)


@router.post("/{stock_id}/adjust", response_model=StockResponse)
async def adjust_stock(
    stock_id: int, payload: StockAdjustRequest,
    db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above),
):
    """Manual stock adjustment — receipt, return, transfer, or correction."""
    from sqlalchemy import select
    from app.models.civil.materials import Stock

    result = await db.execute(select(Stock).where(Stock.id == stock_id))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock entry not found")

    repo = StockRepository(db)
    await repo.adjust(
        stock,
        qty_delta=payload.quantity,
        movement_type=payload.movement_type,
        performed_by_id=current_user.id,
        notes=payload.notes,
        unit_cost=payload.unit_cost,
    )
    return stock


@router.get("/{stock_id}/movements", response_model=list[StockMovementResponse])
async def get_stock_movements(stock_id: int, db: DB, current_user: CurrentUser = Depends(get_current_user)):
    repo = StockRepository(db)
    return await repo.get_movements(stock_id)
