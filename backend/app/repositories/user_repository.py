from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, UserRole
from app.models.audit import AuditLog


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id, User.is_deleted == False))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.email == email.lower(), User.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> User:
        if "email" in kwargs:
            kwargs["email"] = kwargs["email"].lower()
        user = User(**kwargs)
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update(self, user: User, **kwargs) -> User:
        for key, value in kwargs.items():
            if hasattr(user, key):
                setattr(user, key, value)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def list_by_role(
        self,
        role: UserRole,
        tenant_id: int | None = None,
        page: int = 1,
        size: int = 20,
        search: str | None = None,
    ) -> tuple[list[User], int]:
        query = select(User).where(User.role == role, User.is_deleted == False)
        if tenant_id is not None:
            query = query.where(User.tenant_id == tenant_id)
        if search:
            term = f"%{search}%"
            query = query.where(or_(User.full_name.ilike(term), User.email.ilike(term)))
        total_result = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar_one()
        query = query.order_by(User.full_name).offset((page - 1) * size).limit(size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def list_by_creator(
        self,
        created_by: int,
        role: UserRole | None = None,
        page: int = 1,
        size: int = 100,
    ) -> tuple[list[User], int]:
        query = select(User).where(User.created_by == created_by, User.is_deleted == False)
        if role:
            query = query.where(User.role == role)
        total = (await self.db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
        query = query.order_by(User.full_name).offset((page - 1) * size).limit(size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def get_user_logs(self, user_id: int, limit: int = 50) -> list[AuditLog]:
        result = await self.db.execute(
            select(AuditLog)
            .where(AuditLog.user_id == user_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_by_tenant(
        self,
        tenant_id: int,
        role: UserRole | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[User], int]:
        query = select(User).where(User.tenant_id == tenant_id, User.is_deleted == False)
        if role:
            query = query.where(User.role == role)

        total_result = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar_one()

        query = query.offset((page - 1) * size).limit(size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def list_all(self, page: int = 1, size: int = 20) -> tuple[list[User], int]:
        query = select(User).where(User.is_deleted == False)
        total_result = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar_one()
        query = query.offset((page - 1) * size).limit(size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def soft_delete(self, user: User) -> None:
        user.soft_delete()
        await self.db.flush()
