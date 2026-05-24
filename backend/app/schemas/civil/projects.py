from pydantic import BaseModel, ConfigDict, field_validator
from app.models.civil.project import ProjectStatus, BlockStatus


class ProjectCreate(BaseModel):
    name: str
    code: str
    description: str | None = None
    state: str | None = None
    district: str | None = None
    zone: str | None = None
    address: str | None = None
    contract_value: float | None = None
    target_completion_date: str | None = None
    tags: list[str] = []


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: ProjectStatus | None = None
    state: str | None = None
    district: str | None = None
    zone: str | None = None
    address: str | None = None
    contract_value: float | None = None
    target_completion_date: str | None = None
    overall_progress: float | None = None
    tags: list[str] | None = None

    @field_validator("overall_progress")
    @classmethod
    def clamp_progress(cls, v: float | None) -> float | None:
        if v is not None and not (0 <= v <= 100):
            raise ValueError("Progress must be between 0 and 100")
        return v


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    description: str | None
    status: ProjectStatus
    state: str | None
    district: str | None
    zone: str | None
    address: str | None
    contract_value: float | None
    target_completion_date: str | None
    overall_progress: float
    tags: list


class PlanCreate(BaseModel):
    plan_code: str
    name: str
    description: str | None = None


class PlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    plan_code: str
    name: str
    description: str | None
    is_active: bool
    revision: int


class BlockCreate(BaseModel):
    block_code: str
    name: str
    description: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    planned_quantity: float | None = None
    unit_of_measure: str | None = None
    estimated_cost: float | None = None


class BlockUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: BlockStatus | None = None
    start_date: str | None = None
    end_date: str | None = None
    planned_quantity: float | None = None
    actual_quantity: float | None = None
    progress: float | None = None
    actual_cost: float | None = None

    @field_validator("progress")
    @classmethod
    def clamp_progress(cls, v: float | None) -> float | None:
        if v is not None and not (0 <= v <= 100):
            raise ValueError("Progress must be between 0 and 100")
        return v


class BlockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    plan_id: int
    block_code: str
    name: str
    description: str | None
    status: BlockStatus
    start_date: str | None
    end_date: str | None
    planned_quantity: float | None
    actual_quantity: float | None
    unit_of_measure: str | None
    progress: float
    estimated_cost: float | None
    actual_cost: float | None
