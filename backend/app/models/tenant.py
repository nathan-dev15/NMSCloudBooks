import enum
from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin


class DomainModule(str, enum.Enum):
    CIVIL = "civil"
    RETAIL = "retail"
    AGRICULTURE = "agriculture"
    GENERAL = "general"


class Tenant(Base, TimestampMixin, SoftDeleteMixin):
    """Represents a client organization (multi-tenant root)."""
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Subscription — FK to dynamic plan table
    subscription_plan_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("tenant_subscription_plans.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Domain modules enabled by Super Admin
    enabled_modules: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    # Branding (dynamic theming)
    branding: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "logo_url": None,
            "primary_color": "#1a73e8",
            "secondary_color": "#fbbc04",
            "accent_color": "#34a853",
            "font_family": "Inter",
            "company_name": "",
            "tagline": "",
            "header_config": {},
            "footer_config": {},
        },
        nullable=False,
    )

    # Billing
    billing_period: Mapped[str | None] = mapped_column(String(20), nullable=True)  # trial | quarterly | yearly

    # Contact
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Relationships
    subscription_plan: Mapped["SubscriptionPlan"] = relationship(
        "SubscriptionPlan", back_populates="tenants", lazy="select"
    )
    users: Mapped[list["User"]] = relationship("User", back_populates="tenant", lazy="select")

    def has_module(self, module: DomainModule) -> bool:
        return module.value in (self.enabled_modules or [])
