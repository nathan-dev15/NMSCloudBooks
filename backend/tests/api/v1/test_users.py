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


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="Acme Corp", slug="acme-corp", enabled_modules=[])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


def make_user(role: UserRole, tenant_id: int | None, email: str, created_by_id: int | None = None) -> User:
    return User(
        email=email,
        full_name=f"{role.value.replace('_', ' ').title()} User",
        hashed_password=hash_password("Password123"),
        role=role,
        is_active=True,
        is_verified=True,
        tenant_id=tenant_id,
    )


@pytest.fixture
async def super_admin(db_session: AsyncSession) -> User:
    u = make_user(UserRole.SUPER_ADMIN, None, "superadmin@acme.com")
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def admin(db_session: AsyncSession, tenant: Tenant, super_admin: User) -> User:
    u = make_user(UserRole.ADMIN, tenant.id, "admin@acme.com", super_admin.id)
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def primary_user(db_session: AsyncSession, tenant: Tenant, admin: User) -> User:
    u = make_user(UserRole.PRIMARY_USER, tenant.id, "primary@acme.com", admin.id)
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def secondary_user(db_session: AsyncSession, tenant: Tenant, admin: User) -> User:
    u = make_user(UserRole.SECONDARY_USER, tenant.id, "secondary@acme.com", admin.id)
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


# ---------------------------------------------------------------------------
# List users
# ---------------------------------------------------------------------------

class TestListUsers:
    async def test_super_admin_can_list_all(self, client: AsyncClient, super_admin: User, admin: User):
        response = await client.get("/api/v1/users", headers=auth_header(super_admin))
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    async def test_admin_can_list_tenant_users(
        self, client: AsyncClient, admin: User, primary_user: User
    ):
        response = await client.get("/api/v1/users", headers=auth_header(admin))
        assert response.status_code == 200

    async def test_primary_user_cannot_list_users(
        self, client: AsyncClient, primary_user: User
    ):
        response = await client.get("/api/v1/users", headers=auth_header(primary_user))
        assert response.status_code == 403

    async def test_secondary_user_cannot_list_users(
        self, client: AsyncClient, secondary_user: User
    ):
        response = await client.get("/api/v1/users", headers=auth_header(secondary_user))
        assert response.status_code == 403

    async def test_unauthenticated_cannot_list(self, client: AsyncClient):
        response = await client.get("/api/v1/users")
        assert response.status_code == 403

    async def test_pagination_defaults(self, client: AsyncClient, super_admin: User):
        response = await client.get("/api/v1/users", headers=auth_header(super_admin))
        data = response.json()
        assert data["page"] == 1
        assert data["size"] == 20

    async def test_pagination_custom(self, client: AsyncClient, super_admin: User):
        response = await client.get("/api/v1/users?page=1&size=5", headers=auth_header(super_admin))
        data = response.json()
        assert data["size"] == 5


# ---------------------------------------------------------------------------
# Create users — RBAC hierarchy
# ---------------------------------------------------------------------------

class TestCreateUser:
    async def test_super_admin_creates_admin(
        self, client: AsyncClient, super_admin: User, tenant: Tenant
    ):
        response = await client.post("/api/v1/users", headers=auth_header(super_admin), json={
            "email": "newadmin@acme.com",
            "full_name": "New Admin",
            "password": "Password123",
            "role": "admin",
            "tenant_id": tenant.id,
        })
        assert response.status_code == 201
        assert response.json()["role"] == "admin"

    async def test_super_admin_creates_all_roles(
        self, client: AsyncClient, super_admin: User, tenant: Tenant
    ):
        for role in ["admin", "primary_user", "secondary_user"]:
            response = await client.post("/api/v1/users", headers=auth_header(super_admin), json={
                "email": f"new_{role}@acme.com",
                "full_name": f"New {role}",
                "password": "Password123",
                "role": role,
                "tenant_id": tenant.id,
            })
            assert response.status_code == 201, f"Super Admin failed to create {role}"

    async def test_admin_creates_primary_user(
        self, client: AsyncClient, admin: User
    ):
        response = await client.post("/api/v1/users", headers=auth_header(admin), json={
            "email": "newprimary@acme.com",
            "full_name": "New Primary",
            "password": "Password123",
            "role": "primary_user",
        })
        assert response.status_code == 201

    async def test_admin_creates_secondary_user(
        self, client: AsyncClient, admin: User
    ):
        response = await client.post("/api/v1/users", headers=auth_header(admin), json={
            "email": "newsecondary@acme.com",
            "full_name": "New Secondary",
            "password": "Password123",
            "role": "secondary_user",
        })
        assert response.status_code == 201

    async def test_admin_cannot_create_admin(
        self, client: AsyncClient, admin: User, tenant: Tenant
    ):
        response = await client.post("/api/v1/users", headers=auth_header(admin), json={
            "email": "another_admin@acme.com",
            "full_name": "Rogue Admin",
            "password": "Password123",
            "role": "admin",
            "tenant_id": tenant.id,
        })
        assert response.status_code == 403

    async def test_admin_cannot_create_super_admin(
        self, client: AsyncClient, admin: User
    ):
        response = await client.post("/api/v1/users", headers=auth_header(admin), json={
            "email": "rogue_super@acme.com",
            "full_name": "Rogue Super",
            "password": "Password123",
            "role": "super_admin",
        })
        assert response.status_code == 403

    async def test_primary_user_cannot_create_users(
        self, client: AsyncClient, primary_user: User
    ):
        response = await client.post("/api/v1/users", headers=auth_header(primary_user), json={
            "email": "victim@acme.com",
            "full_name": "Victim",
            "password": "Password123",
            "role": "secondary_user",
        })
        assert response.status_code == 403

    async def test_duplicate_email_rejected(
        self, client: AsyncClient, super_admin: User, admin: User, tenant: Tenant
    ):
        response = await client.post("/api/v1/users", headers=auth_header(super_admin), json={
            "email": "admin@acme.com",  # already exists
            "full_name": "Dup Admin",
            "password": "Password123",
            "role": "admin",
            "tenant_id": tenant.id,
        })
        assert response.status_code == 409

    async def test_weak_password_rejected(
        self, client: AsyncClient, super_admin: User, tenant: Tenant
    ):
        response = await client.post("/api/v1/users", headers=auth_header(super_admin), json={
            "email": "weak@acme.com",
            "full_name": "Weak Pass",
            "password": "123",
            "role": "primary_user",
            "tenant_id": tenant.id,
        })
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Get / Update / Delete
# ---------------------------------------------------------------------------

class TestGetUpdateDeleteUser:
    async def test_user_can_get_self(self, client: AsyncClient, primary_user: User):
        response = await client.get(
            f"/api/v1/users/{primary_user.id}", headers=auth_header(primary_user)
        )
        assert response.status_code == 200
        assert response.json()["id"] == primary_user.id

    async def test_user_cannot_get_other(
        self, client: AsyncClient, primary_user: User, secondary_user: User
    ):
        response = await client.get(
            f"/api/v1/users/{secondary_user.id}", headers=auth_header(primary_user)
        )
        assert response.status_code == 403

    async def test_admin_can_get_any_user(
        self, client: AsyncClient, admin: User, secondary_user: User
    ):
        response = await client.get(
            f"/api/v1/users/{secondary_user.id}", headers=auth_header(admin)
        )
        assert response.status_code == 200

    async def test_get_nonexistent_user(self, client: AsyncClient, admin: User):
        response = await client.get("/api/v1/users/999999", headers=auth_header(admin))
        assert response.status_code == 404

    async def test_user_can_update_self(self, client: AsyncClient, primary_user: User):
        response = await client.patch(
            f"/api/v1/users/{primary_user.id}",
            headers=auth_header(primary_user),
            json={"full_name": "Updated Name"},
        )
        assert response.status_code == 200
        assert response.json()["full_name"] == "Updated Name"

    async def test_user_cannot_deactivate_self(
        self, client: AsyncClient, primary_user: User
    ):
        response = await client.patch(
            f"/api/v1/users/{primary_user.id}",
            headers=auth_header(primary_user),
            json={"is_active": False},
        )
        assert response.status_code == 403

    async def test_admin_can_deactivate_user(
        self, client: AsyncClient, admin: User, secondary_user: User
    ):
        response = await client.patch(
            f"/api/v1/users/{secondary_user.id}",
            headers=auth_header(admin),
            json={"is_active": False},
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False

    async def test_admin_can_soft_delete_lower_user(
        self, client: AsyncClient, admin: User, secondary_user: User
    ):
        response = await client.delete(
            f"/api/v1/users/{secondary_user.id}", headers=auth_header(admin)
        )
        assert response.status_code == 204

    async def test_admin_cannot_delete_super_admin(
        self, client: AsyncClient, admin: User, super_admin: User
    ):
        response = await client.delete(
            f"/api/v1/users/{super_admin.id}", headers=auth_header(admin)
        )
        assert response.status_code == 403

    async def test_primary_user_cannot_delete(
        self, client: AsyncClient, primary_user: User, secondary_user: User
    ):
        response = await client.delete(
            f"/api/v1/users/{secondary_user.id}", headers=auth_header(primary_user)
        )
        assert response.status_code == 403
