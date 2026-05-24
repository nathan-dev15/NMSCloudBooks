import enum
from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin, UUIDMixin


class ProjectStatus(str, enum.Enum):
    ACTIVE    = "active"
    PENDING   = "pending"
    COMPLETED = "completed"
    ARCHIVED  = "archived"
    ON_HOLD   = "on_hold"
    CANCELLED = "cancelled"


class BlockStatus(str, enum.Enum):
    PENDING     = "pending"
    ACTIVE      = "active"
    COMPLETED   = "completed"
    ON_HOLD     = "on_hold"
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"


class Project(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """
    Civil construction project — PDF table: civil_projects.
    Admin-only creation (created_by NOT NULL).
    """
    __tablename__ = "civil_projects"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Identity — PDF: project_code, project_name, project_description
    name:        Mapped[str]           = mapped_column(String(255), nullable=False)
    code:        Mapped[str]           = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[str|None]      = mapped_column(Text, nullable=True)
    status:      Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.ACTIVE, nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    # Geographic organisation — PDF: project_state, project_district, project_zone
    state:    Mapped[str|None] = mapped_column(String(100), nullable=True, index=True)
    district: Mapped[str|None] = mapped_column(String(100), nullable=True, index=True)
    zone:     Mapped[str|None] = mapped_column(String(100), nullable=True)
    address:  Mapped[str|None] = mapped_column(Text, nullable=True)

    # Ownership
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    admin_id:  Mapped[int|None] = mapped_column(
        Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )
    customer_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("customer_master.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Financials — PDF: total_budget, currency
    contract_value: Mapped[float|None] = mapped_column(Numeric(15, 2), nullable=True)
    total_budget:   Mapped[float|None] = mapped_column(Numeric(15, 2), nullable=True)
    currency:       Mapped[str]        = mapped_column(String(3), default="INR", nullable=False)

    # Timeline — PDF: start_date, end_date
    start_date:             Mapped[str|None] = mapped_column(String(10), nullable=True)
    end_date:               Mapped[str|None] = mapped_column(String(10), nullable=True)
    target_completion_date: Mapped[str|None] = mapped_column(String(10), nullable=True)
    actual_completion_date: Mapped[str|None] = mapped_column(String(10), nullable=True)
    overall_progress:       Mapped[float]    = mapped_column(Numeric(5, 2), default=0.0, nullable=False)

    # Metadata
    tags: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    # Relationships
    plans:        Mapped[list["ProjectPlan"]]          = relationship(
        "ProjectPlan", back_populates="project", cascade="all, delete-orphan"
    )
    allocations:  Mapped[list["ProjectAllocation"]]    = relationship(
        "ProjectAllocation", back_populates="project", cascade="all, delete-orphan"
    )
    assignments:  Mapped[list["ProjectUserAssignment"]] = relationship(
        "ProjectUserAssignment", back_populates="project", cascade="all, delete-orphan"
    )


class ProjectPlan(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Versioned plan under a project — PDF table: civil_project_plans."""
    __tablename__ = "civil_project_plans"

    id:          Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id:  Mapped[int] = mapped_column(
        Integer, ForeignKey("civil_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_code:   Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name:        Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str|None] = mapped_column(Text, nullable=True)
    is_active:   Mapped[bool]     = mapped_column(Boolean, default=True, nullable=False)
    revision:    Mapped[int]      = mapped_column(Integer, default=1, nullable=False)

    project: Mapped["Project"]     = relationship("Project", back_populates="plans")
    blocks:  Mapped[list["Block"]] = relationship(
        "Block", back_populates="plan", cascade="all, delete-orphan"
    )


class Block(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """
    Atomic billing unit within a plan — PDF table: civil_project_blocks.
    Independent start/end dates per block.
    """
    __tablename__ = "civil_project_blocks"

    id:         Mapped[int] = mapped_column(primary_key=True, index=True)
    plan_id:    Mapped[int] = mapped_column(
        Integer, ForeignKey("civil_project_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    block_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name:       Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str|None] = mapped_column(Text, nullable=True)
    status:     Mapped[BlockStatus] = mapped_column(
        Enum(BlockStatus), default=BlockStatus.PENDING, nullable=False, index=True
    )

    # Scheduling — PDF: block_start_date, block_end_date (NOT NULL in spec)
    start_date: Mapped[str|None] = mapped_column(String(10), nullable=True)
    end_date:   Mapped[str|None] = mapped_column(String(10), nullable=True)

    # Targets
    planned_quantity:    Mapped[float|None] = mapped_column(Numeric(12, 3), nullable=True)
    actual_quantity:     Mapped[float|None] = mapped_column(Numeric(12, 3), nullable=True)
    unit_of_measure:     Mapped[str|None]   = mapped_column(String(20), nullable=True)
    progress:            Mapped[float]      = mapped_column(Numeric(5, 2), default=0.0, nullable=False)
    completion_percentage: Mapped[float]    = mapped_column(Numeric(5, 2), default=0.0, nullable=False)

    # Financials
    estimated_cost: Mapped[float|None] = mapped_column(Numeric(15, 2), nullable=True)
    actual_cost:    Mapped[float|None] = mapped_column(Numeric(15, 2), nullable=True)

    # Relationships
    plan:        Mapped["ProjectPlan"]          = relationship("ProjectPlan", back_populates="blocks")
    allocations: Mapped[list["BlockAllocation"]] = relationship(
        "BlockAllocation", back_populates="block", cascade="all, delete-orphan"
    )
    activities:  Mapped[list["DailyActivity"]]   = relationship(
        "DailyActivity",  back_populates="block", cascade="all, delete-orphan"
    )
    work_orders: Mapped[list["WorkOrder"]]        = relationship(
        "WorkOrder",      back_populates="block", cascade="all, delete-orphan"
    )
    weekly_bills: Mapped[list["WeeklyBill"]]      = relationship(
        "WeeklyBill",     back_populates="block", cascade="all, delete-orphan"
    )
    assignments: Mapped[list["ProjectUserAssignment"]] = relationship(
        "ProjectUserAssignment", back_populates="block", cascade="all, delete-orphan"
    )


class ProjectUserAssignment(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Assign users to projects or blocks — PDF table: project_user_assignments."""
    __tablename__ = "project_user_assignments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("civil_projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    block_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("civil_project_blocks.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Assignment details — PDF: assignment_start_date, assignment_end_date, user_type
    assignment_start_date: Mapped[str|None] = mapped_column(String(10), nullable=True)
    assignment_end_date:   Mapped[str|None] = mapped_column(String(10), nullable=True)
    user_type:             Mapped[str|None] = mapped_column(String(100), nullable=True)

    project: Mapped["Project|None"] = relationship("Project",  back_populates="assignments")
    block:   Mapped["Block|None"]   = relationship("Block",    back_populates="assignments")
