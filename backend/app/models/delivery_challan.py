import enum
from sqlalchemy import Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin


class DCStatus(str, enum.Enum):
    DRAFT = "draft"
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    RETURNED = "returned"
    CANCELLED = "cancelled"


class DeliveryChallan(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "delivery_challans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("customer_master.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )

    dc_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    reference_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dc_date: Mapped[str] = mapped_column(String(10), nullable=False)
    delivery_date: Mapped[str | None] = mapped_column(String(10), nullable=True)

    status: Mapped[DCStatus] = mapped_column(
        Enum(DCStatus), nullable=False, default=DCStatus.DRAFT, index=True
    )

    from_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    to_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    consignee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vehicle_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    driver_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    items: Mapped[list["DCItem"]] = relationship(
        "DCItem", back_populates="challan", cascade="all, delete-orphan",
        order_by="DCItem.item_order"
    )


class DCItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "dc_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    dc_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("delivery_challans.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    item_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    hsn_sac: Mapped[str | None] = mapped_column(String(20), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    quantity: Mapped[float] = mapped_column(Numeric(15, 3), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    challan: Mapped["DeliveryChallan"] = relationship("DeliveryChallan", back_populates="items")
