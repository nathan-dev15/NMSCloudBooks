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


PO_PAYLOAD = {
    "order_date": "2026-05-01",
    "expected_date": "2026-05-15",
    "priority": "medium",
    "currency": "INR",
    "discount_amount": 0.0,
    "items": [
        {
            "description": "Steel Bars",
            "sku": "STL-001",
            "unit": "kg",
            "quantity": 100.0,
            "unit_price": 75.0,
            "tax_rate": 18.0,
        }
    ],
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="PO Corp", slug="po-corp", enabled_modules=[])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


@pytest.fixture
async def admin(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="admin@po.com", full_name="Admin",
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
        email="primary@po.com", full_name="Primary",
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
        email="secondary@po.com", full_name="Secondary",
        hashed_password=hash_password("Password123"),
        role=UserRole.SECONDARY_USER, is_active=True, is_verified=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


# ---------------------------------------------------------------------------
# List POs
# ---------------------------------------------------------------------------

class TestListPOs:
    async def test_admin_can_list(self, client: AsyncClient, admin: User):
        response = await client.get("/api/v1/purchase-orders", headers=auth_header(admin))
        assert response.status_code == 200
        data = response.json()
        assert "items" in data and "total" in data

    async def test_primary_can_list(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/purchase-orders", headers=auth_header(primary_user))
        assert response.status_code == 200

    async def test_secondary_can_list(self, client: AsyncClient, secondary_user: User):
        response = await client.get("/api/v1/purchase-orders", headers=auth_header(secondary_user))
        assert response.status_code == 200

    async def test_unauthenticated_blocked(self, client: AsyncClient):
        response = await client.get("/api/v1/purchase-orders")
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Create PO
# ---------------------------------------------------------------------------

class TestCreatePO:
    async def test_primary_can_create(self, client: AsyncClient, primary_user: User):
        response = await client.post(
            "/api/v1/purchase-orders",
            headers=auth_header(primary_user),
            json=PO_PAYLOAD,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "draft"
        assert data["grand_total"] > 0

    async def test_auto_po_number(self, client: AsyncClient, primary_user: User):
        response = await client.post(
            "/api/v1/purchase-orders",
            headers=auth_header(primary_user),
            json=PO_PAYLOAD,
        )
        assert response.status_code == 201
        assert response.json()["po_number"] != ""

    async def test_secondary_cannot_create(self, client: AsyncClient, secondary_user: User):
        response = await client.post(
            "/api/v1/purchase-orders",
            headers=auth_header(secondary_user),
            json=PO_PAYLOAD,
        )
        assert response.status_code == 403

    async def test_requires_items(self, client: AsyncClient, primary_user: User):
        payload = {**PO_PAYLOAD, "items": []}
        response = await client.post(
            "/api/v1/purchase-orders", headers=auth_header(primary_user), json=payload,
        )
        assert response.status_code == 422

    async def test_total_calculation(self, client: AsyncClient, primary_user: User):
        response = await client.post(
            "/api/v1/purchase-orders",
            headers=auth_header(primary_user),
            json=PO_PAYLOAD,
        )
        data = response.json()
        # 100 kg * ₹75 = ₹7500, 18% GST = ₹1350, total ~₹8850
        assert data["subtotal"] == pytest.approx(7500.0, abs=1)


# ---------------------------------------------------------------------------
# Get PO
# ---------------------------------------------------------------------------

class TestGetPO:
    async def test_get_existing(self, client: AsyncClient, primary_user: User):
        create = await client.post(
            "/api/v1/purchase-orders", headers=auth_header(primary_user), json=PO_PAYLOAD,
        )
        po_id = create.json()["id"]
        response = await client.get(f"/api/v1/purchase-orders/{po_id}", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert response.json()["id"] == po_id

    async def test_get_nonexistent(self, client: AsyncClient, admin: User):
        response = await client.get("/api/v1/purchase-orders/999999", headers=auth_header(admin))
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Status transitions
# ---------------------------------------------------------------------------

class TestPOStatus:
    async def test_submit_then_approve_po(self, client: AsyncClient, primary_user: User):
        create = await client.post(
            "/api/v1/purchase-orders", headers=auth_header(primary_user), json=PO_PAYLOAD,
        )
        po_id = create.json()["id"]
        # Draft → pending (submit)
        submit = await client.patch(
            f"/api/v1/purchase-orders/{po_id}/status",
            headers=auth_header(primary_user),
            json={"status": "pending"},
        )
        assert submit.status_code == 200
        assert submit.json()["status"] == "pending"
        # Pending → approved
        approve = await client.patch(
            f"/api/v1/purchase-orders/{po_id}/status",
            headers=auth_header(primary_user),
            json={"status": "approved"},
        )
        assert approve.status_code == 200
        assert approve.json()["status"] == "approved"

    async def test_secondary_cannot_approve(self, client: AsyncClient, primary_user: User, secondary_user: User):
        create = await client.post(
            "/api/v1/purchase-orders", headers=auth_header(primary_user), json=PO_PAYLOAD,
        )
        po_id = create.json()["id"]
        response = await client.patch(
            f"/api/v1/purchase-orders/{po_id}/status",
            headers=auth_header(secondary_user),
            json={"status": "approved"},
        )
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Delete PO
# ---------------------------------------------------------------------------

class TestDeletePO:
    async def test_admin_can_delete_draft(self, client: AsyncClient, primary_user: User, admin: User):
        create = await client.post(
            "/api/v1/purchase-orders", headers=auth_header(primary_user), json=PO_PAYLOAD,
        )
        po_id = create.json()["id"]
        response = await client.delete(f"/api/v1/purchase-orders/{po_id}", headers=auth_header(admin))
        assert response.status_code == 204

    async def test_primary_cannot_delete(self, client: AsyncClient, primary_user: User):
        create = await client.post(
            "/api/v1/purchase-orders", headers=auth_header(primary_user), json=PO_PAYLOAD,
        )
        po_id = create.json()["id"]
        response = await client.delete(f"/api/v1/purchase-orders/{po_id}", headers=auth_header(primary_user))
        assert response.status_code == 403
