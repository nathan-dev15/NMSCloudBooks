from fastapi import APIRouter, Depends
from app.core.deps import DB, require_admin
from app.models.user import User
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse
from app.services.company_service import CompanyService

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.get("", response_model=list[CompanyResponse])
async def list_companies(
    db: DB,
    admin: User = Depends(require_admin),
):
    return await CompanyService(db).list_companies(admin)


@router.post("", response_model=CompanyResponse, status_code=201)
async def create_company(
    payload: CompanyCreate,
    db: DB,
    admin: User = Depends(require_admin),
):
    return await CompanyService(db).create_company(admin, payload)


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: int,
    db: DB,
    admin: User = Depends(require_admin),
):
    return await CompanyService(db).get_company(company_id, admin)


@router.patch("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: int,
    payload: CompanyUpdate,
    db: DB,
    admin: User = Depends(require_admin),
):
    return await CompanyService(db).update_company(company_id, admin, payload)


@router.delete("/{company_id}", status_code=204)
async def delete_company(
    company_id: int,
    db: DB,
    admin: User = Depends(require_admin),
):
    await CompanyService(db).delete_company(company_id, admin)
