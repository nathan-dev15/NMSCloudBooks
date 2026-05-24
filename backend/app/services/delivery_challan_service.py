from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.models.delivery_challan import DeliveryChallan, DCStatus
from app.repositories.delivery_challan_repository import DCRepository
from app.schemas.delivery_challan import DCCreate, DCUpdate
from app.services.audit_service import AuditService, model_snapshot
from app.core.deletion_guard import assert_is_latest


def _format_dc_number(tenant_id: int, dc_id: int) -> str:
    year = datetime.now(timezone.utc).year
    return f"DC-{tenant_id:03d}-{year}-{dc_id:05d}"


class DCService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = DCRepository(db)
        self.audit = AuditService(db)

    async def create(self, tenant_id: int, user_id: int, data: DCCreate) -> DeliveryChallan:
        dc_number = data.dc_number or "PENDING"

        if data.dc_number:
            if await self.repo.number_exists(data.dc_number, tenant_id):
                raise ValueError(f"DC number '{data.dc_number}' already exists.")

        dc = await self.repo.create(
            tenant_id=tenant_id,
            created_by_id=user_id,
            dc_number=dc_number,
            reference_no=data.reference_no,
            dc_date=data.dc_date,
            delivery_date=data.delivery_date,
            client_id=data.client_id,
            from_address=data.from_address,
            to_address=data.to_address,
            consignee_name=data.consignee_name,
            vehicle_number=data.vehicle_number,
            driver_name=data.driver_name,
            notes=data.notes,
            items=data.items,
        )

        if not data.dc_number:
            dc.dc_number = _format_dc_number(tenant_id, dc.id)
            await self.db.flush()

        await self.audit.log(
            action="CREATE", resource_type="delivery_challan", resource_id=dc.id,
            doc_number=dc.dc_number, user_id=user_id, tenant_id=tenant_id,
            before=None, after=model_snapshot(dc), description=f"DC {dc.dc_number} created",
        )
        return await self._reload(dc.id)

    async def update(self, dc: DeliveryChallan, data: DCUpdate, user_id: int) -> DeliveryChallan:
        if dc.status not in (DCStatus.DRAFT,):
            raise ValueError("Only DRAFT delivery challans can be edited.")

        before = model_snapshot(dc)
        updates = data.model_dump(exclude_none=True, exclude={"regenerate_dc_number"})

        if data.regenerate_dc_number:
            updates["dc_number"] = _format_dc_number(dc.tenant_id, dc.id)
        elif data.dc_number:
            if await self.repo.number_exists(data.dc_number, dc.tenant_id, exclude_id=dc.id):
                raise ValueError(f"DC number '{data.dc_number}' already exists.")

        dc = await self.repo.update(dc, **updates)
        await self.audit.log(
            action="UPDATE", resource_type="delivery_challan", resource_id=dc.id,
            doc_number=dc.dc_number, user_id=user_id, tenant_id=dc.tenant_id,
            before=before, after=model_snapshot(dc), description=f"DC {dc.dc_number} updated",
        )
        return dc

    async def change_status(self, dc: DeliveryChallan, new_status: DCStatus, user_id: int) -> DeliveryChallan:
        ALLOWED: dict[DCStatus, list[DCStatus]] = {
            DCStatus.DRAFT:      [DCStatus.DISPATCHED, DCStatus.CANCELLED],
            DCStatus.DISPATCHED: [DCStatus.DELIVERED, DCStatus.RETURNED, DCStatus.CANCELLED],
            DCStatus.DELIVERED:  [],
            DCStatus.RETURNED:   [],
            DCStatus.CANCELLED:  [],
        }
        if new_status not in ALLOWED.get(dc.status, []):
            raise ValueError(f"Cannot transition from {dc.status.value} to {new_status.value}.")

        before = model_snapshot(dc)
        updates: dict = {"status": new_status}
        if new_status == DCStatus.DELIVERED:
            updates["delivery_date"] = updates.get("delivery_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")

        dc = await self.repo.update(dc, **updates)
        await self.audit.log(
            action="STATUS_CHANGE", resource_type="delivery_challan", resource_id=dc.id,
            doc_number=dc.dc_number, user_id=user_id, tenant_id=dc.tenant_id,
            before=before, after=model_snapshot(dc),
            description=f"DC {dc.dc_number} status → {new_status.value}",
        )
        return dc

    async def cancel(self, dc: DeliveryChallan, user_id: int) -> DeliveryChallan:
        if dc.status in (DCStatus.CANCELLED, DCStatus.DELIVERED):
            raise ValueError(f"Cannot cancel a {dc.status.value} delivery challan.")
        before = model_snapshot(dc)
        dc = await self.repo.update(dc, status=DCStatus.CANCELLED)
        await self.audit.log(
            action="CANCEL", resource_type="delivery_challan", resource_id=dc.id,
            doc_number=dc.dc_number, user_id=user_id, tenant_id=dc.tenant_id,
            before=before, after=model_snapshot(dc), description=f"DC {dc.dc_number} cancelled",
        )
        return dc

    async def delete(self, dc_id: int, tenant_id: int | None, user_id: int) -> bool:
        dc = await self.repo.get(dc_id, tenant_id)
        if not dc:
            return False
        await assert_is_latest(self.db, DeliveryChallan, dc_id, tenant_id, label="delivery challan")
        before = model_snapshot(dc)
        dc.soft_delete(user_id=user_id)
        await self.db.flush()
        await self.audit.log(
            action="DELETE", resource_type="delivery_challan", resource_id=dc_id,
            doc_number=dc.dc_number, user_id=user_id, tenant_id=dc.tenant_id,
            before=before, after=None, description=f"DC {dc.dc_number} deleted",
        )
        return True

    async def _reload(self, dc_id: int) -> DeliveryChallan:
        result = await self.db.execute(
            select(DeliveryChallan)
            .options(selectinload(DeliveryChallan.items))
            .where(DeliveryChallan.id == dc_id)
        )
        return result.scalar_one()
