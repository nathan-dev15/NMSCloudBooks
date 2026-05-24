from pydantic import BaseModel, EmailStr, ConfigDict
from app.models.tenant import DomainModule, SubscriptionPlan


class TenantCreate(BaseModel):
    name: str
    slug: str
    plan: SubscriptionPlan = SubscriptionPlan.BASIC
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    gstin: str | None = None


class TenantUpdate(BaseModel):
    name: str | None = None
    plan: SubscriptionPlan | None = None
    is_active: bool | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    gstin: str | None = None
    branding: dict | None = None


class ModuleToggleRequest(BaseModel):
    module: DomainModule
    enabled: bool


class TenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    is_active: bool
    plan: SubscriptionPlan
    enabled_modules: list
    branding: dict
    email: str | None
    phone: str | None
    gstin: str | None
