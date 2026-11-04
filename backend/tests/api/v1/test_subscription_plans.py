import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, create_access_token
from app.models.user import User, UserRole
from app.models.tenant import Tenant

BASE = "/api/v1/subscription-plans"

_PLAN_PAYLOAD = {
    "name": "Pro",
    "slug": "pro",
    "description": "Professional plan",
    "price_monthly": 29.99,
    "price_quarterly": 79.99,
    "price_yearly": 299.99,
    "trial_days": 14,
    "max_users": 10,
    "enabled_modules": ["civil", "retail"],
    "features": ["invoicing", "reports"],
}


def auth_header(user: User) -> dict:
    token = create_access_token(user.id, extra={"role": user.role.value, "tenant_id": user.tenant_id})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def super_admin(db_session: AsyncSession) -> User:
    u = User(
        email="sa_plans@nmscb.com",
        full_name="Super Admin",
        hashed_password=hash_password("Password123"),
        role=UserRole.SUPER_ADMIN,
        is_active=True,
        is_verified=True,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def regular_tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="Plan Tenant", slug="plan-tenant", enabled_modules=[])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


@pytest.fixture
async def admin_user(db_session: AsyncSession, regular_tenant: Tenant) -> User:
    u = User(
        email="admin_plans@nmscb.com",
        full_name="Admin User",
        hashed_password=hash_password("Password123"),
        role=UserRole.ADMIN,
        is_active=True,
        tenant_id=regular_tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


class TestSubscriptionPlanAccess:
    async def test_list_active_plans_authenticated(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await client.get(BASE, headers=auth_header(admin_user))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_list_active_plans_unauthenticated(self, client: AsyncClient):
        # list_plans has no auth guard — public endpoint by design
        resp = await client.get(BASE)
        assert resp.status_code == 200

    async def test_list_all_plans_super_admin_only(
        self, client: AsyncClient, super_admin: User, admin_user: User
    ):
        sa_resp = await client.get(f"{BASE}/all", headers=auth_header(super_admin))
        assert sa_resp.status_code == 200

        admin_resp = await client.get(f"{BASE}/all", headers=auth_header(admin_user))
        assert admin_resp.status_code == 403

    async def test_create_plan_super_admin_only(
        self, client: AsyncClient, super_admin: User, admin_user: User
    ):
        sa_resp = await client.post(BASE, headers=auth_header(super_admin), json=_PLAN_PAYLOAD)
        assert sa_resp.status_code == 201

        payload2 = {**_PLAN_PAYLOAD, "slug": "pro-admin-attempt"}
        admin_resp = await client.post(BASE, headers=auth_header(admin_user), json=payload2)
        assert admin_resp.status_code == 403


class TestSubscriptionPlanCRUD:
    async def test_create_plan(self, client: AsyncClient, super_admin: User):
        resp = await client.post(BASE, headers=auth_header(super_admin), json=_PLAN_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert data["slug"] == "pro"
        assert data["name"] == "Pro"
        assert data["price_monthly"] == 29.99
        assert data["enabled_modules"] == ["civil", "retail"]
        assert data["is_active"] is True

    async def test_duplicate_slug_rejected(self, client: AsyncClient, super_admin: User):
        await client.post(BASE, headers=auth_header(super_admin), json=_PLAN_PAYLOAD)
        resp = await client.post(BASE, headers=auth_header(super_admin), json=_PLAN_PAYLOAD)
        assert resp.status_code == 409

    async def test_get_plan(self, client: AsyncClient, super_admin: User, admin_user: User):
        create = await client.post(BASE, headers=auth_header(super_admin), json=_PLAN_PAYLOAD)
        plan_id = create.json()["id"]

        # any authenticated user can fetch a plan
        resp = await client.get(f"{BASE}/{plan_id}", headers=auth_header(admin_user))
        assert resp.status_code == 200
        assert resp.json()["id"] == plan_id

    async def test_get_nonexistent_plan(self, client: AsyncClient, admin_user: User):
        resp = await client.get(f"{BASE}/999999", headers=auth_header(admin_user))
        assert resp.status_code == 404

    async def test_update_plan(self, client: AsyncClient, super_admin: User):
        create = await client.post(BASE, headers=auth_header(super_admin), json=_PLAN_PAYLOAD)
        plan_id = create.json()["id"]

        resp = await client.patch(
            f"{BASE}/{plan_id}",
            headers=auth_header(super_admin),
            json={"price_monthly": 39.99, "max_users": 20},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["price_monthly"] == 39.99
        assert data["max_users"] == 20

    async def test_update_plan_non_super_admin_rejected(
        self, client: AsyncClient, super_admin: User, admin_user: User
    ):
        create = await client.post(BASE, headers=auth_header(super_admin), json=_PLAN_PAYLOAD)
        plan_id = create.json()["id"]

        resp = await client.patch(
            f"{BASE}/{plan_id}",
            headers=auth_header(admin_user),
            json={"price_monthly": 0},
        )
        assert resp.status_code == 403

    async def test_delete_plan(self, client: AsyncClient, super_admin: User):
        create = await client.post(BASE, headers=auth_header(super_admin), json=_PLAN_PAYLOAD)
        plan_id = create.json()["id"]

        resp = await client.delete(f"{BASE}/{plan_id}", headers=auth_header(super_admin))
        assert resp.status_code == 204

        # should be gone from active listing
        get_resp = await client.get(f"{BASE}/{plan_id}", headers=auth_header(super_admin))
        assert get_resp.status_code == 404

    async def test_delete_plan_with_tenant_rejected(
        self, client: AsyncClient, super_admin: User, regular_tenant: Tenant
    ):
        # attach the plan to the existing tenant
        create = await client.post(BASE, headers=auth_header(super_admin), json=_PLAN_PAYLOAD)
        plan_id = create.json()["id"]

        await client.patch(
            f"/api/v1/tenants/{regular_tenant.id}",
            headers=auth_header(super_admin),
            json={"subscription_plan_id": plan_id},
        )

        resp = await client.delete(f"{BASE}/{plan_id}", headers=auth_header(super_admin))
        assert resp.status_code == 409

    async def test_inactive_plan_excluded_from_active_list(
        self, client: AsyncClient, super_admin: User, admin_user: User
    ):
        create = await client.post(
            BASE,
            headers=auth_header(super_admin),
            json={**_PLAN_PAYLOAD, "is_active": False},
        )
        plan_id = create.json()["id"]

        resp = await client.get(BASE, headers=auth_header(admin_user))
        ids = [p["id"] for p in resp.json()]
        assert plan_id not in ids

    async def test_inactive_plan_in_all_list(
        self, client: AsyncClient, super_admin: User
    ):
        create = await client.post(
            BASE,
            headers=auth_header(super_admin),
            json={**_PLAN_PAYLOAD, "is_active": False},
        )
        plan_id = create.json()["id"]

        resp = await client.get(f"{BASE}/all", headers=auth_header(super_admin))
        ids = [p["id"] for p in resp.json()]
        assert plan_id in ids
