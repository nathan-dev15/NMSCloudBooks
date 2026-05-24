import enum
from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

# Top-5 civil tools (SOW 5.1.4 — pre-configured templates)
CIVIL_TOP_5_TOOLS = [
    {"code": "EXCA", "name": "Excavator",       "category": "Heavy Equipment"},
    {"code": "CONC", "name": "Concrete Mixer",  "category": "Mixing Equipment"},
    {"code": "VIBR", "name": "Vibrator",        "category": "Compaction Equipment"},
    {"code": "WELD", "name": "Welding Machine", "category": "Joining Equipment"},
    {"code": "GEND", "name": "Generator",       "category": "Power Equipment"},
]


class MaterialCategory(str, enum.Enum):
    CEMENT        = "cement"
    STEEL         = "steel"
    AGGREGATE     = "aggregate"
    SAND          = "sand"
    BRICK         = "brick"
    TIMBER        = "timber"
    PAINT         = "paint"
    PIPE          = "pipe"
    ELECTRICAL    = "electrical"
    TOOL          = "tool"
    HEAVY_EQUIP   = "heavy_equipment"
    OTHER         = "other"


class StockMovementType(str, enum.Enum):
    RECEIPT     = "receipt"     # Goods received
    ISSUE       = "issue"       # Issued to block/site
    RETURN      = "return"      # Returned from site
    TRANSFER    = "transfer"    # Site-to-site transfer
    ADJUSTMENT  = "adjustment"  # Manual correction
    CONSUMED    = "consumed"    # Recorded as consumed


class MaterialCatalog(Base, TimestampMixin, SoftDeleteMixin):
    """
    Master list of all materials and tools available.
    Includes Civil Top 5 pre-configured tools.
    """
    __tablename__ = "civil_material_catalog"

    id:          Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id:   Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    code:        Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name:        Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str|None] = mapped_column(Text, nullable=True)
    category:    Mapped[MaterialCategory] = mapped_column(Enum(MaterialCategory), default=MaterialCategory.OTHER, nullable=False, index=True)
    is_tool:     Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_top5_tool: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Pricing
    unit_of_measure: Mapped[str]        = mapped_column(String(20), default="nos", nullable=False)
    unit_price:      Mapped[float|None] = mapped_column(Numeric(12, 2), nullable=True)

    # Thresholds
    reorder_level: Mapped[float|None] = mapped_column(Numeric(10, 3), nullable=True)
    min_stock:     Mapped[float|None] = mapped_column(Numeric(10, 3), nullable=True)

    # Specs (stored as flexible JSON)
    specifications: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Supplier info
    supplier_name:    Mapped[str|None] = mapped_column(String(255), nullable=True)
    supplier_contact: Mapped[str|None] = mapped_column(String(255), nullable=True)

    stock_entries: Mapped[list["Stock"]] = relationship("Stock", back_populates="material", cascade="all, delete-orphan")


class Stock(Base, TimestampMixin):
    """
    Current stock level of a material at a specific project location.
    """
    __tablename__ = "civil_stock"

    id:          Mapped[int] = mapped_column(primary_key=True, index=True)
    material_id: Mapped[int] = mapped_column(Integer, ForeignKey("civil_material_catalog.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id:  Mapped[int] = mapped_column(Integer, ForeignKey("civil_projects.id",         ondelete="CASCADE"), nullable=False, index=True)
    block_id:    Mapped[int|None] = mapped_column(Integer, ForeignKey("civil_project_blocks.id",      ondelete="SET NULL"), nullable=True, index=True)

    location_label: Mapped[str|None] = mapped_column(String(100), nullable=True)
    quantity:        Mapped[float]   = mapped_column(Numeric(12, 3), default=0.0, nullable=False)
    reserved_qty:    Mapped[float]   = mapped_column(Numeric(12, 3), default=0.0, nullable=False)

    # Batch / serial tracking
    batch_number:  Mapped[str|None] = mapped_column(String(50), nullable=True)
    serial_number: Mapped[str|None] = mapped_column(String(50), nullable=True)
    expiry_date:   Mapped[str|None] = mapped_column(String(20), nullable=True)

    material: Mapped["MaterialCatalog"] = relationship("MaterialCatalog", back_populates="stock_entries")
    movements: Mapped[list["StockMovement"]] = relationship("StockMovement", back_populates="stock", cascade="all, delete-orphan")

    @property
    def available_qty(self) -> float:
        return float(self.quantity) - float(self.reserved_qty)


class StockMovement(Base, TimestampMixin):
    """Immutable audit trail for every stock change."""
    __tablename__ = "civil_stock_movements"

    id:            Mapped[int] = mapped_column(primary_key=True, index=True)
    stock_id:      Mapped[int] = mapped_column(Integer, ForeignKey("civil_stock.id", ondelete="CASCADE"), nullable=False, index=True)
    movement_type: Mapped[StockMovementType] = mapped_column(Enum(StockMovementType), nullable=False, index=True)

    quantity:        Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    quantity_before: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    quantity_after:  Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    unit_cost:       Mapped[float|None] = mapped_column(Numeric(12, 2), nullable=True)

    reference_type: Mapped[str|None] = mapped_column(String(50), nullable=True)   # e.g., "material_request"
    reference_id:   Mapped[int|None] = mapped_column(Integer, nullable=True)

    performed_by_id: Mapped[int|None] = mapped_column(Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True)
    notes:           Mapped[str|None] = mapped_column(String(500), nullable=True)

    stock: Mapped["Stock"] = relationship("Stock", back_populates="movements")
