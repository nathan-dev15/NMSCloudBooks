from sqlalchemy import Boolean, Integer, Numeric, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class SubscriptionPlan(Base, TimestampMixin):
    """Dynamic subscription plan — managed by Super Admin."""
    __tablename__ = "tenant_subscription_plans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    price_yearly: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    max_users: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_companies: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_quarterly: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    trial_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    enabled_modules: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    features: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    tenants: Mapped[list["Tenant"]] = relationship("Tenant", back_populates="subscription_plan", lazy="select")
