from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.civil.project import Project, ProjectPlan, Block, ProjectStatus


class ProjectRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, tenant_id: int, admin_id: int, **kwargs) -> Project:
        p = Project(tenant_id=tenant_id, admin_id=admin_id, **kwargs)
        self.db.add(p)
        await self.db.flush()
        await self.db.refresh(p)
        return p

    async def get_by_id(self, project_id: int) -> Project | None:
        result = await self.db.execute(
            select(Project).where(Project.id == project_id, Project.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def list_by_tenant(
        self, tenant_id: int, state: str | None = None, district: str | None = None,
        status: ProjectStatus | None = None, page: int = 1, size: int = 20,
    ) -> tuple[list[Project], int]:
        q = select(Project).where(Project.tenant_id == tenant_id, Project.is_deleted == False)
        if state:    q = q.where(Project.state == state)
        if district: q = q.where(Project.district == district)
        if status:   q = q.where(Project.status == status)

        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        q = q.offset((page - 1) * size).limit(size)
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows), total

    async def update(self, project: Project, **kwargs) -> Project:
        for k, v in kwargs.items():
            if v is not None and hasattr(project, k):
                setattr(project, k, v)
        await self.db.flush()
        await self.db.refresh(project)
        return project


class PlanRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, project_id: int, **kwargs) -> ProjectPlan:
        plan = ProjectPlan(project_id=project_id, **kwargs)
        self.db.add(plan)
        await self.db.flush()
        await self.db.refresh(plan)
        return plan

    async def get_by_id(self, plan_id: int) -> ProjectPlan | None:
        result = await self.db.execute(
            select(ProjectPlan).where(ProjectPlan.id == plan_id)
            .options(selectinload(ProjectPlan.blocks))
        )
        return result.scalar_one_or_none()

    async def list_by_project(self, project_id: int) -> list[ProjectPlan]:
        result = await self.db.execute(
            select(ProjectPlan).where(ProjectPlan.project_id == project_id)
            .options(selectinload(ProjectPlan.blocks))
        )
        return list(result.scalars().all())


class BlockRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, plan_id: int, **kwargs) -> Block:
        block = Block(plan_id=plan_id, **kwargs)
        self.db.add(block)
        await self.db.flush()
        await self.db.refresh(block)
        return block

    async def get_by_id(self, block_id: int) -> Block | None:
        result = await self.db.execute(
            select(Block).where(Block.id == block_id, Block.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def list_by_plan(self, plan_id: int) -> list[Block]:
        result = await self.db.execute(
            select(Block).where(Block.plan_id == plan_id, Block.is_deleted == False)
        )
        return list(result.scalars().all())

    async def update(self, block: Block, **kwargs) -> Block:
        for k, v in kwargs.items():
            if v is not None and hasattr(block, k):
                setattr(block, k, v)
        await self.db.flush()
        await self.db.refresh(block)
        return block
