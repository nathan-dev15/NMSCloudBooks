import uuid as uuid_lib
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin


class ErrorLog(Base, UUIDMixin):
    """
    Centralized error log — PDF table: system_error_log.
    Python class name kept as ErrorLog for backward compat.
    """
    __tablename__ = "system_error_log"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Error details — PDF: error_code, error_category, error_message, error_stack_trace
    error_code:        Mapped[str|None] = mapped_column(String(50), nullable=True)
    error_type:        Mapped[str|None] = mapped_column(
        "error_category", String(100), nullable=True, index=True
    )
    error_message:     Mapped[str]      = mapped_column(Text, nullable=False)
    error_stack_trace: Mapped[str|None] = mapped_column(Text, nullable=True)

    # Code context — PDF: service_name, function_name, file_path, line_number
    service_name:  Mapped[str|None] = mapped_column(String(100), nullable=True, index=True)
    function_name: Mapped[str|None] = mapped_column(String(255), nullable=True)
    file_path:     Mapped[str|None] = mapped_column(String(255), nullable=True)
    line_number:   Mapped[int|None] = mapped_column(Integer, nullable=True)

    # Request context — PDF: user_id, request_id, api_endpoint, http_method, ip_address
    user_id:    Mapped[int|None] = mapped_column(ForeignKey("user_accounts.id"), nullable=True)
    request_id: Mapped[str|None] = mapped_column(String(100), nullable=True)
    endpoint:   Mapped[str|None] = mapped_column("api_endpoint", String(255), nullable=True)
    http_method: Mapped[str|None] = mapped_column(String(10), nullable=True)
    ip_address:  Mapped[str|None] = mapped_column(String(45), nullable=True)

    # Related entity — PDF: affected_table, affected_record_id
    entity_type: Mapped[str|None] = mapped_column("affected_table",     String(100), nullable=True)
    entity_id:   Mapped[int|None] = mapped_column("affected_record_id", Integer,     nullable=True)

    # Severity — PDF: INFO, WARNING, ERROR, CRITICAL
    severity: Mapped[str|None] = mapped_column("severity_level", String(50), nullable=True, index=True)

    # Resolution tracking — PDF: is_resolved, resolved_date, resolution_notes, resolved_by
    is_resolved:      Mapped[bool]          = mapped_column(Boolean, default=False, nullable=False, index=True)
    resolved_date:    Mapped[datetime|None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[str|None]      = mapped_column(Text, nullable=True)
    resolved_by:      Mapped[int|None]      = mapped_column(
        ForeignKey("user_accounts.id"), nullable=True
    )

    # Timestamps — PDF: error_timestamp, last_updated
    created_date: Mapped[datetime] = mapped_column(
        "error_timestamp", DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_date: Mapped[datetime] = mapped_column(
        "last_updated", DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ActivityLog(Base, UUIDMixin):
    """
    User activity timeline — PDF table: user_activity_log.
    Python class name kept as ActivityLog for backward compat.
    """
    __tablename__ = "user_activity_log"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Activity — PDF: activity_type, activity_description
    activity_type:        Mapped[str|None] = mapped_column(String(100), nullable=True, index=True)
    activity_description: Mapped[str|None] = mapped_column(Text, nullable=True)

    # User — PDF: user_id
    user_id: Mapped[int|None] = mapped_column(
        ForeignKey("user_accounts.id"), nullable=True, index=True
    )

    # Activity context — PDF: module_name, page_url
    module_name: Mapped[str|None] = mapped_column(String(100), nullable=True, index=True)
    page_url:    Mapped[str|None] = mapped_column(String(255), nullable=True)

    # Related record — PDF: related_table, related_record_id
    entity_type: Mapped[str|None] = mapped_column("related_table",     String(100), nullable=True)
    entity_id:   Mapped[int|None] = mapped_column("related_record_id", Integer,     nullable=True)

    # Request info — PDF: ip_address, user_agent, session_id
    ip_address: Mapped[str|None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str|None] = mapped_column(Text, nullable=True)
    endpoint:   Mapped[str|None] = mapped_column(String(255), nullable=True)
    session_id: Mapped[str|None] = mapped_column(String(100), nullable=True)

    # Timestamp — PDF: activity_timestamp
    created_date: Mapped[datetime] = mapped_column(
        "activity_timestamp", DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
