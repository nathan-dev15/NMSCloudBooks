from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, PrimaryOrAbove, AdminOrAbove, get_current_user, require_primary_or_above, require_admin_or_above
from app.models.user import UserRole
from app.models.delivery_challan import DCStatus
from app.repositories.delivery_challan_repository import DCRepository
from app.services.delivery_challan_service import DCService
from app.schemas.delivery_challan import DCCreate, DCUpdate, DCResponse, DCStatusUpdate, PaginatedDCs

router = APIRouter(prefix="/delivery-challans", tags=["Delivery Challans"])

DB = Depends(get_db)


def _svc(db: AsyncSession = DB) -> DCService:
    return DCService(db)


def _repo(db: AsyncSession = DB) -> DCRepository:
    return DCRepository(db)


def _tenant(user: CurrentUser) -> Optional[int]:
    return None if user.role == UserRole.SUPER_ADMIN else user.tenant_id


@router.get("", response_model=PaginatedDCs)
async def list_dcs(
    page:      int           = Query(1, ge=1),
    size:      int           = Query(20, ge=1, le=100),
    search:    Optional[str] = Query(None),
    status:    Optional[str] = Query(None),
    client_id: Optional[int] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    current_user: CurrentUser  = Depends(get_current_user),
    repo:         DCRepository = Depends(_repo),
):
    items, total = await repo.list(
        tenant_id=_tenant(current_user),
        page=page, size=size, search=search,
        status=status, client_id=client_id,
        from_date=from_date, to_date=to_date,
    )
    return PaginatedDCs(
        items=items, total=total, page=page, size=size,
        pages=DCRepository.pages(total, size),
    )


@router.post("", response_model=DCResponse, status_code=status.HTTP_201_CREATED)
async def create_dc(
    data: DCCreate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    svc:          DCService      = Depends(_svc),
):
    try:
        return await svc.create(current_user.tenant_id or 1, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{dc_id}", response_model=DCResponse)
async def get_dc(
    dc_id: int,
    current_user: CurrentUser  = Depends(get_current_user),
    repo:         DCRepository = Depends(_repo),
):
    dc = await repo.get(dc_id, _tenant(current_user))
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    return dc


@router.put("/{dc_id}", response_model=DCResponse)
async def update_dc(
    dc_id: int,
    data:  DCUpdate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo:         DCRepository   = Depends(_repo),
    svc:          DCService      = Depends(_svc),
):
    dc = await repo.get(dc_id, _tenant(current_user))
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    try:
        return await svc.update(dc, data, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{dc_id}/status", response_model=DCResponse)
async def change_dc_status(
    dc_id: int,
    body:  DCStatusUpdate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo:         DCRepository   = Depends(_repo),
    svc:          DCService      = Depends(_svc),
):
    dc = await repo.get(dc_id, _tenant(current_user))
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    try:
        return await svc.change_status(dc, body.status, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{dc_id}/cancel", response_model=DCResponse)
async def cancel_dc(
    dc_id: int,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo:         DCRepository   = Depends(_repo),
    svc:          DCService      = Depends(_svc),
):
    dc = await repo.get(dc_id, _tenant(current_user))
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    try:
        return await svc.cancel(dc, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{dc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dc(
    dc_id: int,
    current_user: AdminOrAbove = Depends(require_admin_or_above),
    svc:          DCService    = Depends(_svc),
):
    try:
        deleted = await svc.delete(dc_id, _tenant(current_user), user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not deleted:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
