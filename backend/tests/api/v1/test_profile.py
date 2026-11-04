import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, create_access_token
from app.models.user import User, UserRole
from app.models.tenant import Tenant

BASE = "/api/v1/profile"


def auth_header(user: User) -> dict:
    token = create_access_token(user.id, extra={"role": user.role.value, "tenant_id": user.tenant_id})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="Profile Tenant", slug="profile-tenant", enabled_modules=[])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


@pytest.fixture
async def admin(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="admin_profile@nmscb.com",
        full_name="Profile Admin",
        hashed_password=hash_password("OldPass123"),
        role=UserRole.ADMIN,
        is_active=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def primary_user(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="primary_profile@nmscb.com",
        full_name="Primary Profile",
        hashed_password=hash_password("OldPass123"),
        role=UserRole.PRIMARY_USER,
        is_active=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def secondary_user(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="secondary_profile@nmscb.com",
        full_name="Secondary Profile",
        hashed_password=hash_password("OldPass123"),
        role=UserRole.SECONDARY_USER,
        is_active=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


class TestGetProfile:
    async def test_get_own_profile(self, client: AsyncClient, admin: User):
        resp = await client.get(BASE, headers=auth_header(admin))
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "admin_profile@nmscb.com"
        assert data["full_name"] == "Profile Admin"

    async def test_get_profile_unauthenticated(self, client: AsyncClient):
        resp = await client.get(BASE)
        assert resp.status_code == 403


class TestUpdateProfile:
    async def test_update_full_name(self, client: AsyncClient, admin: User):
        resp = await client.patch(BASE, headers=auth_header(admin), json={"full_name": "New Name"})
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "New Name"

    async def test_secondary_user_cannot_update_profile(
        self, client: AsyncClient, secondary_user: User
    ):
        resp = await client.patch(
            BASE, headers=auth_header(secondary_user), json={"full_name": "Nope"}
        )
        assert resp.status_code == 403

    async def test_non_admin_cannot_set_business_type(
        self, client: AsyncClient, primary_user: User
    ):
        resp = await client.patch(
            BASE,
            headers=auth_header(primary_user),
            json={"business_type_id": 1},
        )
        assert resp.status_code == 403

    async def test_admin_can_set_business_type(self, client: AsyncClient, admin: User):
        resp = await client.patch(
            BASE,
            headers=auth_header(admin),
            json={"business_type_id": 2},
        )
        assert resp.status_code == 200

    async def test_no_op_update_returns_user(self, client: AsyncClient, admin: User):
        # Sending empty payload returns the user unchanged
        resp = await client.patch(BASE, headers=auth_header(admin), json={})
        assert resp.status_code == 200
        assert resp.json()["email"] == "admin_profile@nmscb.com"


class TestChangePassword:
    async def test_change_password_success(self, client: AsyncClient, admin: User):
        resp = await client.post(
            f"{BASE}/change-password",
            headers=auth_header(admin),
            json={
                "current_password": "OldPass123",
                "new_password": "NewPass456!",
                "confirm_password": "NewPass456!",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Password changed successfully"

    async def test_wrong_current_password_rejected(self, client: AsyncClient, admin: User):
        resp = await client.post(
            f"{BASE}/change-password",
            headers=auth_header(admin),
            json={
                "current_password": "WrongPass",
                "new_password": "NewPass456!",
                "confirm_password": "NewPass456!",
            },
        )
        assert resp.status_code == 400

    async def test_change_password_unauthenticated(self, client: AsyncClient):
        resp = await client.post(
            f"{BASE}/change-password",
            json={
                "current_password": "OldPass123",
                "new_password": "NewPass456!",
                "confirm_password": "NewPass456!",
            },
        )
        assert resp.status_code == 403
