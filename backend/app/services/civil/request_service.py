"""
Material Request approval workflow with OTP verification.

Flow:
  Primary User → creates DRAFT → submits → PENDING (stack)
  Admin sees next pending → requests OTP → OTP_SENT
  Admin receives OTP (SMS/email) → verifies → APPROVED
  Stock auto-issued → FULFILLED
"""
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password, generate_otp
from app.core.exceptions import ForbiddenError, ValidationError, NotFoundError
from app.models.civil.requests import MaterialRequest, RequestStatus
from app.models.civil.materials import StockMovementType
from app.repositories.civil.request_repository import MaterialRequestRepository
from app.repositories.civil.stock_repository import StockRepository
from app.workers.tasks import send_otp

OTP_EXPIRY_MINUTES = 10
MAX_OTP_ATTEMPTS   = 3


class MaterialRequestService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = MaterialRequestRepository(db)
        self.stock_repo = StockRepository(db)

    async def submit_request(self, request_id: int, submitted_by_id: int) -> MaterialRequest:
        """Move DRAFT → PENDING and assign stack position."""
        req = await self.repo.get_by_id(request_id)
        if not req:
            raise NotFoundError("Material request")
        if req.requested_by_id != submitted_by_id:
            raise ForbiddenError("You can only submit your own requests")
        if req.status != RequestStatus.DRAFT:
            raise ValidationError(f"Cannot submit a request in '{req.status}' status")

        return await self.repo.update(req, status=RequestStatus.PENDING)

    async def initiate_otp(self, request_id: int, admin_id: int, admin_phone: str) -> MaterialRequest:
        """
        Admin picks up the next request and triggers OTP.
        OTP is sent to admin's phone for verification.
        """
        req = await self.repo.get_by_id(request_id)
        if not req:
            raise NotFoundError("Material request")
        if req.status not in (RequestStatus.PENDING, RequestStatus.OTP_SENT):
            raise ValidationError(f"Request is in '{req.status}' status — cannot send OTP")

        otp = generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

        await self.repo.update(
            req,
            status=RequestStatus.OTP_SENT,
            otp_hash=hash_password(otp),
            otp_expires_at=expires_at.isoformat(),
            otp_attempts=0,
            approved_by_id=admin_id,
        )

        # Queue the OTP delivery (Celery)
        send_otp.delay(admin_phone, otp)

        return req

    async def verify_otp_and_approve(
        self,
        request_id: int,
        otp: str,
        admin_id: int,
        item_approvals: list[dict] | None = None,
    ) -> MaterialRequest:
        """Verify OTP, approve request, auto-issue stock."""
        req = await self.repo.get_by_id(request_id)
        if not req:
            raise NotFoundError("Material request")
        if req.status != RequestStatus.OTP_SENT:
            raise ValidationError("No OTP is pending for this request")
        if req.approved_by_id != admin_id:
            raise ForbiddenError("OTP was sent to a different admin")

        # Check expiry
        expires_at = datetime.fromisoformat(req.otp_expires_at)
        if datetime.now(timezone.utc) > expires_at:
            await self.repo.update(req, status=RequestStatus.PENDING, otp_hash=None, otp_attempts=0)
            raise ValidationError("OTP has expired. Request a new OTP.")

        # Check attempts
        if req.otp_attempts >= MAX_OTP_ATTEMPTS:
            await self.repo.update(req, status=RequestStatus.PENDING, otp_hash=None, otp_attempts=0)
            raise ValidationError("Too many incorrect OTP attempts. Request a new OTP.")

        if not verify_password(otp, req.otp_hash):
            await self.repo.update(req, otp_attempts=req.otp_attempts + 1)
            remaining = MAX_OTP_ATTEMPTS - (req.otp_attempts + 1)
            raise ValidationError(f"Incorrect OTP. {remaining} attempt(s) remaining.")

        # Apply per-item approved quantities
        approved_map: dict[int, float] = {}
        if item_approvals:
            approved_map = {ia["item_id"]: ia["approved_qty"] for ia in item_approvals}

        for item in req.items:
            item.approved_qty = approved_map.get(item.id, item.requested_qty)

        # Mark approved
        await self.repo.update(
            req,
            status=RequestStatus.APPROVED,
            otp_hash=None,
            otp_attempts=0,
            approved_at=datetime.now(timezone.utc).isoformat(),
        )

        # Auto-issue stock for items that have a material_id
        for item in req.items:
            if item.material_id and item.approved_qty and item.approved_qty > 0:
                stock = await self.stock_repo.get_or_create_stock(
                    material_id=item.material_id,
                    project_id=req.project_id,
                    block_id=req.block_id,
                )
                await self.stock_repo.adjust(
                    stock, qty_delta=-item.approved_qty,
                    movement_type=StockMovementType.ISSUE,
                    performed_by_id=admin_id,
                    notes=f"Auto-issued for request #{req.id}: {req.title}",
                    reference_type="material_request",
                    reference_id=req.id,
                )
                item.issued_qty = item.approved_qty

        await self.repo.update(req, status=RequestStatus.FULFILLED)
        return req

    async def reject_request(self, request_id: int, admin_id: int, reason: str) -> MaterialRequest:
        req = await self.repo.get_by_id(request_id)
        if not req:
            raise NotFoundError("Material request")
        if req.status not in (RequestStatus.PENDING, RequestStatus.OTP_SENT):
            raise ValidationError(f"Cannot reject a request in '{req.status}' status")

        return await self.repo.update(
            req,
            status=RequestStatus.REJECTED,
            rejection_reason=reason,
            approved_by_id=admin_id,
            otp_hash=None,
            otp_attempts=0,
        )
