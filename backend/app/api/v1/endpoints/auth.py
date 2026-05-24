from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import DB, CurrentUser, get_current_user
from app.core.security import hash_password
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.services.auth_service import AuthService
from app.core.exceptions import NMSCBException

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: DB):
    service = AuthService(db)
    try:
        return await service.login(payload.email, payload.password)
    except NMSCBException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(payload: RefreshRequest, db: DB):
    service = AuthService(db)
    try:
        return await service.refresh(payload.refresh_token)
    except NMSCBException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/me")
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "is_active": current_user.is_active,
        "tenant_id": current_user.tenant_id,
        "preferences": current_user.preferences,
    }


@router.post("/logout")
async def logout(current_user: CurrentUser = Depends(get_current_user)):
    # Stateless JWT — client drops token; future: add to blocklist in Redis
    return {"message": "Logged out successfully"}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: DB):
    service = AuthService(db)
    try:
        result = await service.forgot_password(payload.email)
        return result
    except NMSCBException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: DB):
    service = AuthService(db)
    try:
        await service.reset_password(payload.token, payload.new_password)
        return {"message": "Password updated successfully"}
    except NMSCBException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.post("/setup", tags=["Setup"])
async def first_time_setup(db: DB):
    """
    Creates the initial SUPER_ADMIN account.
    Only works when NO users exist in the database (first-run only).
    Disable or remove this endpoint after initial setup.
    """
    from sqlalchemy import select, func
    from app.models.user import User, UserRole
    from app.repositories.user_repository import UserRepository

    # Block if any user already exists
    count = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    if count > 0:
        raise HTTPException(
            status_code=400,
            detail="Setup already complete. This endpoint is disabled once users exist."
        )

    repo = UserRepository(db)
    admin = await repo.create(
        email="admin@nmscloudbooks.com",
        full_name="Super Admin",
        hashed_password=hash_password("Admin@1234"),
        role=UserRole.SUPER_ADMIN,
        is_active=True,
        is_verified=True,
    )
    return {
        "message": "Super Admin created successfully.",
        "email": admin.email,
        "password": "Admin@1234",
        "note": "Change this password immediately after first login."
    }
