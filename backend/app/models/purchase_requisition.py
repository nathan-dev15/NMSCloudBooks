import enum
from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin


class PRStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONVERTED = "converted"
    CANCELLED = "cancelled"


class PRPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class PurchaseRequisition(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "purchase_requisitions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    requested_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )
    approved_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )

    pr_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    reference_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    request_date: Mapped[str] = mapped_column(String(10), nullable=False)
    required_by_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    approved_date: Mapped[str | None] = mapped_column(String(10), nullable=True)

    status: Mapped[PRStatus] = mapped_column(
        Enum(PRStatus), nullable=False, default=PRStatus.DRAFT, index=True
    )
    priority: Mapped[PRPriority] = mapped_column(
        Enum(PRPriority), nullable=False, default=PRPriority.MEDIUM
    )

    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    purpose: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    items: Mapped[list["PRItem"]] = relationship(
        "PRItem", back_populates="requisition", cascade="all, delete-orphan",
        order_by="PRItem.item_order"
    )


class PRItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "pr_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    pr_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("purchase_requisitions.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    item_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    quantity: Mapped[float] = mapped_column(Numeric(15, 3), nullable=False)
    estimated_unit_price: Mapped[float] = mapped_column(Numeric(15, 2), default=0, nullable=False)
    estimated_total: Mapped[float] = mapped_column(Numeric(15, 2), default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    requisition: Mapped["PurchaseRequisition"] = relationship("PurchaseRequisition", back_populates="items")
