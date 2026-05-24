import enum
from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class SiteRole(str, enum.Enum):
    """On-site classification within the Primary User role."""
    SUPERVISOR  = "supervisor"
    LEAD        = "lead"
    TECHNICIAN  = "technician"
    HELPER      = "helper"
    INSPECTOR   = "inspector"
    ENGINEER    = "engineer"


class ProjectAllocation(Base, TimestampMixin):
    """
    Links a user to an entire project.
    Source of truth for project-level team membership.
    """
    __tablename__ = "civil_project_allocations"

    id:         Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("civil_projects.id",  ondelete="CASCADE"), nullable=False, index=True)
    user_id:    Mapped[int] = mapped_column(Integer, ForeignKey("user_accounts.id",   ondelete="CASCADE"), nullable=False, index=True)
    site_role:  Mapped[SiteRole] = mapped_column(Enum(SiteRole), default=SiteRole.TECHNICIAN, nullable=False)
    is_active:  Mapped[bool]     = mapped_column(Boolean, default=True, nullable=False)
    allocated_by_id: Mapped[int|None] = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="allocations", foreign_keys=[project_id])


class BlockAllocation(Base, TimestampMixin):
    """
    Fine-grained: assigns a user to a specific block with utilization tracking.
    """
    __tablename__ = "civil_block_allocations"

    id:       Mapped[int] = mapped_column(primary_key=True, index=True)
    block_id: Mapped[int] = mapped_column(Integer, ForeignKey("civil_project_blocks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id:  Mapped[int] = mapped_column(Integer, ForeignKey("user_accounts.id",        ondelete="CASCADE"), nullable=False, index=True)
    site_role: Mapped[SiteRole] = mapped_column(Enum(SiteRole), default=SiteRole.TECHNICIAN, nullable=False)
    is_active: Mapped[bool]     = mapped_column(Boolean, default=True, nullable=False)

    # Availability tracking
    available_from: Mapped[str|None] = mapped_column(String(10), nullable=True)
    available_to:   Mapped[str|None] = mapped_column(String(10), nullable=True)

    # Weekly utilisation (hours per week)
    planned_hours_per_week:  Mapped[float|None] = mapped_column(Numeric(5, 2), nullable=True)
    actual_hours_this_week:  Mapped[float|None] = mapped_column(Numeric(5, 2), nullable=True)

    block: Mapped["Block"] = relationship("Block", back_populates="allocations")


class UserUtilizationLog(Base, TimestampMixin):
    """Weekly snapshot of how many hours a user worked on a block."""
    __tablename__ = "civil_user_utilization_logs"

    id:               Mapped[int] = mapped_column(primary_key=True, index=True)
    block_id:         Mapped[int] = mapped_column(Integer, ForeignKey("civil_project_blocks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id:          Mapped[int] = mapped_column(Integer, ForeignKey("user_accounts.id",        ondelete="CASCADE"), nullable=False, index=True)
    week_start_date:  Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    hours_worked:     Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)
    tasks_completed:  Mapped[int]   = mapped_column(Integer, default=0, nullable=False)
    notes:            Mapped[str|None] = mapped_column(String(500), nullable=True)
