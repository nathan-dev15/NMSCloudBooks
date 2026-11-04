from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin


class Company(Base, TimestampMixin, SoftDeleteMixin):
    """
    A company profile created and owned by an Admin user.
    Scoped to the Admin's tenant for data isolation.
    Super Admin does not interact with this model.
    """
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Owned by the Admin who created it
    created_by_admin_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Tenant scoping (set automatically from admin's tenant)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Company identity
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Branding
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    seal_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    signature_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Invoice numbering
    invoice_prefix: Mapped[str] = mapped_column(String(20), nullable=False)
    invoice_starting_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # Contact
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    gstin: Mapped[str] = mapped_column(String(15), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    admin: Mapped["User"] = relationship("User", foreign_keys=[created_by_admin_id])
    tenant: Mapped["Tenant"] = relationship("Tenant", foreign_keys=[tenant_id])

    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_companies_tenant_slug"),
    )
