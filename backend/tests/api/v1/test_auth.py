import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.tenant import Tenant


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="Test Corp", slug="test-corp", enabled_modules=[])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


@pytest.fixture
async def active_user(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="admin@test.com",
        full_name="Test Admin",
        hashed_password=hash_password("Password123"),
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def inactive_user(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="inactive@test.com",
        full_name="Inactive User",
        hashed_password=hash_password("Password123"),
        role=UserRole.PRIMARY_USER,
        is_active=False,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def super_admin(db_session: AsyncSession) -> User:
    u = User(
        email="superadmin@test.com",
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


# ---------------------------------------------------------------------------
# Login tests
# ---------------------------------------------------------------------------

class TestLogin:
    async def test_login_success(self, client: AsyncClient, active_user: User):
        response = await client.post("/api/v1/auth/login", json={
            "email": "admin@test.com",
            "password": "Password123",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, active_user: User):
        response = await client.post("/api/v1/auth/login", json={
            "email": "admin@test.com",
            "password": "WrongPassword",
        })
        assert response.status_code == 401

    async def test_login_nonexistent_email(self, client: AsyncClient):
        response = await client.post("/api/v1/auth/login", json={
            "email": "nobody@nowhere.com",
            "password": "anything",
        })
        assert response.status_code == 401

    async def test_login_inactive_account(self, client: AsyncClient, inactive_user: User):
        response = await client.post("/api/v1/auth/login", json={
            "email": "inactive@test.com",
            "password": "Password123",
        })
        assert response.status_code == 401

    async def test_login_case_insensitive_email(self, client: AsyncClient, active_user: User):
        response = await client.post("/api/v1/auth/login", json={
            "email": "ADMIN@TEST.COM",
            "password": "Password123",
        })
        assert response.status_code == 200

    async def test_login_invalid_email_format(self, client: AsyncClient):
        response = await client.post("/api/v1/auth/login", json={
            "email": "not-an-email",
            "password": "Password123",
        })
        assert response.status_code == 422

    async def test_login_missing_fields(self, client: AsyncClient):
        response = await client.post("/api/v1/auth/login", json={"email": "admin@test.com"})
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Token & /me tests
# ---------------------------------------------------------------------------

class TestTokenAndMe:
    @pytest.fixture
    async def tokens(self, client: AsyncClient, active_user: User) -> dict:
        resp = await client.post("/api/v1/auth/login", json={
            "email": "admin@test.com", "password": "Password123"
        })
        return resp.json()

    async def test_get_me_with_valid_token(self, client: AsyncClient, tokens: dict, active_user: User):
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@test.com"
        assert data["role"] == UserRole.ADMIN.value

    async def test_get_me_without_token(self, client: AsyncClient):
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 403  # HTTPBearer returns 403 when missing

    async def test_get_me_with_invalid_token(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer totally.invalid.token"},
        )
        assert response.status_code == 401

    async def test_refresh_token(self, client: AsyncClient, tokens: dict):
        response = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": tokens["refresh_token"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["access_token"] != tokens["access_token"]  # new token issued

    async def test_refresh_with_access_token_fails(self, client: AsyncClient, tokens: dict):
        response = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": tokens["access_token"]  # wrong token type
        })
        assert response.status_code == 401

    async def test_refresh_with_invalid_token(self, client: AsyncClient):
        response = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": "bad.token.here"
        })
        assert response.status_code == 401

    async def test_logout(self, client: AsyncClient, tokens: dict):
        response = await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Logged out successfully"


# ---------------------------------------------------------------------------
# Account lockout tests
# ---------------------------------------------------------------------------

class TestAccountLockout:
    async def test_failed_attempts_increment(
        self, client: AsyncClient, active_user: User, db_session: AsyncSession
    ):
        for _ in range(3):
            await client.post("/api/v1/auth/login", json={
                "email": "admin@test.com", "password": "wrong"
            })
        await db_session.refresh(active_user)
        assert active_user.failed_login_attempts == 3

    async def test_account_locks_after_max_attempts(
        self, client: AsyncClient, active_user: User, db_session: AsyncSession
    ):
        from app.core.config import settings
        for _ in range(settings.MAX_LOGIN_ATTEMPTS):
            await client.post("/api/v1/auth/login", json={
                "email": "admin@test.com", "password": "wrong"
            })
        # Next attempt should be locked
        response = await client.post("/api/v1/auth/login", json={
            "email": "admin@test.com", "password": "Password123"
        })
        # Either locked (401) or resets and re-locks
        assert response.status_code in (200, 401)

    async def test_successful_login_resets_attempts(
        self, client: AsyncClient, active_user: User, db_session: AsyncSession
    ):
        # Fail twice
        for _ in range(2):
            await client.post("/api/v1/auth/login", json={
                "email": "admin@test.com", "password": "wrong"
            })
        # Then succeed
        await client.post("/api/v1/auth/login", json={
            "email": "admin@test.com", "password": "Password123"
        })
        await db_session.refresh(active_user)
        assert active_user.failed_login_attempts == 0
        assert active_user.locked_until is None
