import uuid as uuid_lib
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, DateTime, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UUIDMixin:
    """Adds a UUID column for global replication-safe identification."""
    uuid: Mapped[uuid_lib.UUID] = mapped_column(
        UUID(as_uuid=True),
        default=uuid_lib.uuid4,
        server_default=text("gen_random_uuid()"),
        unique=True,
        nullable=False,
        index=True,
    )


class TimestampMixin:
    """Audit timestamps + creator/updater tracking. DB columns: created_date, updated_date."""
    created_at: Mapped[datetime] = mapped_column(
        "created_date",
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updated_date",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_by: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    updated_by: Mapped[int | None] = mapped_column(BigInteger, nullable=True)


class SoftDeleteMixin:
    """
    PDF-standard soft-delete columns.
    DB columns: is_deleted, deleted_date, deleted_by.
    Python attr deleted_at maps to DB column deleted_date (backward compat).
    """
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(
        "deleted_date",
        DateTime(timezone=True),
        nullable=True,
    )
    deleted_by: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    def soft_delete(self, user_id: int | None = None) -> None:
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
        self.deleted_by = user_id
        if hasattr(self, "is_active"):
            self.is_active = False  # type: ignore[attr-defined]
