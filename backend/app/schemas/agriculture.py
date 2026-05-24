from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from app.models.agriculture import (
    LandUnit, CropSeason, CycleStatus, ExpenseCategory, AgriInvoiceStatus,
)


# ── Farm ──────────────────────────────────────────────────────────────────────

class FarmCreate(BaseModel):
    name:            str       = Field(..., max_length=150)
    farm_code:       Optional[str]   = None
    village:         Optional[str]   = None
    taluk:           Optional[str]   = None
    district:        Optional[str]   = None
    state:           Optional[str]   = None
    survey_no:       Optional[str]   = None
    total_area:      float     = Field(..., gt=0)
    land_unit:       LandUnit  = LandUnit.ACRE
    irrigated_area:  float     = Field(0.0, ge=0)
    soil_type:       Optional[str]   = None
    water_source:    Optional[str]   = None
    owner_id:        Optional[int]   = None
    manager_id:      Optional[int]   = None
    is_active:       bool      = True
    notes:           Optional[str]   = None
    geo_coords:      dict      = {}


class FarmUpdate(BaseModel):
    name:           Optional[str]      = None
    farm_code:      Optional[str]      = None
    village:        Optional[str]      = None
    taluk:          Optional[str]      = None
    district:       Optional[str]      = None
    state:          Optional[str]      = None
    survey_no:      Optional[str]      = None
    total_area:     Optional[float]    = None
    land_unit:      Optional[LandUnit] = None
    irrigated_area: Optional[float]    = None
    soil_type:      Optional[str]      = None
    water_source:   Optional[str]      = None
    owner_id:       Optional[int]      = None
    manager_id:     Optional[int]      = None
    is_active:      Optional[bool]     = None
    notes:          Optional[str]      = None
    geo_coords:     Optional[dict]     = None


class FarmResponse(FarmCreate):
    id:        int
    tenant_id: int

    model_config = {"from_attributes": True}


class FarmListItem(BaseModel):
    id:          int
    name:        str
    farm_code:   Optional[str]
    district:    Optional[str]
    state:       Optional[str]
    total_area:  float
    land_unit:   LandUnit
    is_active:   bool
    owner_id:    Optional[int]

    model_config = {"from_attributes": True}


class PaginatedFarms(BaseModel):
    items: list[FarmListItem]
    total: int
    page:  int
    size:  int
    pages: int


# ── Crop Cycle ────────────────────────────────────────────────────────────────

class CropCycleCreate(BaseModel):
    farm_id:               int
    crop_name:             str       = Field(..., max_length=100)
    variety:               Optional[str]     = None
    season:                CropSeason
    year:                  int       = Field(..., ge=2000, le=2100)
    sowing_date:           Optional[str]     = None
    expected_harvest_date: Optional[str]     = None
    area_cultivated:       float     = Field(..., gt=0)
    land_unit:             LandUnit  = LandUnit.ACRE
    expected_yield:        float     = Field(0.0, ge=0)
    yield_unit:            str       = "kg"
    notes:                 Optional[str]     = None
    tags:                  list[str] = []


class CropCycleUpdate(BaseModel):
    crop_name:             Optional[str]         = None
    variety:               Optional[str]         = None
    season:                Optional[CropSeason]  = None
    status:                Optional[CycleStatus] = None
    sowing_date:           Optional[str]         = None
    expected_harvest_date: Optional[str]         = None
    actual_harvest_date:   Optional[str]         = None
    area_cultivated:       Optional[float]       = None
    expected_yield:        Optional[float]       = None
    actual_yield:          Optional[float]       = None
    yield_unit:            Optional[str]         = None
    notes:                 Optional[str]         = None
    tags:                  Optional[list[str]]   = None


class CropCycleResponse(BaseModel):
    id:                    int
    farm_id:               int
    tenant_id:             int
    crop_name:             str
    variety:               Optional[str]
    season:                CropSeason
    year:                  int
    status:                CycleStatus
    sowing_date:           Optional[str]
    expected_harvest_date: Optional[str]
    actual_harvest_date:   Optional[str]
    area_cultivated:       float
    land_unit:             LandUnit
    expected_yield:        float
    actual_yield:          float
    yield_unit:            str
    total_expense:         float
    total_revenue:         float
    net_profit:            float
    notes:                 Optional[str]
    tags:                  list[str]

    model_config = {"from_attributes": True}


class PaginatedCycles(BaseModel):
    items: list[CropCycleResponse]
    total: int
    page:  int
    size:  int
    pages: int


# ── Farm Expense ──────────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    expense_date: str             = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    category:     ExpenseCategory
    description:  str             = Field(..., max_length=500)
    vendor_id:    Optional[int]   = None
    quantity:     Optional[float] = None
    unit:         Optional[str]   = None
    unit_cost:    Optional[float] = None
    amount:       float           = Field(..., gt=0)
    is_paid:      bool            = True
    receipt_no:   Optional[str]   = None
    notes:        Optional[str]   = None


class ExpenseResponse(ExpenseCreate):
    id:             int
    crop_cycle_id:  int
    recorded_by_id: Optional[int]

    model_config = {"from_attributes": True}


# ── Harvest Record ────────────────────────────────────────────────────────────

class HarvestCreate(BaseModel):
    harvest_date:     str   = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    quantity:         float = Field(..., gt=0)
    unit:             str   = "kg"
    quality_grade:    Optional[str]   = None
    moisture_pct:     Optional[float] = None
    market_rate:      float = Field(0.0, ge=0)
    sale_amount:      float = Field(0.0, ge=0)
    buyer_id:         Optional[int]   = None
    storage_location: Optional[str]   = None
    notes:            Optional[str]   = None


class HarvestResponse(HarvestCreate):
    id:             int
    crop_cycle_id:  int
    recorded_by_id: Optional[int]

    model_config = {"from_attributes": True}


# ── Agri Invoice ──────────────────────────────────────────────────────────────

class AgriInvoiceCreate(BaseModel):
    crop_cycle_id:  int
    buyer_id:       Optional[int]   = None
    invoice_number: Optional[str]   = None
    invoice_date:   str   = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    due_date:       str   = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    quantity:       float = Field(..., gt=0)
    unit:           str   = "kg"
    rate:           float = Field(..., ge=0)
    tax_amount:     float = Field(0.0, ge=0)
    currency:       str   = "INR"
    notes:          Optional[str]   = None


class AgriInvoiceResponse(BaseModel):
    id:             int
    tenant_id:      int
    crop_cycle_id:  int
    buyer_id:       Optional[int]
    created_by_id:  Optional[int]
    invoice_number: str
    invoice_date:   str
    due_date:       str
    status:         AgriInvoiceStatus
    crop_name:      str
    quantity:       float
    unit:           str
    rate:           float
    subtotal:       float
    tax_amount:     float
    grand_total:    float
    amount_paid:    float
    amount_due:     float
    currency:       str
    notes:          Optional[str]

    model_config = {"from_attributes": True}


class AgriInvoiceStatusUpdate(BaseModel):
    status:      AgriInvoiceStatus
    amount_paid: Optional[float] = None
