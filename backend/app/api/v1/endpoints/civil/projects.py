from fastapi import APIRouter, HTTPException, Query, Depends
from app.core.deps import DB, CurrentUser, SuperAdmin, AdminOrAbove, PrimaryOrAbove, get_current_user, require_super_admin, require_admin_or_above, require_primary_or_above
from app.models.user import UserRole
from app.models.civil.project import ProjectStatus
from app.repositories.civil.project_repository import ProjectRepository, PlanRepository, BlockRepository
from app.schemas.civil.projects import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    PlanCreate, PlanResponse,
    BlockCreate, BlockUpdate, BlockResponse,
)
from app.core.exceptions import NMSCBException
import math

router = APIRouter(prefix="/civil/projects", tags=["Civil — Projects"])


# ── Projects ──────────────────────────────────────────────────────────────────

@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(payload: ProjectCreate, db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    """Only Admin and Super Admin can create projects."""
    repo = ProjectRepository(db)
    try:
        return await repo.create(
            tenant_id=current_user.tenant_id,
            admin_id=current_user.id,
            **payload.model_dump(),
        )
    except NMSCBException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("", response_model=dict)
async def list_projects(
    db: DB, current_user: CurrentUser = Depends(get_current_user),
    state: str | None = None,
    district: str | None = None,
    status: ProjectStatus | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    repo = ProjectRepository(db)
    projects, total = await repo.list_by_tenant(
        tenant_id=current_user.tenant_id,
        state=state, district=district, status=status,
        page=page, size=size,
    )
    return {
        "items": [ProjectResponse.model_validate(p) for p in projects],
        "total": total, "page": page, "size": size,
        "pages": math.ceil(total / size) if total else 0,
    }


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: int, db: DB, current_user: CurrentUser = Depends(get_current_user)):
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project or project.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: int, payload: ProjectUpdate, db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project or project.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return await repo.update(project, **payload.model_dump(exclude_none=True))


# ── Plans ─────────────────────────────────────────────────────────────────────

@router.post("/{project_id}/plans", response_model=PlanResponse, status_code=201)
async def create_plan(project_id: int, payload: PlanCreate, db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    proj_repo = ProjectRepository(db)
    project = await proj_repo.get_by_id(project_id)
    if not project or project.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Project not found")

    plan_repo = PlanRepository(db)
    return await plan_repo.create(project_id=project_id, **payload.model_dump())


@router.get("/{project_id}/plans", response_model=list[PlanResponse])
async def list_plans(project_id: int, db: DB, current_user: CurrentUser = Depends(get_current_user)):
    repo = PlanRepository(db)
    return await repo.list_by_project(project_id)


# ── Blocks ────────────────────────────────────────────────────────────────────

@router.post("/{project_id}/plans/{plan_id}/blocks", response_model=BlockResponse, status_code=201)
async def create_block(project_id: int, plan_id: int, payload: BlockCreate, db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    block_repo = BlockRepository(db)
    return await block_repo.create(plan_id=plan_id, **payload.model_dump())


@router.get("/{project_id}/plans/{plan_id}/blocks", response_model=list[BlockResponse])
async def list_blocks(project_id: int, plan_id: int, db: DB, current_user: CurrentUser = Depends(get_current_user)):
    repo = BlockRepository(db)
    return await repo.list_by_plan(plan_id)


@router.get("/blocks/{block_id}", response_model=BlockResponse)
async def get_block(block_id: int, db: DB, current_user: CurrentUser = Depends(get_current_user)):
    repo = BlockRepository(db)
    block = await repo.get_by_id(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    return block


@router.patch("/blocks/{block_id}", response_model=BlockResponse)
async def update_block(block_id: int, payload: BlockUpdate, db: DB, current_user: AdminOrAbove = Depends(require_admin_or_above)):
    repo = BlockRepository(db)
    block = await repo.get_by_id(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    return await repo.update(block, **payload.model_dump(exclude_none=True))
