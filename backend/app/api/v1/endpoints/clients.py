from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import DB, CurrentUser, SuperAdmin, AdminOrAbove, PrimaryOrAbove, get_current_user, require_super_admin, require_admin_or_above, require_primary_or_above
from app.models.user import UserRole
from app.repositories.client_repository import ClientRepository
from app.schemas.client import (
    ClientCreate, ClientUpdate, ClientResponse, ClientListItem, PaginatedClients,
    ClientContactCreate, ClientContactUpdate, ClientContactResponse,
    CommunicationCreate, CommunicationResponse,
)

router = APIRouter(prefix="/clients", tags=["Clients"])

DB = Depends(get_db)


def _repo(db: AsyncSession = DB) -> ClientRepository:
    return ClientRepository(db)


def _tenant_scope(current_user: CurrentUser = Depends(get_current_user)) -> Optional[int]:
    """Super Admin sees all tenants; everyone else scoped to their own."""
    if current_user.role == UserRole.SUPER_ADMIN:
        return None
    return current_user.tenant_id


# ── Client CRUD ──────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedClients)
async def list_clients(
    page:        int            = Query(1, ge=1),
    size:        int            = Query(20, ge=1, le=100),
    search:      Optional[str]  = Query(None),
    client_type: Optional[str]  = Query(None),
    segment:     Optional[str]  = Query(None),
    is_active:   Optional[bool] = Query(None),
    city:        Optional[str]  = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    repo: ClientRepository = Depends(_repo),
):
    tenant_id = _tenant_scope(current_user)
    items, total = await repo.list(
        tenant_id=tenant_id, page=page, size=size,
        search=search, client_type=client_type,
        segment=segment, is_active=is_active, city=city,
    )
    return PaginatedClients(
        items=items, total=total, page=page, size=size,
        pages=ClientRepository.pages(total, size),
    )


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    data: ClientCreate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo: ClientRepository = Depends(_repo),
):
    tenant_id = 1 if current_user.role == UserRole.SUPER_ADMIN else current_user.tenant_id
    return await repo.create(
        tenant_id=tenant_id or 1,
        created_by_id=current_user.id,
        data=data,
    )


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    repo: ClientRepository = Depends(_repo),
):
    client = await repo.get(client_id, _tenant_scope(current_user))
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: int,
    data: ClientUpdate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo: ClientRepository = Depends(_repo),
):
    client = await repo.update(client_id, _tenant_scope(current_user), data)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: int,
    current_user: AdminOrAbove = Depends(require_admin_or_above),
    repo: ClientRepository = Depends(_repo),
):
    deleted = await repo.soft_delete(client_id, _tenant_scope(current_user))
    if not deleted:
        raise HTTPException(status_code=404, detail="Client not found")


# ── Contacts ──────────────────────────────────────────────────────────────────

@router.post("/{client_id}/contacts", response_model=ClientContactResponse, status_code=201)
async def add_contact(
    client_id: int,
    data: ClientContactCreate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo: ClientRepository = Depends(_repo),
):
    client = await repo.get(client_id, _tenant_scope(current_user))
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return await repo.add_contact(client_id, data)


@router.put("/{client_id}/contacts/{contact_id}", response_model=ClientContactResponse)
async def update_contact(
    client_id: int,
    contact_id: int,
    data: ClientContactUpdate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo: ClientRepository = Depends(_repo),
):
    contact = await repo.update_contact(contact_id, client_id, data)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.delete("/{client_id}/contacts/{contact_id}", status_code=204)
async def delete_contact(
    client_id: int,
    contact_id: int,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo: ClientRepository = Depends(_repo),
):
    deleted = await repo.delete_contact(contact_id, client_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Contact not found")


# ── Communications ────────────────────────────────────────────────────────────

@router.post("/{client_id}/communications", response_model=CommunicationResponse, status_code=201)
async def log_communication(
    client_id: int,
    data: CommunicationCreate,
    current_user: PrimaryOrAbove = Depends(require_primary_or_above),
    repo: ClientRepository = Depends(_repo),
):
    client = await repo.get(client_id, _tenant_scope(current_user))
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return await repo.log_communication(client_id, current_user.id, data)


@router.get("/{client_id}/communications", response_model=dict)
async def list_communications(
    client_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    repo: ClientRepository = Depends(_repo),
):
    client = await repo.get(client_id, _tenant_scope(current_user))
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    items, total = await repo.list_communications(client_id, page, size)
    return {"items": items, "total": total, "page": page, "size": size}
