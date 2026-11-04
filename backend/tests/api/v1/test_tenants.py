import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, create_access_token
from app.models.user import User, UserRole
from app.models.tenant import Tenant, DomainModule


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def auth_header(user: User) -> dict:
    token = create_access_token(user.id, extra={"role": user.role.value, "tenant_id": user.tenant_id})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def super_admin(db_session: AsyncSession) -> User:
    u = User(
        email="sa_tenant_test@nmscb.com",
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
async def admin(db_session: AsyncSession, existing_tenant: Tenant) -> User:
    u = User(
        email="admin_tenant_test@nmscb.com",
        full_name="Admin",
        hashed_password=hash_password("Password123"),
        role=UserRole.ADMIN,
        is_active=True,
        tenant_id=existing_tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def existing_tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="Existing Corp", slug="existing-corp", enabled_modules=[])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


# ---------------------------------------------------------------------------
# Tenant CRUD — Super Admin only
# ---------------------------------------------------------------------------

class TestTenantAccess:
    async def test_only_super_admin_can_list(
        self, client: AsyncClient, super_admin: User, admin: User
    ):
        sa_resp = await client.get("/api/v1/tenants", headers=auth_header(super_admin))
        assert sa_resp.status_code == 200

        admin_resp = await client.get("/api/v1/tenants", headers=auth_header(admin))
        assert admin_resp.status_code == 403

    async def test_only_super_admin_can_create(
        self, client: AsyncClient, super_admin: User, admin: User
    ):
        payload = {"name": "New Org", "slug": "new-org"}

        sa_resp = await client.post("/api/v1/tenants", headers=auth_header(super_admin), json=payload)
        assert sa_resp.status_code == 201

        payload["slug"] = "new-org-2"
        admin_resp = await client.post("/api/v1/tenants", headers=auth_header(admin), json=payload)
        assert admin_resp.status_code == 403


class TestTenantCRUD:
    async def test_create_tenant(self, client: AsyncClient, super_admin: User):
        response = await client.post("/api/v1/tenants", headers=auth_header(super_admin), json={
            "name": "Build Corp",
            "slug": "build-corp",
            "email": "contact@buildcorp.com",
            "gstin": "22AAAAA0000A1Z5",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["slug"] == "build-corp"
        assert data["enabled_modules"] == []

    async def test_duplicate_slug_rejected(
        self, client: AsyncClient, super_admin: User, existing_tenant: Tenant
    ):
        response = await client.post("/api/v1/tenants", headers=auth_header(super_admin), json={
            "name": "Duplicate",
            "slug": "existing-corp",  # already taken
        })
        assert response.status_code == 409

    async def test_get_tenant(
        self, client: AsyncClient, super_admin: User, existing_tenant: Tenant
    ):
        response = await client.get(
            f"/api/v1/tenants/{existing_tenant.id}", headers=auth_header(super_admin)
        )
        assert response.status_code == 200
        assert response.json()["id"] == existing_tenant.id

    async def test_get_nonexistent_tenant(self, client: AsyncClient, super_admin: User):
        response = await client.get("/api/v1/tenants/999999", headers=auth_header(super_admin))
        assert response.status_code == 404

    async def test_update_tenant(
        self, client: AsyncClient, super_admin: User, existing_tenant: Tenant
    ):
        response = await client.patch(
            f"/api/v1/tenants/{existing_tenant.id}",
            headers=auth_header(super_admin),
            json={"name": "Updated Corp"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Corp"

    async def test_deactivate_tenant(
        self, client: AsyncClient, super_admin: User, existing_tenant: Tenant
    ):
        response = await client.patch(
            f"/api/v1/tenants/{existing_tenant.id}",
            headers=auth_header(super_admin),
            json={"is_active": False},
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False


# ---------------------------------------------------------------------------
# Domain module toggling
# ---------------------------------------------------------------------------

class TestDomainModuleToggle:
    async def test_enable_civil_module(
        self, client: AsyncClient, super_admin: User, existing_tenant: Tenant
    ):
        response = await client.post(
            f"/api/v1/tenants/{existing_tenant.id}/modules",
            headers=auth_header(super_admin),
            json={"module": "civil", "enabled": True},
        )
        assert response.status_code == 200
        assert "civil" in response.json()["enabled_modules"]

    async def test_enable_multiple_modules(
        self, client: AsyncClient, super_admin: User, existing_tenant: Tenant
    ):
        for module in ["civil", "retail", "agriculture", "general"]:
            await client.post(
                f"/api/v1/tenants/{existing_tenant.id}/modules",
                headers=auth_header(super_admin),
                json={"module": module, "enabled": True},
            )
        resp = await client.get(
            f"/api/v1/tenants/{existing_tenant.id}", headers=auth_header(super_admin)
        )
        modules = resp.json()["enabled_modules"]
        assert set(modules) == {"civil", "retail", "agriculture", "general"}

    async def test_disable_module(
        self, client: AsyncClient, super_admin: User, existing_tenant: Tenant
    ):
        # Enable first
        await client.post(
            f"/api/v1/tenants/{existing_tenant.id}/modules",
            headers=auth_header(super_admin),
            json={"module": "retail", "enabled": True},
        )
        # Then disable
        response = await client.post(
            f"/api/v1/tenants/{existing_tenant.id}/modules",
            headers=auth_header(super_admin),
            json={"module": "retail", "enabled": False},
        )
        assert response.status_code == 200
        assert "retail" not in response.json()["enabled_modules"]

    async def test_enabling_same_module_twice_is_idempotent(
        self, client: AsyncClient, super_admin: User, existing_tenant: Tenant
    ):
        for _ in range(3):
            await client.post(
                f"/api/v1/tenants/{existing_tenant.id}/modules",
                headers=auth_header(super_admin),
                json={"module": "civil", "enabled": True},
            )
        resp = await client.get(
            f"/api/v1/tenants/{existing_tenant.id}", headers=auth_header(super_admin)
        )
        assert resp.json()["enabled_modules"].count("civil") == 1

    async def test_invalid_module_name(
        self, client: AsyncClient, super_admin: User, existing_tenant: Tenant
    ):
        response = await client.post(
            f"/api/v1/tenants/{existing_tenant.id}/modules",
            headers=auth_header(super_admin),
            json={"module": "invalid_module", "enabled": True},
        )
        assert response.status_code == 422

    async def test_admin_cannot_toggle_modules(
        self, client: AsyncClient, admin: User, existing_tenant: Tenant
    ):
        response = await client.post(
            f"/api/v1/tenants/{existing_tenant.id}/modules",
            headers=auth_header(admin),
            json={"module": "civil", "enabled": True},
        )
        assert response.status_code == 403
