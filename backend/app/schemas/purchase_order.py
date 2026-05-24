from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field, model_validator
from app.models.purchase_order import POStatus, POPriority


# ── POItem ────────────────────────────────────────────────────────────────────

class POItemCreate(BaseModel):
    description: str   = Field(..., max_length=500)
    sku:         Optional[str] = None
    hsn_sac:     Optional[str] = None
    unit:        Optional[str] = None
    quantity:    float = Field(..., gt=0)
    unit_price:  float = Field(..., ge=0)
    tax_rate:    float = Field(0.0, ge=0, le=28)


class POItemResponse(BaseModel):
    id:                int
    purchase_order_id: int
    item_order:        int
    description:       str
    sku:               Optional[str]
    hsn_sac:           Optional[str]
    unit:              Optional[str]
    quantity:          float
    unit_price:        float
    tax_rate:          float
    tax_amount:        float
    line_total:        float
    qty_received:      float
    is_closed:         bool

    model_config = {"from_attributes": True}


# ── PurchaseOrder ─────────────────────────────────────────────────────────────

class POCreate(BaseModel):
    vendor_id:        Optional[int] = None
    po_number:        Optional[str] = None            # auto-generated if blank
    reference_no:     Optional[str] = None
    order_date:       str  = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    expected_date:    Optional[str] = None
    priority:         POPriority = POPriority.MEDIUM
    currency:         str = "INR"
    discount_amount:  float = Field(0.0, ge=0)
    delivery_address: Optional[str] = None
    shipping_terms:   Optional[str] = None
    payment_terms:    Optional[str] = None
    notes:            Optional[str] = None
    internal_notes:   Optional[str] = None
    tags:             list[str] = []
    items:            list[POItemCreate] = Field(..., min_length=1)


class POUpdate(BaseModel):
    # PO number — mutually exclusive options (DRAFT only)
    po_number:             Optional[str] = Field(None, min_length=1, max_length=100)
    regenerate_po_number:  bool          = False

    vendor_id:        Optional[int]       = None
    reference_no:     Optional[str]       = None
    order_date:       Optional[str]       = None
    expected_date:    Optional[str]       = None
    priority:         Optional[POPriority] = None
    discount_amount:  Optional[float]     = None
    delivery_address: Optional[str]       = None
    shipping_terms:   Optional[str]       = None
    payment_terms:    Optional[str]       = None
    notes:            Optional[str]       = None
    internal_notes:   Optional[str]       = None
    tags:             Optional[list[str]] = None
    items:            Optional[list[POItemCreate]] = None

    @model_validator(mode="after")
    def _check_po_number_conflict(self) -> "POUpdate":
        if self.po_number and self.regenerate_po_number:
            raise ValueError(
                "Provide either 'po_number' or 'regenerate_po_number', not both."
            )
        return self


class POResponse(BaseModel):
    id:                    int
    tenant_id:             int
    vendor_id:             Optional[int]
    created_by_id:         Optional[int]
    approved_by_id:        Optional[int]
    po_number:             str
    reference_no:          Optional[str]
    order_date:            str
    expected_date:         Optional[str]
    approved_date:         Optional[str]
    received_date:         Optional[str]
    status:                POStatus
    priority:              POPriority
    vendor_name:           Optional[str]
    vendor_address:        Optional[str]
    vendor_gstin:          Optional[str]
    currency:              str
    subtotal:              float
    tax_amount:            float
    discount_amount:       float
    grand_total:           float
    amount_received_value: float
    delivery_address:      Optional[str]
    shipping_terms:        Optional[str]
    payment_terms:         Optional[str]
    notes:                 Optional[str]
    internal_notes:        Optional[str]
    rejection_reason:      Optional[str]
    tags:                  list[str]
    items:                 list[POItemResponse] = []

    model_config = {"from_attributes": True}


class POListItem(BaseModel):
    id:           int
    po_number:    str
    vendor_name:  Optional[str]
    order_date:   str
    expected_date: Optional[str]
    status:       POStatus
    priority:     POPriority
    grand_total:  float
    currency:     str

    model_config = {"from_attributes": True}


class PaginatedPOs(BaseModel):
    items: list[POListItem]
    total: int
    page:  int
    size:  int
    pages: int


class POStatusUpdate(BaseModel):
    status:           POStatus
    rejection_reason: Optional[str] = None


class POReceiveItem(BaseModel):
    item_id:      int
    qty_received: float = Field(..., gt=0)


class POReceive(BaseModel):
    received_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    items:         list[POReceiveItem]
    notes:         Optional[str] = None
