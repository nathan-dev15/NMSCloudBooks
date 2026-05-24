from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from app.models.retail import StoreStatus, SaleStatus, PaymentMethod, PromotionType, LoyaltyTxnType


# ── Store ─────────────────────────────────────────────────────────────────────

class StoreCreate(BaseModel):
    name:       str = Field(..., max_length=150)
    code:       Optional[str] = None
    address:    Optional[str] = None
    phone:      Optional[str] = None
    gstin:      Optional[str] = None
    status:     StoreStatus   = StoreStatus.ACTIVE
    is_default: bool = False
    currency:   str  = "INR"
    settings:   dict = {}
    manager_id: Optional[int] = None


class StoreUpdate(BaseModel):
    name:       Optional[str]         = None
    code:       Optional[str]         = None
    address:    Optional[str]         = None
    phone:      Optional[str]         = None
    gstin:      Optional[str]         = None
    status:     Optional[StoreStatus] = None
    is_default: Optional[bool]        = None
    settings:   Optional[dict]        = None
    manager_id: Optional[int]         = None


class StoreResponse(BaseModel):
    id:         int
    tenant_id:  int
    name:       str
    code:       Optional[str]
    address:    Optional[str]
    phone:      Optional[str]
    gstin:      Optional[str]
    status:     StoreStatus
    is_default: bool
    currency:   str
    settings:   dict
    manager_id: Optional[int]

    model_config = {"from_attributes": True}


# ── POS Session ───────────────────────────────────────────────────────────────

class POSOpenSession(BaseModel):
    opening_cash: float = Field(0.0, ge=0)
    notes:        Optional[str] = None


class POSCloseSession(BaseModel):
    closing_cash: float = Field(..., ge=0)
    notes:        Optional[str] = None


class POSSessionResponse(BaseModel):
    id:              int
    store_id:        int
    cashier_id:      Optional[int]
    opened_at:       str
    closed_at:       Optional[str]
    opening_cash:    float
    closing_cash:    float
    expected_cash:   float
    cash_difference: float
    total_sales:     float
    total_refunds:   float
    is_open:         bool
    notes:           Optional[str]

    model_config = {"from_attributes": True}


# ── Sale ──────────────────────────────────────────────────────────────────────

class SaleItemCreate(BaseModel):
    product_id:   int
    quantity:     float = Field(..., gt=0)
    unit_price:   float = Field(..., ge=0)
    discount_pct: float = Field(0.0, ge=0, le=100)
    promotion_id: Optional[int] = None


class SaleCreate(BaseModel):
    store_id:        int
    session_id:      Optional[int]   = None
    customer_id:     Optional[int]   = None
    sale_date:       str             = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    sale_time:       Optional[str]   = None
    payment_method:  PaymentMethod   = PaymentMethod.CASH
    discount_amount: float           = Field(0.0, ge=0)
    amount_tendered: float           = Field(0.0, ge=0)
    loyalty_points_used: int         = Field(0, ge=0)
    notes:           Optional[str]   = None
    items:           list[SaleItemCreate] = Field(..., min_length=1)


class SaleItemResponse(BaseModel):
    id:            int
    sale_id:       int
    product_id:    int
    item_order:    int
    product_name:  str
    sku:           Optional[str]
    unit:          str
    quantity:      float
    unit_price:    float
    mrp:           float
    discount_pct:  float
    discount_amt:  float
    tax_rate:      float
    tax_amount:    float
    line_total:    float
    promotion_id:  Optional[int]

    model_config = {"from_attributes": True}


class SaleResponse(BaseModel):
    id:                    int
    tenant_id:             int
    store_id:              int
    session_id:            Optional[int]
    cashier_id:            Optional[int]
    customer_id:           Optional[int]
    bill_number:           str
    sale_date:             str
    sale_time:             Optional[str]
    status:                SaleStatus
    payment_method:        PaymentMethod
    subtotal:              float
    discount_amount:       float
    taxable_amount:        float
    tax_amount:            float
    round_off:             float
    grand_total:           float
    amount_tendered:       float
    change_due:            float
    loyalty_points_used:   int
    loyalty_points_earned: int
    notes:                 Optional[str]
    items:                 list[SaleItemResponse] = []

    model_config = {"from_attributes": True}


class SaleListItem(BaseModel):
    id:           int
    bill_number:  str
    sale_date:    str
    store_id:     int
    customer_id:  Optional[int]
    status:       SaleStatus
    grand_total:  float
    payment_method: PaymentMethod

    model_config = {"from_attributes": True}


class PaginatedSales(BaseModel):
    items: list[SaleListItem]
    total: int
    page:  int
    size:  int
    pages: int


class SaleRefund(BaseModel):
    reason:     str
    item_ids:   list[int] = []   # empty = full refund


# ── Promotion ─────────────────────────────────────────────────────────────────

class PromotionCreate(BaseModel):
    name:           str           = Field(..., max_length=150)
    code:           Optional[str] = None
    promo_type:     PromotionType
    discount_value: float         = Field(0.0, ge=0)
    buy_qty:        int           = 0
    get_qty:        int           = 0
    free_product_id: Optional[int] = None
    min_purchase:   float         = 0.0
    max_discount:   Optional[float] = None
    start_date:     str           = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date:       str           = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    usage_limit:    Optional[int] = None
    is_active:      bool          = True
    applicable_categories: list[int] = []
    applicable_products:   list[int] = []


class PromotionResponse(PromotionCreate):
    id:          int
    tenant_id:   int
    usage_count: int

    model_config = {"from_attributes": True}


# ── Loyalty ───────────────────────────────────────────────────────────────────

class LoyaltyAccountResponse(BaseModel):
    id:                int
    customer_id:       int
    points_balance:    int
    lifetime_earned:   int
    lifetime_redeemed: int
    tier:              str

    model_config = {"from_attributes": True}


class LoyaltyAdjust(BaseModel):
    points:      int
    txn_type:    LoyaltyTxnType = LoyaltyTxnType.ADJUST
    description: Optional[str] = None
