from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.civil.materials import MaterialCatalog, Stock, StockMovement, StockMovementType, CIVIL_TOP_5_TOOLS
from app.models.civil.requests import RequestStatus


class StockRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_stock(
        self, material_id: int, project_id: int, block_id: int | None = None
    ) -> Stock:
        q = select(Stock).where(
            Stock.material_id == material_id,
            Stock.project_id == project_id,
            Stock.block_id == block_id,
        )
        result = await self.db.execute(q)
        stock = result.scalar_one_or_none()
        if not stock:
            stock = Stock(material_id=material_id, project_id=project_id, block_id=block_id, quantity=0.0)
            self.db.add(stock)
            await self.db.flush()
            await self.db.refresh(stock)
        return stock

    async def adjust(
        self, stock: Stock, qty_delta: float,
        movement_type: StockMovementType,
        performed_by_id: int | None = None,
        notes: str | None = None,
        unit_cost: float | None = None,
        reference_type: str | None = None,
        reference_id: int | None = None,
    ) -> StockMovement:
        before = float(stock.quantity)
        stock.quantity = before + qty_delta
        movement = StockMovement(
            stock_id=stock.id,
            movement_type=movement_type,
            quantity=abs(qty_delta),
            quantity_before=before,
            quantity_after=float(stock.quantity),
            performed_by_id=performed_by_id,
            notes=notes,
            unit_cost=unit_cost,
            reference_type=reference_type,
            reference_id=reference_id,
        )
        self.db.add(movement)
        await self.db.flush()
        return movement

    async def list_by_project(self, project_id: int) -> list[Stock]:
        result = await self.db.execute(
            select(Stock).where(Stock.project_id == project_id)
        )
        return list(result.scalars().all())

    async def get_movements(self, stock_id: int, limit: int = 50) -> list[StockMovement]:
        result = await self.db.execute(
            select(StockMovement)
            .where(StockMovement.stock_id == stock_id)
            .order_by(StockMovement.id.desc())
            .limit(limit)
        )
        return list(result.scalars().all())


class MaterialCatalogRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def seed_top5_tools(self, tenant_id: int) -> list[MaterialCatalog]:
        """Create the 5 pre-configured civil tools for a tenant if not already seeded."""
        seeded = []
        for tool in CIVIL_TOP_5_TOOLS:
            existing = await self.db.execute(
                select(MaterialCatalog).where(
                    MaterialCatalog.tenant_id == tenant_id,
                    MaterialCatalog.code == tool["code"],
                )
            )
            if not existing.scalar_one_or_none():
                m = MaterialCatalog(
                    tenant_id=tenant_id,
                    code=tool["code"],
                    name=tool["name"],
                    category="tool",
                    is_tool=True,
                    is_top5_tool=True,
                )
                self.db.add(m)
                seeded.append(m)
        if seeded:
            await self.db.flush()
        return seeded

    async def create(self, tenant_id: int, **kwargs) -> MaterialCatalog:
        m = MaterialCatalog(tenant_id=tenant_id, **kwargs)
        self.db.add(m)
        await self.db.flush()
        await self.db.refresh(m)
        return m

    async def list_by_tenant(self, tenant_id: int, is_tool: bool | None = None) -> list[MaterialCatalog]:
        q = select(MaterialCatalog).where(
            MaterialCatalog.tenant_id == tenant_id,
            MaterialCatalog.is_deleted == False,
        )
        if is_tool is not None:
            q = q.where(MaterialCatalog.is_tool == is_tool)
        result = await self.db.execute(q)
        return list(result.scalars().all())
