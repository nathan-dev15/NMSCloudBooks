"""
General Billing Module — SOW §5.4
Covers: Service Catalog, Subscription Plans, Client Subscriptions,
        Recurring Invoice Templates, General Invoices.
"""
import enum
from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin


class BillingCycle(str, enum.Enum):
    DAILY      = "daily"
    WEEKLY     = "weekly"
    MONTHLY    = "monthly"
    QUARTERLY  = "quarterly"
    HALF_YEARLY = "half_yearly"
    ANNUAL     = "annual"
    ONE_TIME   = "one_time"


class SubscriptionStatus(str, enum.Enum):
    TRIAL    = "trial"
    ACTIVE   = "active"
    PAUSED   = "paused"
    EXPIRED  = "expired"
    CANCELLED = "cancelled"


class GenInvoiceStatus(str, enum.Enum):
    DRAFT     = "draft"
    SENT      = "sent"
    PAID      = "paid"
    PARTIAL   = "partial"
    OVERDUE   = "overdue"
    CANCELLED = "cancelled"


class RecurringStatus(str, enum.Enum):
    ACTIVE   = "active"
    PAUSED   = "paused"
    STOPPED  = "stopped"


# ── Service Category ──────────────────────────────────────────────────────────

class ServiceCategory(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "service_categories"

    id:        Mapped[int]      = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int]      = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name:      Mapped[str]      = mapped_column(String(100), nullable=False)
    slug:      Mapped[str]      = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str|None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool]     = mapped_column(Boolean, default=True, nullable=False)

    services: Mapped[list["Service"]] = relationship("Service", back_populates="category")


# ── Service ────────────────────────────────────────────────────────────────────

class Service(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "services"

    id:          Mapped[int]      = mapped_column(primary_key=True, index=True)
    tenant_id:   Mapped[int]      = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id: Mapped[int|None] = mapped_column(Integer, ForeignKey("service_categories.id", ondelete="SET NULL"), nullable=True, index=True)

    name:        Mapped[str]      = mapped_column(String(200), nullable=False, index=True)
    code:        Mapped[str|None] = mapped_column(String(50),  nullable=True,  index=True)
    description: Mapped[str|None] = mapped_column(Text, nullable=True)
    unit:        Mapped[str]      = mapped_column(String(30), default="hr", nullable=False)  # hr / visit / month / unit
    rate:        Mapped[float]    = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    tax_rate:    Mapped[float]    = mapped_column(Numeric(5,2),  default=18.0, nullable=False)
    hsn_sac:     Mapped[str|None] = mapped_column(String(20), nullable=True)
    is_active:   Mapped[bool]     = mapped_column(Boolean, default=True, nullable=False)
    is_recurring_eligible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes:       Mapped[str|None] = mapped_column(Text, nullable=True)
    tags:        Mapped[list]     = mapped_column(JSON, default=list, nullable=False)

    category: Mapped["ServiceCategory"] = relationship("ServiceCategory", back_populates="services")


# ── Subscription Plan ─────────────────────────────────────────────────────────

class SubscriptionPlanModel(Base, TimestampMixin, SoftDeleteMixin):
    """Reusable plan template (e.g., 'Basic AMC', 'Premium Support')."""
    __tablename__ = "subscription_plans"

    id:          Mapped[int]           = mapped_column(primary_key=True, index=True)
    tenant_id:   Mapped[int]           = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name:        Mapped[str]           = mapped_column(String(150), nullable=False)
    code:        Mapped[str|None]      = mapped_column(String(50),  nullable=True, index=True)
    description: Mapped[str|None]      = mapped_column(Text, nullable=True)
    billing_cycle: Mapped[BillingCycle] = mapped_column(Enum(BillingCycle), default=BillingCycle.MONTHLY, nullable=False)
    price:       Mapped[float]         = mapped_column(Numeric(15,2), nullable=False)
    tax_rate:    Mapped[float]         = mapped_column(Numeric(5,2),  default=18.0, nullable=False)
    trial_days:  Mapped[int]           = mapped_column(Integer, default=0, nullable=False)
    max_users:   Mapped[int|None]      = mapped_column(Integer, nullable=True)
    features:    Mapped[list]          = mapped_column(JSON, default=list, nullable=False)  # feature bullet list
    is_active:   Mapped[bool]          = mapped_column(Boolean, default=True, nullable=False)
    is_public:   Mapped[bool]          = mapped_column(Boolean, default=True, nullable=False)
    sort_order:  Mapped[int]           = mapped_column(Integer, default=0, nullable=False)
    currency:    Mapped[str]           = mapped_column(String(3), default="INR", nullable=False)

    subscriptions: Mapped[list["ClientSubscription"]] = relationship("ClientSubscription", back_populates="plan")


# ── Client Subscription ───────────────────────────────────────────────────────

class ClientSubscription(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "client_subscriptions"

    id:          Mapped[int]                = mapped_column(primary_key=True, index=True)
    tenant_id:   Mapped[int]                = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id:   Mapped[int]                = mapped_column(Integer, ForeignKey("customer_master.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id:     Mapped[int]                = mapped_column(Integer, ForeignKey("subscription_plans.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_by_id: Mapped[int|None]         = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)

    status:         Mapped[SubscriptionStatus] = mapped_column(Enum(SubscriptionStatus), default=SubscriptionStatus.TRIAL, nullable=False, index=True)
    start_date:     Mapped[str]               = mapped_column(String(10), nullable=False)
    trial_end_date: Mapped[str|None]          = mapped_column(String(10), nullable=True)
    next_billing_date: Mapped[str|None]       = mapped_column(String(10), nullable=True)
    end_date:       Mapped[str|None]          = mapped_column(String(10), nullable=True)
    cancelled_at:   Mapped[str|None]          = mapped_column(String(10), nullable=True)
    cancellation_reason: Mapped[str|None]     = mapped_column(Text, nullable=True)

    # Overrides from plan (allow per-client pricing)
    custom_price:    Mapped[float|None]  = mapped_column(Numeric(15,2), nullable=True)
    discount_pct:    Mapped[float]       = mapped_column(Numeric(5,2), default=0.0, nullable=False)
    auto_renew:      Mapped[bool]        = mapped_column(Boolean, default=True, nullable=False)
    invoices_generated: Mapped[int]      = mapped_column(Integer, default=0, nullable=False)
    total_billed:    Mapped[float]       = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    notes:           Mapped[str|None]    = mapped_column(Text, nullable=True)

    plan: Mapped["SubscriptionPlanModel"] = relationship("SubscriptionPlanModel", back_populates="subscriptions")
    invoices: Mapped[list["GenInvoice"]]  = relationship("GenInvoice", back_populates="subscription")


# ── Recurring Invoice Template ────────────────────────────────────────────────

class RecurringTemplate(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "recurring_templates"

    id:          Mapped[int]              = mapped_column(primary_key=True, index=True)
    tenant_id:   Mapped[int]              = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id:   Mapped[int]              = mapped_column(Integer, ForeignKey("customer_master.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_id: Mapped[int|None]       = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)

    name:          Mapped[str]            = mapped_column(String(200), nullable=False)
    billing_cycle: Mapped[BillingCycle]   = mapped_column(Enum(BillingCycle), nullable=False)
    status:        Mapped[RecurringStatus] = mapped_column(Enum(RecurringStatus), default=RecurringStatus.ACTIVE, nullable=False)
    next_run_date: Mapped[str]            = mapped_column(String(10), nullable=False)   # YYYY-MM-DD
    end_date:      Mapped[str|None]       = mapped_column(String(10), nullable=True)    # null = forever
    payment_due_days: Mapped[int]         = mapped_column(Integer, default=30, nullable=False)
    currency:      Mapped[str]            = mapped_column(String(3), default="INR", nullable=False)
    notes:         Mapped[str|None]       = mapped_column(Text, nullable=True)
    line_items:    Mapped[list]           = mapped_column(JSON, default=list, nullable=False)
    # [{description, quantity, rate, tax_rate, hsn_sac}]

    invoices_generated: Mapped[int]   = mapped_column(Integer, default=0, nullable=False)


# ── General Invoice ────────────────────────────────────────────────────────────

class GenInvoice(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "gen_invoices"

    id:               Mapped[int]              = mapped_column(primary_key=True, index=True)
    tenant_id:        Mapped[int]              = mapped_column(Integer, ForeignKey("tenants.id",   ondelete="CASCADE"),  nullable=False, index=True)
    client_id:        Mapped[int]              = mapped_column(Integer, ForeignKey("customer_master.id",   ondelete="RESTRICT"), nullable=False, index=True)
    subscription_id:  Mapped[int|None]         = mapped_column(Integer, ForeignKey("client_subscriptions.id", ondelete="SET NULL"), nullable=True)
    template_id:      Mapped[int|None]         = mapped_column(Integer, ForeignKey("recurring_templates.id",  ondelete="SET NULL"), nullable=True)
    created_by_id:    Mapped[int|None]         = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)

    invoice_number:   Mapped[str]              = mapped_column(String(50),   nullable=False, unique=True, index=True)
    reference_no:     Mapped[str|None]         = mapped_column(String(100),  nullable=True)
    invoice_date:     Mapped[str]              = mapped_column(String(10),   nullable=False)
    due_date:         Mapped[str]              = mapped_column(String(10),   nullable=False)
    service_period_start: Mapped[str|None]     = mapped_column(String(10),   nullable=True)
    service_period_end:   Mapped[str|None]     = mapped_column(String(10),   nullable=True)

    status:           Mapped[GenInvoiceStatus] = mapped_column(Enum(GenInvoiceStatus), default=GenInvoiceStatus.DRAFT, nullable=False, index=True)
    currency:         Mapped[str]              = mapped_column(String(3),    default="INR", nullable=False)

    subtotal:         Mapped[float]            = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    discount_amount:  Mapped[float]            = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    taxable_amount:   Mapped[float]            = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    tax_amount:       Mapped[float]            = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    round_off:        Mapped[float]            = mapped_column(Numeric(5,2),  default=0.0, nullable=False)
    grand_total:      Mapped[float]            = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    amount_paid:      Mapped[float]            = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    amount_due:       Mapped[float]            = mapped_column(Numeric(15,2), default=0.0, nullable=False)

    billing_name:     Mapped[str|None]         = mapped_column(String(255), nullable=True)
    notes:            Mapped[str|None]         = mapped_column(Text, nullable=True)
    terms:            Mapped[str|None]         = mapped_column(Text, nullable=True)
    tags:             Mapped[list]             = mapped_column(JSON, default=list, nullable=False)

    items:        Mapped[list["GenInvoiceItem"]] = relationship("GenInvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    subscription: Mapped["ClientSubscription"]   = relationship("ClientSubscription", back_populates="invoices")


class GenInvoiceItem(Base, TimestampMixin):
    __tablename__ = "gen_invoice_items"

    id:          Mapped[int]   = mapped_column(primary_key=True, index=True)
    invoice_id:  Mapped[int]   = mapped_column(Integer, ForeignKey("gen_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id:  Mapped[int|None] = mapped_column(Integer, ForeignKey("services.id", ondelete="SET NULL"), nullable=True)

    item_order:   Mapped[int]      = mapped_column(Integer, default=0, nullable=False)
    description:  Mapped[str]      = mapped_column(String(500), nullable=False)
    hsn_sac:      Mapped[str|None] = mapped_column(String(20),  nullable=True)
    unit:         Mapped[str]      = mapped_column(String(30),  default="hr", nullable=False)
    quantity:     Mapped[float]    = mapped_column(Numeric(15,3), nullable=False)
    rate:         Mapped[float]    = mapped_column(Numeric(15,2), nullable=False)
    discount_pct: Mapped[float]    = mapped_column(Numeric(5,2),  default=0.0, nullable=False)
    tax_rate:     Mapped[float]    = mapped_column(Numeric(5,2),  default=18.0, nullable=False)
    tax_amount:   Mapped[float]    = mapped_column(Numeric(15,2), nullable=False)
    line_total:   Mapped[float]    = mapped_column(Numeric(15,2), nullable=False)

    invoice: Mapped["GenInvoice"] = relationship("GenInvoice", back_populates="items")
