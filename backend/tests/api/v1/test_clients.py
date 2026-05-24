import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, create_access_token
from app.models.user import User, UserRole
from app.models.tenant import Tenant


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def auth_header(user: User) -> dict:
    token = create_access_token(user.id, extra={"role": user.role.value, "tenant_id": user.tenant_id})
    return {"Authorization": f"Bearer {token}"}


CLIENT_PAYLOAD = {
    "display_name": "Acme Builders",
    "client_type": "company",
    "segment": "standard",
    "email": "contact@acme.com",
    "phone": "9876543210",
    "city": "Chennai",
    "state": "Tamil Nadu",
    "country": "India",
    "currency": "INR",
    "tags": [],
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="Client Corp", slug="client-corp", enabled_modules=[])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


@pytest.fixture
async def admin(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="admin@client.com", full_name="Admin User",
        hashed_password=hash_password("Password123"),
        role=UserRole.ADMIN, is_active=True, is_verified=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def primary_user(db_session: AsyncSession, tenant: Tenant, admin: User) -> User:
    u = User(
        email="primary@client.com", full_name="Primary User",
        hashed_password=hash_password("Password123"),
        role=UserRole.PRIMARY_USER, is_active=True, is_verified=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def secondary_user(db_session: AsyncSession, tenant: Tenant, admin: User) -> User:
    u = User(
        email="secondary@client.com", full_name="Secondary User",
        hashed_password=hash_password("Password123"),
        role=UserRole.SECONDARY_USER, is_active=True, is_verified=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


# ---------------------------------------------------------------------------
# List clients
# ---------------------------------------------------------------------------

class TestListClients:
    async def test_admin_can_list(self, client: AsyncClient, admin: User):
        response = await client.get("/api/v1/clients", headers=auth_header(admin))
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["page"] == 1

    async def test_primary_user_can_list(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/clients", headers=auth_header(primary_user))
        assert response.status_code == 200

    async def test_secondary_user_can_list(self, client: AsyncClient, secondary_user: User):
        response = await client.get("/api/v1/clients", headers=auth_header(secondary_user))
        assert response.status_code == 200

    async def test_unauthenticated_cannot_list(self, client: AsyncClient):
        response = await client.get("/api/v1/clients")
        assert response.status_code == 403

    async def test_pagination_params(self, client: AsyncClient, admin: User):
        response = await client.get("/api/v1/clients?page=1&size=5", headers=auth_header(admin))
        assert response.status_code == 200
        assert response.json()["size"] == 5


# ---------------------------------------------------------------------------
# Create clients
# ---------------------------------------------------------------------------

class TestCreateClient:
    async def test_primary_can_create(self, client: AsyncClient, primary_user: User):
        response = await client.post("/api/v1/clients", headers=auth_header(primary_user), json=CLIENT_PAYLOAD)
        assert response.status_code == 201
        data = response.json()
        assert data["display_name"] == "Acme Builders"
        assert data["email"] == "contact@acme.com"

    async def test_admin_can_create(self, client: AsyncClient, admin: User):
        payload = {**CLIENT_PAYLOAD, "display_name": "Beta Corp", "email": "beta@corp.com"}
        response = await client.post("/api/v1/clients", headers=auth_header(admin), json=payload)
        assert response.status_code == 201

    async def test_secondary_cannot_create(self, client: AsyncClient, secondary_user: User):
        response = await client.post("/api/v1/clients", headers=auth_header(secondary_user), json=CLIENT_PAYLOAD)
        assert response.status_code == 403

    async def test_invalid_gstin_rejected(self, client: AsyncClient, primary_user: User):
        payload = {**CLIENT_PAYLOAD, "display_name": "GST Test", "gstin": "TOOSHORT"}
        response = await client.post("/api/v1/clients", headers=auth_header(primary_user), json=payload)
        assert response.status_code == 422

    async def test_create_with_contact(self, client: AsyncClient, primary_user: User):
        payload = {
            **CLIENT_PAYLOAD,
            "display_name": "With Contact",
            "email": "contact2@acme.com",
            "contacts": [{"name": "John Doe", "phone": "9000000001", "is_primary": True}],
        }
        response = await client.post("/api/v1/clients", headers=auth_header(primary_user), json=payload)
        assert response.status_code == 201
        assert len(response.json()["contacts"]) == 1


# ---------------------------------------------------------------------------
# Get single client
# ---------------------------------------------------------------------------

class TestGetClient:
    async def test_get_existing(self, client: AsyncClient, primary_user: User):
        create = await client.post("/api/v1/clients", headers=auth_header(primary_user), json={
            **CLIENT_PAYLOAD, "display_name": "Get Test", "email": "get@test.com",
        })
        cid = create.json()["id"]
        response = await client.get(f"/api/v1/clients/{cid}", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert response.json()["id"] == cid

    async def test_get_nonexistent(self, client: AsyncClient, admin: User):
        response = await client.get("/api/v1/clients/999999", headers=auth_header(admin))
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Update client
# ---------------------------------------------------------------------------

class TestUpdateClient:
    async def test_primary_can_update(self, client: AsyncClient, primary_user: User):
        create = await client.post("/api/v1/clients", headers=auth_header(primary_user), json={
            **CLIENT_PAYLOAD, "display_name": "Update Target", "email": "update@target.com",
        })
        cid = create.json()["id"]
        response = await client.put(f"/api/v1/clients/{cid}", headers=auth_header(primary_user),
                                     json={"city": "Bangalore"})
        assert response.status_code == 200
        assert response.json()["city"] == "Bangalore"

    async def test_secondary_cannot_update(self, client: AsyncClient, primary_user: User, secondary_user: User):
        create = await client.post("/api/v1/clients", headers=auth_header(primary_user), json={
            **CLIENT_PAYLOAD, "display_name": "Blocked Update", "email": "blocked@update.com",
        })
        cid = create.json()["id"]
        response = await client.put(f"/api/v1/clients/{cid}", headers=auth_header(secondary_user),
                                     json={"city": "Bangalore"})
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

class TestClientSearch:
    async def test_search_by_name(self, client: AsyncClient, primary_user: User):
        await client.post("/api/v1/clients", headers=auth_header(primary_user), json={
            **CLIENT_PAYLOAD, "display_name": "SearchableClient XYZ", "email": "srch@xyz.com",
        })
        response = await client.get("/api/v1/clients?search=SearchableClient", headers=auth_header(primary_user))
        assert response.status_code == 200
        names = [c["display_name"] for c in response.json()["items"]]
        assert any("SearchableClient" in n for n in names)
