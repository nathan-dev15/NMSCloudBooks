from __future__ import annotations
import math
from typing import Optional
from sqlalchemy import select, func, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.inventory import (
    Product, ProductCategory, Warehouse,
    InventoryLevel, StockTransaction, StockTxnType,
)
from app.schemas.inventory import (
    CategoryCreate, CategoryUpdate,
    WarehouseCreate, WarehouseUpdate,
    ProductCreate, ProductUpdate,
    StockAdjust,
)


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant_id: int, data: CategoryCreate) -> ProductCategory:
        cat = ProductCategory(tenant_id=tenant_id, **data.model_dump())
        self.db.add(cat)
        await self.db.commit()
        await self.db.refresh(cat)
        return cat

    async def list(self, tenant_id: int) -> list[ProductCategory]:
        stmt = select(ProductCategory).where(
            ProductCategory.tenant_id == tenant_id,
            ProductCategory.is_deleted == False,
        ).order_by(ProductCategory.name)
        return list((await self.db.execute(stmt)).scalars().all())

    async def get(self, cat_id: int, tenant_id: int) -> Optional[ProductCategory]:
        stmt = select(ProductCategory).where(
            ProductCategory.id == cat_id,
            ProductCategory.tenant_id == tenant_id,
            ProductCategory.is_deleted == False,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def update(self, cat: ProductCategory, data: CategoryUpdate) -> ProductCategory:
        for f, v in data.model_dump(exclude_unset=True).items():
            setattr(cat, f, v)
        await self.db.commit()
        await self.db.refresh(cat)
        return cat

    async def soft_delete(self, cat: ProductCategory, user_id: int | None = None) -> None:
        cat.soft_delete(user_id=user_id)
        await self.db.commit()


# ── Warehouse ─────────────────────────────────────────────────────────────────

class WarehouseRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant_id: int, data: WarehouseCreate) -> Warehouse:
        wh = Warehouse(tenant_id=tenant_id, **data.model_dump())
        self.db.add(wh)
        if data.is_default:
            await self._clear_default(tenant_id, exclude_id=None)
        await self.db.commit()
        await self.db.refresh(wh)
        return wh

    async def list(self, tenant_id: int, active_only: bool = False) -> list[Warehouse]:
        stmt = select(Warehouse).where(
            Warehouse.tenant_id == tenant_id,
            Warehouse.is_deleted == False,
        )
        if active_only:
            stmt = stmt.where(Warehouse.is_active == True)
        return list((await self.db.execute(stmt.order_by(Warehouse.name))).scalars().all())

    async def get(self, wh_id: int, tenant_id: int) -> Optional[Warehouse]:
        stmt = select(Warehouse).where(
            Warehouse.id == wh_id,
            Warehouse.tenant_id == tenant_id,
            Warehouse.is_deleted == False,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def update(self, wh: Warehouse, data: WarehouseUpdate) -> Warehouse:
        if data.is_default:
            await self._clear_default(wh.tenant_id, exclude_id=wh.id)
        for f, v in data.model_dump(exclude_unset=True).items():
            setattr(wh, f, v)
        await self.db.commit()
        await self.db.refresh(wh)
        return wh

    async def _clear_default(self, tenant_id: int, exclude_id: Optional[int]) -> None:
        stmt = (
            update(Warehouse)
            .where(Warehouse.tenant_id == tenant_id, Warehouse.is_default == True)
            .values(is_default=False)
        )
        if exclude_id:
            stmt = stmt.where(Warehouse.id != exclude_id)
        await self.db.execute(stmt)


# ── Product ───────────────────────────────────────────────────────────────────

class ProductRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant_id: int, data: ProductCreate) -> Product:
        product = Product(tenant_id=tenant_id, **data.model_dump())
        self.db.add(product)
        await self.db.commit()
        await self.db.refresh(product)
        return await self._load_full(product.id)

    async def get(self, product_id: int, tenant_id: Optional[int] = None) -> Optional[Product]:
        stmt = (
            select(Product)
            .options(selectinload(Product.stock_levels))
            .where(Product.id == product_id, Product.is_deleted == False)
        )
        if tenant_id is not None:
            stmt = stmt.where(Product.tenant_id == tenant_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list(
        self,
        tenant_id: Optional[int],
        page: int = 1,
        size: int = 20,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        status: Optional[str] = None,
        product_type: Optional[str] = None,
        low_stock_only: bool = False,
    ) -> tuple[list[Product], int]:
        stmt = select(Product).where(Product.is_deleted == False)
        if tenant_id is not None:
            stmt = stmt.where(Product.tenant_id == tenant_id)
        if search:
            term = f"%{search}%"
            stmt = stmt.where(or_(
                Product.name.ilike(term),
                Product.sku.ilike(term),
                Product.barcode.ilike(term),
                Product.brand.ilike(term),
            ))
        if category_id:
            stmt = stmt.where(Product.category_id == category_id)
        if status:
            stmt = stmt.where(Product.status == status)
        if product_type:
            stmt = stmt.where(Product.product_type == product_type)

        total = (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt  = stmt.order_by(Product.name).offset((page - 1) * size).limit(size)
        stmt  = stmt.options(selectinload(Product.stock_levels))
        rows  = (await self.db.execute(stmt)).scalars().all()
        return list(rows), total

    async def update(self, product: Product, data: ProductUpdate) -> Product:
        for f, v in data.model_dump(exclude_unset=True).items():
            setattr(product, f, v)
        await self.db.commit()
        return await self._load_full(product.id)

    async def soft_delete(self, product_id: int, tenant_id: Optional[int], user_id: int | None = None) -> bool:
        p = await self.get(product_id, tenant_id)
        if not p:
            return False
        p.soft_delete(user_id=user_id)
        await self.db.commit()
        return True

    async def _load_full(self, product_id: int) -> Product:
        stmt = (
            select(Product)
            .options(selectinload(Product.stock_levels))
            .where(Product.id == product_id)
        )
        return (await self.db.execute(stmt)).scalar_one()

    @staticmethod
    def pages(total: int, size: int) -> int:
        return math.ceil(total / size) if size else 0


# ── Stock ─────────────────────────────────────────────────────────────────────

class StockRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def adjust(
        self, tenant_id: int, product_id: int, created_by_id: int, data: StockAdjust
    ) -> tuple[StockTransaction, InventoryLevel]:
        # Get or create the inventory level row
        stmt = select(InventoryLevel).where(
            InventoryLevel.product_id == product_id,
            InventoryLevel.warehouse_id == data.warehouse_id,
        )
        level = (await self.db.execute(stmt)).scalar_one_or_none()
        if not level:
            level = InventoryLevel(
                product_id=product_id, warehouse_id=data.warehouse_id,
                qty_on_hand=0.0, qty_reserved=0.0, qty_available=0.0,
            )
            self.db.add(level)
            await self.db.flush()

        # Check negative stock policy
        if data.qty < 0:
            product = (await self.db.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
            if product and not product.allow_negative:
                new_qty = round(level.qty_on_hand + data.qty, 3)
                if new_qty < 0:
                    raise ValueError(f"Insufficient stock: available {level.qty_on_hand}, requested {abs(data.qty)}")

        txn = StockTransaction(
            tenant_id=tenant_id,
            product_id=product_id,
            warehouse_id=data.warehouse_id,
            created_by=created_by_id,
            txn_type=data.txn_type,
            qty=data.qty,
            unit_cost=data.unit_cost,
            ref_type=data.ref_type,
            ref_id=data.ref_id,
            notes=data.notes,
            batch_no=data.batch_no,
            expiry_date=data.expiry_date,
        )
        self.db.add(txn)

        level.qty_on_hand   = round(level.qty_on_hand + data.qty, 3)
        level.qty_available = round(level.qty_on_hand - level.qty_reserved, 3)

        await self.db.commit()
        await self.db.refresh(txn)
        await self.db.refresh(level)
        return txn, level

    async def get_level(self, product_id: int, warehouse_id: int) -> Optional[InventoryLevel]:
        stmt = select(InventoryLevel).where(
            InventoryLevel.product_id == product_id,
            InventoryLevel.warehouse_id == warehouse_id,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_transactions(
        self, product_id: int, tenant_id: int, page: int = 1, size: int = 30
    ) -> tuple[list[StockTransaction], int]:
        stmt = select(StockTransaction).where(
            StockTransaction.product_id == product_id,
            StockTransaction.tenant_id == tenant_id,
        )
        total = (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt  = stmt.order_by(StockTransaction.created_at.desc()).offset((page - 1) * size).limit(size)
        return list((await self.db.execute(stmt)).scalars().all()), total

    async def low_stock_report(self, tenant_id: int) -> list[dict]:
        """Return products where qty_available <= reorder_level (for any warehouse)."""
        stmt = (
            select(
                Product.id.label("product_id"),
                Product.name.label("product_name"),
                Product.sku.label("sku"),
                Product.reorder_level,
                Product.reorder_qty,
                Warehouse.id.label("warehouse_id"),
                Warehouse.name.label("warehouse_name"),
                InventoryLevel.qty_available,
            )
            .join(InventoryLevel, InventoryLevel.product_id == Product.id)
            .join(Warehouse, Warehouse.id == InventoryLevel.warehouse_id)
            .where(
                Product.tenant_id == tenant_id,
                Product.is_deleted == False,
                Product.track_inventory == True,
                InventoryLevel.qty_available <= Product.reorder_level,
            )
            .order_by(InventoryLevel.qty_available)
        )
        rows = (await self.db.execute(stmt)).all()
        return [r._asdict() for r in rows]
