from pydantic import BaseModel, ConfigDict
from typing import Optional


class SubscriptionPlanCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    price_monthly: float = 0.0
    price_quarterly: float = 0.0
    price_yearly: float = 0.0
    trial_days: int = 30
    max_users: Optional[int] = None
    max_companies: Optional[int] = None
    enabled_modules: list = []
    features: list = []
    is_active: bool = True
    display_order: int = 0


class SubscriptionPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_monthly: Optional[float] = None
    price_quarterly: Optional[float] = None
    price_yearly: Optional[float] = None
    trial_days: Optional[int] = None
    max_users: Optional[int] = None
    max_companies: Optional[int] = None
    enabled_modules: Optional[list] = None
    features: Optional[list] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class SubscriptionPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: Optional[str]
    price_monthly: float
    price_quarterly: float
    price_yearly: float
    trial_days: int
    max_users: Optional[int]
    max_companies: Optional[int]
    enabled_modules: list
    features: list
    is_active: bool
    display_order: int


class SubscriptionPlanBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    price_monthly: float
    price_quarterly: float
    price_yearly: float
    trial_days: int
    max_users: Optional[int]
    max_companies: Optional[int]
    features: list
