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


FARM_PAYLOAD = {
    "name": "Green Acres Farm",
    "farm_code": "GRN-001",
    "village": "Palani",
    "district": "Dindigul",
    "state": "Tamil Nadu",
    "total_area": 5.0,
    "land_unit": "acre",
    "irrigated_area": 3.0,
    "soil_type": "black",
    "water_source": "borewell",
    "is_active": True,
}


def cycle_payload(farm_id: int) -> dict:
    return {
        "farm_id": farm_id,
        "crop_name": "Cotton",
        "variety": "Bt Cotton",
        "season": "kharif",
        "year": 2026,
        "sowing_date": "2026-06-10",
        "expected_harvest_date": "2026-11-10",
        "area_cultivated": 4.0,
        "land_unit": "acre",
        "expected_yield": 1200.0,
        "yield_unit": "kg",
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="Agri Corp", slug="agri-corp", enabled_modules=[])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


@pytest.fixture
async def admin(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="admin@agri.com", full_name="Admin",
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
        email="primary@agri.com", full_name="Primary",
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
        email="secondary@agri.com", full_name="Secondary",
        hashed_password=hash_password("Password123"),
        role=UserRole.SECONDARY_USER, is_active=True, is_verified=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


# ---------------------------------------------------------------------------
# Farms — List
# ---------------------------------------------------------------------------

class TestListFarms:
    async def test_primary_can_list(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/agriculture/farms", headers=auth_header(primary_user))
        assert response.status_code == 200
        data = response.json()
        assert "items" in data and "total" in data

    async def test_secondary_can_list(self, client: AsyncClient, secondary_user: User):
        response = await client.get("/api/v1/agriculture/farms", headers=auth_header(secondary_user))
        assert response.status_code == 200

    async def test_unauthenticated_blocked(self, client: AsyncClient):
        response = await client.get("/api/v1/agriculture/farms")
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Farms — Create
# ---------------------------------------------------------------------------

class TestCreateFarm:
    async def test_primary_can_create(self, client: AsyncClient, primary_user: User):
        response = await client.post(
            "/api/v1/agriculture/farms",
            headers=auth_header(primary_user),
            json=FARM_PAYLOAD,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Green Acres Farm"
        assert data["total_area"] == 5.0

    async def test_secondary_cannot_create(self, client: AsyncClient, secondary_user: User):
        response = await client.post(
            "/api/v1/agriculture/farms",
            headers=auth_header(secondary_user),
            json=FARM_PAYLOAD,
        )
        assert response.status_code == 403

    async def test_requires_name_and_area(self, client: AsyncClient, primary_user: User):
        response = await client.post(
            "/api/v1/agriculture/farms",
            headers=auth_header(primary_user),
            json={"land_unit": "acre"},
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Farms — Get & Update
# ---------------------------------------------------------------------------

class TestFarmGetUpdate:
    async def test_get_existing(self, client: AsyncClient, primary_user: User):
        create = await client.post(
            "/api/v1/agriculture/farms", headers=auth_header(primary_user),
            json={**FARM_PAYLOAD, "name": "Get Farm", "farm_code": "GET-001"},
        )
        farm_id = create.json()["id"]
        response = await client.get(
            f"/api/v1/agriculture/farms/{farm_id}", headers=auth_header(primary_user)
        )
        assert response.status_code == 200
        assert response.json()["id"] == farm_id

    async def test_update_farm(self, client: AsyncClient, primary_user: User):
        create = await client.post(
            "/api/v1/agriculture/farms", headers=auth_header(primary_user),
            json={**FARM_PAYLOAD, "name": "Update Farm", "farm_code": "UPD-001"},
        )
        farm_id = create.json()["id"]
        response = await client.put(
            f"/api/v1/agriculture/farms/{farm_id}",
            headers=auth_header(primary_user),
            json={"soil_type": "red loam"},
        )
        assert response.status_code == 200
        assert response.json()["soil_type"] == "red loam"

    async def test_get_nonexistent(self, client: AsyncClient, admin: User):
        response = await client.get("/api/v1/agriculture/farms/999999", headers=auth_header(admin))
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Crop Cycles — CRUD
# ---------------------------------------------------------------------------

class TestCropCycles:
    async def test_create_cycle(self, client: AsyncClient, primary_user: User):
        farm = await client.post(
            "/api/v1/agriculture/farms", headers=auth_header(primary_user),
            json={**FARM_PAYLOAD, "name": "Cycle Farm", "farm_code": "CYC-001"},
        )
        farm_id = farm.json()["id"]
        response = await client.post(
            "/api/v1/agriculture/cycles",
            headers=auth_header(primary_user),
            json=cycle_payload(farm_id),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["crop_name"] == "Cotton"
        assert data["status"] == "planned"

    async def test_list_cycles(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/agriculture/cycles", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert "items" in response.json()

    async def test_secondary_cannot_create_cycle(self, client: AsyncClient, primary_user: User, secondary_user: User):
        farm = await client.post(
            "/api/v1/agriculture/farms", headers=auth_header(primary_user),
            json={**FARM_PAYLOAD, "name": "Blocked Farm", "farm_code": "BLK-001"},
        )
        response = await client.post(
            "/api/v1/agriculture/cycles",
            headers=auth_header(secondary_user),
            json=cycle_payload(farm.json()["id"]),
        )
        assert response.status_code == 403

    async def test_filter_by_season(self, client: AsyncClient, primary_user: User):
        response = await client.get(
            "/api/v1/agriculture/cycles?season=kharif",
            headers=auth_header(primary_user),
        )
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------

class TestExpenses:
    async def test_add_expense_to_cycle(self, client: AsyncClient, primary_user: User):
        farm = await client.post(
            "/api/v1/agriculture/farms", headers=auth_header(primary_user),
            json={**FARM_PAYLOAD, "name": "Expense Farm", "farm_code": "EXP-001"},
        )
        cycle = await client.post(
            "/api/v1/agriculture/cycles", headers=auth_header(primary_user),
            json=cycle_payload(farm.json()["id"]),
        )
        cycle_id = cycle.json()["id"]
        response = await client.post(
            f"/api/v1/agriculture/cycles/{cycle_id}/expenses",
            headers=auth_header(primary_user),
            json={
                "expense_date": "2026-06-15",
                "category": "seeds",
                "description": "Bt Cotton Seeds",
                "quantity": 5.0,
                "unit": "kg",
                "unit_cost": 300.0,
                "amount": 1500.0,
                "is_paid": True,
            },
        )
        assert response.status_code == 201
        assert response.json()["amount"] == 1500.0

    async def test_secondary_cannot_add_expense(self, client: AsyncClient, primary_user: User, secondary_user: User):
        farm = await client.post(
            "/api/v1/agriculture/farms", headers=auth_header(primary_user),
            json={**FARM_PAYLOAD, "name": "Sec Farm", "farm_code": "SEC-001"},
        )
        cycle = await client.post(
            "/api/v1/agriculture/cycles", headers=auth_header(primary_user),
            json=cycle_payload(farm.json()["id"]),
        )
        response = await client.post(
            f"/api/v1/agriculture/cycles/{cycle.json()['id']}/expenses",
            headers=auth_header(secondary_user),
            json={"expense_date": "2026-06-15", "category": "seeds", "description": "X", "amount": 100.0},
        )
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Harvests
# ---------------------------------------------------------------------------

class TestHarvests:
    async def test_add_harvest(self, client: AsyncClient, primary_user: User):
        farm = await client.post(
            "/api/v1/agriculture/farms", headers=auth_header(primary_user),
            json={**FARM_PAYLOAD, "name": "Harvest Farm", "farm_code": "HRV-001"},
        )
        cycle = await client.post(
            "/api/v1/agriculture/cycles", headers=auth_header(primary_user),
            json=cycle_payload(farm.json()["id"]),
        )
        cycle_id = cycle.json()["id"]
        response = await client.post(
            f"/api/v1/agriculture/cycles/{cycle_id}/harvests",
            headers=auth_header(primary_user),
            json={
                "harvest_date": "2026-11-10",
                "quantity": 1100.0,
                "unit": "kg",
                "quality_grade": "A",
                "market_rate": 50.0,
                "sale_amount": 55000.0,
            },
        )
        assert response.status_code == 201
        assert response.json()["quantity"] == 1100.0


# ---------------------------------------------------------------------------
# Agriculture Invoices
# ---------------------------------------------------------------------------

class TestAgriInvoices:
    async def test_list_agri_invoices(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/agriculture/invoices", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert "items" in response.json()
