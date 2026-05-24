import uuid as uuid_lib
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin, UUIDMixin


class Role(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """4-tier role master: SUPER_ADMIN, ADMIN, PRIMARY_USER, SECONDARY_USER."""
    __tablename__ = "user_roles_master"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    role_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    user_roles: Mapped[list["UserRoleAssignment"]] = relationship(
        "UserRoleAssignment", back_populates="role", cascade="all, delete-orphan"
    )
    role_permissions: Mapped[list["RolePermissionAssignment"]] = relationship(
        "RolePermissionAssignment", back_populates="role", cascade="all, delete-orphan"
    )


class UserRoleAssignment(Base, UUIDMixin, SoftDeleteMixin):
    """Junction: which roles are assigned to which users."""
    __tablename__ = "user_role_assignments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_id: Mapped[int] = mapped_column(
        ForeignKey("user_roles_master.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "created_date", DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("user_accounts.id"), nullable=True)

    role: Mapped[Role] = relationship("Role", back_populates="user_roles")

    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role_assignments_user_role"),)


class UserPermission(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Individual permission definitions per module."""
    __tablename__ = "user_permissions_master"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    permission_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    module_name: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    role_permissions: Mapped[list["RolePermissionAssignment"]] = relationship(
        "RolePermissionAssignment", back_populates="permission", cascade="all, delete-orphan"
    )


class RolePermissionAssignment(Base, UUIDMixin, SoftDeleteMixin):
    """Junction: which permissions are granted to which roles."""
    __tablename__ = "role_permission_assignments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    role_id: Mapped[int] = mapped_column(
        ForeignKey("user_roles_master.id", ondelete="CASCADE"), nullable=False, index=True
    )
    permission_id: Mapped[int] = mapped_column(
        ForeignKey("user_permissions_master.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "created_date", DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("user_accounts.id"), nullable=True)

    role: Mapped[Role] = relationship("Role", back_populates="role_permissions")
    permission: Mapped[UserPermission] = relationship("UserPermission", back_populates="role_permissions")

    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission_assignments_role_perm"),)
