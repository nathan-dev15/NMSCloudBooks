from pydantic import BaseModel, EmailStr, ConfigDict, Field
from app.models.tenant import DomainModule
from app.schemas.subscription_plan import SubscriptionPlanBrief
from typing import Optional


class TenantCreate(BaseModel):
    name: str
    slug: str
    subscription_plan_id: int
    billing_period: Optional[str] = 'trial'  # trial | quarterly | yearly
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = None
    gstin: Optional[str] = Field(default=None, max_length=50)


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    subscription_plan_id: Optional[int] = None
    billing_period: Optional[str] = None
    is_active: Optional[bool] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = None
    gstin: Optional[str] = Field(default=None, max_length=50)
    branding: Optional[dict] = None


class ModuleToggleRequest(BaseModel):
    module: DomainModule
    enabled: bool


class TenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    is_active: bool
    subscription_plan_id: Optional[int]
    subscription_plan: Optional[SubscriptionPlanBrief]
    billing_period: Optional[str]
    enabled_modules: list
    branding: dict
    email: Optional[str]
    phone: Optional[str]
    gstin: Optional[str]
