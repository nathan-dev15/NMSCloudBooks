from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import DB, CurrentUser, SuperAdmin, AdminOrAbove, PrimaryOrAbove, get_current_user, require_super_admin, require_admin_or_above, require_primary_or_above
from app.models.user import UserRole
from app.repositories.inventory_repository import (
    CategoryRepository, WarehouseRepository, ProductRepository, StockRepository,
)
from app.schemas.inventory import (
    CategoryCreate, CategoryUpdate, CategoryResponse,
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    ProductCreate, ProductUpdate, ProductResponse, ProductListItem, PaginatedProducts,
    StockAdjust, StockTxnResponse, PaginatedTxns, LowStockItem,
)

router = APIRouter(prefix="/inventory", tags=["Inventory"])

DB = Depends(get_db)


def _tenant(user: CurrentUser) -> Optional[int]:
    return None if user.role == UserRole.SUPER_ADMIN else user.tenant_id

def _tenant_required(user: CurrentUser) -> int:
    return user.tenant_id or 1


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    repo = CategoryRepository(db)
    return await repo.list(_tenant_required(current_user))


@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    current_user: AdminOrAbove = Depends(require_admin_or_above),
    db: AsyncSession = DB,
):
    return await CategoryRepository(db).create(_tenant_required(current_user), data)


@router.put("/categories/{cat_id}", response_model=CategoryResponse)
async def update_category(
    cat_id: int, data: CategoryUpdate,
    current_user: AdminOrAbove = Depends(require_admin_or_above),
    db: AsyncSession = DB,
):
    repo = CategoryRepository(db)
    cat  = await repo.get(cat_id, _tenant_required(current_user))
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return await repo.update(cat, data)


@router.delete("/categories/{cat_id}", status_code=204)
async def delete_category(
    cat_id: int,
    current_user: AdminOrAbove = Depends(require_admin_or_above),
    db: AsyncSession = DB,
):
    repo = CategoryRepository(db)
    cat  = await repo.get(cat_id, _tenant_required(current_user))
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await repo.soft_delete(cat)


# ── Warehouses ────────────────────────────────────────────────────────────────

@router.get("/warehouses", response_model=list[WarehouseResponse])
async def list_warehouses(
    active_only: bool = Query(False),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    return await WarehouseRepository(db).list(_tenant_required(current_user), active_only)


@router.post("/warehouses", response_model=WarehouseResponse, status_code=201)
async def create_warehouse(
    data: WarehouseCreate,
    current_user: AdminOrAbove = Depends(require_admin_or_above),
    db: AsyncSession = DB,
):
    return await WarehouseRepository(db).create(_tenant_required(current_user), data)


@router.put("/warehouses/{wh_id}", response_model=WarehouseResponse)
async def update_warehouse(
    wh_id: int, data: WarehouseUpdate,
    current_user: AdminOrAbove = Depends(require_admin_or_above),
    db: AsyncSession = DB,
):
    repo = WarehouseRepository(db)
    wh   = await repo.get(wh_id, _tenant_required(current_user))
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return await repo.update(wh, data)


# ── Products ──────────────────────────────────────────────────────────────────

@router.get("/products", response_model=PaginatedProducts)
async def list_products(
    page:         int            = Query(1, ge=1),
    size:         int            = Query(20, ge=1, le=100),
    search:       Optional[str]  = Query(None),
    category_id:  Optional[int]  = Query(None),
    status:       Optional[str]  = Query(None),
    product_type: Optional[str]  = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    repo = ProductRepository(db)
    items, total = await repo.list(
        tenant_id=_tenant(current_user),
        page=page, size=size, search=search,
        category_id=category_id, status=status, product_type=product_type,
    )
    # Compute total_stock per product
    product_list = []
    for p in items:
        total_stock = sum(lvl.qty_available for lvl in p.stock_levels) if p.stock_levels else 0.0
        product_list.append({
            **{c.key: getattr(p, c.key) for c in p.__table__.columns},
            "total_stock": total_stock,
        })
    return PaginatedProducts(
        items=product_list, total=total, page=page, size=size,
        pages=ProductRepository.pages(total, size),
    )


@router.post("/products", response_model=ProductResponse, status_code=201)
async def create_product(
    data: ProductCreate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    db: AsyncSession = DB,
):
    return await ProductRepository(db).create(_tenant_required(current_user), data)


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    p = await ProductRepository(db).get(product_id, _tenant(current_user))
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int, data: ProductUpdate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    db: AsyncSession = DB,
):
    repo = ProductRepository(db)
    p    = await repo.get(product_id, _tenant(current_user))
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return await repo.update(p, data)


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    current_user: AdminOrAbove = Depends(require_admin_or_above),
    db: AsyncSession = DB,
):
    ok = await ProductRepository(db).soft_delete(product_id, _tenant(current_user))
    if not ok:
        raise HTTPException(status_code=404, detail="Product not found")


# ── Stock Adjustment ──────────────────────────────────────────────────────────

@router.post("/products/{product_id}/stock/adjust", response_model=dict)
async def adjust_stock(
    product_id: int,
    data: StockAdjust,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    db: AsyncSession = DB,
):
    p = await ProductRepository(db).get(product_id, _tenant(current_user))
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    try:
        txn, level = await StockRepository(db).adjust(
            tenant_id=_tenant_required(current_user),
            product_id=product_id,
            created_by_id=current_user.id,
            data=data,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "transaction_id": txn.id,
        "qty_on_hand":    level.qty_on_hand,
        "qty_available":  level.qty_available,
    }


@router.get("/products/{product_id}/stock/transactions", response_model=PaginatedTxns)
async def list_transactions(
    product_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(30, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    p = await ProductRepository(db).get(product_id, _tenant(current_user))
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    items, total = await StockRepository(db).list_transactions(
        product_id, _tenant_required(current_user), page, size
    )
    return PaginatedTxns(
        items=items, total=total, page=page, size=size,
        pages=ProductRepository.pages(total, size),
    )


# ── Low Stock Report ──────────────────────────────────────────────────────────

@router.get("/reports/low-stock", response_model=list[LowStockItem])
async def low_stock_report(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    return await StockRepository(db).low_stock_report(_tenant_required(current_user))
