"""
Retail Billing Module — SOW §5.2
Covers: Stores, POS Sessions, Sales Transactions, Promotions, Loyalty.
"""
import enum
from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin


class StoreStatus(str, enum.Enum):
    ACTIVE   = "active"
    INACTIVE = "inactive"
    CLOSED   = "closed"


class SaleStatus(str, enum.Enum):
    DRAFT     = "draft"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REFUNDED  = "refunded"
    PARTIAL_REFUND = "partial_refund"


class PaymentMethod(str, enum.Enum):
    CASH     = "cash"
    CARD     = "card"
    UPI      = "upi"
    WALLET   = "wallet"
    SPLIT    = "split"     # multiple payment methods
    CREDIT   = "credit"    # charge to customer account


class PromotionType(str, enum.Enum):
    PERCENT_DISCOUNT  = "percent_discount"
    FLAT_DISCOUNT     = "flat_discount"
    BUY_X_GET_Y       = "buy_x_get_y"
    FREE_ITEM         = "free_item"
    LOYALTY_MULTIPLIER = "loyalty_multiplier"


class LoyaltyTxnType(str, enum.Enum):
    EARN   = "earn"
    REDEEM = "redeem"
    EXPIRE = "expire"
    ADJUST = "adjust"


# ── Store ─────────────────────────────────────────────────────────────────────

class Store(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "stores"

    id:         Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id:  Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    manager_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)

    name:        Mapped[str]         = mapped_column(String(150), nullable=False)
    code:        Mapped[str | None]  = mapped_column(String(20),  nullable=True, index=True)
    address:     Mapped[str | None]  = mapped_column(Text, nullable=True)
    phone:       Mapped[str | None]  = mapped_column(String(20),  nullable=True)
    gstin:       Mapped[str | None]  = mapped_column(String(15),  nullable=True)
    status:      Mapped[StoreStatus] = mapped_column(Enum(StoreStatus), default=StoreStatus.ACTIVE, nullable=False)
    is_default:  Mapped[bool]        = mapped_column(Boolean, default=False, nullable=False)
    currency:    Mapped[str]         = mapped_column(String(3), default="INR", nullable=False)
    settings:    Mapped[dict]        = mapped_column(JSON, default=dict, nullable=False)   # tax_inclusive, receipt_header, etc.

    pos_sessions: Mapped[list["POSSession"]] = relationship("POSSession", back_populates="store", cascade="all, delete-orphan")
    sales:        Mapped[list["Sale"]]       = relationship("Sale",       back_populates="store", cascade="all, delete-orphan")


# ── POS Session ───────────────────────────────────────────────────────────────

class POSSession(Base, TimestampMixin):
    __tablename__ = "pos_sessions"

    id:           Mapped[int] = mapped_column(primary_key=True, index=True)
    store_id:     Mapped[int] = mapped_column(Integer, ForeignKey("stores.id", ondelete="CASCADE"),  nullable=False, index=True)
    cashier_id:   Mapped[int] = mapped_column(Integer, ForeignKey("user_accounts.id",  ondelete="SET NULL"), nullable=True)

    opened_at:      Mapped[str]        = mapped_column(String(30), nullable=False)   # ISO datetime
    closed_at:      Mapped[str | None] = mapped_column(String(30), nullable=True)
    opening_cash:   Mapped[float]      = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    closing_cash:   Mapped[float]      = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    expected_cash:  Mapped[float]      = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    cash_difference: Mapped[float]     = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    total_sales:    Mapped[float]      = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    total_refunds:  Mapped[float]      = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    is_open:        Mapped[bool]       = mapped_column(Boolean, default=True, nullable=False)
    notes:          Mapped[str | None] = mapped_column(Text, nullable=True)

    store: Mapped["Store"]    = relationship("Store", back_populates="pos_sessions")
    sales: Mapped[list["Sale"]] = relationship("Sale", back_populates="session")


# ── Sale ──────────────────────────────────────────────────────────────────────

class Sale(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "sales"

    id:           Mapped[int]      = mapped_column(primary_key=True, index=True)
    tenant_id:    Mapped[int]      = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"),  nullable=False, index=True)
    store_id:     Mapped[int]      = mapped_column(Integer, ForeignKey("stores.id",  ondelete="RESTRICT"), nullable=False, index=True)
    session_id:   Mapped[int|None] = mapped_column(Integer, ForeignKey("pos_sessions.id", ondelete="SET NULL"), nullable=True)
    cashier_id:   Mapped[int|None] = mapped_column(Integer, ForeignKey("user_accounts.id",   ondelete="SET NULL"), nullable=True)
    customer_id:  Mapped[int|None] = mapped_column(Integer, ForeignKey("customer_master.id", ondelete="SET NULL"), nullable=True)

    # Numbering
    bill_number:  Mapped[str]       = mapped_column(String(50),  nullable=False, unique=True, index=True)
    sale_date:    Mapped[str]       = mapped_column(String(10),  nullable=False, index=True)  # YYYY-MM-DD
    sale_time:    Mapped[str|None]  = mapped_column(String(8),   nullable=True)               # HH:MM:SS

    status:       Mapped[SaleStatus]    = mapped_column(Enum(SaleStatus),    default=SaleStatus.DRAFT,   nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), default=PaymentMethod.CASH, nullable=False)

    # Amounts
    subtotal:        Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    taxable_amount:  Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    tax_amount:      Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    round_off:       Mapped[float] = mapped_column(Numeric(5,2),  default=0.0, nullable=False)
    grand_total:     Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    amount_tendered: Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    change_due:      Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    loyalty_points_used:   Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    loyalty_points_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    notes:           Mapped[str|None] = mapped_column(Text, nullable=True)
    is_exchange:     Mapped[bool]     = mapped_column(Boolean, default=False, nullable=False)
    original_sale_id: Mapped[int|None] = mapped_column(Integer, ForeignKey("sales.id", ondelete="SET NULL"), nullable=True)

    store:   Mapped["Store"]        = relationship("Store",      back_populates="sales")
    session: Mapped["POSSession"]   = relationship("POSSession", back_populates="sales")
    items:   Mapped[list["SaleItem"]] = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


# ── Sale Item ─────────────────────────────────────────────────────────────────

class SaleItem(Base, TimestampMixin):
    __tablename__ = "sale_items"

    id:          Mapped[int] = mapped_column(primary_key=True, index=True)
    sale_id:     Mapped[int] = mapped_column(Integer, ForeignKey("sales.id",    ondelete="CASCADE"), nullable=False, index=True)
    product_id:  Mapped[int] = mapped_column(Integer, ForeignKey("inventory_products_master.id", ondelete="RESTRICT"), nullable=False)

    item_order:    Mapped[int]      = mapped_column(Integer, default=0, nullable=False)
    product_name:  Mapped[str]      = mapped_column(String(255), nullable=False)  # snapshot at time of sale
    sku:           Mapped[str|None] = mapped_column(String(100), nullable=True)
    unit:          Mapped[str]      = mapped_column(String(20),  nullable=False, server_default="nos")
    quantity:      Mapped[float]    = mapped_column(Numeric(15,3), nullable=False)
    unit_price:    Mapped[float]    = mapped_column(Numeric(15,2), nullable=False)
    mrp:           Mapped[float]    = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    discount_pct:  Mapped[float]    = mapped_column(Numeric(5,2),  default=0.0, nullable=False)
    discount_amt:  Mapped[float]    = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    tax_rate:      Mapped[float]    = mapped_column(Numeric(5,2),  default=0.0, nullable=False)
    tax_amount:    Mapped[float]    = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    line_total:    Mapped[float]    = mapped_column(Numeric(15,2), nullable=False)
    promotion_id:  Mapped[int|None] = mapped_column(Integer, ForeignKey("promotions.id", ondelete="SET NULL"), nullable=True)

    sale: Mapped["Sale"] = relationship("Sale", back_populates="items")


# ── Promotion ─────────────────────────────────────────────────────────────────

class Promotion(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "promotions"

    id:        Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    name:           Mapped[str]           = mapped_column(String(150), nullable=False)
    code:           Mapped[str|None]      = mapped_column(String(50),  nullable=True, index=True)  # coupon code
    promo_type:     Mapped[PromotionType] = mapped_column(Enum(PromotionType), nullable=False)
    discount_value: Mapped[float]         = mapped_column(Numeric(10,2), default=0.0, nullable=False)  # % or flat amount
    buy_qty:        Mapped[int]           = mapped_column(Integer, default=0, nullable=False)     # for BUY_X_GET_Y
    get_qty:        Mapped[int]           = mapped_column(Integer, default=0, nullable=False)
    free_product_id: Mapped[int|None]     = mapped_column(Integer, ForeignKey("inventory_products_master.id", ondelete="SET NULL"), nullable=True)
    min_purchase:   Mapped[float]         = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    max_discount:   Mapped[float|None]    = mapped_column(Numeric(15,2), nullable=True)           # cap on % discounts
    start_date:     Mapped[str]           = mapped_column(String(10), nullable=False)
    end_date:       Mapped[str]           = mapped_column(String(10), nullable=False)
    usage_limit:    Mapped[int|None]      = mapped_column(Integer, nullable=True)
    usage_count:    Mapped[int]           = mapped_column(Integer, default=0, nullable=False)
    is_active:      Mapped[bool]          = mapped_column(Boolean, default=True, nullable=False)
    applicable_categories: Mapped[list]  = mapped_column(JSON, default=list, nullable=False)  # [] = all
    applicable_products:   Mapped[list]  = mapped_column(JSON, default=list, nullable=False)


# ── Loyalty ───────────────────────────────────────────────────────────────────

class LoyaltyAccount(Base, TimestampMixin):
    __tablename__ = "loyalty_accounts"

    id:          Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id:   Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customer_master.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    points_balance: Mapped[int]   = mapped_column(Integer, default=0, nullable=False)
    lifetime_earned: Mapped[int]  = mapped_column(Integer, default=0, nullable=False)
    lifetime_redeemed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tier:           Mapped[str]   = mapped_column(String(30), default="bronze", nullable=False)  # bronze/silver/gold/platinum

    transactions: Mapped[list["LoyaltyTransaction"]] = relationship("LoyaltyTransaction", back_populates="account", cascade="all, delete-orphan")


class LoyaltyTransaction(Base, TimestampMixin):
    __tablename__ = "loyalty_transactions"

    id:         Mapped[int] = mapped_column(primary_key=True, index=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("loyalty_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_id:    Mapped[int|None] = mapped_column(Integer, ForeignKey("sales.id", ondelete="SET NULL"), nullable=True)

    txn_type:   Mapped[LoyaltyTxnType] = mapped_column(Enum(LoyaltyTxnType), nullable=False)
    points:     Mapped[int]   = mapped_column(Integer, nullable=False)   # +ve earn, -ve redeem
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str|None] = mapped_column(String(255), nullable=True)
    expires_at:  Mapped[str|None]  = mapped_column(String(10), nullable=True)

    account: Mapped["LoyaltyAccount"] = relationship("LoyaltyAccount", back_populates="transactions")
