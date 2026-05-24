from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.tenant import Tenant, DomainModule


class TenantRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, tenant_id: int) -> Tenant | None:
        result = await self.db.execute(
            select(Tenant).where(Tenant.id == tenant_id, Tenant.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Tenant | None:
        result = await self.db.execute(
            select(Tenant).where(Tenant.slug == slug, Tenant.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> Tenant:
        tenant = Tenant(**kwargs)
        self.db.add(tenant)
        await self.db.flush()
        await self.db.refresh(tenant)
        return tenant

    async def update(self, tenant: Tenant, **kwargs) -> Tenant:
        for key, value in kwargs.items():
            if hasattr(tenant, key) and value is not None:
                setattr(tenant, key, value)
        await self.db.flush()
        await self.db.refresh(tenant)
        return tenant

    async def list_all(self) -> list[Tenant]:
        result = await self.db.execute(select(Tenant).where(Tenant.is_deleted == False))
        return list(result.scalars().all())

    async def toggle_module(self, tenant: Tenant, module: DomainModule, enabled: bool) -> Tenant:
        modules: list = list(tenant.enabled_modules or [])
        if enabled and module.value not in modules:
            modules.append(module.value)
        elif not enabled and module.value in modules:
            modules.remove(module.value)
        tenant.enabled_modules = modules
        await self.db.flush()
        await self.db.refresh(tenant)
        return tenant
