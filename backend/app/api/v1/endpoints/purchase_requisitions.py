from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, PrimaryOrAbove, AdminOrAbove, get_current_user, require_primary_or_above, require_admin_or_above
from app.models.user import UserRole
from app.models.purchase_requisition import PRStatus
from app.repositories.purchase_requisition_repository import PRRepository
from app.services.purchase_requisition_service import PRService
from app.schemas.purchase_requisition import PRCreate, PRUpdate, PRResponse, PRStatusUpdate, PaginatedPRs

router = APIRouter(prefix="/purchase-requisitions", tags=["Purchase Requisitions"])

DB = Depends(get_db)


def _svc(db: AsyncSession = DB) -> PRService:
    return PRService(db)


def _repo(db: AsyncSession = DB) -> PRRepository:
    return PRRepository(db)


def _tenant(user: CurrentUser) -> Optional[int]:
    return None if user.role == UserRole.SUPER_ADMIN else user.tenant_id


@router.get("", response_model=PaginatedPRs)
async def list_prs(
    page:      int           = Query(1, ge=1),
    size:      int           = Query(20, ge=1, le=100),
    search:    Optional[str] = Query(None),
    status:    Optional[str] = Query(None),
    priority:  Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    current_user: CurrentUser    = Depends(get_current_user),
    repo:         PRRepository   = Depends(_repo),
):
    items, total = await repo.list(
        tenant_id=_tenant(current_user),
        page=page, size=size, search=search,
        status=status, priority=priority,
        from_date=from_date, to_date=to_date,
    )
    return PaginatedPRs(
        items=items, total=total, page=page, size=size,
        pages=PRRepository.pages(total, size),
    )


@router.post("", response_model=PRResponse, status_code=status.HTTP_201_CREATED)
async def create_pr(
    data: PRCreate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    svc:          PRService      = Depends(_svc),
):
    try:
        return await svc.create(current_user.tenant_id or 1, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{pr_id}", response_model=PRResponse)
async def get_pr(
    pr_id: int,
    current_user: CurrentUser  = Depends(get_current_user),
    repo:         PRRepository = Depends(_repo),
):
    pr = await repo.get(pr_id, _tenant(current_user))
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")
    return pr


@router.put("/{pr_id}", response_model=PRResponse)
async def update_pr(
    pr_id: int,
    data:  PRUpdate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo:         PRRepository   = Depends(_repo),
    svc:          PRService      = Depends(_svc),
):
    pr = await repo.get(pr_id, _tenant(current_user))
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")
    try:
        return await svc.update(pr, data, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{pr_id}/status", response_model=PRResponse)
async def change_pr_status(
    pr_id: int,
    body:  PRStatusUpdate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo:         PRRepository   = Depends(_repo),
    svc:          PRService      = Depends(_svc),
):
    pr = await repo.get(pr_id, _tenant(current_user))
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")
    try:
        return await svc.change_status(pr, body.status, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{pr_id}/cancel", response_model=PRResponse)
async def cancel_pr(
    pr_id: int,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo:         PRRepository   = Depends(_repo),
    svc:          PRService      = Depends(_svc),
):
    pr = await repo.get(pr_id, _tenant(current_user))
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")
    try:
        return await svc.cancel(pr, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{pr_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pr(
    pr_id: int,
    current_user: AdminOrAbove = Depends(require_admin_or_above),
    svc:          PRService    = Depends(_svc),
):
    try:
        deleted = await svc.delete(pr_id, _tenant(current_user), user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not deleted:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")
