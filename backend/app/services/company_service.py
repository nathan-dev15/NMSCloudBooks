from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.company_repository import CompanyRepository
from app.schemas.company import CompanyCreate, CompanyUpdate


class CompanyService:
    def __init__(self, db: AsyncSession):
        self.repo = CompanyRepository(db)

    async def list_companies(self, admin: User) -> list:
        return await self.repo.list_by_admin(admin.id)

    async def get_company(self, company_id: int, admin: User):
        company = await self.repo.get_by_id(company_id)
        if not company or company.created_by_admin_id != admin.id:
            raise HTTPException(status_code=404, detail="Company not found")
        return company

    async def create_company(self, admin: User, payload: CompanyCreate):
        if not admin.tenant_id:
            raise HTTPException(status_code=403, detail="Admin has no associated tenant")
        existing = await self.repo.get_by_slug(admin.tenant_id, payload.slug)
        if existing:
            raise HTTPException(status_code=409, detail="A company with this slug already exists")
        return await self.repo.create(
            admin_id=admin.id,
            tenant_id=admin.tenant_id,
            **payload.model_dump(),
        )

    async def update_company(self, company_id: int, admin: User, payload: CompanyUpdate):
        company = await self.get_company(company_id, admin)
        return await self.repo.update(company, **payload.model_dump(exclude_none=True))

    async def delete_company(self, company_id: int, admin: User) -> None:
        company = await self.get_company(company_id, admin)
        await self.repo.soft_delete(company)
