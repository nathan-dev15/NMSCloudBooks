import enum
from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin, UUIDMixin


class ProductStatus(str, enum.Enum):
    ACTIVE       = "active"
    INACTIVE     = "inactive"
    DISCONTINUED = "discontinued"


class ProductType(str, enum.Enum):
    GOODS   = "goods"
    SERVICE = "service"
    DIGITAL = "digital"


class StockTxnType(str, enum.Enum):
    IN              = "IN"
    OUT             = "OUT"
    ADJUST          = "ADJUST"
    TRANSFER        = "TRANSFER"
    RETURN          = "RETURN"
    PURCHASE_RECEIPT = "purchase_receipt"
    SALE_ISSUE       = "sale_issue"
    ADJUSTMENT_IN    = "adjustment_in"
    ADJUSTMENT_OUT   = "adjustment_out"
    TRANSFER_IN      = "transfer_in"
    TRANSFER_OUT     = "transfer_out"
    RETURN_IN        = "return_in"
    OPENING_STOCK    = "opening_stock"


# ── Product Category (supporting table, kept as-is) ───────────────────────────

class ProductCategory(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "product_categories"

    id:        Mapped[int]      = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int]      = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("product_categories.id", ondelete="SET NULL"), nullable=True
    )
    name:        Mapped[str]      = mapped_column(String(100), nullable=False)
    slug:        Mapped[str]      = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str|None] = mapped_column(Text, nullable=True)
    is_active:   Mapped[bool]     = mapped_column(Boolean, default=True, nullable=False)

    products:  Mapped[list["Product"]]        = relationship("Product", back_populates="category")
    children:  Mapped[list["ProductCategory"]] = relationship(
        "ProductCategory", foreign_keys="ProductCategory.parent_id"
    )

    __table_args__ = (UniqueConstraint("tenant_id", "slug", name="uq_category_tenant_slug"),)


# ── Warehouse (supporting table, kept as-is) ──────────────────────────────────

class Warehouse(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "warehouses"

    id:        Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name:        Mapped[str]      = mapped_column(String(150), nullable=False)
    code:        Mapped[str|None] = mapped_column(String(20),  nullable=True, index=True)
    address:     Mapped[str|None] = mapped_column(Text, nullable=True)
    is_active:   Mapped[bool]     = mapped_column(Boolean, default=True, nullable=False)
    is_default:  Mapped[bool]     = mapped_column(Boolean, default=False, nullable=False)
    manager_id:  Mapped[int|None] = mapped_column(
        Integer, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True
    )

    stock_levels: Mapped[list["InventoryLevel"]]   = relationship(
        "InventoryLevel", back_populates="warehouse", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["StockTransaction"]] = relationship(
        "StockTransaction", back_populates="warehouse"
    )


# ── Product master — PDF table: inventory_products_master ─────────────────────

class Product(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Product catalog — PDF table: inventory_products_master."""
    __tablename__ = "inventory_products_master"

    id:          Mapped[int]      = mapped_column(primary_key=True, index=True)
    tenant_id:   Mapped[int]      = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("product_categories.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Identification — PDF: product_code, product_name
    name:         Mapped[str]      = mapped_column(String(255), nullable=False, index=True)
    product_code: Mapped[str|None] = mapped_column(String(100), nullable=True, unique=True, index=True)
    sku:          Mapped[str|None] = mapped_column(String(100), nullable=True, index=True)
    barcode:      Mapped[str|None] = mapped_column(String(100), nullable=True, index=True)
    hsn_sac:      Mapped[str|None] = mapped_column(String(20),  nullable=True)
    hsn_code:     Mapped[str|None] = mapped_column(String(20),  nullable=True)
    description:  Mapped[str|None] = mapped_column(Text, nullable=True)

    # Classification — PDF: product_category
    product_type: Mapped[ProductType]   = mapped_column(
        Enum(ProductType), default=ProductType.GOODS, nullable=False
    )
    status:       Mapped[ProductStatus] = mapped_column(
        Enum(ProductStatus), default=ProductStatus.ACTIVE, nullable=False, index=True
    )
    is_active:    Mapped[bool]          = mapped_column(Boolean, default=True, nullable=False)

    # Unit & pricing — PDF: standard_unit_price, unit_of_measure
    unit:           Mapped[str]   = mapped_column(String(20), default="nos", nullable=False)
    purchase_price: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    selling_price:  Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    unit_price:     Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    mrp:            Mapped[float] = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    currency:       Mapped[str]   = mapped_column(String(3), default="INR", nullable=False)
    tax_rate:       Mapped[float] = mapped_column(Numeric(5, 2),  default=18.0, nullable=False)

    # Stock thresholds — PDF: minimum_stock_level, reorder_quantity
    reorder_level:   Mapped[float] = mapped_column(Numeric(15, 3), default=0.0, nullable=False)
    reorder_qty:     Mapped[float] = mapped_column(Numeric(15, 3), default=0.0, nullable=False)
    max_stock_level: Mapped[float] = mapped_column(Numeric(15, 3), default=0.0, nullable=False)
    lead_time_days:  Mapped[int]   = mapped_column(Integer, default=7, nullable=False)

    # Tracking flags
    track_inventory: Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    allow_negative:  Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Metadata
    brand:      Mapped[str|None] = mapped_column(String(100), nullable=True)
    tags:       Mapped[list]     = mapped_column(JSON, default=list, nullable=False)
    attributes: Mapped[dict]     = mapped_column(JSON, default=dict, nullable=False)

    category:     Mapped["ProductCategory"]    = relationship("ProductCategory", back_populates="products")
    stock_levels: Mapped[list["InventoryLevel"]] = relationship(
        "InventoryLevel", back_populates="product", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["StockTransaction"]] = relationship(
        "StockTransaction", back_populates="product"
    )


# ── Inventory level per warehouse — PDF table: inventory_stock_levels ─────────

class InventoryLevel(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Current stock per product per warehouse — PDF table: inventory_stock_levels."""
    __tablename__ = "inventory_stock_levels"

    id:           Mapped[int] = mapped_column(primary_key=True, index=True)
    product_id:   Mapped[int] = mapped_column(
        Integer, ForeignKey("inventory_products_master.id", ondelete="CASCADE"), nullable=False, index=True
    )
    warehouse_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("civil_projects.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Stock quantities — PDF: quantity_on_hand, quantity_reserved, quantity_available
    qty_on_hand:   Mapped[float] = mapped_column(Numeric(15, 3), default=0.0, nullable=False)
    qty_reserved:  Mapped[float] = mapped_column(Numeric(15, 3), default=0.0, nullable=False)
    qty_available: Mapped[float] = mapped_column(Numeric(15, 3), default=0.0, nullable=False)

    # Location / batch
    warehouse_location: Mapped[str|None] = mapped_column(String(255), nullable=True)
    batch_number:       Mapped[str|None] = mapped_column(String(100), nullable=True, index=True)
    serial_number:      Mapped[str|None] = mapped_column(String(100), nullable=True)
    expiry_date:        Mapped[str|None] = mapped_column(String(10),  nullable=True)

    # Costing
    unit_cost:      Mapped[float|None] = mapped_column(Numeric(15, 2), nullable=True)
    costing_method: Mapped[str|None]   = mapped_column(String(50), nullable=True)

    product:   Mapped["Product"]   = relationship("Product",   back_populates="stock_levels")
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", back_populates="stock_levels")

    __table_args__ = (
        UniqueConstraint("product_id", "warehouse_id", name="uq_inv_stock_level_product_warehouse"),
    )


# ── Stock movement ledger — PDF table: inventory_movement_history ─────────────

class StockTransaction(Base, UUIDMixin, TimestampMixin):
    """
    Immutable ledger of every stock movement — PDF table: inventory_movement_history.
    Python class name kept as StockTransaction for backward compat.
    """
    __tablename__ = "inventory_movement_history"

    id:           Mapped[int]          = mapped_column(primary_key=True, index=True)
    tenant_id:    Mapped[int]          = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id:   Mapped[int]          = mapped_column(
        Integer, ForeignKey("inventory_products_master.id", ondelete="CASCADE"), nullable=False, index=True
    )
    warehouse_id: Mapped[int]          = mapped_column(
        Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stock_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("inventory_stock_levels.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Movement type — PDF: movement_type, movement_subtype
    txn_type:         Mapped[StockTxnType] = mapped_column(Enum(StockTxnType), nullable=False, index=True)
    movement_subtype: Mapped[str|None]     = mapped_column(String(50), nullable=True)

    # Quantities — PDF: quantity_before, quantity_changed, quantity_after
    qty:              Mapped[float]     = mapped_column(Numeric(15, 3), nullable=False)
    quantity_before:  Mapped[int|None]  = mapped_column(Integer, nullable=True)
    quantity_changed: Mapped[int|None]  = mapped_column(Integer, nullable=True)
    quantity_after:   Mapped[int|None]  = mapped_column(Integer, nullable=True)

    unit_cost:  Mapped[float]      = mapped_column(Numeric(15, 2), default=0.0, nullable=False)
    ref_type:   Mapped[str|None]   = mapped_column(String(50),  nullable=True)
    ref_id:     Mapped[int|None]   = mapped_column(Integer,      nullable=True)
    notes:      Mapped[str|None]   = mapped_column(Text, nullable=True)
    batch_no:   Mapped[str|None]   = mapped_column(String(100), nullable=True)
    expiry_date: Mapped[str|None]  = mapped_column(String(10),  nullable=True)

    # Project transfer context
    from_project_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("civil_projects.id", ondelete="SET NULL"), nullable=True
    )
    to_project_id: Mapped[int|None] = mapped_column(
        Integer, ForeignKey("civil_projects.id", ondelete="SET NULL"), nullable=True
    )

    product:   Mapped["Product"]   = relationship("Product",   back_populates="transactions")
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", back_populates="transactions")
