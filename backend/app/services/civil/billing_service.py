"""
Weekly billing service — generates a WeeklyBill for each active block
by aggregating DailyActivity entries and stock issues for the week.
"""
import math
from datetime import date, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.civil.billing import WeeklyBill, WeeklyBillStatus, DailyActivity, ActivityType, WorkOrder
from app.models.civil.materials import StockMovement, StockMovementType
from app.models.civil.project import Block, BlockStatus


def _week_bounds(ref: date) -> tuple[date, date]:
    """Return Monday–Sunday for the week containing `ref`."""
    monday = ref - timedelta(days=ref.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _bill_number(block_id: int, week_start: date) -> str:
    return f"WB-{block_id:04d}-{week_start.strftime('%Y%m%d')}"


class WeeklyBillingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_for_block(self, block_id: int, ref_date: date | None = None) -> WeeklyBill:
        """
        Generate (or regenerate) the weekly bill for a block.
        If a bill already exists for the week it is overwritten (status stays DRAFT).
        """
        ref = ref_date or date.today()
        week_start, week_end = _week_bounds(ref)

        block_result = await self.db.execute(
            select(Block).where(Block.id == block_id, Block.is_deleted == False)
        )
        block = block_result.scalar_one_or_none()
        if not block:
            from app.core.exceptions import NotFoundError
            raise NotFoundError("Block")

        # ---- Aggregate daily activities ----
        activity_result = await self.db.execute(
            select(
                func.sum(DailyActivity.amount).label("total_amount"),
                func.sum(DailyActivity.hours_worked).label("total_hours"),
            )
            .where(
                DailyActivity.block_id == block_id,
                DailyActivity.activity_date >= week_start,
                DailyActivity.activity_date <= week_end,
                DailyActivity.is_billable == True,
            )
        )
        agg = activity_result.one()
        labour_cost = float(agg.total_amount or 0.0)

        # ---- Aggregate material issues ----
        from app.models.civil.materials import Stock
        material_result = await self.db.execute(
            select(func.sum(StockMovement.quantity * StockMovement.unit_cost))
            .join(Stock, StockMovement.stock_id == Stock.id)
            .where(
                Stock.block_id == block_id,
                StockMovement.movement_type == StockMovementType.ISSUE,
                StockMovement.created_at >= week_start,
                StockMovement.created_at <= week_end,
            )
        )
        material_cost = float(material_result.scalar_one() or 0.0)

        total_cost = labour_cost + material_cost

        # ---- Build line items snapshot ----
        activities = (await self.db.execute(
            select(DailyActivity)
            .where(
                DailyActivity.block_id == block_id,
                DailyActivity.activity_date >= week_start,
                DailyActivity.activity_date <= week_end,
                DailyActivity.is_billable == True,
            )
        )).scalars().all()

        line_items = [
            {
                "date": str(a.activity_date),
                "type": a.activity_type.value,
                "title": a.title,
                "hours": float(a.hours_worked or 0),
                "amount": float(a.amount or 0),
            }
            for a in activities
        ]

        # ---- Upsert bill ----
        bill_number = _bill_number(block_id, week_start)
        existing_result = await self.db.execute(
            select(WeeklyBill).where(WeeklyBill.bill_number == bill_number)
        )
        bill = existing_result.scalar_one_or_none()

        if bill and bill.status != WeeklyBillStatus.DRAFT:
            from app.core.exceptions import ValidationError
            raise ValidationError("Cannot regenerate a bill that is no longer in DRAFT status")

        values = dict(
            block_id=block_id,
            week_start_date=str(week_start),
            week_end_date=str(week_end),
            bill_number=bill_number,
            labour_cost=labour_cost,
            material_cost=material_cost,
            overhead_cost=0.0,
            total_cost=total_cost,
            progress_this_week=float(block.progress),
            cumulative_progress=float(block.progress),
            line_items=line_items,
            status=WeeklyBillStatus.DRAFT,
        )

        if bill:
            for k, v in values.items():
                setattr(bill, k, v)
        else:
            bill = WeeklyBill(**values)
            self.db.add(bill)

        await self.db.flush()
        await self.db.refresh(bill)
        return bill

    async def submit_bill(self, bill_id: int) -> WeeklyBill:
        bill = await self._get_bill(bill_id)
        if bill.status != WeeklyBillStatus.DRAFT:
            from app.core.exceptions import ValidationError
            raise ValidationError("Only DRAFT bills can be submitted")
        bill.status = WeeklyBillStatus.SUBMITTED
        await self.db.flush()
        return bill

    async def approve_bill(self, bill_id: int, approver_id: int) -> WeeklyBill:
        bill = await self._get_bill(bill_id)
        if bill.status != WeeklyBillStatus.SUBMITTED:
            from app.core.exceptions import ValidationError
            raise ValidationError("Only SUBMITTED bills can be approved")
        bill.status = WeeklyBillStatus.APPROVED
        bill.approved_by_id = approver_id
        await self.db.flush()
        return bill

    async def list_by_block(self, block_id: int) -> list[WeeklyBill]:
        result = await self.db.execute(
            select(WeeklyBill)
            .where(WeeklyBill.block_id == block_id)
            .order_by(WeeklyBill.week_start_date.desc())
        )
        return list(result.scalars().all())

    async def _get_bill(self, bill_id: int) -> WeeklyBill:
        result = await self.db.execute(select(WeeklyBill).where(WeeklyBill.id == bill_id))
        bill = result.scalar_one_or_none()
        if not bill:
            from app.core.exceptions import NotFoundError
            raise NotFoundError("Weekly bill")
        return bill
