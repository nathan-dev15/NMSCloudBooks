import math
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.purchase_requisition import PurchaseRequisition, PRItem, PRStatus
from app.core.filters import FilterBuilder


class PRRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _base(self, tenant_id: int | None):
        q = (
            select(PurchaseRequisition)
            .options(selectinload(PurchaseRequisition.items))
            .where(PurchaseRequisition.is_deleted == False)
        )
        if tenant_id is not None:
            q = q.where(PurchaseRequisition.tenant_id == tenant_id)
        return q

    async def get(self, pr_id: int, tenant_id: int | None) -> PurchaseRequisition | None:
        result = await self.db.execute(
            self._base(tenant_id).where(PurchaseRequisition.id == pr_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        tenant_id: int | None,
        page: int = 1,
        size: int = 20,
        search: str | None = None,
        status: str | None = None,
        priority: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> tuple[list[PurchaseRequisition], int]:
        fb = FilterBuilder()
        q = self._base(tenant_id)

        if search:
            fb.single_search(search, PurchaseRequisition.pr_number, PurchaseRequisition.reference_no, PurchaseRequisition.department)
        if status:
            fb.eq(PurchaseRequisition.status, status)
        if priority:
            fb.eq(PurchaseRequisition.priority, priority)
        if from_date or to_date:
            fb.date_range(PurchaseRequisition.request_date, from_date, to_date)

        for f in fb.filters:
            q = q.where(f)

        total = (await self.db.execute(
            select(func.count()).select_from(q.order_by(None).subquery())
        )).scalar_one()

        q = q.order_by(PurchaseRequisition.id.desc()).offset((page - 1) * size).limit(size)
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows), total

    async def create(self, **kwargs) -> PurchaseRequisition:
        items_data = kwargs.pop("items", [])
        pr = PurchaseRequisition(**kwargs)
        self.db.add(pr)
        await self.db.flush()

        for idx, item in enumerate(items_data):
            d = item if isinstance(item, dict) else item.model_dump()
            d["item_order"] = d.get("item_order") or idx
            d["estimated_total"] = round(d.get("quantity", 0) * d.get("estimated_unit_price", 0), 2)
            self.db.add(PRItem(pr_id=pr.id, **d))

        await self.db.flush()
        await self.db.refresh(pr)
        return pr

    async def update(self, pr: PurchaseRequisition, **kwargs) -> PurchaseRequisition:
        for key, value in kwargs.items():
            if hasattr(pr, key):
                setattr(pr, key, value)
        await self.db.flush()
        await self.db.refresh(pr)
        return pr

    async def number_exists(self, pr_number: str, tenant_id: int, exclude_id: int | None = None) -> bool:
        q = select(PurchaseRequisition.id).where(
            PurchaseRequisition.pr_number == pr_number,
            PurchaseRequisition.tenant_id == tenant_id,
            PurchaseRequisition.is_deleted == False,
        )
        if exclude_id:
            q = q.where(PurchaseRequisition.id != exclude_id)
        return (await self.db.execute(q)).scalar_one_or_none() is not None

    @staticmethod
    def pages(total: int, size: int) -> int:
        return math.ceil(total / size) if total else 0
