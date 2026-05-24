import enum
from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin


class WorkOrderStatus(str, enum.Enum):
    DRAFT      = "draft"
    OPEN       = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED  = "completed"
    CANCELLED  = "cancelled"


class WeeklyBillStatus(str, enum.Enum):
    DRAFT     = "draft"
    SUBMITTED = "submitted"
    APPROVED  = "approved"
    INVOICED  = "invoiced"


class ActivityType(str, enum.Enum):
    WORK_LOG   = "work_log"
    EXPENSE    = "expense"
    INSPECTION = "inspection"
    MILESTONE  = "milestone"
    ISSUE      = "issue"
    NOTE       = "note"


class WorkOrder(Base, TimestampMixin, SoftDeleteMixin):
    """
    A work order authorises labour and materials for a specific block activity.
    """
    __tablename__ = "civil_work_orders"

    id:       Mapped[int] = mapped_column(primary_key=True, index=True)
    block_id: Mapped[int] = mapped_column(Integer, ForeignKey("civil_project_blocks.id", ondelete="CASCADE"), nullable=False, index=True)
    wo_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    title:     Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str|None] = mapped_column(Text, nullable=True)
    status:    Mapped[WorkOrderStatus] = mapped_column(Enum(WorkOrderStatus), default=WorkOrderStatus.DRAFT, nullable=False, index=True)

    # Dates
    start_date: Mapped[str|None] = mapped_column(String(10), nullable=True)
    end_date:   Mapped[str|None] = mapped_column(String(10), nullable=True)

    # Financials
    estimated_labour_cost:   Mapped[float|None] = mapped_column(Numeric(15, 2), nullable=True)
    estimated_material_cost: Mapped[float|None] = mapped_column(Numeric(15, 2), nullable=True)
    actual_labour_cost:      Mapped[float|None] = mapped_column(Numeric(15, 2), nullable=True)
    actual_material_cost:    Mapped[float|None] = mapped_column(Numeric(15, 2), nullable=True)

    # Subcontractor
    subcontractor_name:    Mapped[str|None] = mapped_column(String(255), nullable=True)
    subcontractor_contact: Mapped[str|None] = mapped_column(String(100), nullable=True)
    retention_pct:         Mapped[float|None] = mapped_column(Numeric(5, 2), nullable=True)
    retention_released:    Mapped[bool]        = mapped_column(Boolean, default=False, nullable=False)

    created_by_id: Mapped[int|None] = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)

    block: Mapped["Block"] = relationship("Block", back_populates="work_orders")


class WeeklyBill(Base, TimestampMixin):
    """
    Auto-generated every week per block.  Aggregates labour + material costs.
    """
    __tablename__ = "civil_weekly_bills"

    id:              Mapped[int] = mapped_column(primary_key=True, index=True)
    block_id:        Mapped[int] = mapped_column(Integer, ForeignKey("civil_project_blocks.id", ondelete="CASCADE"), nullable=False, index=True)
    week_start_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    week_end_date:   Mapped[str] = mapped_column(String(10), nullable=False)
    bill_number:     Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    status:          Mapped[WeeklyBillStatus] = mapped_column(Enum(WeeklyBillStatus), default=WeeklyBillStatus.DRAFT, nullable=False)

    # Breakdown
    labour_cost:     Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    material_cost:   Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    overhead_cost:   Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    total_cost:      Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)

    # Progress snapshot
    progress_this_week: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)
    cumulative_progress: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)

    # Line items (JSON snapshot for PDF generation)
    line_items: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    approved_by_id: Mapped[int|None] = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)
    notes:          Mapped[str|None] = mapped_column(Text, nullable=True)

    block: Mapped["Block"] = relationship("Block", back_populates="weekly_bills")


class DailyActivity(Base, TimestampMixin):
    """
    Day-to-day activity log for a block.  Tracks minor work, expenses, photos.
    """
    __tablename__ = "civil_daily_activities"

    id:            Mapped[int] = mapped_column(primary_key=True, index=True)
    block_id:      Mapped[int] = mapped_column(Integer, ForeignKey("civil_project_blocks.id", ondelete="CASCADE"), nullable=False, index=True)
    logged_by_id:  Mapped[int|None] = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)
    activity_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    activity_type: Mapped[ActivityType] = mapped_column(Enum(ActivityType), default=ActivityType.WORK_LOG, nullable=False, index=True)

    title:       Mapped[str]      = mapped_column(String(255), nullable=False)
    description: Mapped[str|None] = mapped_column(Text, nullable=True)

    # Quantities / hours
    hours_worked: Mapped[float|None] = mapped_column(Numeric(5, 2), nullable=True)
    quantity:     Mapped[float|None] = mapped_column(Numeric(10, 3), nullable=True)
    unit:         Mapped[str|None]   = mapped_column(String(20), nullable=True)
    amount:       Mapped[float|None] = mapped_column(Numeric(12, 2), nullable=True)

    # Attachments (stored as list of URLs)
    attachments: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    is_billable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    block: Mapped["Block"] = relationship("Block", back_populates="activities")
