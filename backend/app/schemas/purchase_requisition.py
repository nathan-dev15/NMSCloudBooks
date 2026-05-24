from typing import Optional
from pydantic import BaseModel, Field, model_validator
from app.models.purchase_requisition import PRStatus, PRPriority


class PRItemCreate(BaseModel):
    item_order: int = 0
    description: str = Field(..., min_length=1, max_length=500)
    sku: Optional[str] = None
    unit: Optional[str] = None
    quantity: float = Field(..., gt=0)
    estimated_unit_price: float = Field(0, ge=0)
    notes: Optional[str] = None


class PRItemResponse(PRItemCreate):
    id: int
    pr_id: int
    estimated_total: float

    model_config = {"from_attributes": True}


class PRCreate(BaseModel):
    pr_number: Optional[str] = Field(None, min_length=1, max_length=100)
    reference_no: Optional[str] = None
    request_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    required_by_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    priority: PRPriority = PRPriority.MEDIUM
    department: Optional[str] = None
    purpose: Optional[str] = None
    notes: Optional[str] = None
    tags: list[str] = []
    items: list[PRItemCreate] = []


class PRUpdate(BaseModel):
    pr_number: Optional[str] = Field(None, min_length=1, max_length=100)
    regenerate_pr_number: bool = False
    reference_no: Optional[str] = None
    request_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    required_by_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    priority: Optional[PRPriority] = None
    department: Optional[str] = None
    purpose: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None

    @model_validator(mode="after")
    def _check_number_conflict(self) -> "PRUpdate":
        if self.pr_number and self.regenerate_pr_number:
            raise ValueError("Provide either 'pr_number' or 'regenerate_pr_number', not both.")
        return self


class PRStatusUpdate(BaseModel):
    status: PRStatus
    rejection_reason: Optional[str] = None


class PRResponse(BaseModel):
    id: int
    tenant_id: int
    requested_by_id: Optional[int]
    approved_by_id: Optional[int]
    pr_number: str
    reference_no: Optional[str]
    request_date: str
    required_by_date: Optional[str]
    approved_date: Optional[str]
    status: PRStatus
    priority: PRPriority
    department: Optional[str]
    purpose: Optional[str]
    notes: Optional[str]
    rejection_reason: Optional[str]
    tags: list[str]
    items: list[PRItemResponse]

    model_config = {"from_attributes": True}


class PaginatedPRs(BaseModel):
    items: list[PRResponse]
    total: int
    page: int
    size: int
    pages: int
