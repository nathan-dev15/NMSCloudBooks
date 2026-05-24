from typing import Optional
from pydantic import BaseModel, Field, model_validator
from app.models.delivery_challan import DCStatus


class DCItemCreate(BaseModel):
    item_order: int = 0
    description: str = Field(..., min_length=1, max_length=500)
    hsn_sac: Optional[str] = None
    unit: Optional[str] = None
    quantity: float = Field(..., gt=0)
    notes: Optional[str] = None


class DCItemResponse(DCItemCreate):
    id: int
    dc_id: int

    model_config = {"from_attributes": True}


class DCCreate(BaseModel):
    dc_number: Optional[str] = Field(None, min_length=1, max_length=100)
    reference_no: Optional[str] = None
    dc_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    delivery_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    client_id: Optional[int] = None
    from_address: Optional[str] = None
    to_address: Optional[str] = None
    consignee_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    notes: Optional[str] = None
    items: list[DCItemCreate] = []


class DCUpdate(BaseModel):
    dc_number: Optional[str] = Field(None, min_length=1, max_length=100)
    regenerate_dc_number: bool = False
    reference_no: Optional[str] = None
    dc_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    delivery_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    client_id: Optional[int] = None
    from_address: Optional[str] = None
    to_address: Optional[str] = None
    consignee_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def _check_number_conflict(self) -> "DCUpdate":
        if self.dc_number and self.regenerate_dc_number:
            raise ValueError("Provide either 'dc_number' or 'regenerate_dc_number', not both.")
        return self


class DCStatusUpdate(BaseModel):
    status: DCStatus


class DCResponse(BaseModel):
    id: int
    tenant_id: int
    client_id: Optional[int]
    created_by_id: Optional[int]
    dc_number: str
    reference_no: Optional[str]
    dc_date: str
    delivery_date: Optional[str]
    status: DCStatus
    from_address: Optional[str]
    to_address: Optional[str]
    consignee_name: Optional[str]
    vehicle_number: Optional[str]
    driver_name: Optional[str]
    notes: Optional[str]
    items: list[DCItemResponse]

    model_config = {"from_attributes": True}


class PaginatedDCs(BaseModel):
    items: list[DCResponse]
    total: int
    page: int
    size: int
    pages: int
