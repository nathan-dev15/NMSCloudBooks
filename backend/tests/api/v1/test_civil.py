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


PROJECT_PAYLOAD = {
    "name": "Highway NH-44 Extension",
    "code": "NH44-EXT",
    "description": "National highway extension project",
    "state": "Tamil Nadu",
    "district": "Vellore",
    "contract_value": 50000000.0,
    "target_completion_date": "2027-12-31",
    "tags": ["highway", "national"],
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="Civil Corp", slug="civil-corp", enabled_modules=["civil"])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


@pytest.fixture
async def admin(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="admin@civil.com", full_name="Admin",
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
        email="primary@civil.com", full_name="Primary",
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
        email="secondary@civil.com", full_name="Secondary",
        hashed_password=hash_password("Password123"),
        role=UserRole.SECONDARY_USER, is_active=True, is_verified=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


# ---------------------------------------------------------------------------
# Projects — List & Create
# ---------------------------------------------------------------------------

class TestProjects:
    async def test_admin_can_create_project(self, client: AsyncClient, admin: User):
        response = await client.post(
            "/api/v1/civil/projects", headers=auth_header(admin), json=PROJECT_PAYLOAD,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Highway NH-44 Extension"
        assert data["code"] == "NH44-EXT"
        assert data["status"] in ("active", "planning", "pending")

    async def test_primary_cannot_create_project(self, client: AsyncClient, primary_user: User):
        response = await client.post(
            "/api/v1/civil/projects", headers=auth_header(primary_user), json=PROJECT_PAYLOAD,
        )
        assert response.status_code == 403

    async def test_all_roles_can_list_projects(
        self, client: AsyncClient, admin: User, primary_user: User, secondary_user: User
    ):
        for user in [admin, primary_user, secondary_user]:
            response = await client.get("/api/v1/civil/projects", headers=auth_header(user))
            assert response.status_code == 200
            assert "items" in response.json()

    async def test_unauthenticated_blocked(self, client: AsyncClient):
        response = await client.get("/api/v1/civil/projects")
        assert response.status_code == 403

    async def test_get_project(self, client: AsyncClient, admin: User):
        create = await client.post(
            "/api/v1/civil/projects", headers=auth_header(admin),
            json={**PROJECT_PAYLOAD, "code": "GET-PRJ"},
        )
        proj_id = create.json()["id"]
        response = await client.get(f"/api/v1/civil/projects/{proj_id}", headers=auth_header(admin))
        assert response.status_code == 200
        assert response.json()["id"] == proj_id

    async def test_update_project(self, client: AsyncClient, admin: User):
        create = await client.post(
            "/api/v1/civil/projects", headers=auth_header(admin),
            json={**PROJECT_PAYLOAD, "code": "UPD-PRJ"},
        )
        proj_id = create.json()["id"]
        response = await client.patch(
            f"/api/v1/civil/projects/{proj_id}",
            headers=auth_header(admin),
            json={"overall_progress": 25.0},
        )
        assert response.status_code == 200
        assert response.json()["overall_progress"] == 25.0

    async def test_filter_by_state(self, client: AsyncClient, admin: User):
        response = await client.get(
            "/api/v1/civil/projects?state=Tamil Nadu", headers=auth_header(admin),
        )
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Plans & Blocks (blocks live under plans in this project's URL structure)
# ---------------------------------------------------------------------------

class TestBlocks:
    async def test_create_plan_and_block(self, client: AsyncClient, admin: User):
        project = await client.post(
            "/api/v1/civil/projects", headers=auth_header(admin),
            json={**PROJECT_PAYLOAD, "code": "BLK-PRJ"},
        )
        proj_id = project.json()["id"]

        plan = await client.post(
            f"/api/v1/civil/projects/{proj_id}/plans",
            headers=auth_header(admin),
            json={"plan_code": "PLN-001", "name": "Phase 1 Plan"},
        )
        assert plan.status_code == 201
        plan_id = plan.json()["id"]

        response = await client.post(
            f"/api/v1/civil/projects/{proj_id}/plans/{plan_id}/blocks",
            headers=auth_header(admin),
            json={"block_code": "BLK-A", "name": "Block A", "planned_quantity": 500.0, "unit_of_measure": "sqm"},
        )
        assert response.status_code == 201
        assert response.json()["name"] == "Block A"

    async def test_list_blocks(self, client: AsyncClient, admin: User):
        project = await client.post(
            "/api/v1/civil/projects", headers=auth_header(admin),
            json={**PROJECT_PAYLOAD, "code": "BLKLST-PRJ"},
        )
        proj_id = project.json()["id"]
        plan = await client.post(
            f"/api/v1/civil/projects/{proj_id}/plans",
            headers=auth_header(admin),
            json={"plan_code": "PLN-LST", "name": "List Plan"},
        )
        plan_id = plan.json()["id"]
        response = await client.get(
            f"/api/v1/civil/projects/{proj_id}/plans/{plan_id}/blocks",
            headers=auth_header(admin),
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_primary_cannot_create_block(self, client: AsyncClient, admin: User, primary_user: User):
        project = await client.post(
            "/api/v1/civil/projects", headers=auth_header(admin),
            json={**PROJECT_PAYLOAD, "code": "PBLK-PRJ"},
        )
        proj_id = project.json()["id"]
        plan = await client.post(
            f"/api/v1/civil/projects/{proj_id}/plans",
            headers=auth_header(admin),
            json={"plan_code": "PLN-P", "name": "Primary Plan"},
        )
        plan_id = plan.json()["id"]
        response = await client.post(
            f"/api/v1/civil/projects/{proj_id}/plans/{plan_id}/blocks",
            headers=auth_header(primary_user),
            json={"block_code": "BLK-B", "name": "Block B"},
        )
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Material Requests
# ---------------------------------------------------------------------------

class TestMaterialRequests:
    async def test_primary_can_create_request(self, client: AsyncClient, admin: User, primary_user: User):
        project = await client.post(
            "/api/v1/civil/projects", headers=auth_header(admin),
            json={**PROJECT_PAYLOAD, "code": "MR-PRJ"},
        )
        proj_id = project.json()["id"]
        response = await client.post(
            "/api/v1/civil/requests",
            headers=auth_header(primary_user),
            json={
                "project_id": proj_id,
                "title": "Cement for Foundation",
                "required_by": "2026-05-25",
                "priority": "standard",
                "notes": "Urgent requirement",
                "items": [
                    {
                        "material_name": "Cement",
                        "requested_qty": 100.0,
                        "unit_of_measure": "bag",
                        "notes": "OPC 53 Grade",
                    }
                ],
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["project_id"] == proj_id
        assert data["status"] == "draft"

    async def test_list_requests(self, client: AsyncClient, admin: User, primary_user: User):
        project = await client.post(
            "/api/v1/civil/projects", headers=auth_header(admin),
            json={**PROJECT_PAYLOAD, "code": "LIST-MR-PRJ"},
        )
        proj_id = project.json()["id"]
        response = await client.get(
            f"/api/v1/civil/requests?project_id={proj_id}", headers=auth_header(primary_user)
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    async def test_secondary_cannot_create_request(self, client: AsyncClient, admin: User, secondary_user: User):
        project = await client.post(
            "/api/v1/civil/projects", headers=auth_header(admin),
            json={**PROJECT_PAYLOAD, "code": "SEC-MR-PRJ"},
        )
        response = await client.post(
            "/api/v1/civil/requests",
            headers=auth_header(secondary_user),
            json={
                "project_id": project.json()["id"],
                "title": "Sand Request",
                "items": [{"material_name": "Sand", "requested_qty": 5.0, "unit_of_measure": "ton"}],
            },
        )
        assert response.status_code == 403

    async def test_submit_request(self, client: AsyncClient, admin: User, primary_user: User):
        project = await client.post(
            "/api/v1/civil/projects", headers=auth_header(admin),
            json={**PROJECT_PAYLOAD, "code": "SUB-MR-PRJ"},
        )
        proj_id = project.json()["id"]
        create = await client.post(
            "/api/v1/civil/requests",
            headers=auth_header(primary_user),
            json={
                "project_id": proj_id,
                "title": "Gravel for Roads",
                "items": [{"material_name": "Gravel", "requested_qty": 10.0, "unit_of_measure": "ton"}],
            },
        )
        req_id = create.json()["id"]
        response = await client.post(
            f"/api/v1/civil/requests/{req_id}/submit",
            headers=auth_header(primary_user),
            json={},
        )
        assert response.status_code in (200, 201)
        assert response.json()["status"] in ("submitted", "pending_approval", "pending")
