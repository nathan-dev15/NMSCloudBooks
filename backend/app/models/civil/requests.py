import enum
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class RequestStatus(str, enum.Enum):
    DRAFT       = "draft"      # Saved, not submitted
    PENDING     = "pending"    # In the approval stack
    OTP_SENT    = "otp_sent"   # Admin has been sent OTP
    APPROVED    = "approved"   # OTP verified, approved
    REJECTED    = "rejected"   # Rejected by Admin
    FULFILLED   = "fulfilled"  # Stock has been issued
    CANCELLED   = "cancelled"  # Cancelled by requester


class RequestPriority(str, enum.Enum):
    LOW      = "low"
    STANDARD = "standard"
    HIGH     = "high"
    URGENT   = "urgent"


class MaterialRequest(Base, TimestampMixin):
    """
    A material/tool request raised by a Primary User.
    Goes through a stack-based OTP approval workflow.
    """
    __tablename__ = "civil_material_requests"

    id:         Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("civil_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    block_id:   Mapped[int|None] = mapped_column(Integer, ForeignKey("civil_project_blocks.id", ondelete="SET NULL"), nullable=True, index=True)

    # Who raised it
    requested_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)

    # Workflow state
    status:   Mapped[RequestStatus]  = mapped_column(Enum(RequestStatus),  default=RequestStatus.DRAFT,    nullable=False, index=True)
    priority: Mapped[RequestPriority] = mapped_column(Enum(RequestPriority), default=RequestPriority.STANDARD, nullable=False)

    # Description
    title:       Mapped[str]      = mapped_column(String(255), nullable=False)
    notes:       Mapped[str|None] = mapped_column(Text, nullable=True)
    required_by: Mapped[str|None] = mapped_column(String(20), nullable=True)  # Date string

    # OTP approval
    otp_hash:        Mapped[str|None] = mapped_column(String(255), nullable=True)   # bcrypt-hashed OTP
    otp_expires_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    otp_attempts:    Mapped[int]      = mapped_column(Integer, default=0, nullable=False)
    approved_by_id:  Mapped[int|None] = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)
    approved_at:     Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str|None] = mapped_column(Text, nullable=True)

    # Stack position (lower = processed first)
    stack_position: Mapped[int] = mapped_column(Integer, default=0, nullable=False, index=True)

    items: Mapped[list["MaterialRequestItem"]] = relationship(
        "MaterialRequestItem", back_populates="request", cascade="all, delete-orphan"
    )


class MaterialRequestItem(Base, TimestampMixin):
    """A single line item within a material request."""
    __tablename__ = "civil_material_request_items"

    id:          Mapped[int] = mapped_column(primary_key=True, index=True)
    request_id:  Mapped[int] = mapped_column(Integer, ForeignKey("civil_material_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    material_id: Mapped[int] = mapped_column(Integer, ForeignKey("civil_material_catalog.id",  ondelete="SET NULL"), nullable=True)

    material_name:   Mapped[str]        = mapped_column(String(255), nullable=False)   # Snapshot of name
    requested_qty:   Mapped[float]      = mapped_column(Numeric(12, 3), nullable=False)
    approved_qty:    Mapped[float|None] = mapped_column(Numeric(12, 3), nullable=True)
    issued_qty:      Mapped[float|None] = mapped_column(Numeric(12, 3), nullable=True)
    unit_of_measure: Mapped[str]        = mapped_column(String(20), default="nos", nullable=False)
    estimated_cost:  Mapped[float|None] = mapped_column(Numeric(12, 2), nullable=True)
    notes:           Mapped[str|None]   = mapped_column(String(500), nullable=True)

    request: Mapped["MaterialRequest"] = relationship("MaterialRequest", back_populates="items")
