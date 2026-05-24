import enum
from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin, UUIDMixin


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    PRIMARY_USER = "primary_user"
    SECONDARY_USER = "secondary_user"


ROLE_HIERARCHY: dict[UserRole, int] = {
    UserRole.SUPER_ADMIN: 4,
    UserRole.ADMIN: 3,
    UserRole.PRIMARY_USER: 2,
    UserRole.SECONDARY_USER: 1,
}

CREATABLE_ROLES: dict[UserRole, list[UserRole]] = {
    UserRole.SUPER_ADMIN: [UserRole.ADMIN, UserRole.PRIMARY_USER, UserRole.SECONDARY_USER],
    UserRole.ADMIN: [UserRole.PRIMARY_USER, UserRole.SECONDARY_USER],
    UserRole.PRIMARY_USER: [],
    UserRole.SECONDARY_USER: [],
}


class User(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "user_accounts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Identity — PDF spec: username, email, password_hash, first_name, last_name
    username: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Multi-tenant
    tenant_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="users")

    # Admin link — set for primary_user and secondary_user rows
    admin_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Numeric role ID: 1=super_admin 2=admin 3=primary_user 4=secondary_user 5=others
    role_id: Mapped[int] = mapped_column(Integer, default=5, nullable=False, index=True)

    # Security — PDF spec: login_attempts, locked_until, last_login
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_login: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Profile & preferences
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    preferences: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {"theme": "light", "notifications": True, "timezone": "Asia/Kolkata"},
        nullable=False,
    )
    custom_permissions: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    def can_create_role(self, target_role: UserRole) -> bool:
        return target_role in CREATABLE_ROLES.get(self.role, [])

    def has_higher_privilege_than(self, other: "User") -> bool:
        return ROLE_HIERARCHY[self.role] > ROLE_HIERARCHY[other.role]
