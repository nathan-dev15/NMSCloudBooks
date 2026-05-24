from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from app.models.general import (
    BillingCycle, SubscriptionStatus, GenInvoiceStatus, RecurringStatus,
)


# ── Service Category ──────────────────────────────────────────────────────────

class ServiceCategoryCreate(BaseModel):
    name:        str  = Field(..., max_length=100)
    slug:        str  = Field(..., max_length=100, pattern=r"^[a-z0-9-]+$")
    description: Optional[str] = None
    is_active:   bool = True


class ServiceCategoryResponse(ServiceCategoryCreate):
    id:        int
    tenant_id: int
    model_config = {"from_attributes": True}


# ── Service ───────────────────────────────────────────────────────────────────

class ServiceCreate(BaseModel):
    category_id:  Optional[int]   = None
    name:         str             = Field(..., max_length=200)
    code:         Optional[str]   = None
    description:  Optional[str]   = None
    unit:         str             = "hr"
    rate:         float           = Field(0.0, ge=0)
    tax_rate:     float           = Field(18.0, ge=0, le=28)
    hsn_sac:      Optional[str]   = None
    is_active:    bool            = True
    is_recurring_eligible: bool   = True
    notes:        Optional[str]   = None
    tags:         list[str]       = []


class ServiceUpdate(BaseModel):
    category_id:  Optional[int]   = None
    name:         Optional[str]   = None
    code:         Optional[str]   = None
    description:  Optional[str]   = None
    unit:         Optional[str]   = None
    rate:         Optional[float] = None
    tax_rate:     Optional[float] = None
    hsn_sac:      Optional[str]   = None
    is_active:    Optional[bool]  = None
    notes:        Optional[str]   = None
    tags:         Optional[list[str]] = None


class ServiceResponse(ServiceCreate):
    id:        int
    tenant_id: int
    model_config = {"from_attributes": True}


# ── Subscription Plan ─────────────────────────────────────────────────────────

class PlanCreate(BaseModel):
    name:          str          = Field(..., max_length=150)
    code:          Optional[str] = None
    description:   Optional[str] = None
    billing_cycle: BillingCycle = BillingCycle.MONTHLY
    price:         float        = Field(..., ge=0)
    tax_rate:      float        = Field(18.0, ge=0, le=28)
    trial_days:    int          = Field(0, ge=0)
    max_users:     Optional[int] = None
    features:      list[str]   = []
    is_active:     bool        = True
    is_public:     bool        = True
    sort_order:    int         = 0
    currency:      str         = "INR"


class PlanUpdate(BaseModel):
    name:          Optional[str]          = None
    description:   Optional[str]          = None
    billing_cycle: Optional[BillingCycle] = None
    price:         Optional[float]        = None
    tax_rate:      Optional[float]        = None
    trial_days:    Optional[int]          = None
    max_users:     Optional[int]          = None
    features:      Optional[list[str]]    = None
    is_active:     Optional[bool]         = None
    sort_order:    Optional[int]          = None


class PlanResponse(PlanCreate):
    id:        int
    tenant_id: int
    model_config = {"from_attributes": True}


# ── Client Subscription ───────────────────────────────────────────────────────

class SubscriptionCreate(BaseModel):
    client_id:        int
    plan_id:          int
    start_date:       str   = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    custom_price:     Optional[float] = None
    discount_pct:     float = Field(0.0, ge=0, le=100)
    auto_renew:       bool  = True
    notes:            Optional[str]   = None


class SubscriptionUpdate(BaseModel):
    status:           Optional[SubscriptionStatus] = None
    custom_price:     Optional[float]              = None
    discount_pct:     Optional[float]              = None
    auto_renew:       Optional[bool]               = None
    next_billing_date: Optional[str]               = None
    end_date:         Optional[str]                = None
    cancellation_reason: Optional[str]             = None
    notes:            Optional[str]                = None


class SubscriptionResponse(BaseModel):
    id:                  int
    tenant_id:           int
    client_id:           int
    plan_id:             int
    created_by_id:       Optional[int]
    status:              SubscriptionStatus
    start_date:          str
    trial_end_date:      Optional[str]
    next_billing_date:   Optional[str]
    end_date:            Optional[str]
    cancelled_at:        Optional[str]
    cancellation_reason: Optional[str]
    custom_price:        Optional[float]
    discount_pct:        float
    auto_renew:          bool
    invoices_generated:  int
    total_billed:        float
    notes:               Optional[str]
    model_config = {"from_attributes": True}


class PaginatedSubscriptions(BaseModel):
    items: list[SubscriptionResponse]
    total: int
    page:  int
    size:  int
    pages: int


# ── Recurring Template ────────────────────────────────────────────────────────

class RecurringLineItem(BaseModel):
    description:  str
    quantity:     float = Field(..., gt=0)
    rate:         float = Field(..., ge=0)
    tax_rate:     float = Field(18.0, ge=0, le=28)
    hsn_sac:      Optional[str] = None
    unit:         str   = "hr"


class RecurringTemplateCreate(BaseModel):
    client_id:        int
    name:             str           = Field(..., max_length=200)
    billing_cycle:    BillingCycle
    next_run_date:    str           = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date:         Optional[str] = None
    payment_due_days: int           = Field(30, ge=0)
    currency:         str           = "INR"
    notes:            Optional[str] = None
    line_items:       list[RecurringLineItem] = Field(..., min_length=1)


class RecurringTemplateResponse(BaseModel):
    id:                 int
    tenant_id:          int
    client_id:          int
    name:               str
    billing_cycle:      BillingCycle
    status:             RecurringStatus
    next_run_date:      str
    end_date:           Optional[str]
    payment_due_days:   int
    currency:           str
    notes:              Optional[str]
    line_items:         list
    invoices_generated: int
    model_config = {"from_attributes": True}


# ── General Invoice ───────────────────────────────────────────────────────────

class GenInvoiceItemCreate(BaseModel):
    service_id:   Optional[int]   = None
    description:  str             = Field(..., max_length=500)
    hsn_sac:      Optional[str]   = None
    unit:         str             = "hr"
    quantity:     float           = Field(..., gt=0)
    rate:         float           = Field(..., ge=0)
    discount_pct: float           = Field(0.0, ge=0, le=100)
    tax_rate:     float           = Field(18.0, ge=0, le=28)


class GenInvoiceItemResponse(BaseModel):
    id:           int
    invoice_id:   int
    service_id:   Optional[int]
    item_order:   int
    description:  str
    hsn_sac:      Optional[str]
    unit:         str
    quantity:     float
    rate:         float
    discount_pct: float
    tax_rate:     float
    tax_amount:   float
    line_total:   float
    model_config = {"from_attributes": True}


class GenInvoiceCreate(BaseModel):
    client_id:           int
    subscription_id:     Optional[int]   = None
    template_id:         Optional[int]   = None
    invoice_number:      Optional[str]   = None
    reference_no:        Optional[str]   = None
    invoice_date:        str             = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    due_date:            str             = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    service_period_start: Optional[str] = None
    service_period_end:   Optional[str] = None
    currency:            str             = "INR"
    discount_amount:     float           = Field(0.0, ge=0)
    notes:               Optional[str]   = None
    terms:               Optional[str]   = None
    tags:                list[str]       = []
    items:               list[GenInvoiceItemCreate] = Field(..., min_length=1)


class GenInvoiceUpdate(BaseModel):
    reference_no:        Optional[str]        = None
    invoice_date:        Optional[str]        = None
    due_date:            Optional[str]        = None
    service_period_start: Optional[str]       = None
    service_period_end:   Optional[str]       = None
    discount_amount:     Optional[float]      = None
    notes:               Optional[str]        = None
    terms:               Optional[str]        = None
    tags:                Optional[list[str]]  = None
    items:               Optional[list[GenInvoiceItemCreate]] = None


class GenInvoiceResponse(BaseModel):
    id:                   int
    tenant_id:            int
    client_id:            int
    subscription_id:      Optional[int]
    template_id:          Optional[int]
    created_by_id:        Optional[int]
    invoice_number:       str
    reference_no:         Optional[str]
    invoice_date:         str
    due_date:             str
    service_period_start: Optional[str]
    service_period_end:   Optional[str]
    status:               GenInvoiceStatus
    currency:             str
    subtotal:             float
    discount_amount:      float
    taxable_amount:       float
    tax_amount:           float
    round_off:            float
    grand_total:          float
    amount_paid:          float
    amount_due:           float
    billing_name:         Optional[str]
    notes:                Optional[str]
    terms:                Optional[str]
    tags:                 list[str]
    items:                list[GenInvoiceItemResponse] = []
    model_config = {"from_attributes": True}


class GenInvoiceListItem(BaseModel):
    id:             int
    invoice_number: str
    client_id:      int
    billing_name:   Optional[str]
    invoice_date:   str
    due_date:       str
    status:         GenInvoiceStatus
    grand_total:    float
    amount_due:     float
    currency:       str
    model_config = {"from_attributes": True}


class PaginatedGenInvoices(BaseModel):
    items: list[GenInvoiceListItem]
    total: int
    page:  int
    size:  int
    pages: int


class GenInvoiceStatusUpdate(BaseModel):
    status:      GenInvoiceStatus
    amount_paid: Optional[float] = None


class GenerateFromTemplate(BaseModel):
    template_id:  int
    invoice_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
