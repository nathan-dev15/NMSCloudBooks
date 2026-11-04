import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, create_access_token
from app.models.user import User, UserRole
from app.models.tenant import Tenant

BASE = "/api/v1/companies"

_COMPANY_PAYLOAD = {
    "name": "Build Corp",
    "slug": "build-corp",
    "invoice_prefix": "bc",
    "invoice_starting_number": 1001,
    "email": "contact@buildcorp.com",
    "phone": "+919876543210",
    "address": "123 Main St, Chennai",
    "gstin": "22AAAAA0000A1Z5",
}


def auth_header(user: User) -> dict:
    token = create_access_token(user.id, extra={"role": user.role.value, "tenant_id": user.tenant_id})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="Co Test Tenant", slug="co-test-tenant", enabled_modules=[])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


@pytest.fixture
async def admin(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="admin_co@nmscb.com",
        full_name="Admin Co",
        hashed_password=hash_password("Password123"),
        role=UserRole.ADMIN,
        is_active=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def other_admin(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="other_admin_co@nmscb.com",
        full_name="Other Admin",
        hashed_password=hash_password("Password123"),
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
        email="primary_co@nmscb.com",
        full_name="Primary User",
        hashed_password=hash_password("Password123"),
        role=UserRole.PRIMARY_USER,
        is_active=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


class TestCompanyAccess:
    async def test_non_admin_cannot_list(self, client: AsyncClient, primary_user: User):
        resp = await client.get(BASE, headers=auth_header(primary_user))
        assert resp.status_code == 403

    async def test_unauthenticated_rejected(self, client: AsyncClient):
        resp = await client.get(BASE)
        assert resp.status_code == 403

    async def test_admin_can_list(self, client: AsyncClient, admin: User):
        resp = await client.get(BASE, headers=auth_header(admin))
        assert resp.status_code == 200


class TestCompanyCRUD:
    async def test_create_company(self, client: AsyncClient, admin: User):
        resp = await client.post(BASE, headers=auth_header(admin), json=_COMPANY_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Build Corp"
        assert data["slug"] == "build-corp"
        assert data["invoice_prefix"] == "BC"  # validator uppercases
        assert data["invoice_starting_number"] == 1001
        assert data["created_by_admin_id"] == admin.id
        assert data["tenant_id"] == admin.tenant_id

    async def test_duplicate_slug_rejected(self, client: AsyncClient, admin: User):
        await client.post(BASE, headers=auth_header(admin), json=_COMPANY_PAYLOAD)
        resp = await client.post(BASE, headers=auth_header(admin), json=_COMPANY_PAYLOAD)
        assert resp.status_code == 409

    async def test_invoice_prefix_uppercased(self, client: AsyncClient, admin: User):
        payload = {**_COMPANY_PAYLOAD, "invoice_prefix": "lc", "slug": "lower-co"}
        resp = await client.post(BASE, headers=auth_header(admin), json=payload)
        assert resp.status_code == 201
        assert resp.json()["invoice_prefix"] == "LC"

    async def test_invalid_invoice_number_rejected(self, client: AsyncClient, admin: User):
        payload = {**_COMPANY_PAYLOAD, "invoice_starting_number": 0}
        resp = await client.post(BASE, headers=auth_header(admin), json=payload)
        assert resp.status_code == 422

    async def test_get_company(self, client: AsyncClient, admin: User):
        create = await client.post(BASE, headers=auth_header(admin), json=_COMPANY_PAYLOAD)
        company_id = create.json()["id"]

        resp = await client.get(f"{BASE}/{company_id}", headers=auth_header(admin))
        assert resp.status_code == 200
        assert resp.json()["id"] == company_id

    async def test_get_nonexistent_company(self, client: AsyncClient, admin: User):
        resp = await client.get(f"{BASE}/999999", headers=auth_header(admin))
        assert resp.status_code == 404

    async def test_other_admin_cannot_see_company(
        self, client: AsyncClient, admin: User, other_admin: User
    ):
        create = await client.post(BASE, headers=auth_header(admin), json=_COMPANY_PAYLOAD)
        company_id = create.json()["id"]

        resp = await client.get(f"{BASE}/{company_id}", headers=auth_header(other_admin))
        assert resp.status_code == 404

    async def test_update_company(self, client: AsyncClient, admin: User):
        create = await client.post(BASE, headers=auth_header(admin), json=_COMPANY_PAYLOAD)
        company_id = create.json()["id"]

        resp = await client.patch(
            f"{BASE}/{company_id}",
            headers=auth_header(admin),
            json={"name": "Updated Corp", "phone": "+911234567890"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Updated Corp"
        assert data["phone"] == "+911234567890"

    async def test_other_admin_cannot_update_company(
        self, client: AsyncClient, admin: User, other_admin: User
    ):
        create = await client.post(BASE, headers=auth_header(admin), json=_COMPANY_PAYLOAD)
        company_id = create.json()["id"]

        resp = await client.patch(
            f"{BASE}/{company_id}",
            headers=auth_header(other_admin),
            json={"name": "Stolen Update"},
        )
        assert resp.status_code == 404

    async def test_delete_company(self, client: AsyncClient, admin: User):
        create = await client.post(BASE, headers=auth_header(admin), json=_COMPANY_PAYLOAD)
        company_id = create.json()["id"]

        resp = await client.delete(f"{BASE}/{company_id}", headers=auth_header(admin))
        assert resp.status_code == 204

        get_resp = await client.get(f"{BASE}/{company_id}", headers=auth_header(admin))
        assert get_resp.status_code == 404

    async def test_list_only_shows_own_companies(
        self, client: AsyncClient, admin: User, other_admin: User
    ):
        await client.post(BASE, headers=auth_header(admin), json=_COMPANY_PAYLOAD)
        payload2 = {**_COMPANY_PAYLOAD, "slug": "other-co", "email": "other@co.com"}
        await client.post(BASE, headers=auth_header(other_admin), json=payload2)

        resp = await client.get(BASE, headers=auth_header(admin))
        data = resp.json()
        assert len(data) == 1
        assert data[0]["created_by_admin_id"] == admin.id
