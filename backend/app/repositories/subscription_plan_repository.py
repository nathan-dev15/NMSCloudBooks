from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.subscription_plan import SubscriptionPlan


class SubscriptionPlanRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_active(self) -> list[SubscriptionPlan]:
        result = await self.db.execute(
            select(SubscriptionPlan)
            .where(SubscriptionPlan.is_active == True)
            .order_by(SubscriptionPlan.display_order)
        )
        return list(result.scalars().all())

    async def list_all(self) -> list[SubscriptionPlan]:
        result = await self.db.execute(
            select(SubscriptionPlan).order_by(SubscriptionPlan.display_order)
        )
        return list(result.scalars().all())

    async def get_by_id(self, plan_id: int) -> SubscriptionPlan | None:
        result = await self.db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> SubscriptionPlan | None:
        result = await self.db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.slug == slug)
        )
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> SubscriptionPlan:
        plan = SubscriptionPlan(**kwargs)
        self.db.add(plan)
        await self.db.flush()
        await self.db.refresh(plan)
        return plan

    async def update(self, plan: SubscriptionPlan, **kwargs) -> SubscriptionPlan:
        for key, value in kwargs.items():
            if hasattr(plan, key) and value is not None:
                setattr(plan, key, value)
        await self.db.flush()
        await self.db.refresh(plan)
        return plan

    async def delete(self, plan: SubscriptionPlan) -> None:
        await self.db.delete(plan)
        await self.db.flush()
