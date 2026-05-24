from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password, hash_password, create_access_token, create_refresh_token, decode_token
from app.core.exceptions import UnauthorizedError, NMSCBException
from app.core.config import settings
from app.repositories.user_repository import UserRepository
from jose import jwt, JWTError


class AuthService:
    def __init__(self, db: AsyncSession):
        self.repo = UserRepository(db)

    async def login(self, email: str, password: str) -> dict:
        user = await self.repo.get_by_email(email)

        if not user or not verify_password(password, user.hashed_password):
            if user:
                await self._record_failed_attempt(user)
            raise UnauthorizedError("Invalid email or password")

        if not user.is_active:
            raise UnauthorizedError("Account is disabled")

        if user.locked_until:
            locked_until = datetime.fromisoformat(user.locked_until)
            if datetime.now(timezone.utc) < locked_until:
                raise UnauthorizedError("Account is temporarily locked. Try again later.")

        # Reset failed attempts on successful login
        await self.repo.update(user, failed_login_attempts=0, locked_until=None)

        token_data = {"role": user.role.value, "tenant_id": user.tenant_id}
        return {
            "access_token": create_access_token(user.id, extra=token_data),
            "refresh_token": create_refresh_token(user.id),
            "token_type": "bearer",
        }

    async def refresh(self, refresh_token: str) -> dict:
        try:
            payload = decode_token(refresh_token)
        except ValueError:
            raise UnauthorizedError("Invalid refresh token")

        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type")

        user = await self.repo.get_by_id(int(payload["sub"]))
        if not user or not user.is_active:
            raise UnauthorizedError("User not found or inactive")

        token_data = {"role": user.role.value, "tenant_id": user.tenant_id}
        return {
            "access_token": create_access_token(user.id, extra=token_data),
            "refresh_token": create_refresh_token(user.id),
            "token_type": "bearer",
        }

    async def forgot_password(self, email: str) -> dict:
        user = await self.repo.get_by_email(email)
        # Always return success to avoid user enumeration
        if not user or not user.is_active:
            return {"message": "If that email is registered, a reset link has been sent."}

        expire = datetime.now(timezone.utc) + timedelta(hours=1)
        token = jwt.encode(
            {"sub": str(user.id), "exp": expire, "type": "password_reset"},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        # No email service — return token directly (dev mode)
        return {
            "message": "If that email is registered, a reset link has been sent.",
            "reset_token": token,
        }

    async def reset_password(self, token: str, new_password: str) -> None:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        except JWTError:
            raise NMSCBException(status_code=400, message="Reset link is invalid or has expired.")

        if payload.get("type") != "password_reset":
            raise NMSCBException(status_code=400, message="Invalid reset token type.")

        user = await self.repo.get_by_id(int(payload["sub"]))
        if not user or not user.is_active:
            raise NMSCBException(status_code=400, message="User not found or account is disabled.")

        await self.repo.update(user, hashed_password=hash_password(new_password))

    async def _record_failed_attempt(self, user) -> None:
        attempts = user.failed_login_attempts + 1
        locked_until = None
        if attempts >= settings.MAX_LOGIN_ATTEMPTS:
            lockout = datetime.now(timezone.utc) + timedelta(minutes=settings.LOCKOUT_DURATION_MINUTES)
            locked_until = lockout.isoformat()
            attempts = 0
        await self.repo.update(user, failed_login_attempts=attempts, locked_until=locked_until)
