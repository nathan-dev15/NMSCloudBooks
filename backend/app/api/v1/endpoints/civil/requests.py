from fastapi import APIRouter, HTTPException, Query, Depends
from app.core.deps import DB, CurrentUser, SuperAdmin, AdminOrAbove, PrimaryOrAbove, get_current_user, require_super_admin, require_admin_or_above, require_primary_or_above
from app.core.exceptions import NMSCBException
from app.models.civil.requests import RequestStatus
from app.repositories.civil.request_repository import MaterialRequestRepository
from app.services.civil.request_service import MaterialRequestService
from app.schemas.civil.requests import (
    MaterialRequestCreate, MaterialRequestUpdate, MaterialRequestResponse,
    SubmitRequestAction, OTPVerifyAction, RejectAction, BulkApproveAction,
)
import math

router = APIRouter(prefix="/civil/requests", tags=["Civil — Material Requests"])


@router.post("", response_model=MaterialRequestResponse, status_code=201)
async def create_request(payload: MaterialRequestCreate, db: DB, current_user: PrimaryOrAbove = Depends(require_primary_or_above)):
    """Primary User or above can raise a material request."""
    repo = MaterialRequestRepository(db)
    items_data = [i.model_dump() for i in payload.items]
    return await repo.create(
        project_id=payload.project_id,
        block_id=payload.block_id,
        requested_by_id=current_user.id,
        title=payload.title,
        notes=payload.notes,
        priority=payload.priority,
        required_by=payload.required_by,
        status="draft",
        items=items_data,
    )


@router.get("", response_model=dict)
async def list_requests(
    db: DB, current_user: CurrentUser = Depends(get_current_user),
    project_id: int = Query(...),
    status: RequestStatus | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    repo = MaterialRequestRepository(db)
    items, total = await repo.list_by_project(project_id, status=status, page=page, size=size)
    return {
        "items": [MaterialRequestResponse.model_validate(r) for r in items],
        "total": total, "page": page, "size": size,
        "pages": math.ceil(total / size) if total else 0,
    }


@router.get("/{request_id}", response_model=MaterialRequestResponse)
async def get_request(request_id: int, db: DB, current_user: CurrentUser = Depends(get_current_user)):
    repo = MaterialRequestRepository(db)
    req = await repo.get_by_id(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req


@router.post("/{request_id}/submit", response_model=MaterialRequestResponse)
async def submit_request(request_id: int, db: DB, current_user: PrimaryOrAbove = Depends(require_primary_or_above)):
    """Move DRAFT → PENDING (into the approval stack)."""
    service = MaterialRequestService(db)
    try:
        return await service.submit_request(request_id, current_user.id)
    except NMSCBException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/{request_id}/otp/send", response_model=MaterialRequestResponse)
async def send_otp_for_request(request_id: int, db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    """Admin triggers OTP for approval. OTP sent to admin's phone."""
    service = MaterialRequestService(db)
    try:
        # Phone comes from the admin's profile
        phone = current_user.phone or "0000000000"
        return await service.initiate_otp(request_id, current_user.id, phone)
    except NMSCBException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/{request_id}/otp/verify", response_model=MaterialRequestResponse)
async def verify_otp(request_id: int, payload: OTPVerifyAction, bulk: BulkApproveAction | None = None, db: DB = None, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    service = MaterialRequestService(db)
    try:
        item_approvals = [ia.model_dump() for ia in (bulk.item_approvals if bulk else [])]
        return await service.verify_otp_and_approve(request_id, payload.otp, current_user.id, item_approvals)
    except NMSCBException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/{request_id}/reject", response_model=MaterialRequestResponse)
async def reject_request(request_id: int, payload: RejectAction, db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    service = MaterialRequestService(db)
    try:
        return await service.reject_request(request_id, current_user.id, payload.reason)
    except NMSCBException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
