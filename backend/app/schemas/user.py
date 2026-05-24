from pydantic import BaseModel, EmailStr, field_validator, ConfigDict
from app.models.user import UserRole
from app.core.config import settings


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole
    phone: str | None = None
    tenant_id: int | None = None
    admin_id: int | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < settings.PASSWORD_MIN_LENGTH:
            raise ValueError(f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name cannot be blank")
        return v.strip()


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    is_active: bool | None = None
    preferences: dict | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    is_verified: bool
    phone: str | None
    avatar_url: str | None
    tenant_id: int | None
    preferences: dict


class UserListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    tenant_id: int | None


class PaginatedUsers(BaseModel):
    items: list[UserListResponse]
    total: int
    page: int
    size: int
    pages: int
