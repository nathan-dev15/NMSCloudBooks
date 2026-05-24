from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from app.models.inventory import ProductStatus, ProductType, StockTxnType


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name:        str = Field(..., max_length=100)
    slug:        str = Field(..., max_length=100, pattern=r"^[a-z0-9-]+$")
    parent_id:   Optional[int] = None
    description: Optional[str] = None
    is_active:   bool = True


class CategoryUpdate(BaseModel):
    name:        Optional[str]  = None
    description: Optional[str]  = None
    is_active:   Optional[bool] = None


class CategoryResponse(BaseModel):
    id:          int
    tenant_id:   int
    parent_id:   Optional[int]
    name:        str
    slug:        str
    description: Optional[str]
    is_active:   bool

    model_config = {"from_attributes": True}


# ── Warehouse ─────────────────────────────────────────────────────────────────

class WarehouseCreate(BaseModel):
    name:       str = Field(..., max_length=150)
    code:       Optional[str] = None
    address:    Optional[str] = None
    is_active:  bool = True
    is_default: bool = False
    manager_id: Optional[int] = None


class WarehouseUpdate(BaseModel):
    name:       Optional[str]  = None
    code:       Optional[str]  = None
    address:    Optional[str]  = None
    is_active:  Optional[bool] = None
    is_default: Optional[bool] = None
    manager_id: Optional[int]  = None


class WarehouseResponse(BaseModel):
    id:         int
    tenant_id:  int
    name:       str
    code:       Optional[str]
    address:    Optional[str]
    is_active:  bool
    is_default: bool
    manager_id: Optional[int]

    model_config = {"from_attributes": True}


# ── Product ───────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    category_id:     Optional[int]   = None
    name:            str             = Field(..., max_length=255)
    sku:             Optional[str]   = None
    barcode:         Optional[str]   = None
    hsn_sac:         Optional[str]   = None
    description:     Optional[str]   = None
    product_type:    ProductType     = ProductType.GOODS
    status:          ProductStatus   = ProductStatus.ACTIVE
    unit:            str             = "nos"
    purchase_price:  float           = Field(0.0, ge=0)
    selling_price:   float           = Field(0.0, ge=0)
    mrp:             float           = Field(0.0, ge=0)
    tax_rate:        float           = Field(18.0, ge=0, le=28)
    reorder_level:   float           = Field(0.0, ge=0)
    reorder_qty:     float           = Field(0.0, ge=0)
    max_stock_level: float           = Field(0.0, ge=0)
    track_inventory: bool            = True
    allow_negative:  bool            = False
    brand:           Optional[str]   = None
    tags:            list[str]       = []
    attributes:      dict            = {}


class ProductUpdate(BaseModel):
    category_id:     Optional[int]           = None
    name:            Optional[str]           = None
    sku:             Optional[str]           = None
    barcode:         Optional[str]           = None
    hsn_sac:         Optional[str]           = None
    description:     Optional[str]           = None
    product_type:    Optional[ProductType]   = None
    status:          Optional[ProductStatus] = None
    unit:            Optional[str]           = None
    purchase_price:  Optional[float]         = None
    selling_price:   Optional[float]         = None
    mrp:             Optional[float]         = None
    tax_rate:        Optional[float]         = None
    reorder_level:   Optional[float]         = None
    reorder_qty:     Optional[float]         = None
    max_stock_level: Optional[float]         = None
    track_inventory: Optional[bool]          = None
    allow_negative:  Optional[bool]          = None
    brand:           Optional[str]           = None
    tags:            Optional[list[str]]     = None
    attributes:      Optional[dict]          = None


# ── InventoryLevel ────────────────────────────────────────────────────────────

class InventoryLevelResponse(BaseModel):
    id:            int
    product_id:    int
    warehouse_id:  int
    qty_on_hand:   float
    qty_reserved:  float
    qty_available: float

    model_config = {"from_attributes": True}


class ProductResponse(ProductCreate):
    id:           int
    tenant_id:    int
    stock_levels: list[InventoryLevelResponse] = []

    model_config = {"from_attributes": True}


class ProductListItem(BaseModel):
    id:            int
    name:          str
    sku:           Optional[str]
    category_id:   Optional[int]
    product_type:  ProductType
    status:        ProductStatus
    unit:          str
    selling_price: float
    tax_rate:      float
    reorder_level: float
    total_stock:   float = 0.0   # sum across all warehouses

    model_config = {"from_attributes": True}


class PaginatedProducts(BaseModel):
    items: list[ProductListItem]
    total: int
    page:  int
    size:  int
    pages: int


# ── Stock Transaction ─────────────────────────────────────────────────────────

class StockAdjust(BaseModel):
    warehouse_id: int
    txn_type:     StockTxnType
    qty:          float = Field(..., ne=0)
    unit_cost:    float = Field(0.0, ge=0)
    notes:        Optional[str]  = None
    batch_no:     Optional[str]  = None
    expiry_date:  Optional[str]  = None
    ref_type:     Optional[str]  = None
    ref_id:       Optional[int]  = None


class StockTxnResponse(BaseModel):
    id:            int
    tenant_id:     int
    product_id:    int
    warehouse_id:  int
    created_by_id: Optional[int]
    txn_type:      StockTxnType
    qty:           float
    unit_cost:     float
    ref_type:      Optional[str]
    ref_id:        Optional[int]
    notes:         Optional[str]
    batch_no:      Optional[str]
    expiry_date:   Optional[str]
    created_at:    str

    model_config = {"from_attributes": True}


class PaginatedTxns(BaseModel):
    items: list[StockTxnResponse]
    total: int
    page:  int
    size:  int
    pages: int


# ── Low-stock report ──────────────────────────────────────────────────────────

class LowStockItem(BaseModel):
    product_id:    int
    product_name:  str
    sku:           Optional[str]
    warehouse_id:  int
    warehouse_name: str
    qty_available: float
    reorder_level: float
    reorder_qty:   float
