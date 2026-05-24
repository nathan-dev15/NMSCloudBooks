import enum
from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, Numeric, String, Text, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin, UUIDMixin


class InvoiceStatus(str, enum.Enum):
    DRAFT     = "draft"
    SENT      = "sent"
    PARTIAL   = "partial"
    PAID      = "paid"
    OVERDUE   = "overdue"
    CANCELLED = "cancelled"
    VOID      = "void"


class GSTType(str, enum.Enum):
    IGST      = "igst"
    CGST_SGST = "cgst_sgst"
    NONE      = "none"


class PaymentMode(str, enum.Enum):
    CASH   = "cash"
    BANK   = "bank"
    UPI    = "upi"
    CHEQUE = "cheque"
    NEFT   = "neft"
    CREDIT = "credit"


class Invoice(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Invoice header — PDF table: billing_invoices."""
    __tablename__ = "billing_invoices"

    id:            Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id:     Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id:     Mapped[int] = mapped_column(
        Integer, ForeignKey("customer_master.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    created_by_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )

    # PDF: project_id, project_block_id links
    project_id:       Mapped[int|None] = mapped_column(
        Integer, ForeignKey("civil_projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    project_block_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("civil_project_blocks.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Numbering
    invoice_number: Mapped[str]      = mapped_column(String(100), nullable=False, index=True, unique=True)
    invoice_type:   Mapped[str|None] = mapped_column(String(50), nullable=True)
    reference_no:   Mapped[str|None] = mapped_column(String(100), nullable=True)

    # Dates — PDF: invoice_date, due_date
    invoice_date: Mapped[str] = mapped_column(String(10), nullable=False)
    due_date:     Mapped[str] = mapped_column(String(10), nullable=False)
    supply_date:  Mapped[str|None] = mapped_column(String(10), nullable=True)

    # Status — PDF: DRAFT, SENT, PAID, OVERDUE, CANCELLED
    status:         Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), default=InvoiceStatus.DRAFT, nullable=False, index=True
    )
    is_active:      Mapped[bool]          = mapped_column(Boolean, default=True, nullable=False)

    # GST
    gst_type:        Mapped[GSTType]  = mapped_column(Enum(GSTType), default=GSTType.CGST_SGST, nullable=False)
    place_of_supply: Mapped[str|None] = mapped_column(String(50), nullable=True)

    # Amounts — PDF: subtotal, tax_amount, total_amount + GST breakdown
    currency:          Mapped[str]   = mapped_column(String(3), default="INR", nullable=False)
    subtotal:          Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    subtotal_amount:   Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    discount_amount:   Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    taxable_amount:    Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    cgst_amount:       Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    sgst_amount:       Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    igst_amount:       Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    tax_amount:        Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    total_tax_amount:  Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    round_off:         Mapped[float] = mapped_column(Numeric(5, 2),  default=0.0, nullable=False)
    grand_total:       Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    total_amount:      Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    amount_paid:       Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    amount_due:        Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)

    # Payment info — PDF: payment_status, payment_date, payment_mode
    payment_status: Mapped[str]      = mapped_column(String(50), default="UNPAID", nullable=False)
    payment_date:   Mapped[str|None] = mapped_column(String(20), nullable=True)
    payment_mode:   Mapped[str|None] = mapped_column(String(50), nullable=True)

    # Billing snapshot
    billing_name:    Mapped[str|None] = mapped_column(String(255), nullable=True)
    billing_address: Mapped[str|None] = mapped_column(Text, nullable=True)
    billing_gstin:   Mapped[str|None] = mapped_column(String(15), nullable=True)

    # Notes
    notes:        Mapped[str|None] = mapped_column(Text, nullable=True)
    terms:        Mapped[str|None] = mapped_column(Text, nullable=True)
    is_recurring: Mapped[bool]     = mapped_column(Boolean, default=False, nullable=False)
    tags:         Mapped[list]     = mapped_column(JSON, default=list, nullable=False)

    # Relationships
    items:    Mapped[list["InvoiceItem"]]    = relationship(
        "InvoiceItem",    back_populates="invoice", cascade="all, delete-orphan"
    )
    payments: Mapped[list["InvoicePayment"]] = relationship(
        "InvoicePayment", back_populates="invoice", cascade="all, delete-orphan"
    )


class InvoiceItem(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Invoice line items — PDF table: billing_invoice_line_items."""
    __tablename__ = "billing_invoice_line_items"

    id:         Mapped[int] = mapped_column(primary_key=True, index=True)
    invoice_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("billing_invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("inventory_products_master.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Item details — PDF: description, quantity, unit_price, line_total
    item_order:      Mapped[int]      = mapped_column(Integer, default=0, nullable=False)
    description:     Mapped[str]      = mapped_column(String(500), nullable=False)
    hsn_sac:         Mapped[str|None] = mapped_column(String(20), nullable=True)
    unit:            Mapped[str|None] = mapped_column(String(20), nullable=True)
    quantity:        Mapped[float]    = mapped_column(Numeric(15, 3), nullable=False)
    rate:            Mapped[float]    = mapped_column(Numeric(15, 2), nullable=False)
    unit_price:      Mapped[float]    = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    discount_pct:    Mapped[float]    = mapped_column(Numeric(5, 2),  default=0.0, nullable=False)
    taxable_amount:  Mapped[float]    = mapped_column(Numeric(15, 2), nullable=False, default=0.0)

    # Tax
    gst_rate:    Mapped[float] = mapped_column(Numeric(5, 2),  default=18.0, nullable=False)
    cgst_rate:   Mapped[float] = mapped_column(Numeric(5, 2),  default=0.0,  nullable=False)
    sgst_rate:   Mapped[float] = mapped_column(Numeric(5, 2),  default=0.0,  nullable=False)
    igst_rate:   Mapped[float] = mapped_column(Numeric(5, 2),  default=0.0,  nullable=False)
    cgst_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0,  nullable=False)
    sgst_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0,  nullable=False)
    igst_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0,  nullable=False)
    tax_amount:  Mapped[float] = mapped_column(Numeric(15, 2), default=0.0,  nullable=False)
    line_total:  Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0.0)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")


class InvoicePayment(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Payment records per invoice — not in PDF spec but retained for functionality."""
    __tablename__ = "invoice_payments"

    id:         Mapped[int] = mapped_column(primary_key=True, index=True)
    invoice_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("billing_invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recorded_by_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )

    payment_date: Mapped[str]           = mapped_column(String(10), nullable=False)
    amount:       Mapped[float]         = mapped_column(Numeric(15, 2), nullable=False)
    mode:         Mapped[PaymentMode]   = mapped_column(Enum(PaymentMode), default=PaymentMode.BANK, nullable=False)
    reference:    Mapped[str|None]      = mapped_column(String(100), nullable=True)
    notes:        Mapped[str|None]      = mapped_column(String(500), nullable=True)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments")
