from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.core.exceptions import raise_401, raise_403
from app.models.user import User, UserRole
from app.repositories.user_repository import UserRepository

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        raise_401("Invalid or expired token")

    if payload.get("type") != "access":
        raise_401("Invalid token type")

    user_id = payload.get("sub")
    repo = UserRepository(db)
    user = await repo.get_by_id(int(user_id))

    if not user:
        raise_401("User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    return user


DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = User


def require_roles(*roles: UserRole):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise_403(f"Required role: {[r.value for r in roles]}")
        return current_user
    return checker


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.SUPER_ADMIN:
        raise_403("Super Admin access required")
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise_403("Admin access required")
    return current_user


def require_admin_or_above(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.ADMIN):
        raise_403("Admin access required")
    return current_user


def require_primary_or_above(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRIMARY_USER):
        raise_403("Primary User access or above required")
    return current_user


SuperAdmin = User
AdminOrAbove = User
PrimaryOrAbove = User
