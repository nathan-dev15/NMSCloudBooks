import os
import uuid
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.core.deps import DB, CurrentUser, get_current_user
from app.core.security import verify_password, hash_password
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserResponse
from app.schemas.profile import ProfileUpdate, ChangePasswordRequest
from app.models.user import UserRole

router = APIRouter(prefix="/profile", tags=["Profile"])

_MEDIA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "media", "avatars")
_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_SIZE = 2 * 1024 * 1024  # 2 MB


@router.get("", response_model=UserResponse)
async def get_profile(current_user: CurrentUser = Depends(get_current_user)):
    return current_user


@router.patch("", response_model=UserResponse)
async def update_profile(
    payload: ProfileUpdate,
    db: DB,
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role == UserRole.SECONDARY_USER:
        raise HTTPException(status_code=403, detail="Secondary users cannot edit their profile")

    updates: dict = {}

    if payload.full_name is not None:
        updates["full_name"] = payload.full_name

    if payload.business_type_id is not None:
        if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.ADMIN):
            raise HTTPException(status_code=403, detail="Only admins can set business type")
        prefs = dict(current_user.preferences)
        prefs["business_type_id"] = payload.business_type_id
        updates["preferences"] = prefs

    if not updates:
        return current_user

    repo = UserRepository(db)
    return await repo.update(current_user, **updates)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db: DB,
    current_user: CurrentUser = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    repo = UserRepository(db)
    await repo.update(current_user, hashed_password=hash_password(payload.new_password))
    return {"message": "Password changed successfully"}


@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
    db: DB,
    current_user: CurrentUser = Depends(get_current_user),
    avatar: UploadFile = File(...),
):
    if avatar.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail="Avatar must be JPEG, PNG, or WebP")

    content = await avatar.read()
    if len(content) > _MAX_SIZE:
        raise HTTPException(status_code=413, detail="Avatar must be under 2 MB")

    ext = (avatar.filename or "avatar").rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp"}:
        ext = "jpg"

    os.makedirs(_MEDIA_DIR, exist_ok=True)
    filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"

    with open(os.path.join(_MEDIA_DIR, filename), "wb") as fh:
        fh.write(content)

    repo = UserRepository(db)
    return await repo.update(current_user, avatar_url=f"/media/avatars/{filename}")
