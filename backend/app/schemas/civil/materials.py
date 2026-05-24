from pydantic import BaseModel, ConfigDict
from app.models.civil.materials import MaterialCategory, StockMovementType


class MaterialCatalogCreate(BaseModel):
    code: str
    name: str
    description: str | None = None
    category: MaterialCategory = MaterialCategory.OTHER
    is_tool: bool = False
    unit_of_measure: str = "nos"
    unit_price: float | None = None
    reorder_level: float | None = None
    specifications: dict = {}
    supplier_name: str | None = None
    supplier_contact: str | None = None


class MaterialCatalogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    description: str | None
    category: MaterialCategory
    is_tool: bool
    is_top5_tool: bool
    unit_of_measure: str
    unit_price: float | None
    reorder_level: float | None
    specifications: dict
    supplier_name: str | None


class StockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    material_id: int
    project_id: int
    block_id: int | None
    location_label: str | None
    quantity: float
    reserved_qty: float
    available_qty: float
    batch_number: str | None
    expiry_date: str | None


class StockAdjustRequest(BaseModel):
    quantity: float
    movement_type: StockMovementType
    notes: str | None = None
    unit_cost: float | None = None


class StockMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stock_id: int
    movement_type: StockMovementType
    quantity: float
    quantity_before: float
    quantity_after: float
    notes: str | None
