import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, create_access_token
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.inventory import Product, ProductType, ProductStatus
from app.models.retail import Store, StoreStatus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def auth_header(user: User) -> dict:
    token = create_access_token(user.id, extra={"role": user.role.value, "tenant_id": user.tenant_id})
    return {"Authorization": f"Bearer {token}"}


STORE_PAYLOAD = {
    "name": "Main Street Store",
    "code": "MAIN-ST",
    "address": "123 Main St, Chennai",
    "phone": "9876543210",
    "currency": "INR",
    "is_default": True,
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="Retail Corp", slug="retail-corp", enabled_modules=["retail"])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


@pytest.fixture
async def admin(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="admin@retail.com", full_name="Admin",
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
        email="primary@retail.com", full_name="Primary",
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
        email="secondary@retail.com", full_name="Secondary",
        hashed_password=hash_password("Password123"),
        role=UserRole.SECONDARY_USER, is_active=True, is_verified=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def store(db_session: AsyncSession, tenant: Tenant) -> Store:
    s = Store(
        tenant_id=tenant.id,
        name="Test Store",
        code="TEST-ST",
        status=StoreStatus.ACTIVE,
        is_default=True,
        currency="INR",
        settings={},
    )
    db_session.add(s)
    await db_session.flush()
    await db_session.refresh(s)
    return s


@pytest.fixture
async def product(db_session: AsyncSession, tenant: Tenant) -> Product:
    p = Product(
        tenant_id=tenant.id,
        name="Test Product",
        sku="TST-001",
        product_type=ProductType.GOODS,
        status=ProductStatus.ACTIVE,
        unit="nos",
        purchase_price=100.0,
        selling_price=150.0,
        mrp=160.0,
        tax_rate=18.0,
        track_inventory=True,
        allow_negative=True,
        tags=[],
        attributes={},
    )
    db_session.add(p)
    await db_session.flush()
    await db_session.refresh(p)
    return p


# ---------------------------------------------------------------------------
# Stores
# ---------------------------------------------------------------------------

class TestStores:
    async def test_admin_can_create_store(self, client: AsyncClient, admin: User):
        response = await client.post(
            "/api/v1/retail/stores", headers=auth_header(admin), json=STORE_PAYLOAD,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Main Street Store"

    async def test_list_stores(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/retail/stores", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_secondary_cannot_create_store(self, client: AsyncClient, secondary_user: User):
        response = await client.post(
            "/api/v1/retail/stores", headers=auth_header(secondary_user), json=STORE_PAYLOAD,
        )
        assert response.status_code == 403

    async def test_get_store(self, client: AsyncClient, admin: User):
        create = await client.post(
            "/api/v1/retail/stores", headers=auth_header(admin),
            json={**STORE_PAYLOAD, "name": "Get Store", "code": "GET-ST"},
        )
        store_id = create.json()["id"]
        response = await client.get(f"/api/v1/retail/stores/{store_id}", headers=auth_header(admin))
        assert response.status_code == 200
        assert response.json()["id"] == store_id

    async def test_update_store(self, client: AsyncClient, admin: User):
        create = await client.post(
            "/api/v1/retail/stores", headers=auth_header(admin),
            json={**STORE_PAYLOAD, "name": "Update Store", "code": "UPD-ST"},
        )
        store_id = create.json()["id"]
        response = await client.put(
            f"/api/v1/retail/stores/{store_id}",
            headers=auth_header(admin),
            json={"address": "456 New Road"},
        )
        assert response.status_code == 200
        assert response.json()["address"] == "456 New Road"


# ---------------------------------------------------------------------------
# Sales
# ---------------------------------------------------------------------------

class TestSales:
    async def test_list_sales(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/retail/sales", headers=auth_header(primary_user))
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    async def test_create_sale(
        self, client: AsyncClient, primary_user: User, store: Store, product: Product
    ):
        response = await client.post(
            "/api/v1/retail/sales",
            headers=auth_header(primary_user),
            json={
                "store_id": store.id,
                "sale_date": "2026-05-15",
                "payment_method": "cash",
                "discount_amount": 0.0,
                "amount_tendered": 200.0,
                "loyalty_points_used": 0,
                "currency": "INR",
                "items": [
                    {
                        "product_id": product.id,
                        "quantity": 1.0,
                        "unit_price": 150.0,
                        "discount_pct": 0.0,
                    }
                ],
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["store_id"] == store.id
        assert data["status"] in ("completed", "draft")

    async def test_secondary_cannot_create_sale(
        self, client: AsyncClient, secondary_user: User, store: Store, product: Product
    ):
        response = await client.post(
            "/api/v1/retail/sales",
            headers=auth_header(secondary_user),
            json={
                "store_id": store.id,
                "sale_date": "2026-05-15",
                "payment_method": "cash",
                "discount_amount": 0.0,
                "amount_tendered": 200.0,
                "loyalty_points_used": 0,
                "currency": "INR",
                "items": [{"product_id": product.id, "quantity": 1.0, "unit_price": 150.0, "discount_pct": 0.0}],
            },
        )
        assert response.status_code == 403

    async def test_get_sale(
        self, client: AsyncClient, primary_user: User, store: Store, product: Product
    ):
        create = await client.post(
            "/api/v1/retail/sales",
            headers=auth_header(primary_user),
            json={
                "store_id": store.id,
                "sale_date": "2026-05-15",
                "payment_method": "upi",
                "discount_amount": 0.0,
                "amount_tendered": 177.0,
                "loyalty_points_used": 0,
                "currency": "INR",
                "items": [{"product_id": product.id, "quantity": 1.0, "unit_price": 150.0, "discount_pct": 0.0}],
            },
        )
        sale_id = create.json()["id"]
        response = await client.get(f"/api/v1/retail/sales/{sale_id}", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert response.json()["id"] == sale_id


# ---------------------------------------------------------------------------
# Promotions
# ---------------------------------------------------------------------------

class TestPromotions:
    async def test_list_promotions(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/retail/promotions", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_admin_can_create_promotion(self, client: AsyncClient, admin: User):
        response = await client.post(
            "/api/v1/retail/promotions",
            headers=auth_header(admin),
            json={
                "name": "Summer Sale",
                "code": "SUMMER26",
                "promo_type": "percent_discount",
                "discount_value": 10.0,
                "start_date": "2026-06-01",
                "end_date": "2026-06-30",
                "is_active": True,
                "min_purchase": 500.0,
            },
        )
        assert response.status_code == 201
        assert response.json()["name"] == "Summer Sale"
