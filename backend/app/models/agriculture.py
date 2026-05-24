"""
Agriculture Billing Module — SOW §5.3
Covers: Farms, Crop Cycles, Harvest Records, Farm Expenses, Agri Invoices.
"""
import enum
from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin


class LandUnit(str, enum.Enum):
    ACRE    = "acre"
    HECTARE = "hectare"
    GUNTHA  = "guntha"
    BIGHA   = "bigha"
    SQFT    = "sqft"


class CropSeason(str, enum.Enum):
    KHARIF  = "kharif"   # June–November (monsoon)
    RABI    = "rabi"     # November–April (winter)
    ZAID    = "zaid"     # April–June (summer)
    ANNUAL  = "annual"


class CycleStatus(str, enum.Enum):
    PLANNED   = "planned"
    SOWING    = "sowing"
    GROWING   = "growing"
    HARVESTING = "harvesting"
    COMPLETED = "completed"
    FAILED    = "failed"


class ExpenseCategory(str, enum.Enum):
    SEEDS        = "seeds"
    FERTILIZER   = "fertilizer"
    PESTICIDE    = "pesticide"
    IRRIGATION   = "irrigation"
    LABOUR       = "labour"
    MACHINERY    = "machinery"
    TRANSPORT    = "transport"
    STORAGE      = "storage"
    MISCELLANEOUS = "miscellaneous"


class AgriInvoiceStatus(str, enum.Enum):
    DRAFT     = "draft"
    SENT      = "sent"
    PAID      = "paid"
    PARTIAL   = "partial"
    CANCELLED = "cancelled"


# ── Farm ──────────────────────────────────────────────────────────────────────

class Farm(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "farms"

    id:         Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id:  Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id:   Mapped[int | None] = mapped_column(Integer, ForeignKey("customer_master.id",  ondelete="SET NULL"), nullable=True)
    manager_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("user_accounts.id",    ondelete="SET NULL"), nullable=True)

    name:         Mapped[str]      = mapped_column(String(150), nullable=False, index=True)
    farm_code:    Mapped[str|None] = mapped_column(String(30),  nullable=True,  index=True)
    village:      Mapped[str|None] = mapped_column(String(100), nullable=True)
    taluk:        Mapped[str|None] = mapped_column(String(100), nullable=True)
    district:     Mapped[str|None] = mapped_column(String(100), nullable=True, index=True)
    state:        Mapped[str|None] = mapped_column(String(100), nullable=True)
    survey_no:    Mapped[str|None] = mapped_column(String(50),  nullable=True)

    total_area:   Mapped[float]    = mapped_column(Numeric(10,3), nullable=False)
    land_unit:    Mapped[LandUnit] = mapped_column(Enum(LandUnit), default=LandUnit.ACRE, nullable=False)
    irrigated_area: Mapped[float]  = mapped_column(Numeric(10,3), default=0.0, nullable=False)
    soil_type:    Mapped[str|None] = mapped_column(String(80), nullable=True)   # black / red / alluvial
    water_source: Mapped[str|None] = mapped_column(String(80), nullable=True)   # borewell / canal / rain-fed
    is_active:    Mapped[bool]     = mapped_column(Boolean, default=True, nullable=False)
    notes:        Mapped[str|None] = mapped_column(Text, nullable=True)
    geo_coords:   Mapped[dict]     = mapped_column(JSON, default=dict, nullable=False)  # {lat, lng}

    crop_cycles: Mapped[list["CropCycle"]] = relationship("CropCycle", back_populates="farm", cascade="all, delete-orphan")


# ── Crop Cycle ────────────────────────────────────────────────────────────────

class CropCycle(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "crop_cycles"

    id:       Mapped[int] = mapped_column(primary_key=True, index=True)
    farm_id:  Mapped[int] = mapped_column(Integer, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_id: Mapped[int|None] = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)

    crop_name:    Mapped[str]         = mapped_column(String(100), nullable=False, index=True)
    variety:      Mapped[str|None]    = mapped_column(String(100), nullable=True)
    season:       Mapped[CropSeason]  = mapped_column(Enum(CropSeason), nullable=False)
    year:         Mapped[int]         = mapped_column(Integer, nullable=False, index=True)
    status:       Mapped[CycleStatus] = mapped_column(Enum(CycleStatus), default=CycleStatus.PLANNED, nullable=False, index=True)

    sowing_date:    Mapped[str|None] = mapped_column(String(10), nullable=True)
    expected_harvest_date: Mapped[str|None] = mapped_column(String(10), nullable=True)
    actual_harvest_date:   Mapped[str|None] = mapped_column(String(10), nullable=True)

    area_cultivated: Mapped[float]     = mapped_column(Numeric(10,3), nullable=False)
    land_unit:       Mapped[LandUnit]  = mapped_column(Enum(LandUnit), default=LandUnit.ACRE, nullable=False)

    # Yield targets and actuals
    expected_yield:  Mapped[float] = mapped_column(Numeric(15,3), default=0.0, nullable=False)
    actual_yield:    Mapped[float] = mapped_column(Numeric(15,3), default=0.0, nullable=False)
    yield_unit:      Mapped[str]   = mapped_column(String(20), default="kg", nullable=False)

    # Financials (auto-aggregated from expenses & harvest)
    total_expense:   Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    total_revenue:   Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    net_profit:      Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)

    notes:    Mapped[str|None] = mapped_column(Text, nullable=True)
    tags:     Mapped[list]     = mapped_column(JSON, default=list, nullable=False)

    farm:     Mapped["Farm"]               = relationship("Farm",          back_populates="crop_cycles")
    expenses: Mapped[list["FarmExpense"]]  = relationship("FarmExpense",   back_populates="crop_cycle", cascade="all, delete-orphan")
    harvests: Mapped[list["HarvestRecord"]] = relationship("HarvestRecord", back_populates="crop_cycle", cascade="all, delete-orphan")
    invoices: Mapped[list["AgriInvoice"]]  = relationship("AgriInvoice",   back_populates="crop_cycle", cascade="all, delete-orphan")


# ── Farm Expense ──────────────────────────────────────────────────────────────

class FarmExpense(Base, TimestampMixin):
    __tablename__ = "farm_expenses"

    id:            Mapped[int] = mapped_column(primary_key=True, index=True)
    crop_cycle_id: Mapped[int] = mapped_column(Integer, ForeignKey("crop_cycles.id", ondelete="CASCADE"), nullable=False, index=True)
    recorded_by_id: Mapped[int|None] = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)

    expense_date: Mapped[str]             = mapped_column(String(10), nullable=False)
    category:     Mapped[ExpenseCategory] = mapped_column(Enum(ExpenseCategory), nullable=False, index=True)
    description:  Mapped[str]             = mapped_column(String(500), nullable=False)
    vendor_id:    Mapped[int|None]        = mapped_column(Integer, ForeignKey("customer_master.id", ondelete="SET NULL"), nullable=True)
    quantity:     Mapped[float|None]      = mapped_column(Numeric(15,3), nullable=True)
    unit:         Mapped[str|None]        = mapped_column(String(20), nullable=True)
    unit_cost:    Mapped[float|None]      = mapped_column(Numeric(15,2), nullable=True)
    amount:       Mapped[float]           = mapped_column(Numeric(15,2), nullable=False)
    is_paid:      Mapped[bool]            = mapped_column(Boolean, default=True, nullable=False)
    receipt_no:   Mapped[str|None]        = mapped_column(String(100), nullable=True)
    notes:        Mapped[str|None]        = mapped_column(Text, nullable=True)

    crop_cycle: Mapped["CropCycle"] = relationship("CropCycle", back_populates="expenses")


# ── Harvest Record ─────────────────────────────────────────────────────────────

class HarvestRecord(Base, TimestampMixin):
    __tablename__ = "harvest_records"

    id:            Mapped[int] = mapped_column(primary_key=True, index=True)
    crop_cycle_id: Mapped[int] = mapped_column(Integer, ForeignKey("crop_cycles.id", ondelete="CASCADE"), nullable=False, index=True)
    recorded_by_id: Mapped[int|None] = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)

    harvest_date:  Mapped[str]   = mapped_column(String(10), nullable=False)
    quantity:      Mapped[float] = mapped_column(Numeric(15,3), nullable=False)
    unit:          Mapped[str]   = mapped_column(String(20), default="kg", nullable=False)
    quality_grade: Mapped[str|None] = mapped_column(String(20), nullable=True)   # A / B / C / premium
    moisture_pct:  Mapped[float|None] = mapped_column(Numeric(5,2), nullable=True)
    market_rate:   Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)  # per unit
    sale_amount:   Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    buyer_id:      Mapped[int|None] = mapped_column(Integer, ForeignKey("customer_master.id", ondelete="SET NULL"), nullable=True)
    storage_location: Mapped[str|None] = mapped_column(String(150), nullable=True)
    notes:         Mapped[str|None] = mapped_column(Text, nullable=True)

    crop_cycle: Mapped["CropCycle"] = relationship("CropCycle", back_populates="harvests")


# ── Agri Invoice ──────────────────────────────────────────────────────────────

class AgriInvoice(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "agri_invoices"

    id:            Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id:     Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id",    ondelete="CASCADE"),  nullable=False, index=True)
    crop_cycle_id: Mapped[int] = mapped_column(Integer, ForeignKey("crop_cycles.id",ondelete="CASCADE"),  nullable=False, index=True)
    buyer_id:      Mapped[int|None] = mapped_column(Integer, ForeignKey("customer_master.id",  ondelete="SET NULL"), nullable=True)
    created_by_id: Mapped[int|None] = mapped_column(Integer, ForeignKey("user_accounts.id",    ondelete="SET NULL"), nullable=True)

    invoice_number: Mapped[str]              = mapped_column(String(50),   nullable=False, unique=True, index=True)
    invoice_date:   Mapped[str]              = mapped_column(String(10),   nullable=False)
    due_date:       Mapped[str]              = mapped_column(String(10),   nullable=False)
    status:         Mapped[AgriInvoiceStatus] = mapped_column(Enum(AgriInvoiceStatus), default=AgriInvoiceStatus.DRAFT, nullable=False)

    crop_name:   Mapped[str]   = mapped_column(String(100), nullable=False)
    quantity:    Mapped[float] = mapped_column(Numeric(15,3), nullable=False)
    unit:        Mapped[str]   = mapped_column(String(20), default="kg", nullable=False)
    rate:        Mapped[float] = mapped_column(Numeric(15,2), nullable=False)
    subtotal:    Mapped[float] = mapped_column(Numeric(15,2), nullable=False)
    tax_amount:  Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    grand_total: Mapped[float] = mapped_column(Numeric(15,2), nullable=False)
    amount_paid: Mapped[float] = mapped_column(Numeric(15,2), default=0.0, nullable=False)
    amount_due:  Mapped[float] = mapped_column(Numeric(15,2), nullable=False)
    currency:    Mapped[str]   = mapped_column(String(3), default="INR", nullable=False)

    notes:       Mapped[str|None] = mapped_column(Text, nullable=True)

    crop_cycle: Mapped["CropCycle"] = relationship("CropCycle", back_populates="invoices")
