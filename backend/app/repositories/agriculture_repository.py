from __future__ import annotations
import math
from datetime import date
from typing import Optional
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.agriculture import (
    Farm, CropCycle, FarmExpense, HarvestRecord, AgriInvoice,
    CycleStatus, AgriInvoiceStatus,
)
from app.schemas.agriculture import (
    FarmCreate, FarmUpdate,
    CropCycleCreate, CropCycleUpdate,
    ExpenseCreate, HarvestCreate,
    AgriInvoiceCreate, AgriInvoiceStatusUpdate,
)


class FarmRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant_id: int, data: FarmCreate) -> Farm:
        farm = Farm(tenant_id=tenant_id, **data.model_dump())
        self.db.add(farm)
        await self.db.commit()
        await self.db.refresh(farm)
        return farm

    async def get(self, farm_id: int, tenant_id: Optional[int] = None) -> Optional[Farm]:
        stmt = select(Farm).where(Farm.id == farm_id, Farm.is_deleted == False)
        if tenant_id:
            stmt = stmt.where(Farm.tenant_id == tenant_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list(
        self, tenant_id: Optional[int],
        page: int = 1, size: int = 20,
        search: Optional[str] = None,
        district: Optional[str] = None,
        state: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> tuple[list[Farm], int]:
        stmt = select(Farm).where(Farm.is_deleted == False)
        if tenant_id:
            stmt = stmt.where(Farm.tenant_id == tenant_id)
        if search:
            t = f"%{search}%"
            stmt = stmt.where(or_(Farm.name.ilike(t), Farm.farm_code.ilike(t), Farm.village.ilike(t)))
        if district:
            stmt = stmt.where(Farm.district.ilike(f"%{district}%"))
        if state:
            stmt = stmt.where(Farm.state.ilike(f"%{state}%"))
        if is_active is not None:
            stmt = stmt.where(Farm.is_active == is_active)
        total = (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        rows  = (await self.db.execute(stmt.order_by(Farm.name).offset((page-1)*size).limit(size))).scalars().all()
        return list(rows), total

    async def update(self, farm: Farm, data: FarmUpdate) -> Farm:
        for f, v in data.model_dump(exclude_unset=True).items():
            setattr(farm, f, v)
        await self.db.commit()
        await self.db.refresh(farm)
        return farm

    async def soft_delete(self, farm: Farm, user_id: int | None = None) -> None:
        farm.soft_delete(user_id=user_id)
        await self.db.commit()

    @staticmethod
    def pages(total: int, size: int) -> int:
        return math.ceil(total / size) if size else 0


class CropCycleRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant_id: int, created_by_id: int, data: CropCycleCreate) -> CropCycle:
        cycle = CropCycle(tenant_id=tenant_id, created_by_id=created_by_id, **data.model_dump())
        self.db.add(cycle)
        await self.db.commit()
        return await self._load_full(cycle.id)

    async def get(self, cycle_id: int, tenant_id: Optional[int] = None) -> Optional[CropCycle]:
        stmt = (
            select(CropCycle)
            .options(
                selectinload(CropCycle.expenses),
                selectinload(CropCycle.harvests),
                selectinload(CropCycle.invoices),
            )
            .where(CropCycle.id == cycle_id, CropCycle.is_deleted == False)
        )
        if tenant_id:
            stmt = stmt.where(CropCycle.tenant_id == tenant_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list(
        self, tenant_id: Optional[int],
        page: int = 1, size: int = 20,
        farm_id: Optional[int] = None,
        season: Optional[str] = None,
        year: Optional[int] = None,
        status: Optional[str] = None,
        crop_name: Optional[str] = None,
    ) -> tuple[list[CropCycle], int]:
        stmt = select(CropCycle).where(CropCycle.is_deleted == False)
        if tenant_id:
            stmt = stmt.where(CropCycle.tenant_id == tenant_id)
        if farm_id:
            stmt = stmt.where(CropCycle.farm_id == farm_id)
        if season:
            stmt = stmt.where(CropCycle.season == season)
        if year:
            stmt = stmt.where(CropCycle.year == year)
        if status:
            stmt = stmt.where(CropCycle.status == status)
        if crop_name:
            stmt = stmt.where(CropCycle.crop_name.ilike(f"%{crop_name}%"))
        total = (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        rows  = (await self.db.execute(stmt.order_by(CropCycle.year.desc(), CropCycle.id.desc()).offset((page-1)*size).limit(size))).scalars().all()
        return list(rows), total

    async def update(self, cycle: CropCycle, data: CropCycleUpdate) -> CropCycle:
        for f, v in data.model_dump(exclude_unset=True).items():
            setattr(cycle, f, v)
        if data.status == CycleStatus.COMPLETED:
            await self._recalc_financials(cycle)
        await self.db.commit()
        return await self._load_full(cycle.id)

    async def add_expense(self, cycle: CropCycle, recorded_by_id: int, data: ExpenseCreate) -> FarmExpense:
        exp = FarmExpense(crop_cycle_id=cycle.id, recorded_by_id=recorded_by_id, **data.model_dump())
        self.db.add(exp)
        cycle.total_expense = round(float(cycle.total_expense) + float(data.amount), 2)
        cycle.net_profit    = round(float(cycle.total_revenue) - float(cycle.total_expense), 2)
        await self.db.commit()
        await self.db.refresh(exp)
        return exp

    async def add_harvest(self, cycle: CropCycle, recorded_by_id: int, data: HarvestCreate) -> HarvestRecord:
        rec = HarvestRecord(crop_cycle_id=cycle.id, recorded_by_id=recorded_by_id, **data.model_dump())
        self.db.add(rec)
        cycle.actual_yield   = round(float(cycle.actual_yield) + float(data.quantity), 3)
        cycle.total_revenue  = round(float(cycle.total_revenue) + float(data.sale_amount or 0), 2)
        cycle.net_profit     = round(float(cycle.total_revenue) - float(cycle.total_expense), 2)
        await self.db.commit()
        await self.db.refresh(rec)
        return rec

    async def _recalc_financials(self, cycle: CropCycle) -> None:
        """Re-aggregate from child rows for accuracy."""
        exp_stmt = select(func.coalesce(func.sum(FarmExpense.amount), 0)).where(FarmExpense.crop_cycle_id == cycle.id)
        rev_stmt = select(func.coalesce(func.sum(HarvestRecord.sale_amount), 0)).where(HarvestRecord.crop_cycle_id == cycle.id)
        yld_stmt = select(func.coalesce(func.sum(HarvestRecord.quantity), 0)).where(HarvestRecord.crop_cycle_id == cycle.id)
        cycle.total_expense = float((await self.db.execute(exp_stmt)).scalar_one())
        cycle.total_revenue = float((await self.db.execute(rev_stmt)).scalar_one())
        cycle.actual_yield  = float((await self.db.execute(yld_stmt)).scalar_one())
        cycle.net_profit    = round(cycle.total_revenue - cycle.total_expense, 2)

    async def soft_delete(self, cycle: CropCycle, user_id: int | None = None) -> None:
        cycle.soft_delete(user_id=user_id)
        await self.db.commit()

    async def _load_full(self, cycle_id: int) -> CropCycle:
        stmt = (
            select(CropCycle)
            .options(
                selectinload(CropCycle.expenses),
                selectinload(CropCycle.harvests),
                selectinload(CropCycle.invoices),
            )
            .where(CropCycle.id == cycle_id)
        )
        return (await self.db.execute(stmt)).scalar_one()

    @staticmethod
    def pages(total: int, size: int) -> int:
        return math.ceil(total / size) if size else 0


class AgriInvoiceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _next_number(self, tenant_id: int) -> str:
        count = (await self.db.execute(
            select(func.count()).select_from(AgriInvoice).where(AgriInvoice.tenant_id == tenant_id)
        )).scalar_one()
        year = date.today().year
        return f"AGRI-{tenant_id:03d}-{year}-{count + 1:05d}"

    async def create(self, tenant_id: int, created_by_id: int, data: AgriInvoiceCreate) -> AgriInvoice:
        cycle = (await self.db.execute(
            select(CropCycle).where(CropCycle.id == data.crop_cycle_id)
        )).scalar_one_or_none()
        if not cycle:
            raise ValueError("Crop cycle not found")

        subtotal    = round(data.quantity * data.rate, 2)
        grand_total = round(subtotal + data.tax_amount, 2)
        inv_number  = data.invoice_number or await self._next_number(tenant_id)

        inv = AgriInvoice(
            tenant_id=tenant_id,
            created_by_id=created_by_id,
            invoice_number=inv_number,
            crop_name=cycle.crop_name,
            subtotal=subtotal,
            grand_total=grand_total,
            amount_due=grand_total,
            **{k: v for k, v in data.model_dump().items() if k != "invoice_number"},
        )
        self.db.add(inv)
        await self.db.commit()
        await self.db.refresh(inv)
        return inv

    async def get(self, inv_id: int, tenant_id: Optional[int] = None) -> Optional[AgriInvoice]:
        stmt = select(AgriInvoice).where(AgriInvoice.id == inv_id, AgriInvoice.is_deleted == False)
        if tenant_id:
            stmt = stmt.where(AgriInvoice.tenant_id == tenant_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list(
        self, tenant_id: Optional[int],
        page: int = 1, size: int = 20,
        status: Optional[str] = None,
        crop_cycle_id: Optional[int] = None,
    ) -> tuple[list[AgriInvoice], int]:
        stmt = select(AgriInvoice).where(AgriInvoice.is_deleted == False)
        if tenant_id:
            stmt = stmt.where(AgriInvoice.tenant_id == tenant_id)
        if status:
            stmt = stmt.where(AgriInvoice.status == status)
        if crop_cycle_id:
            stmt = stmt.where(AgriInvoice.crop_cycle_id == crop_cycle_id)
        total = (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        rows  = (await self.db.execute(stmt.order_by(AgriInvoice.invoice_date.desc()).offset((page-1)*size).limit(size))).scalars().all()
        return list(rows), total

    async def update_status(self, inv: AgriInvoice, data: AgriInvoiceStatusUpdate) -> AgriInvoice:
        inv.status = data.status
        if data.amount_paid is not None:
            inv.amount_paid = round(data.amount_paid, 2)
            inv.amount_due  = round(inv.grand_total - inv.amount_paid, 2)
            if inv.amount_due <= 0:
                inv.status = AgriInvoiceStatus.PAID
            elif inv.amount_paid > 0:
                inv.status = AgriInvoiceStatus.PARTIAL
        await self.db.commit()
        await self.db.refresh(inv)
        return inv

    @staticmethod
    def pages(total: int, size: int) -> int:
        return math.ceil(total / size) if size else 0
