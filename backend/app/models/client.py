import enum
from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin, UUIDMixin


class ClientType(str, enum.Enum):
    INDIVIDUAL  = "individual"
    COMPANY     = "company"
    GOVERNMENT  = "government"
    NGO         = "ngo"


class ClientSegment(str, enum.Enum):
    PREMIUM   = "premium"
    STANDARD  = "standard"
    PROSPECT  = "prospect"
    INACTIVE  = "inactive"


class Client(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Customer/Client master — PDF table: customer_master."""
    __tablename__ = "customer_master"

    id:         Mapped[int]  = mapped_column(primary_key=True, index=True)

    # Identity — PDF: customer_code, customer_name, customer_type
    display_name: Mapped[str]      = mapped_column(String(255), nullable=False, index=True)
    client_code:  Mapped[str|None] = mapped_column(String(50), nullable=True, index=True)
    client_type:  Mapped[ClientType]    = mapped_column(Enum(ClientType), default=ClientType.COMPANY, nullable=False)
    segment:      Mapped[ClientSegment] = mapped_column(Enum(ClientSegment), default=ClientSegment.STANDARD, nullable=False)
    is_active:    Mapped[bool]          = mapped_column(Boolean, default=True, nullable=False, index=True)

    # Multi-tenant
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Contact
    email:        Mapped[str|None]  = mapped_column(String(255), nullable=True, index=True)
    phone:        Mapped[str|None]  = mapped_column(String(20), nullable=True)
    alt_phone:    Mapped[str|None]  = mapped_column(String(20), nullable=True)
    website:      Mapped[str|None]  = mapped_column(String(255), nullable=True)

    # Address — PDF: address, city, state, country, postal_code
    address_line1: Mapped[str|None] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[str|None] = mapped_column(String(255), nullable=True)
    city:          Mapped[str|None] = mapped_column(String(100), nullable=True, index=True)
    state:         Mapped[str|None] = mapped_column(String(100), nullable=True)
    pincode:       Mapped[str|None] = mapped_column(String(10), nullable=True)
    country:       Mapped[str]      = mapped_column(String(100), default="India", nullable=False)

    # Tax & financial — PDF: gstin, pan, credit_limit, payment_terms_days
    gstin:          Mapped[str|None] = mapped_column(String(15), nullable=True, index=True)
    pan:            Mapped[str|None] = mapped_column(String(10), nullable=True)
    credit_limit:   Mapped[float|None] = mapped_column(Numeric(15, 2), nullable=True)
    credit_days:    Mapped[int|None]   = mapped_column(Integer, nullable=True)
    currency:       Mapped[str]         = mapped_column(String(3), default="INR", nullable=False)
    outstanding_balance: Mapped[float]  = mapped_column(Numeric(15, 2), default=0.0, nullable=False)

    # Metadata
    notes: Mapped[str|None] = mapped_column(Text, nullable=True)
    tags:  Mapped[list]     = mapped_column(JSON, default=list, nullable=False)

    # Relationships
    contacts:       Mapped[list["ClientContact"]]       = relationship(
        "ClientContact", back_populates="client", cascade="all, delete-orphan"
    )
    communications: Mapped[list["ClientCommunication"]] = relationship(
        "ClientCommunication", back_populates="client", cascade="all, delete-orphan"
    )


class ClientContact(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Contact persons per customer — PDF table: customer_contact_persons."""
    __tablename__ = "customer_contact_persons"

    id:        Mapped[int] = mapped_column(primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customer_master.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name:        Mapped[str]      = mapped_column(String(255), nullable=False)
    designation: Mapped[str|None] = mapped_column(String(100), nullable=True)
    email:       Mapped[str|None] = mapped_column(String(255), nullable=True)
    phone:       Mapped[str|None] = mapped_column(String(20), nullable=True)
    is_primary:  Mapped[bool]     = mapped_column(Boolean, default=False, nullable=False)

    client: Mapped["Client"] = relationship("Client", back_populates="contacts")


class CommunicationType(str, enum.Enum):
    EMAIL    = "email"
    CALL     = "call"
    MEETING  = "meeting"
    NOTE     = "note"
    WHATSAPP = "whatsapp"


class ClientCommunication(Base, TimestampMixin):
    """Communication log per customer. Not in SQL spec but retained for CRM functionality."""
    __tablename__ = "client_communications"

    id:        Mapped[int] = mapped_column(primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customer_master.id", ondelete="CASCADE"), nullable=False, index=True
    )
    logged_by_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )

    comm_type: Mapped[CommunicationType] = mapped_column(Enum(CommunicationType), nullable=False)
    subject:   Mapped[str]      = mapped_column(String(255), nullable=False)
    body:      Mapped[str|None] = mapped_column(Text, nullable=True)
    outcome:   Mapped[str|None] = mapped_column(String(255), nullable=True)
    follow_up_date: Mapped[str|None] = mapped_column(String(20), nullable=True)

    client: Mapped["Client"] = relationship("Client", back_populates="communications")
