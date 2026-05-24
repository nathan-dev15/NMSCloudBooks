import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, create_access_token
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.inventory import ProductCategory, Warehouse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def auth_header(user: User) -> dict:
    token = create_access_token(user.id, extra={"role": user.role.value, "tenant_id": user.tenant_id})
    return {"Authorization": f"Bearer {token}"}


PRODUCT_PAYLOAD = {
    "name": "Steel Bar 10mm",
    "sku": "STL-BAR-10",
    "product_type": "goods",
    "unit": "kg",
    "purchase_price": 70.0,
    "selling_price": 85.0,
    "mrp": 90.0,
    "tax_rate": 18.0,
    "reorder_level": 100.0,
    "reorder_qty": 500.0,
    "track_inventory": True,
    "allow_negative": False,
    "tags": [],
    "attributes": {},
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def tenant(db_session: AsyncSession) -> Tenant:
    t = Tenant(name="Inventory Corp", slug="inventory-corp", enabled_modules=["inventory"])
    db_session.add(t)
    await db_session.flush()
    await db_session.refresh(t)
    return t


@pytest.fixture
async def admin(db_session: AsyncSession, tenant: Tenant) -> User:
    u = User(
        email="admin@inventory.com", full_name="Admin",
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
        email="primary@inventory.com", full_name="Primary",
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
        email="secondary@inventory.com", full_name="Secondary",
        hashed_password=hash_password("Password123"),
        role=UserRole.SECONDARY_USER, is_active=True, is_verified=True,
        tenant_id=tenant.id,
    )
    db_session.add(u)
    await db_session.flush()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def warehouse(db_session: AsyncSession, tenant: Tenant) -> Warehouse:
    w = Warehouse(
        tenant_id=tenant.id,
        name="Main Warehouse",
        code="MAIN-WH",
        is_active=True,
        is_default=True,
    )
    db_session.add(w)
    await db_session.flush()
    await db_session.refresh(w)
    return w


@pytest.fixture
async def category(db_session: AsyncSession, tenant: Tenant) -> ProductCategory:
    c = ProductCategory(
        tenant_id=tenant.id,
        name="Steel",
        slug="steel",
        is_active=True,
    )
    db_session.add(c)
    await db_session.flush()
    await db_session.refresh(c)
    return c


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

class TestCategories:
    async def test_list_categories(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/inventory/categories", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_admin_can_create_category(self, client: AsyncClient, admin: User):
        response = await client.post(
            "/api/v1/inventory/categories",
            headers=auth_header(admin),
            json={"name": "Hardware", "slug": "hardware", "is_active": True},
        )
        assert response.status_code == 201
        assert response.json()["name"] == "Hardware"

    async def test_secondary_cannot_create_category(self, client: AsyncClient, secondary_user: User):
        response = await client.post(
            "/api/v1/inventory/categories",
            headers=auth_header(secondary_user),
            json={"name": "Blocked", "slug": "blocked"},
        )
        assert response.status_code == 403

    async def test_invalid_slug_rejected(self, client: AsyncClient, admin: User):
        response = await client.post(
            "/api/v1/inventory/categories",
            headers=auth_header(admin),
            json={"name": "Bad Slug", "slug": "BAD SLUG!"},
        )
        assert response.status_code == 422

    async def test_delete_category(self, client: AsyncClient, admin: User):
        create = await client.post(
            "/api/v1/inventory/categories",
            headers=auth_header(admin),
            json={"name": "To Delete", "slug": "to-delete"},
        )
        cat_id = create.json()["id"]
        response = await client.delete(f"/api/v1/inventory/categories/{cat_id}", headers=auth_header(admin))
        assert response.status_code == 204


# ---------------------------------------------------------------------------
# Warehouses
# ---------------------------------------------------------------------------

class TestWarehouses:
    async def test_list_warehouses(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/inventory/warehouses", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_admin_can_create_warehouse(self, client: AsyncClient, admin: User):
        response = await client.post(
            "/api/v1/inventory/warehouses",
            headers=auth_header(admin),
            json={"name": "North Warehouse", "code": "NORTH-WH", "is_active": True, "is_default": False},
        )
        assert response.status_code == 201
        assert response.json()["name"] == "North Warehouse"

    async def test_secondary_cannot_create_warehouse(self, client: AsyncClient, secondary_user: User):
        response = await client.post(
            "/api/v1/inventory/warehouses",
            headers=auth_header(secondary_user),
            json={"name": "Blocked WH", "code": "BLK-WH"},
        )
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

class TestProducts:
    async def test_list_products(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/inventory/products", headers=auth_header(primary_user))
        assert response.status_code == 200
        data = response.json()
        assert "items" in data and "total" in data

    async def test_primary_can_create_product(self, client: AsyncClient, primary_user: User):
        response = await client.post(
            "/api/v1/inventory/products",
            headers=auth_header(primary_user),
            json=PRODUCT_PAYLOAD,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Steel Bar 10mm"
        assert data["sku"] == "STL-BAR-10"

    async def test_secondary_cannot_create_product(self, client: AsyncClient, secondary_user: User):
        response = await client.post(
            "/api/v1/inventory/products",
            headers=auth_header(secondary_user),
            json=PRODUCT_PAYLOAD,
        )
        assert response.status_code == 403

    async def test_get_product(self, client: AsyncClient, primary_user: User):
        create = await client.post(
            "/api/v1/inventory/products",
            headers=auth_header(primary_user),
            json={**PRODUCT_PAYLOAD, "name": "Get Product", "sku": "GET-PRD"},
        )
        prod_id = create.json()["id"]
        response = await client.get(f"/api/v1/inventory/products/{prod_id}", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert response.json()["id"] == prod_id

    async def test_update_product(self, client: AsyncClient, primary_user: User):
        create = await client.post(
            "/api/v1/inventory/products",
            headers=auth_header(primary_user),
            json={**PRODUCT_PAYLOAD, "name": "Update Product", "sku": "UPD-PRD"},
        )
        prod_id = create.json()["id"]
        response = await client.put(
            f"/api/v1/inventory/products/{prod_id}",
            headers=auth_header(primary_user),
            json={"selling_price": 95.0},
        )
        assert response.status_code == 200
        assert response.json()["selling_price"] == 95.0

    async def test_delete_product(self, client: AsyncClient, admin: User, primary_user: User):
        create = await client.post(
            "/api/v1/inventory/products",
            headers=auth_header(primary_user),
            json={**PRODUCT_PAYLOAD, "name": "Delete Product", "sku": "DEL-PRD"},
        )
        prod_id = create.json()["id"]
        response = await client.delete(
            f"/api/v1/inventory/products/{prod_id}", headers=auth_header(admin),
        )
        assert response.status_code == 204

    async def test_search_products(self, client: AsyncClient, primary_user: User):
        await client.post(
            "/api/v1/inventory/products",
            headers=auth_header(primary_user),
            json={**PRODUCT_PAYLOAD, "name": "Searchable Steel Rod", "sku": "SRCH-ROD"},
        )
        response = await client.get(
            "/api/v1/inventory/products?search=Searchable",
            headers=auth_header(primary_user),
        )
        assert response.status_code == 200
        names = [p["name"] for p in response.json()["items"]]
        assert any("Searchable" in n for n in names)


# ---------------------------------------------------------------------------
# Stock adjustments
# ---------------------------------------------------------------------------

class TestStockAdjustments:
    async def test_stock_in(self, client: AsyncClient, primary_user: User, warehouse: Warehouse):
        product = await client.post(
            "/api/v1/inventory/products",
            headers=auth_header(primary_user),
            json={**PRODUCT_PAYLOAD, "name": "Stock Product", "sku": "STK-PRD"},
        )
        prod_id = product.json()["id"]
        response = await client.post(
            f"/api/v1/inventory/products/{prod_id}/stock/adjust",
            headers=auth_header(primary_user),
            json={
                "warehouse_id": warehouse.id,
                "txn_type": "opening_stock",
                "qty": 200.0,
                "unit_cost": 70.0,
                "notes": "Initial stock",
            },
        )
        assert response.status_code == 200

    async def test_view_stock_transactions(self, client: AsyncClient, primary_user: User, warehouse: Warehouse):
        product = await client.post(
            "/api/v1/inventory/products",
            headers=auth_header(primary_user),
            json={**PRODUCT_PAYLOAD, "name": "Txn Product", "sku": "TXN-PRD"},
        )
        prod_id = product.json()["id"]
        response = await client.get(
            f"/api/v1/inventory/products/{prod_id}/stock/transactions",
            headers=auth_header(primary_user),
        )
        assert response.status_code == 200
        assert "items" in response.json()


# ---------------------------------------------------------------------------
# Low-stock report
# ---------------------------------------------------------------------------

class TestLowStockReport:
    async def test_low_stock_accessible(self, client: AsyncClient, primary_user: User):
        response = await client.get("/api/v1/inventory/reports/low-stock", headers=auth_header(primary_user))
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_unauthenticated_cannot_access_report(self, client: AsyncClient):
        response = await client.get("/api/v1/inventory/reports/low-stock")
        assert response.status_code == 403
