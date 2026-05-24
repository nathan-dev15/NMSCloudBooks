from pydantic import BaseModel, ConfigDict
from app.models.civil.billing import WorkOrderStatus, WeeklyBillStatus, ActivityType


class WorkOrderCreate(BaseModel):
    block_id: int
    title: str
    description: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    estimated_labour_cost: float | None = None
    estimated_material_cost: float | None = None
    subcontractor_name: str | None = None
    subcontractor_contact: str | None = None
    retention_pct: float | None = None


class WorkOrderUpdate(BaseModel):
    title: str | None = None
    status: WorkOrderStatus | None = None
    actual_labour_cost: float | None = None
    actual_material_cost: float | None = None
    retention_released: bool | None = None


class WorkOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    block_id: int
    wo_number: str
    title: str
    description: str | None
    status: WorkOrderStatus
    start_date: str | None
    end_date: str | None
    estimated_labour_cost: float | None
    estimated_material_cost: float | None
    actual_labour_cost: float | None
    actual_material_cost: float | None
    subcontractor_name: str | None
    retention_pct: float | None
    retention_released: bool


class DailyActivityCreate(BaseModel):
    block_id: int
    activity_date: str
    activity_type: ActivityType = ActivityType.WORK_LOG
    title: str
    description: str | None = None
    hours_worked: float | None = None
    quantity: float | None = None
    unit: str | None = None
    amount: float | None = None
    is_billable: bool = True


class DailyActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    block_id: int
    logged_by_id: int | None
    activity_date: str
    activity_type: ActivityType
    title: str
    description: str | None
    hours_worked: float | None
    quantity: float | None
    amount: float | None
    is_billable: bool
    attachments: list


class WeeklyBillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    block_id: int
    week_start_date: str
    week_end_date: str
    bill_number: str
    status: WeeklyBillStatus
    labour_cost: float
    material_cost: float
    overhead_cost: float
    total_cost: float
    progress_this_week: float
    cumulative_progress: float
    line_items: list
    notes: str | None
