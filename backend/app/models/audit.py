from datetime import datetime
from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.base import UUIDMixin


class AuditLog(Base, UUIDMixin):
    """
    Immutable audit trail — never updated or deleted.
    PDF table: system_audit_trail.
    Python class name kept as AuditLog for backward compat.
    """
    __tablename__ = "system_audit_trail"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        "action_timestamp",
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Who — PDF: user_id, action, table_name, record_id
    user_id:    Mapped[int|None] = mapped_column(
        Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_email: Mapped[str|None] = mapped_column(String(255), nullable=True)
    user_role:  Mapped[str|None] = mapped_column(String(50), nullable=True)
    tenant_id:  Mapped[int|None] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True
    )

    # What — PDF: action_performed, table_name, record_id
    action:        Mapped[str]      = mapped_column(
        "action_performed", String(100), nullable=False, index=True
    )
    resource_type: Mapped[str]      = mapped_column(
        "table_name", String(100), nullable=False, index=True
    )
    resource_id:   Mapped[str|None] = mapped_column(
        "record_id", String(100), nullable=True
    )
    description:   Mapped[str|None] = mapped_column(
        "change_description", Text, nullable=True
    )

    # Change tracking — PDF: old_values, new_values (JSONB)
    before_state: Mapped[dict|None] = mapped_column(
        "old_values", JSONB, nullable=True
    )
    after_state:  Mapped[dict|None] = mapped_column(
        "new_values", JSONB, nullable=True
    )

    # Context — PDF: ip_address, user_agent, http_method, api_endpoint
    ip_address:  Mapped[str|None] = mapped_column(String(45), nullable=True)
    user_agent:  Mapped[str|None] = mapped_column(String(500), nullable=True)
    http_method: Mapped[str|None] = mapped_column(String(10), nullable=True)
    endpoint:    Mapped[str|None] = mapped_column("api_endpoint", String(255), nullable=True)

    # Status — PDF: action_status, error_message
    status:        Mapped[str|None] = mapped_column("action_status", String(50), nullable=True)
    error_message: Mapped[str|None] = mapped_column(Text, nullable=True)

    data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
