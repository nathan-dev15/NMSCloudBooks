from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company


class CompanyRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _active(self):
        return select(Company).where(Company.is_deleted == False)

    async def list_by_admin(self, admin_id: int) -> list[Company]:
        result = await self.db.execute(
            self._active().where(Company.created_by_admin_id == admin_id)
        )
        return list(result.scalars().all())

    async def get_by_id(self, company_id: int) -> Company | None:
        result = await self.db.execute(
            self._active().where(Company.id == company_id)
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, tenant_id: int, slug: str) -> Company | None:
        result = await self.db.execute(
            self._active().where(
                Company.tenant_id == tenant_id,
                Company.slug == slug,
            )
        )
        return result.scalar_one_or_none()

    async def create(self, admin_id: int, tenant_id: int, **kwargs) -> Company:
        company = Company(created_by_admin_id=admin_id, tenant_id=tenant_id, **kwargs)
        self.db.add(company)
        await self.db.flush()
        await self.db.refresh(company)
        return company

    async def update(self, company: Company, **kwargs) -> Company:
        for key, value in kwargs.items():
            if hasattr(company, key):
                setattr(company, key, value)
        await self.db.flush()
        await self.db.refresh(company)
        return company

    async def soft_delete(self, company: Company) -> None:
        company.is_deleted = True
        await self.db.flush()
