from pydantic import BaseModel, ConfigDict
from app.models.civil.requests import RequestStatus, RequestPriority


class RequestItemCreate(BaseModel):
    material_id: int | None = None
    material_name: str
    requested_qty: float
    unit_of_measure: str = "nos"
    notes: str | None = None


class MaterialRequestCreate(BaseModel):
    project_id: int
    block_id: int | None = None
    title: str
    notes: str | None = None
    priority: RequestPriority = RequestPriority.STANDARD
    required_by: str | None = None
    items: list[RequestItemCreate]


class MaterialRequestUpdate(BaseModel):
    title: str | None = None
    notes: str | None = None
    priority: RequestPriority | None = None
    required_by: str | None = None


class SubmitRequestAction(BaseModel):
    """Primary User submits draft → pending, triggers OTP to Admin."""
    pass


class OTPVerifyAction(BaseModel):
    """Admin verifies OTP to approve the request."""
    otp: str


class RejectAction(BaseModel):
    reason: str


class ApproveItemQty(BaseModel):
    item_id: int
    approved_qty: float


class BulkApproveAction(BaseModel):
    """Admin can adjust quantities per item before final approval."""
    item_approvals: list[ApproveItemQty] = []


class RequestItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    material_id: int | None
    material_name: str
    requested_qty: float
    approved_qty: float | None
    issued_qty: float | None
    unit_of_measure: str
    notes: str | None


class MaterialRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    block_id: int | None
    requested_by_id: int | None
    status: RequestStatus
    priority: RequestPriority
    title: str
    notes: str | None
    required_by: str | None
    stack_position: int
    approved_by_id: int | None
    approved_at: str | None
    rejection_reason: str | None
    items: list[RequestItemResponse]
