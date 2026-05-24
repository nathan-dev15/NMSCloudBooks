import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, create_access_token
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.client import Client


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def auth_header(user: User) -> dict:
    token = create_access_token(user.id, extra={"role": user.role.value, "tenant_id": user.tenant_id})
    return {"Authorization": f"Bearer {token}"}


def invoice_payload(client_id: int) -> dict:
    return {
        "client_id": client_id,
        "invoice_date": "2026-05-01",
        "due_date": "2026-05-31",
        "currency": "INR",
        "gst_type": "cgst_sgst",
        "discount_amount": 0.0,
        "items": [
            {
                "description": "Consulting Service",
                "quantity": 2.0,
                "rate": 5000.0,
                "discount_pct": 0.0,
                "gst_rate": 18.0,
            }
        ],
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="Invoice Corp", slug="invoice-corp", enabled_modules=[])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


@pytest.fixture
async def admin(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="admin@invoice.com", full_name="Admin",
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
        email="primary@invoice.com", full_name="Primary",
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
        email="secondary@invoice.com", full_name="Secondary",
        hashed_password=hash_password("Password123"),
        role=UserRole.SECONDARY_USER, is_active=True, is_verified=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def test_client_obj(db_session: AsyncSession, tenant: Tenant) -> Client:
    c = Client(
        tenant_id=tenant.id,
        display_name="Test Buyer",
        client_type="company",
        segment="standard",
        currency="INR",
        outstanding_balance=0.0,
        tags=[],
    )
    db_session.add(c)
    await db_session.flush()
    await db_session.refresh(c)
    return c


# ---------------------------------------------------------------------------
# List invoices
# ---------------------------------------------------------------------------

class TestListInvoices:
    async def test_primary_can_list(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/invoices", headers=auth_header(primary_user))
        assert response.status_code == 200
        data = response.json()
        assert "items" in data and "total" in data

    async def test_secondary_can_list(self, client: AsyncClient, secondary_user: User):
        response = await client.get("/api/v1/invoices", headers=auth_header(secondary_user))
        assert response.status_code == 200

    async def test_unauthenticated_blocked(self, client: AsyncClient):
        response = await client.get("/api/v1/invoices")
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Create invoice
# ---------------------------------------------------------------------------

class TestCreateInvoice:
    async def test_primary_can_create(
        self, client: AsyncClient, primary_user: User, test_client_obj: Client
    ):
        response = await client.post(
            "/api/v1/invoices",
            headers=auth_header(primary_user),
            json=invoice_payload(test_client_obj.id),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["client_id"] == test_client_obj.id
        assert data["grand_total"] > 0
        assert data["status"] == "draft"

    async def test_secondary_cannot_create(
        self, client: AsyncClient, secondary_user: User, test_client_obj: Client
    ):
        response = await client.post(
            "/api/v1/invoices",
            headers=auth_header(secondary_user),
            json=invoice_payload(test_client_obj.id),
        )
        assert response.status_code == 403

    async def test_invoice_requires_items(self, client: AsyncClient, primary_user: User, test_client_obj: Client):
        payload = {**invoice_payload(test_client_obj.id), "items": []}
        response = await client.post("/api/v1/invoices", headers=auth_header(primary_user), json=payload)
        assert response.status_code == 422

    async def test_auto_invoice_number(
        self, client: AsyncClient, primary_user: User, test_client_obj: Client
    ):
        response = await client.post(
            "/api/v1/invoices",
            headers=auth_header(primary_user),
            json=invoice_payload(test_client_obj.id),
        )
        assert response.status_code == 201
        assert response.json()["invoice_number"] != ""

    async def test_gst_calculation(
        self, client: AsyncClient, primary_user: User, test_client_obj: Client
    ):
        response = await client.post(
            "/api/v1/invoices",
            headers=auth_header(primary_user),
            json=invoice_payload(test_client_obj.id),
        )
        data = response.json()
        # 2 qty * ₹5000 = ₹10000 subtotal, 18% GST = ₹1800
        assert data["subtotal"] == pytest.approx(10000.0, abs=1)
        assert data["total_tax_amount"] == pytest.approx(1800.0, abs=1)


# ---------------------------------------------------------------------------
# Get invoice
# ---------------------------------------------------------------------------

class TestGetInvoice:
    async def test_get_existing(
        self, client: AsyncClient, primary_user: User, test_client_obj: Client
    ):
        create = await client.post(
            "/api/v1/invoices", headers=auth_header(primary_user),
            json=invoice_payload(test_client_obj.id),
        )
        inv_id = create.json()["id"]
        response = await client.get(f"/api/v1/invoices/{inv_id}", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert response.json()["id"] == inv_id

    async def test_get_nonexistent(self, client: AsyncClient, admin: User):
        response = await client.get("/api/v1/invoices/999999", headers=auth_header(admin))
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Status update
# ---------------------------------------------------------------------------

class TestInvoiceStatusUpdate:
    async def test_mark_as_sent(
        self, client: AsyncClient, primary_user: User, test_client_obj: Client
    ):
        create = await client.post(
            "/api/v1/invoices", headers=auth_header(primary_user),
            json=invoice_payload(test_client_obj.id),
        )
        inv_id = create.json()["id"]
        response = await client.patch(
            f"/api/v1/invoices/{inv_id}/status",
            headers=auth_header(primary_user),
            json={"status": "sent"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "sent"

    async def test_secondary_cannot_update_status(
        self, client: AsyncClient, primary_user: User, secondary_user: User, test_client_obj: Client
    ):
        create = await client.post(
            "/api/v1/invoices", headers=auth_header(primary_user),
            json=invoice_payload(test_client_obj.id),
        )
        inv_id = create.json()["id"]
        response = await client.patch(
            f"/api/v1/invoices/{inv_id}/status",
            headers=auth_header(secondary_user),
            json={"status": "sent"},
        )
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Add payment
# ---------------------------------------------------------------------------

class TestAddPayment:
    async def test_add_payment(
        self, client: AsyncClient, primary_user: User, test_client_obj: Client
    ):
        create = await client.post(
            "/api/v1/invoices", headers=auth_header(primary_user),
            json=invoice_payload(test_client_obj.id),
        )
        inv_id = create.json()["id"]
        # Mark as sent first
        await client.patch(
            f"/api/v1/invoices/{inv_id}/status",
            headers=auth_header(primary_user),
            json={"status": "sent"},
        )
        response = await client.post(
            f"/api/v1/invoices/{inv_id}/payments",
            headers=auth_header(primary_user),
            json={"payment_date": "2026-05-10", "amount": 5000.0, "mode": "bank"},
        )
        assert response.status_code == 201
        assert response.json()["amount"] == 5000.0
