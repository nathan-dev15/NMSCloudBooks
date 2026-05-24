from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.civil.requests import MaterialRequest, MaterialRequestItem, RequestStatus


class MaterialRequestRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> MaterialRequest:
        # Assign next stack position for the project
        project_id = kwargs.get("project_id")
        max_pos_result = await self.db.execute(
            select(func.max(MaterialRequest.stack_position))
            .where(MaterialRequest.project_id == project_id,
                   MaterialRequest.status.in_([RequestStatus.PENDING, RequestStatus.OTP_SENT]))
        )
        max_pos = max_pos_result.scalar_one_or_none() or 0
        kwargs["stack_position"] = max_pos + 1

        items_data = kwargs.pop("items", [])
        req = MaterialRequest(**kwargs)
        self.db.add(req)
        await self.db.flush()

        for item_data in items_data:
            item = MaterialRequestItem(request_id=req.id, **item_data)
            self.db.add(item)

        await self.db.commit()
        result = await self.db.execute(
            select(MaterialRequest)
            .where(MaterialRequest.id == req.id)
            .options(selectinload(MaterialRequest.items))
        )
        return result.scalar_one()

    async def get_by_id(self, request_id: int) -> MaterialRequest | None:
        result = await self.db.execute(
            select(MaterialRequest)
            .where(MaterialRequest.id == request_id)
            .options(selectinload(MaterialRequest.items))
        )
        return result.scalar_one_or_none()

    async def list_by_project(
        self, project_id: int,
        status: RequestStatus | None = None,
        page: int = 1, size: int = 20,
    ) -> tuple[list[MaterialRequest], int]:
        q = select(MaterialRequest).where(MaterialRequest.project_id == project_id)
        if status: q = q.where(MaterialRequest.status == status)

        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        q = q.options(selectinload(MaterialRequest.items)).order_by(MaterialRequest.stack_position)
        q = q.offset((page - 1) * size).limit(size)
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows), total

    async def update(self, req: MaterialRequest, **kwargs) -> MaterialRequest:
        for k, v in kwargs.items():
            if hasattr(req, k):
                setattr(req, k, v)
        await self.db.commit()
        result = await self.db.execute(
            select(MaterialRequest)
            .where(MaterialRequest.id == req.id)
            .options(selectinload(MaterialRequest.items))
        )
        return result.scalar_one()

    async def get_next_pending(self, project_id: int) -> MaterialRequest | None:
        result = await self.db.execute(
            select(MaterialRequest)
            .where(
                MaterialRequest.project_id == project_id,
                MaterialRequest.status == RequestStatus.PENDING,
            )
            .order_by(MaterialRequest.stack_position)
            .options(selectinload(MaterialRequest.items))
            .limit(1)
        )
        return result.scalar_one_or_none()
