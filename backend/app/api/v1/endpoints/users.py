import math
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from app.core.deps import DB, CurrentUser, SuperAdmin, AdminOrAbove, PrimaryOrAbove, get_current_user, require_super_admin, require_admin_or_above, require_primary_or_above
from app.core.security import hash_password
from app.core.exceptions import NMSCBException
from app.models.user import UserRole
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserUpdate, UserResponse, PaginatedUsers

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=PaginatedUsers)
async def list_users(
    db: DB,
    current_user: AdminOrAbove = Depends(require_admin_or_above),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    role: UserRole | None = None,
    search: Optional[str] = Query(None),
):
    repo = UserRepository(db)
    if current_user.role == UserRole.SUPER_ADMIN:
        if role:
            users, total = await repo.list_by_role(role=role, page=page, size=size, search=search)
        else:
            users, total = await repo.list_all(page=page, size=size)
    else:
        users, total = await repo.list_by_tenant(
            tenant_id=current_user.tenant_id, role=role, page=page, size=size
        )
    return PaginatedUsers(
        items=users,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{user_id}/team", response_model=PaginatedUsers)
async def get_admin_team(
    user_id: int,
    db: DB,
    current_user: AdminOrAbove = Depends(require_admin_or_above),
    role: UserRole | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=200),
):
    """Super Admin only: list all users created by a specific admin."""
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    repo = UserRepository(db)
    users, total = await repo.list_by_creator(created_by=user_id, role=role, page=page, size=size)
    return PaginatedUsers(
        items=users, total=total, page=page, size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{user_id}/logs")
async def get_user_logs(
    user_id: int,
    db: DB,
    current_user: AdminOrAbove = Depends(require_admin_or_above),
    limit: int = Query(50, ge=1, le=200),
):
    """Get audit log entries created by a user."""
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    logs = await repo.get_user_logs(user_id, limit=limit)
    return [
        {
            "id": log.id,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "description": log.description,
            "status": log.status,
            "timestamp": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(payload: UserCreate, db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    if not current_user.can_create_role(payload.role):
        raise HTTPException(status_code=403, detail=f"You cannot create users with role '{payload.role.value}'")

    repo = UserRepository(db)
    existing = await repo.get_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    tenant_id = payload.tenant_id or current_user.tenant_id

    # Auto-link admin_id for primary/secondary users created by an admin
    admin_id = None
    if payload.role in (UserRole.PRIMARY_USER, UserRole.SECONDARY_USER):
        if current_user.role == UserRole.ADMIN:
            admin_id = current_user.id
        elif payload.admin_id:
            admin_id = payload.admin_id

    # Numeric role_id
    ROLE_ID_MAP = {
        UserRole.SUPER_ADMIN:    1,
        UserRole.ADMIN:          2,
        UserRole.PRIMARY_USER:   3,
        UserRole.SECONDARY_USER: 4,
    }
    role_id = ROLE_ID_MAP.get(payload.role, 5)

    user = await repo.create(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        role_id=role_id,
        phone=payload.phone,
        tenant_id=tenant_id,
        created_by=current_user.id,
        admin_id=admin_id,
    )
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: DB, current_user: CurrentUser = Depends(get_current_user)):
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Users can only view themselves unless Admin+
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.ADMIN):
        if current_user.id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(user_id: int, payload: UserUpdate, db: DB, current_user: CurrentUser = Depends(get_current_user)):
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Only self or Admin+ can update
    if current_user.id != user_id and current_user.role not in (UserRole.SUPER_ADMIN, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Access denied")

    # Only Admin+ can toggle is_active
    if payload.is_active is not None and current_user.role not in (UserRole.SUPER_ADMIN, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Cannot change account status")

    updated = await repo.update(user, **payload.model_dump(exclude_none=True))
    return updated


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: int, db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not current_user.has_higher_privilege_than(user):
        raise HTTPException(status_code=403, detail="Cannot delete a user with equal or higher privilege")
    user.soft_delete(user_id=current_user.id)
    await db.flush()
