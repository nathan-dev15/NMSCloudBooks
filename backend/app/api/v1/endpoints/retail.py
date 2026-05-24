from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import DB, CurrentUser, SuperAdmin, AdminOrAbove, PrimaryOrAbove, get_current_user, require_super_admin, require_admin_or_above, require_primary_or_above
from app.repositories.retail_repository import (
    StoreRepository, POSRepository, SaleRepository,
    PromotionRepository, LoyaltyRepository,
)
from app.schemas.retail import (
    StoreCreate, StoreUpdate, StoreResponse,
    POSOpenSession, POSCloseSession, POSSessionResponse,
    SaleCreate, SaleResponse, SaleListItem, PaginatedSales, SaleRefund,
    PromotionCreate, PromotionResponse,
    LoyaltyAccountResponse, LoyaltyAdjust,
)

router = APIRouter(prefix="/retail", tags=["Retail"])

DB = Depends(get_db)


def _tid(user: CurrentUser) -> int:
    return user.tenant_id or 1


# ── Stores ────────────────────────────────────────────────────────────────────

@router.get("/stores", response_model=list[StoreResponse])
async def list_stores(current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    return await StoreRepository(db).list(_tid(current_user))


@router.post("/stores", response_model=StoreResponse, status_code=201)
async def create_store(data: StoreCreate, current_user: AdminOrAbove = Depends(require_admin_or_above), db: AsyncSession = DB):
    return await StoreRepository(db).create(_tid(current_user), data)


@router.get("/stores/{store_id}", response_model=StoreResponse)
async def get_store(store_id: int, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    s = await StoreRepository(db).get(store_id, _tid(current_user))
    if not s: raise HTTPException(404, "Store not found")
    return s


@router.put("/stores/{store_id}", response_model=StoreResponse)
async def update_store(store_id: int, data: StoreUpdate, current_user: AdminOrAbove = Depends(require_admin_or_above), db: AsyncSession = DB):
    repo  = StoreRepository(db)
    store = await repo.get(store_id, _tid(current_user))
    if not store: raise HTTPException(404, "Store not found")
    return await repo.update(store, data)


# ── POS Sessions ──────────────────────────────────────────────────────────────

@router.post("/stores/{store_id}/sessions/open", response_model=POSSessionResponse, status_code=201)
async def open_session(store_id: int, data: POSOpenSession, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    try:
        return await POSRepository(db).open_session(store_id, current_user.id, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/sessions/{session_id}/close", response_model=POSSessionResponse)
async def close_session(session_id: int, data: POSCloseSession, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    repo    = POSRepository(db)
    session = await repo.get_session(session_id, store_id=0)  # any store — user-scoped
    # Reload without store constraint
    from sqlalchemy import select
    from app.models.retail import POSSession
    session = (await db.execute(select(POSSession).where(POSSession.id == session_id))).scalar_one_or_none()
    if not session: raise HTTPException(404, "Session not found")
    try:
        return await repo.close_session(session, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/stores/{store_id}/sessions", response_model=dict)
async def list_sessions(
    store_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    items, total = await POSRepository(db).list_sessions(store_id, page, size)
    return {"items": items, "total": total, "page": page, "size": size}


# ── Sales ─────────────────────────────────────────────────────────────────────

@router.get("/sales", response_model=PaginatedSales)
async def list_sales(
    page:      int           = Query(1, ge=1),
    size:      int           = Query(20, ge=1, le=100),
    store_id:  Optional[int] = Query(None),
    search:    Optional[str] = Query(None),
    status:    Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    items, total = await SaleRepository(db).list(
        _tid(current_user), page, size, store_id, search, status, from_date, to_date,
    )
    return PaginatedSales(items=items, total=total, page=page, size=size,
                          pages=SaleRepository.pages(total, size))


@router.post("/sales", response_model=SaleResponse, status_code=201)
async def create_sale(data: SaleCreate, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    try:
        return await SaleRepository(db).create(_tid(current_user), current_user.id, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/sales/{sale_id}", response_model=SaleResponse)
async def get_sale(sale_id: int, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    sale = await SaleRepository(db).get(sale_id, _tid(current_user))
    if not sale: raise HTTPException(404, "Sale not found")
    return sale


@router.post("/sales/{sale_id}/refund", response_model=SaleResponse)
async def refund_sale(sale_id: int, data: SaleRefund, current_user: PrimaryOrAbove = Depends(require_primary_or_above), db: AsyncSession = DB):
    repo = SaleRepository(db)
    sale = await repo.get(sale_id, _tid(current_user))
    if not sale: raise HTTPException(404, "Sale not found")
    try:
        return await repo.refund(sale, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Promotions ────────────────────────────────────────────────────────────────

@router.get("/promotions", response_model=list[PromotionResponse])
async def list_promotions(
    active_only: bool = Query(False),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = DB,
):
    return await PromotionRepository(db).list(_tid(current_user), active_only)


@router.post("/promotions", response_model=PromotionResponse, status_code=201)
async def create_promotion(data: PromotionCreate, current_user: AdminOrAbove = Depends(require_admin_or_above), db: AsyncSession = DB):
    return await PromotionRepository(db).create(_tid(current_user), data)


@router.get("/promotions/{promo_id}", response_model=PromotionResponse)
async def get_promotion(promo_id: int, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    p = await PromotionRepository(db).get(promo_id, _tid(current_user))
    if not p: raise HTTPException(404, "Promotion not found")
    return p


# ── Loyalty ───────────────────────────────────────────────────────────────────

@router.get("/loyalty/{customer_id}", response_model=LoyaltyAccountResponse)
async def get_loyalty(customer_id: int, current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = DB):
    acc = await LoyaltyRepository(db).get_account(customer_id)
    if not acc: raise HTTPException(404, "Loyalty account not found")
    return acc


@router.post("/loyalty/{customer_id}/adjust", response_model=LoyaltyAccountResponse)
async def adjust_loyalty(customer_id: int, data: LoyaltyAdjust, current_user: AdminOrAbove = Depends(require_admin_or_above), db: AsyncSession = DB):
    acc = await LoyaltyRepository(db).get_account(customer_id)
    if not acc: raise HTTPException(404, "Loyalty account not found")
    try:
        return await LoyaltyRepository(db).adjust(acc, data)
    except ValueError as e:
        raise HTTPException(400, str(e))
