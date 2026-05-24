import enum
from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin, UUIDMixin


class POStatus(str, enum.Enum):
    DRAFT      = "draft"
    PENDING    = "pending"      # submitted, awaiting approval
    APPROVED   = "approved"
    ORDERED    = "ordered"      # sent to vendor
    PARTIAL    = "partial"      # partial receipt
    RECEIVED   = "received"     # fully received
    CANCELLED  = "cancelled"
    CLOSED     = "closed"


class POPriority(str, enum.Enum):
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"
    URGENT = "urgent"


class PurchaseOrder(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "purchase_orders"

    id:            Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id:     Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id:     Mapped[int | None] = mapped_column(Integer, ForeignKey("customer_master.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)
    approved_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)

    # Numbering
    po_number:    Mapped[str]      = mapped_column(String(50), nullable=False, index=True, unique=True)
    reference_no: Mapped[str|None] = mapped_column(String(100), nullable=True)

    # Dates
    order_date:     Mapped[str]      = mapped_column(String(10), nullable=False)   # YYYY-MM-DD
    expected_date:  Mapped[str|None] = mapped_column(String(10), nullable=True)    # expected delivery
    approved_date:  Mapped[str|None] = mapped_column(String(10), nullable=True)
    received_date:  Mapped[str|None] = mapped_column(String(10), nullable=True)

    # Workflow
    status:   Mapped[POStatus]   = mapped_column(Enum(POStatus),   default=POStatus.DRAFT,   nullable=False, index=True)
    priority: Mapped[POPriority] = mapped_column(Enum(POPriority), default=POPriority.MEDIUM, nullable=False)

    # Vendor snapshot
    vendor_name:    Mapped[str|None] = mapped_column(String(255), nullable=True)
    vendor_address: Mapped[str|None] = mapped_column(Text, nullable=True)
    vendor_gstin:   Mapped[str|None] = mapped_column(String(15), nullable=True)

    # Financials
    currency:        Mapped[str]   = mapped_column(String(3),    default="INR",  nullable=False)
    subtotal:        Mapped[float] = mapped_column(Numeric(15,2), default=0.0,   nullable=False)
    tax_amount:      Mapped[float] = mapped_column(Numeric(15,2), default=0.0,   nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(15,2), default=0.0,   nullable=False)
    grand_total:     Mapped[float] = mapped_column(Numeric(15,2), default=0.0,   nullable=False)
    amount_received_value: Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)

    # Delivery
    delivery_address: Mapped[str|None] = mapped_column(Text, nullable=True)
    shipping_terms:   Mapped[str|None] = mapped_column(String(255), nullable=True)
    payment_terms:    Mapped[str|None] = mapped_column(String(255), nullable=True)

    # Notes
    notes:            Mapped[str|None] = mapped_column(Text, nullable=True)
    internal_notes:   Mapped[str|None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str|None] = mapped_column(Text, nullable=True)
    tags:             Mapped[list]     = mapped_column(JSON, default=list, nullable=False)

    # Relationships
    items: Mapped[list["POItem"]] = relationship("POItem", back_populates="purchase_order", cascade="all, delete-orphan")


class POItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "po_items"

    id:                Mapped[int] = mapped_column(primary_key=True, index=True)
    purchase_order_id: Mapped[int] = mapped_column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)

    item_order:   Mapped[int]      = mapped_column(Integer, default=0, nullable=False)
    description:  Mapped[str]      = mapped_column(String(500), nullable=False)
    sku:          Mapped[str|None] = mapped_column(String(100), nullable=True)
    hsn_sac:      Mapped[str|None] = mapped_column(String(20), nullable=True)
    unit:         Mapped[str|None] = mapped_column(String(20), nullable=True)
    quantity:     Mapped[float]    = mapped_column(Numeric(15,3), nullable=False)
    unit_price:   Mapped[float]    = mapped_column(Numeric(15,2), nullable=False)
    tax_rate:     Mapped[float]    = mapped_column(Numeric(5,2), default=0.0, nullable=False)  # GST %
    tax_amount:   Mapped[float]    = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    line_total:   Mapped[float]    = mapped_column(Numeric(15,2), nullable=False)

    qty_received: Mapped[float] = mapped_column(Numeric(15,3), default=0.0, nullable=False)
    is_closed:    Mapped[bool]  = mapped_column(Boolean, default=False, nullable=False)

    purchase_order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="items")
