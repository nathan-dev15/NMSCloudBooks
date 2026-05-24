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


SERVICE_PAYLOAD = {
    "name": "Web Development",
    "code": "WEB-DEV",
    "unit": "hr",
    "rate": 1500.0,
    "tax_rate": 18.0,
    "is_active": True,
    "is_recurring_eligible": True,
    "tags": [],
}

PLAN_PAYLOAD = {
    "name": "Starter Plan",
    "code": "STARTER",
    "billing_cycle": "monthly",
    "price": 4999.0,
    "tax_rate": 18.0,
    "trial_days": 14,
    "features": ["5 Users", "10 GB Storage"],
    "is_active": True,
    "currency": "INR",
}


def gen_invoice_payload(client_id: int) -> dict:
    return {
        "client_id": client_id,
        "invoice_date": "2026-05-01",
        "due_date": "2026-05-31",
        "currency": "INR",
        "discount_amount": 0.0,
        "items": [
            {
                "description": "Monthly Retainer",
                "quantity": 1.0,
                "rate": 10000.0,
                "tax_rate": 18.0,
                "discount_pct": 0.0,
                "unit": "month",
            }
        ],
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="General Corp", slug="general-corp", enabled_modules=[])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


@pytest.fixture
async def admin(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="admin@general.com", full_name="Admin",
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
        email="primary@general.com", full_name="Primary",
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
        email="secondary@general.com", full_name="Secondary",
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
        display_name="General Buyer",
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
# Services
# ---------------------------------------------------------------------------

class TestServices:
    async def test_list_services(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/general/services", headers=auth_header(primary_user))
        assert response.status_code == 200
        data = response.json()
        assert "items" in data and "total" in data

    async def test_admin_can_create_service(self, client: AsyncClient, admin: User):
        response = await client.post(
            "/api/v1/general/services", headers=auth_header(admin), json=SERVICE_PAYLOAD,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Web Development"
        assert data["rate"] == 1500.0

    async def test_secondary_cannot_create_service(self, client: AsyncClient, secondary_user: User):
        response = await client.post(
            "/api/v1/general/services", headers=auth_header(secondary_user), json=SERVICE_PAYLOAD,
        )
        assert response.status_code == 403

    async def test_get_service(self, client: AsyncClient, admin: User):
        create = await client.post(
            "/api/v1/general/services", headers=auth_header(admin),
            json={**SERVICE_PAYLOAD, "name": "Get Service", "code": "GET-SVC"},
        )
        svc_id = create.json()["id"]
        response = await client.get(f"/api/v1/general/services/{svc_id}", headers=auth_header(admin))
        assert response.status_code == 200
        assert response.json()["id"] == svc_id

    async def test_update_service(self, client: AsyncClient, admin: User):
        create = await client.post(
            "/api/v1/general/services", headers=auth_header(admin),
            json={**SERVICE_PAYLOAD, "name": "Update Service", "code": "UPD-SVC"},
        )
        svc_id = create.json()["id"]
        response = await client.put(
            f"/api/v1/general/services/{svc_id}",
            headers=auth_header(admin),
            json={"rate": 2000.0},
        )
        assert response.status_code == 200
        assert response.json()["rate"] == 2000.0

    async def test_delete_service(self, client: AsyncClient, admin: User):
        create = await client.post(
            "/api/v1/general/services", headers=auth_header(admin),
            json={**SERVICE_PAYLOAD, "name": "Delete Service", "code": "DEL-SVC"},
        )
        svc_id = create.json()["id"]
        response = await client.delete(f"/api/v1/general/services/{svc_id}", headers=auth_header(admin))
        assert response.status_code == 204


# ---------------------------------------------------------------------------
# Subscription Plans
# ---------------------------------------------------------------------------

class TestPlans:
    async def test_list_plans(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/general/plans", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_admin_can_create_plan(self, client: AsyncClient, admin: User):
        response = await client.post(
            "/api/v1/general/plans", headers=auth_header(admin), json=PLAN_PAYLOAD,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Starter Plan"
        assert data["billing_cycle"] == "monthly"
        assert data["trial_days"] == 14

    async def test_secondary_cannot_create_plan(self, client: AsyncClient, secondary_user: User):
        response = await client.post(
            "/api/v1/general/plans", headers=auth_header(secondary_user), json=PLAN_PAYLOAD,
        )
        assert response.status_code == 403

    async def test_update_plan(self, client: AsyncClient, admin: User):
        create = await client.post(
            "/api/v1/general/plans", headers=auth_header(admin),
            json={**PLAN_PAYLOAD, "name": "Update Plan", "code": "UPD-PLAN"},
        )
        plan_id = create.json()["id"]
        response = await client.put(
            f"/api/v1/general/plans/{plan_id}",
            headers=auth_header(admin),
            json={"price": 5999.0},
        )
        assert response.status_code == 200
        assert response.json()["price"] == 5999.0


# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------

class TestSubscriptions:
    async def test_list_subscriptions(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/general/subscriptions", headers=auth_header(primary_user))
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    async def test_create_subscription(
        self, client: AsyncClient, primary_user: User, admin: User, test_client_obj: Client
    ):
        plan = await client.post(
            "/api/v1/general/plans", headers=auth_header(admin),
            json={**PLAN_PAYLOAD, "name": "Sub Plan", "code": "SUB-PLAN"},
        )
        plan_id = plan.json()["id"]
        response = await client.post(
            "/api/v1/general/subscriptions",
            headers=auth_header(primary_user),
            json={
                "client_id": test_client_obj.id,
                "plan_id": plan_id,
                "start_date": "2026-05-01",
                "discount_pct": 0.0,
                "auto_renew": True,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["client_id"] == test_client_obj.id
        assert data["plan_id"] == plan_id

    async def test_secondary_cannot_subscribe(
        self, client: AsyncClient, secondary_user: User, admin: User, test_client_obj: Client
    ):
        plan = await client.post(
            "/api/v1/general/plans", headers=auth_header(admin),
            json={**PLAN_PAYLOAD, "name": "Sec Plan", "code": "SEC-PLAN"},
        )
        response = await client.post(
            "/api/v1/general/subscriptions",
            headers=auth_header(secondary_user),
            json={
                "client_id": test_client_obj.id,
                "plan_id": plan.json()["id"],
                "start_date": "2026-05-01",
                "discount_pct": 0.0,
                "auto_renew": True,
            },
        )
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# General Invoices
# ---------------------------------------------------------------------------

class TestGenInvoices:
    async def test_list_gen_invoices(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/general/invoices", headers=auth_header(primary_user))
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    async def test_create_gen_invoice(
        self, client: AsyncClient, primary_user: User, test_client_obj: Client
    ):
        response = await client.post(
            "/api/v1/general/invoices",
            headers=auth_header(primary_user),
            json=gen_invoice_payload(test_client_obj.id),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["client_id"] == test_client_obj.id
        assert data["status"] == "draft"

    async def test_secondary_cannot_create_gen_invoice(
        self, client: AsyncClient, secondary_user: User, test_client_obj: Client
    ):
        response = await client.post(
            "/api/v1/general/invoices",
            headers=auth_header(secondary_user),
            json=gen_invoice_payload(test_client_obj.id),
        )
        assert response.status_code == 403

    async def test_update_gen_invoice_status(
        self, client: AsyncClient, primary_user: User, test_client_obj: Client
    ):
        create = await client.post(
            "/api/v1/general/invoices",
            headers=auth_header(primary_user),
            json=gen_invoice_payload(test_client_obj.id),
        )
        inv_id = create.json()["id"]
        response = await client.patch(
            f"/api/v1/general/invoices/{inv_id}/status",
            headers=auth_header(primary_user),
            json={"status": "sent"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "sent"

    async def test_delete_draft_invoice(
        self, client: AsyncClient, admin: User, primary_user: User, test_client_obj: Client
    ):
        create = await client.post(
            "/api/v1/general/invoices",
            headers=auth_header(primary_user),
            json=gen_invoice_payload(test_client_obj.id),
        )
        inv_id = create.json()["id"]
        response = await client.delete(
            f"/api/v1/general/invoices/{inv_id}", headers=auth_header(admin)
        )
        assert response.status_code == 204

    async def test_filter_by_status(self, client: AsyncClient, primary_user: User):
        response = await client.get(
            "/api/v1/general/invoices?status=draft", headers=auth_header(primary_user)
        )
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Recurring Templates
# ---------------------------------------------------------------------------

class TestRecurringTemplates:
    async def test_list_templates(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/general/recurring-templates", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_create_template(
        self, client: AsyncClient, primary_user: User, test_client_obj: Client
    ):
        response = await client.post(
            "/api/v1/general/recurring-templates",
            headers=auth_header(primary_user),
            json={
                "client_id": test_client_obj.id,
                "name": "Monthly Retainer",
                "billing_cycle": "monthly",
                "next_run_date": "2026-06-01",
                "payment_due_days": 15,
                "currency": "INR",
                "line_items": [
                    {
                        "description": "Monthly Support",
                        "quantity": 1.0,
                        "rate": 5000.0,
                        "tax_rate": 18.0,
                        "unit": "month",
                    }
                ],
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Monthly Retainer"
        assert data["billing_cycle"] == "monthly"
