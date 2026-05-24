from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field, model_validator, field_validator
from app.models.invoice import InvoiceStatus, GSTType, PaymentMode


# ── InvoiceItem ───────────────────────────────────────────────────────────────

class InvoiceItemCreate(BaseModel):
    description:  str   = Field(..., max_length=500)
    hsn_sac:      Optional[str] = None
    unit:         Optional[str] = None
    quantity:     float = Field(..., gt=0)
    rate:         float = Field(..., ge=0)
    discount_pct: float = Field(0.0, ge=0, le=100)
    gst_rate:     float = Field(18.0, ge=0, le=28)   # total GST % (5/12/18/28)


class InvoiceItemResponse(BaseModel):
    id:             int
    invoice_id:     int
    item_order:     int
    description:    str
    hsn_sac:        Optional[str]
    unit:           Optional[str]
    quantity:       float
    rate:           float
    discount_pct:   float
    taxable_amount: float
    gst_rate:       float
    cgst_rate:      float
    sgst_rate:      float
    igst_rate:      float
    cgst_amount:    float
    sgst_amount:    float
    igst_amount:    float
    line_total:     float

    model_config = {"from_attributes": True}


# ── InvoicePayment ────────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    payment_date: str   = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    amount:       float = Field(..., gt=0)
    mode:         PaymentMode = PaymentMode.BANK
    reference:    Optional[str] = None
    notes:        Optional[str] = None


class PaymentResponse(PaymentCreate):
    id:              int
    invoice_id:      int
    recorded_by_id:  Optional[int]

    model_config = {"from_attributes": True}


# ── Invoice ───────────────────────────────────────────────────────────────────

class InvoiceCreate(BaseModel):
    client_id:       int
    invoice_number:  Optional[str] = None   # auto-generated if not provided
    reference_no:    Optional[str] = None
    invoice_date:    str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    due_date:        str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    supply_date:     Optional[str] = None
    gst_type:        GSTType = GSTType.CGST_SGST
    place_of_supply: Optional[str] = None
    currency:        str = "INR"
    discount_amount: float = Field(0.0, ge=0)   # header-level discount
    notes:           Optional[str] = None
    terms:           Optional[str] = None
    is_recurring:    bool = False
    tags:            list[str] = []
    items:           list[InvoiceItemCreate] = Field(..., min_length=1)


class InvoiceUpdate(BaseModel):
    # Invoice number — mutually exclusive options (DRAFT only)
    invoice_number:           Optional[str]  = Field(None, min_length=1, max_length=100)
    regenerate_invoice_number: bool          = False

    reference_no:    Optional[str] = None
    invoice_date:    Optional[str] = None
    due_date:        Optional[str] = None
    supply_date:     Optional[str] = None
    gst_type:        Optional[GSTType] = None
    place_of_supply: Optional[str] = None
    discount_amount: Optional[float] = None
    notes:           Optional[str] = None
    terms:           Optional[str] = None
    tags:            Optional[list[str]] = None
    items:           Optional[list[InvoiceItemCreate]] = None

    @model_validator(mode="after")
    def _check_invoice_number_conflict(self) -> "InvoiceUpdate":
        if self.invoice_number and self.regenerate_invoice_number:
            raise ValueError(
                "Provide either 'invoice_number' or 'regenerate_invoice_number', not both."
            )
        return self


class InvoiceResponse(BaseModel):
    id:               int
    tenant_id:        int
    client_id:        int
    created_by_id:    Optional[int]
    invoice_number:   str
    reference_no:     Optional[str]
    invoice_date:     str
    due_date:         str
    supply_date:      Optional[str]
    status:           InvoiceStatus
    gst_type:         GSTType
    place_of_supply:  Optional[str]
    currency:         str
    subtotal:         float
    discount_amount:  float
    taxable_amount:   float
    cgst_amount:      float
    sgst_amount:      float
    igst_amount:      float
    total_tax_amount: float
    round_off:        float
    grand_total:      float
    amount_paid:      float
    amount_due:       float
    billing_name:     Optional[str]
    billing_address:  Optional[str]
    billing_gstin:    Optional[str]
    notes:            Optional[str]
    terms:            Optional[str]
    is_recurring:     bool
    tags:             list[str]
    items:            list[InvoiceItemResponse] = []
    payments:         list[PaymentResponse]     = []

    model_config = {"from_attributes": True}


class InvoiceListItem(BaseModel):
    id:             int
    invoice_number: str
    client_id:      int
    invoice_date:   str
    due_date:       str
    status:         InvoiceStatus
    grand_total:    float
    amount_paid:    float
    amount_due:     float
    currency:       str

    model_config = {"from_attributes": True}


class PaginatedInvoices(BaseModel):
    items: list[InvoiceListItem]
    total: int
    page:  int
    size:  int
    pages: int


class InvoiceStatusUpdate(BaseModel):
    status: InvoiceStatus
