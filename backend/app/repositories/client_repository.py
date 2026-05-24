from __future__ import annotations
import math
from typing import Optional
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client, ClientContact, ClientCommunication
from app.schemas.client import (
    ClientCreate, ClientUpdate, ClientContactCreate, ClientContactUpdate,
    CommunicationCreate,
)


class ClientRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Client CRUD ─────────────────────────────────────────────────────────

    async def create(self, tenant_id: int, created_by_id: int, data: ClientCreate) -> Client:
        contacts_data = data.model_dump().pop("contacts", [])
        client = Client(
            tenant_id=tenant_id,
            created_by=created_by_id,
            **{k: v for k, v in data.model_dump().items() if k != "contacts"},
        )
        self.db.add(client)
        await self.db.flush()

        for c in contacts_data:
            self.db.add(ClientContact(client_id=client.id, **c))

        await self.db.commit()
        await self.db.refresh(client)
        return await self._load_full(client.id)

    async def get(self, client_id: int, tenant_id: Optional[int] = None) -> Optional[Client]:
        stmt = (
            select(Client)
            .options(selectinload(Client.contacts))
            .where(Client.id == client_id, Client.is_deleted == False)
        )
        if tenant_id is not None:
            stmt = stmt.where(Client.tenant_id == tenant_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(
        self,
        tenant_id: Optional[int],
        page: int = 1,
        size: int = 20,
        search: Optional[str] = None,
        client_type: Optional[str] = None,
        segment: Optional[str] = None,
        is_active: Optional[bool] = None,
        city: Optional[str] = None,
    ) -> tuple[list[Client], int]:
        stmt = select(Client).where(Client.is_deleted == False)
        if tenant_id is not None:
            stmt = stmt.where(Client.tenant_id == tenant_id)
        if search:
            term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    Client.display_name.ilike(term),
                    Client.client_code.ilike(term),
                    Client.email.ilike(term),
                    Client.phone.ilike(term),
                    Client.gstin.ilike(term),
                )
            )
        if client_type:
            stmt = stmt.where(Client.client_type == client_type)
        if segment:
            stmt = stmt.where(Client.segment == segment)
        if is_active is not None:
            stmt = stmt.where(Client.is_active == is_active)
        if city:
            stmt = stmt.where(Client.city.ilike(f"%{city}%"))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = stmt.order_by(Client.display_name).offset((page - 1) * size).limit(size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return list(rows), total

    async def update(
        self, client_id: int, tenant_id: Optional[int], data: ClientUpdate
    ) -> Optional[Client]:
        client = await self.get(client_id, tenant_id)
        if not client:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(client, field, value)
        await self.db.commit()
        return await self._load_full(client_id)

    async def soft_delete(self, client_id: int, tenant_id: Optional[int]) -> bool:
        from datetime import datetime, timezone
        client = await self.get(client_id, tenant_id)
        if not client:
            return False
        client.is_deleted = True
        client.deleted_at = datetime.now(timezone.utc)
        client.is_active  = False
        await self.db.commit()
        return True

    # ── Contacts ─────────────────────────────────────────────────────────────

    async def add_contact(self, client_id: int, data: ClientContactCreate) -> ClientContact:
        contact = ClientContact(client_id=client_id, **data.model_dump())
        self.db.add(contact)
        await self.db.commit()
        await self.db.refresh(contact)
        return contact

    async def update_contact(
        self, contact_id: int, client_id: int, data: ClientContactUpdate
    ) -> Optional[ClientContact]:
        stmt = select(ClientContact).where(
            ClientContact.id == contact_id, ClientContact.client_id == client_id
        )
        contact = (await self.db.execute(stmt)).scalar_one_or_none()
        if not contact:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(contact, field, value)
        await self.db.commit()
        await self.db.refresh(contact)
        return contact

    async def delete_contact(self, contact_id: int, client_id: int) -> bool:
        stmt = select(ClientContact).where(
            ClientContact.id == contact_id, ClientContact.client_id == client_id
        )
        contact = (await self.db.execute(stmt)).scalar_one_or_none()
        if not contact:
            return False
        await self.db.delete(contact)
        await self.db.commit()
        return True

    # ── Communications ────────────────────────────────────────────────────────

    async def log_communication(
        self, client_id: int, logged_by_id: int, data: CommunicationCreate
    ) -> ClientCommunication:
        comm = ClientCommunication(
            client_id=client_id, logged_by_id=logged_by_id, **data.model_dump()
        )
        self.db.add(comm)
        await self.db.commit()
        await self.db.refresh(comm)
        return comm

    async def list_communications(
        self, client_id: int, page: int = 1, size: int = 20
    ) -> tuple[list[ClientCommunication], int]:
        stmt = select(ClientCommunication).where(ClientCommunication.client_id == client_id)
        total = (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt = stmt.order_by(ClientCommunication.created_at.desc()).offset((page - 1) * size).limit(size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return list(rows), total

    # ── helpers ───────────────────────────────────────────────────────────────

    async def _load_full(self, client_id: int) -> Client:
        stmt = (
            select(Client)
            .options(selectinload(Client.contacts))
            .where(Client.id == client_id)
        )
        return (await self.db.execute(stmt)).scalar_one()

    @staticmethod
    def pages(total: int, size: int) -> int:
        return math.ceil(total / size) if size else 0
