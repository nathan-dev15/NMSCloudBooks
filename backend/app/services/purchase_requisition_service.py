from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.models.purchase_requisition import PurchaseRequisition, PRStatus
from app.repositories.purchase_requisition_repository import PRRepository
from app.schemas.purchase_requisition import PRCreate, PRUpdate
from app.services.audit_service import AuditService, model_snapshot
from app.core.deletion_guard import assert_is_latest


def _format_pr_number(tenant_id: int, pr_id: int) -> str:
    year = datetime.now(timezone.utc).year
    return f"PR-{tenant_id:03d}-{year}-{pr_id:05d}"


class PRService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PRRepository(db)
        self.audit = AuditService(db)

    async def create(self, tenant_id: int, user_id: int, data: PRCreate) -> PurchaseRequisition:
        pr_number = data.pr_number or "PENDING"

        if data.pr_number:
            if await self.repo.number_exists(data.pr_number, tenant_id):
                raise ValueError(f"PR number '{data.pr_number}' already exists.")

        pr = await self.repo.create(
            tenant_id=tenant_id,
            requested_by_id=user_id,
            pr_number=pr_number,
            reference_no=data.reference_no,
            request_date=data.request_date,
            required_by_date=data.required_by_date,
            priority=data.priority,
            department=data.department,
            purpose=data.purpose,
            notes=data.notes,
            tags=data.tags,
            items=data.items,
        )

        if not data.pr_number:
            pr.pr_number = _format_pr_number(tenant_id, pr.id)
            await self.db.flush()

        await self.audit.log(
            action="CREATE", resource_type="purchase_requisition", resource_id=pr.id,
            doc_number=pr.pr_number, user_id=user_id, tenant_id=tenant_id,
            before=None, after=model_snapshot(pr), description=f"PR {pr.pr_number} created",
        )
        return await self._reload(pr.id)

    async def update(self, pr: PurchaseRequisition, data: PRUpdate, user_id: int) -> PurchaseRequisition:
        if pr.status not in (PRStatus.DRAFT,):
            raise ValueError("Only DRAFT requisitions can be edited.")

        before = model_snapshot(pr)
        updates = data.model_dump(exclude_none=True, exclude={"regenerate_pr_number"})

        if data.regenerate_pr_number:
            updates["pr_number"] = _format_pr_number(pr.tenant_id, pr.id)
        elif data.pr_number:
            if await self.repo.number_exists(data.pr_number, pr.tenant_id, exclude_id=pr.id):
                raise ValueError(f"PR number '{data.pr_number}' already exists.")

        pr = await self.repo.update(pr, **updates)
        await self.audit.log(
            action="UPDATE", resource_type="purchase_requisition", resource_id=pr.id,
            doc_number=pr.pr_number, user_id=user_id, tenant_id=pr.tenant_id,
            before=before, after=model_snapshot(pr), description=f"PR {pr.pr_number} updated",
        )
        return pr

    async def change_status(self, pr: PurchaseRequisition, new_status: PRStatus, user_id: int) -> PurchaseRequisition:
        ALLOWED: dict[PRStatus, list[PRStatus]] = {
            PRStatus.DRAFT:      [PRStatus.SUBMITTED, PRStatus.CANCELLED],
            PRStatus.SUBMITTED:  [PRStatus.APPROVED, PRStatus.REJECTED, PRStatus.CANCELLED],
            PRStatus.APPROVED:   [PRStatus.CONVERTED, PRStatus.CANCELLED],
            PRStatus.REJECTED:   [],
            PRStatus.CONVERTED:  [],
            PRStatus.CANCELLED:  [],
        }
        if new_status not in ALLOWED.get(pr.status, []):
            raise ValueError(f"Cannot transition from {pr.status.value} to {new_status.value}.")

        before = model_snapshot(pr)
        updates: dict = {"status": new_status}
        if new_status == PRStatus.APPROVED:
            updates["approved_by_id"] = user_id
            updates["approved_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        pr = await self.repo.update(pr, **updates)
        await self.audit.log(
            action="STATUS_CHANGE", resource_type="purchase_requisition", resource_id=pr.id,
            doc_number=pr.pr_number, user_id=user_id, tenant_id=pr.tenant_id,
            before=before, after=model_snapshot(pr),
            description=f"PR {pr.pr_number} status → {new_status.value}",
        )
        return pr

    async def cancel(self, pr: PurchaseRequisition, user_id: int) -> PurchaseRequisition:
        if pr.status in (PRStatus.CANCELLED, PRStatus.CONVERTED):
            raise ValueError(f"Cannot cancel a {pr.status.value} requisition.")
        before = model_snapshot(pr)
        pr = await self.repo.update(pr, status=PRStatus.CANCELLED)
        await self.audit.log(
            action="CANCEL", resource_type="purchase_requisition", resource_id=pr.id,
            doc_number=pr.pr_number, user_id=user_id, tenant_id=pr.tenant_id,
            before=before, after=model_snapshot(pr), description=f"PR {pr.pr_number} cancelled",
        )
        return pr

    async def delete(self, pr_id: int, tenant_id: int | None, user_id: int) -> bool:
        pr = await self.repo.get(pr_id, tenant_id)
        if not pr:
            return False
        await assert_is_latest(self.db, PurchaseRequisition, pr_id, tenant_id, label="purchase requisition")
        before = model_snapshot(pr)
        pr.soft_delete(user_id=user_id)
        await self.db.flush()
        await self.audit.log(
            action="DELETE", resource_type="purchase_requisition", resource_id=pr_id,
            doc_number=pr.pr_number, user_id=user_id, tenant_id=pr.tenant_id,
            before=before, after=None, description=f"PR {pr.pr_number} deleted",
        )
        return True

    async def _reload(self, pr_id: int) -> PurchaseRequisition:
        result = await self.db.execute(
            select(PurchaseRequisition)
            .options(selectinload(PurchaseRequisition.items))
            .where(PurchaseRequisition.id == pr_id)
        )
        return result.scalar_one()
