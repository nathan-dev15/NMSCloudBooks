import math
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.delivery_challan import DeliveryChallan, DCItem, DCStatus
from app.core.filters import FilterBuilder


class DCRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _base(self, tenant_id: int | None):
        q = (
            select(DeliveryChallan)
            .options(selectinload(DeliveryChallan.items))
            .where(DeliveryChallan.is_deleted == False)
        )
        if tenant_id is not None:
            q = q.where(DeliveryChallan.tenant_id == tenant_id)
        return q

    async def get(self, dc_id: int, tenant_id: int | None) -> DeliveryChallan | None:
        result = await self.db.execute(
            self._base(tenant_id).where(DeliveryChallan.id == dc_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        tenant_id: int | None,
        page: int = 1,
        size: int = 20,
        search: str | None = None,
        status: str | None = None,
        client_id: int | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> tuple[list[DeliveryChallan], int]:
        fb = FilterBuilder()
        q = self._base(tenant_id)

        if search:
            fb.single_search(search, DeliveryChallan.dc_number, DeliveryChallan.reference_no, DeliveryChallan.consignee_name)
        if status:
            fb.eq(DeliveryChallan.status, status)
        if client_id:
            fb.eq(DeliveryChallan.client_id, client_id)
        if from_date or to_date:
            fb.date_range(DeliveryChallan.dc_date, from_date, to_date)

        for f in fb.filters:
            q = q.where(f)

        total = (await self.db.execute(
            select(func.count()).select_from(q.order_by(None).subquery())
        )).scalar_one()

        q = q.order_by(DeliveryChallan.id.desc()).offset((page - 1) * size).limit(size)
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows), total

    async def create(self, **kwargs) -> DeliveryChallan:
        items_data = kwargs.pop("items", [])
        dc = DeliveryChallan(**kwargs)
        self.db.add(dc)
        await self.db.flush()

        for idx, item in enumerate(items_data):
            d = item if isinstance(item, dict) else item.model_dump()
            d["item_order"] = d.get("item_order") or idx
            self.db.add(DCItem(dc_id=dc.id, **d))

        await self.db.flush()
        await self.db.refresh(dc)
        return dc

    async def update(self, dc: DeliveryChallan, **kwargs) -> DeliveryChallan:
        for key, value in kwargs.items():
            if hasattr(dc, key):
                setattr(dc, key, value)
        await self.db.flush()
        await self.db.refresh(dc)
        return dc

    async def number_exists(self, dc_number: str, tenant_id: int, exclude_id: int | None = None) -> bool:
        q = select(DeliveryChallan.id).where(
            DeliveryChallan.dc_number == dc_number,
            DeliveryChallan.tenant_id == tenant_id,
            DeliveryChallan.is_deleted == False,
        )
        if exclude_id:
            q = q.where(DeliveryChallan.id != exclude_id)
        return (await self.db.execute(q)).scalar_one_or_none() is not None

    @staticmethod
    def pages(total: int, size: int) -> int:
        return math.ceil(total / size) if total else 0
