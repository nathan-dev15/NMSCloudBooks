"""initial schema — all tables

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-20

Creates every table in dependency order:
  tenants → users → audit_logs
  clients → client_contacts → client_communications
  product_categories → warehouses → products → inventory_levels → stock_transactions
  invoices → invoice_items → invoice_payments
  purchase_orders → po_items
  civil: projects, project_plans, blocks, allocations, material_catalog,
         stocks, stock_movements, material_requests, material_request_items,
         work_orders, daily_activities, weekly_bills
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Tenants ───────────────────────────────────────────────────────────────
    op.create_table(
        "tenants",
        sa.Column("id",              sa.Integer(),    primary_key=True),
        sa.Column("name",            sa.String(255),  nullable=False),
        sa.Column("slug",            sa.String(100),  nullable=False, unique=True),
        sa.Column("plan",            sa.String(50),   nullable=False, server_default="starter"),
        sa.Column("is_active",       sa.Boolean(),    nullable=False, server_default="true"),
        sa.Column("enabled_modules", sa.JSON(),       nullable=False, server_default="[]"),
        sa.Column("branding",        sa.JSON(),       nullable=False, server_default="{}"),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",      sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── Users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id",             sa.Integer(),   primary_key=True),
        sa.Column("tenant_id",      sa.Integer(),   sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("email",          sa.String(255), nullable=False, unique=True),
        sa.Column("full_name",      sa.String(255), nullable=False),
        sa.Column("hashed_password",sa.String(255), nullable=False),
        sa.Column("role",           sa.String(50),  nullable=False),
        sa.Column("is_active",      sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until",   sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at",     sa.DateTime(timezone=True), nullable=True),
    )

    # ── Audit Logs ─────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id",         sa.Integer(),    primary_key=True),
        sa.Column("tenant_id",  sa.Integer(),    sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("user_id",    sa.Integer(),    sa.ForeignKey("users.id",   ondelete="SET NULL"), nullable=True),
        sa.Column("action",     sa.String(100),  nullable=False),
        sa.Column("resource",   sa.String(100),  nullable=True),
        sa.Column("resource_id",sa.Integer(),    nullable=True),
        sa.Column("old_data",   sa.JSON(),       nullable=True),
        sa.Column("new_data",   sa.JSON(),       nullable=True),
        sa.Column("ip_address", sa.String(45),   nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Clients ───────────────────────────────────────────────────────────────
    op.create_table(
        "clients",
        sa.Column("id",           sa.Integer(),    primary_key=True),
        sa.Column("tenant_id",    sa.Integer(),    sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_by_id",sa.Integer(),    sa.ForeignKey("users.id",   ondelete="SET NULL"), nullable=True),
        sa.Column("display_name", sa.String(255),  nullable=False, index=True),
        sa.Column("client_code",  sa.String(50),   nullable=True,  index=True),
        sa.Column("client_type",  sa.String(20),   nullable=False, server_default="company"),
        sa.Column("segment",      sa.String(20),   nullable=False, server_default="standard"),
        sa.Column("is_active",    sa.Boolean(),    nullable=False, server_default="true"),
        sa.Column("email",        sa.String(255),  nullable=True,  index=True),
        sa.Column("phone",        sa.String(20),   nullable=True),
        sa.Column("alt_phone",    sa.String(20),   nullable=True),
        sa.Column("website",      sa.String(255),  nullable=True),
        sa.Column("address_line1",sa.String(255),  nullable=True),
        sa.Column("address_line2",sa.String(255),  nullable=True),
        sa.Column("city",         sa.String(100),  nullable=True,  index=True),
        sa.Column("state",        sa.String(100),  nullable=True),
        sa.Column("pincode",      sa.String(10),   nullable=True),
        sa.Column("country",      sa.String(100),  nullable=False, server_default="India"),
        sa.Column("gstin",        sa.String(15),   nullable=True,  index=True),
        sa.Column("pan",          sa.String(10),   nullable=True),
        sa.Column("credit_limit", sa.Numeric(15,2),nullable=True),
        sa.Column("credit_days",  sa.Integer(),    nullable=True),
        sa.Column("currency",     sa.String(3),    nullable=False, server_default="INR"),
        sa.Column("outstanding_balance", sa.Numeric(15,2), nullable=False, server_default="0"),
        sa.Column("notes",        sa.Text(),       nullable=True),
        sa.Column("tags",         sa.JSON(),       nullable=False, server_default="[]"),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at",   sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "client_contacts",
        sa.Column("id",          sa.Integer(),   primary_key=True),
        sa.Column("client_id",   sa.Integer(),   sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name",        sa.String(255), nullable=False),
        sa.Column("designation", sa.String(100), nullable=True),
        sa.Column("email",       sa.String(255), nullable=True),
        sa.Column("phone",       sa.String(20),  nullable=True),
        sa.Column("is_primary",  sa.Boolean(),   nullable=False, server_default="false"),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "client_communications",
        sa.Column("id",            sa.Integer(),   primary_key=True),
        sa.Column("client_id",     sa.Integer(),   sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("logged_by_id",  sa.Integer(),   sa.ForeignKey("users.id",   ondelete="SET NULL"), nullable=True),
        sa.Column("comm_type",     sa.String(20),  nullable=False),
        sa.Column("subject",       sa.String(255), nullable=False),
        sa.Column("body",          sa.Text(),      nullable=True),
        sa.Column("outcome",       sa.String(255), nullable=True),
        sa.Column("follow_up_date",sa.String(20),  nullable=True),
        sa.Column("created_at",    sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",    sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Invoices ──────────────────────────────────────────────────────────────
    op.create_table(
        "invoices",
        sa.Column("id",               sa.Integer(),    primary_key=True),
        sa.Column("tenant_id",        sa.Integer(),    sa.ForeignKey("tenants.id",  ondelete="CASCADE"),  nullable=False, index=True),
        sa.Column("client_id",        sa.Integer(),    sa.ForeignKey("clients.id",  ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("created_by_id",    sa.Integer(),    sa.ForeignKey("users.id",    ondelete="SET NULL"), nullable=True),
        sa.Column("invoice_number",   sa.String(50),   nullable=False, unique=True, index=True),
        sa.Column("reference_no",     sa.String(100),  nullable=True),
        sa.Column("invoice_date",     sa.String(10),   nullable=False),
        sa.Column("due_date",         sa.String(10),   nullable=False),
        sa.Column("supply_date",      sa.String(10),   nullable=True),
        sa.Column("status",           sa.String(20),   nullable=False, server_default="draft", index=True),
        sa.Column("gst_type",         sa.String(20),   nullable=False, server_default="cgst_sgst"),
        sa.Column("place_of_supply",  sa.String(50),   nullable=True),
        sa.Column("currency",         sa.String(3),    nullable=False, server_default="INR"),
        sa.Column("subtotal",         sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("discount_amount",  sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("taxable_amount",   sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("cgst_amount",      sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("sgst_amount",      sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("igst_amount",      sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("total_tax_amount", sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("round_off",        sa.Numeric(5,2), nullable=False, server_default="0"),
        sa.Column("grand_total",      sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("amount_paid",      sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("amount_due",       sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("billing_name",     sa.String(255),  nullable=True),
        sa.Column("billing_address",  sa.Text(),       nullable=True),
        sa.Column("billing_gstin",    sa.String(15),   nullable=True),
        sa.Column("notes",            sa.Text(),       nullable=True),
        sa.Column("terms",            sa.Text(),       nullable=True),
        sa.Column("is_recurring",     sa.Boolean(),    nullable=False, server_default="false"),
        sa.Column("tags",             sa.JSON(),       nullable=False, server_default="[]"),
        sa.Column("created_at",       sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",       sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "invoice_items",
        sa.Column("id",             sa.Integer(),    primary_key=True),
        sa.Column("invoice_id",     sa.Integer(),    sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_order",     sa.Integer(),    nullable=False, server_default="0"),
        sa.Column("description",    sa.String(500),  nullable=False),
        sa.Column("hsn_sac",        sa.String(20),   nullable=True),
        sa.Column("unit",           sa.String(20),   nullable=True),
        sa.Column("quantity",       sa.Numeric(15,3),nullable=False),
        sa.Column("rate",           sa.Numeric(15,2),nullable=False),
        sa.Column("discount_pct",   sa.Numeric(5,2), nullable=False, server_default="0"),
        sa.Column("taxable_amount", sa.Numeric(15,2),nullable=False),
        sa.Column("gst_rate",       sa.Numeric(5,2), nullable=False, server_default="18"),
        sa.Column("cgst_rate",      sa.Numeric(5,2), nullable=False, server_default="0"),
        sa.Column("sgst_rate",      sa.Numeric(5,2), nullable=False, server_default="0"),
        sa.Column("igst_rate",      sa.Numeric(5,2), nullable=False, server_default="0"),
        sa.Column("cgst_amount",    sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("sgst_amount",    sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("igst_amount",    sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("line_total",     sa.Numeric(15,2),nullable=False),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "invoice_payments",
        sa.Column("id",              sa.Integer(),    primary_key=True),
        sa.Column("invoice_id",      sa.Integer(),    sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("recorded_by_id",  sa.Integer(),    sa.ForeignKey("users.id",   ondelete="SET NULL"), nullable=True),
        sa.Column("payment_date",    sa.String(10),   nullable=False),
        sa.Column("amount",          sa.Numeric(15,2),nullable=False),
        sa.Column("mode",            sa.String(20),   nullable=False, server_default="bank"),
        sa.Column("reference",       sa.String(100),  nullable=True),
        sa.Column("notes",           sa.String(500),  nullable=True),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Purchase Orders ───────────────────────────────────────────────────────
    op.create_table(
        "purchase_orders",
        sa.Column("id",                     sa.Integer(),    primary_key=True),
        sa.Column("tenant_id",              sa.Integer(),    sa.ForeignKey("tenants.id", ondelete="CASCADE"),   nullable=False, index=True),
        sa.Column("vendor_id",              sa.Integer(),    sa.ForeignKey("clients.id", ondelete="SET NULL"),  nullable=True,  index=True),
        sa.Column("created_by_id",          sa.Integer(),    sa.ForeignKey("users.id",   ondelete="SET NULL"),  nullable=True),
        sa.Column("approved_by_id",         sa.Integer(),    sa.ForeignKey("users.id",   ondelete="SET NULL"),  nullable=True),
        sa.Column("po_number",              sa.String(50),   nullable=False, unique=True, index=True),
        sa.Column("reference_no",           sa.String(100),  nullable=True),
        sa.Column("order_date",             sa.String(10),   nullable=False),
        sa.Column("expected_date",          sa.String(10),   nullable=True),
        sa.Column("approved_date",          sa.String(10),   nullable=True),
        sa.Column("received_date",          sa.String(10),   nullable=True),
        sa.Column("status",                 sa.String(20),   nullable=False, server_default="draft", index=True),
        sa.Column("priority",               sa.String(20),   nullable=False, server_default="medium"),
        sa.Column("vendor_name",            sa.String(255),  nullable=True),
        sa.Column("vendor_address",         sa.Text(),       nullable=True),
        sa.Column("vendor_gstin",           sa.String(15),   nullable=True),
        sa.Column("currency",               sa.String(3),    nullable=False, server_default="INR"),
        sa.Column("subtotal",               sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("tax_amount",             sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("discount_amount",        sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("grand_total",            sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("amount_received_value",  sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("delivery_address",       sa.Text(),       nullable=True),
        sa.Column("shipping_terms",         sa.String(255),  nullable=True),
        sa.Column("payment_terms",          sa.String(255),  nullable=True),
        sa.Column("notes",                  sa.Text(),       nullable=True),
        sa.Column("internal_notes",         sa.Text(),       nullable=True),
        sa.Column("rejection_reason",       sa.Text(),       nullable=True),
        sa.Column("tags",                   sa.JSON(),       nullable=False, server_default="[]"),
        sa.Column("created_at",             sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",             sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at",             sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "po_items",
        sa.Column("id",                sa.Integer(),    primary_key=True),
        sa.Column("purchase_order_id", sa.Integer(),    sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_order",        sa.Integer(),    nullable=False, server_default="0"),
        sa.Column("description",       sa.String(500),  nullable=False),
        sa.Column("sku",               sa.String(100),  nullable=True),
        sa.Column("hsn_sac",           sa.String(20),   nullable=True),
        sa.Column("unit",              sa.String(20),   nullable=True),
        sa.Column("quantity",          sa.Numeric(15,3),nullable=False),
        sa.Column("unit_price",        sa.Numeric(15,2),nullable=False),
        sa.Column("tax_rate",          sa.Numeric(5,2), nullable=False, server_default="0"),
        sa.Column("tax_amount",        sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("line_total",        sa.Numeric(15,2),nullable=False),
        sa.Column("qty_received",      sa.Numeric(15,3),nullable=False, server_default="0"),
        sa.Column("is_closed",         sa.Boolean(),    nullable=False, server_default="false"),
        sa.Column("created_at",        sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",        sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Inventory ─────────────────────────────────────────────────────────────
    op.create_table(
        "product_categories",
        sa.Column("id",          sa.Integer(),   primary_key=True),
        sa.Column("tenant_id",   sa.Integer(),   sa.ForeignKey("tenants.id",            ondelete="CASCADE"),  nullable=False, index=True),
        sa.Column("parent_id",   sa.Integer(),   sa.ForeignKey("product_categories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name",        sa.String(100), nullable=False),
        sa.Column("slug",        sa.String(100), nullable=False, index=True),
        sa.Column("description", sa.Text(),      nullable=True),
        sa.Column("is_active",   sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at",  sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_category_tenant_slug"),
    )

    op.create_table(
        "warehouses",
        sa.Column("id",         sa.Integer(),   primary_key=True),
        sa.Column("tenant_id",  sa.Integer(),   sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name",       sa.String(150), nullable=False),
        sa.Column("code",       sa.String(20),  nullable=True, index=True),
        sa.Column("address",    sa.Text(),      nullable=True),
        sa.Column("is_active",  sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("is_default", sa.Boolean(),   nullable=False, server_default="false"),
        sa.Column("manager_id", sa.Integer(),   sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "products",
        sa.Column("id",              sa.Integer(),    primary_key=True),
        sa.Column("tenant_id",       sa.Integer(),    sa.ForeignKey("tenants.id",          ondelete="CASCADE"),  nullable=False, index=True),
        sa.Column("category_id",     sa.Integer(),    sa.ForeignKey("product_categories.id",ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("name",            sa.String(255),  nullable=False, index=True),
        sa.Column("sku",             sa.String(100),  nullable=True,  index=True),
        sa.Column("barcode",         sa.String(100),  nullable=True,  index=True),
        sa.Column("hsn_sac",         sa.String(20),   nullable=True),
        sa.Column("description",     sa.Text(),       nullable=True),
        sa.Column("product_type",    sa.String(20),   nullable=False, server_default="goods"),
        sa.Column("status",          sa.String(20),   nullable=False, server_default="active", index=True),
        sa.Column("unit",            sa.String(20),   nullable=False, server_default="nos"),
        sa.Column("purchase_price",  sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("selling_price",   sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("mrp",             sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("tax_rate",        sa.Numeric(5,2), nullable=False, server_default="18"),
        sa.Column("reorder_level",   sa.Numeric(15,3),nullable=False, server_default="0"),
        sa.Column("reorder_qty",     sa.Numeric(15,3),nullable=False, server_default="0"),
        sa.Column("max_stock_level", sa.Numeric(15,3),nullable=False, server_default="0"),
        sa.Column("track_inventory", sa.Boolean(),    nullable=False, server_default="true"),
        sa.Column("allow_negative",  sa.Boolean(),    nullable=False, server_default="false"),
        sa.Column("brand",           sa.String(100),  nullable=True),
        sa.Column("tags",            sa.JSON(),       nullable=False, server_default="[]"),
        sa.Column("attributes",      sa.JSON(),       nullable=False, server_default="{}"),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at",      sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "inventory_levels",
        sa.Column("id",            sa.Integer(),    primary_key=True),
        sa.Column("product_id",    sa.Integer(),    sa.ForeignKey("products.id",   ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("warehouse_id",  sa.Integer(),    sa.ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("qty_on_hand",   sa.Numeric(15,3),nullable=False, server_default="0"),
        sa.Column("qty_reserved",  sa.Numeric(15,3),nullable=False, server_default="0"),
        sa.Column("qty_available", sa.Numeric(15,3),nullable=False, server_default="0"),
        sa.Column("created_at",    sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",    sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("product_id", "warehouse_id", name="uq_inv_level_product_warehouse"),
    )

    op.create_table(
        "stock_transactions",
        sa.Column("id",             sa.Integer(),    primary_key=True),
        sa.Column("tenant_id",      sa.Integer(),    sa.ForeignKey("tenants.id",   ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id",     sa.Integer(),    sa.ForeignKey("products.id",  ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("warehouse_id",   sa.Integer(),    sa.ForeignKey("warehouses.id",ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_by_id",  sa.Integer(),    sa.ForeignKey("users.id",     ondelete="SET NULL"),nullable=True),
        sa.Column("txn_type",       sa.String(30),   nullable=False, index=True),
        sa.Column("qty",            sa.Numeric(15,3),nullable=False),
        sa.Column("unit_cost",      sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("ref_type",       sa.String(50),   nullable=True),
        sa.Column("ref_id",         sa.Integer(),    nullable=True),
        sa.Column("notes",          sa.Text(),       nullable=True),
        sa.Column("batch_no",       sa.String(100),  nullable=True),
        sa.Column("expiry_date",    sa.String(10),   nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Civil module tables ───────────────────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id",          sa.Integer(),   primary_key=True),
        sa.Column("tenant_id",   sa.Integer(),   sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name",        sa.String(255), nullable=False),
        sa.Column("project_code",sa.String(50),  nullable=True),
        sa.Column("state",       sa.String(100), nullable=True),
        sa.Column("district",    sa.String(100), nullable=True),
        sa.Column("zone",        sa.String(100), nullable=True),
        sa.Column("client_id",   sa.Integer(),   sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active",   sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("created_by_id",sa.Integer(),  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes",       sa.Text(),      nullable=True),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at",  sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "project_plans",
        sa.Column("id",          sa.Integer(),   primary_key=True),
        sa.Column("project_id",  sa.Integer(),   sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name",        sa.String(255), nullable=False),
        sa.Column("description", sa.Text(),      nullable=True),
        sa.Column("is_active",   sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "blocks",
        sa.Column("id",             sa.Integer(),   primary_key=True),
        sa.Column("plan_id",        sa.Integer(),   sa.ForeignKey("project_plans.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name",           sa.String(255), nullable=False),
        sa.Column("block_code",     sa.String(50),  nullable=True),
        sa.Column("description",    sa.Text(),      nullable=True),
        sa.Column("progress_pct",   sa.Numeric(5,2),nullable=False, server_default="0"),
        sa.Column("is_active",      sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "material_catalog",
        sa.Column("id",          sa.Integer(),   primary_key=True),
        sa.Column("tenant_id",   sa.Integer(),   sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name",        sa.String(255), nullable=False),
        sa.Column("unit",        sa.String(20),  nullable=False, server_default="nos"),
        sa.Column("unit_cost",   sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("category",    sa.String(100), nullable=True),
        sa.Column("is_active",   sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "stocks",
        sa.Column("id",             sa.Integer(),    primary_key=True),
        sa.Column("project_id",     sa.Integer(),    sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("material_id",    sa.Integer(),    sa.ForeignKey("material_catalog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("qty_available",  sa.Numeric(15,3),nullable=False, server_default="0"),
        sa.Column("qty_reserved",   sa.Numeric(15,3),nullable=False, server_default="0"),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "material_requests",
        sa.Column("id",               sa.Integer(),   primary_key=True),
        sa.Column("tenant_id",        sa.Integer(),   sa.ForeignKey("tenants.id",   ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("project_id",       sa.Integer(),   sa.ForeignKey("projects.id",  ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("block_id",         sa.Integer(),   sa.ForeignKey("blocks.id",    ondelete="SET NULL"), nullable=True),
        sa.Column("requested_by_id",  sa.Integer(),   sa.ForeignKey("users.id",     ondelete="SET NULL"), nullable=True),
        sa.Column("approved_by_id",   sa.Integer(),   sa.ForeignKey("users.id",     ondelete="SET NULL"), nullable=True),
        sa.Column("status",           sa.String(20),  nullable=False, server_default="draft", index=True),
        sa.Column("stack_position",   sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("otp_hash",         sa.String(255), nullable=True),
        sa.Column("otp_expires_at",   sa.DateTime(timezone=True), nullable=True),
        sa.Column("otp_attempts",     sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("notes",            sa.Text(),      nullable=True),
        sa.Column("rejection_reason", sa.Text(),      nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",       sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "material_request_items",
        sa.Column("id",          sa.Integer(),    primary_key=True),
        sa.Column("request_id",  sa.Integer(),    sa.ForeignKey("material_requests.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("material_id", sa.Integer(),    sa.ForeignKey("material_catalog.id",  ondelete="CASCADE"), nullable=False),
        sa.Column("qty_requested",sa.Numeric(15,3),nullable=False),
        sa.Column("qty_issued",   sa.Numeric(15,3),nullable=False, server_default="0"),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "work_orders",
        sa.Column("id",          sa.Integer(),   primary_key=True),
        sa.Column("block_id",    sa.Integer(),   sa.ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title",       sa.String(255), nullable=False),
        sa.Column("description", sa.Text(),      nullable=True),
        sa.Column("status",      sa.String(20),  nullable=False, server_default="open"),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "daily_activities",
        sa.Column("id",          sa.Integer(),   primary_key=True),
        sa.Column("block_id",    sa.Integer(),   sa.ForeignKey("blocks.id",      ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("logged_by_id",sa.Integer(),   sa.ForeignKey("users.id",       ondelete="SET NULL"), nullable=True),
        sa.Column("work_order_id",sa.Integer(),  sa.ForeignKey("work_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("activity_date",sa.String(10), nullable=False),
        sa.Column("activity_type",sa.String(30), nullable=False),
        sa.Column("description", sa.Text(),      nullable=True),
        sa.Column("qty",         sa.Numeric(15,3),nullable=True),
        sa.Column("unit",        sa.String(20),  nullable=True),
        sa.Column("amount",      sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "weekly_bills",
        sa.Column("id",           sa.Integer(),    primary_key=True),
        sa.Column("block_id",     sa.Integer(),    sa.ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("bill_number",  sa.String(50),   nullable=False, unique=True),
        sa.Column("week_start",   sa.String(10),   nullable=False),
        sa.Column("week_end",     sa.String(10),   nullable=False),
        sa.Column("status",       sa.String(20),   nullable=False, server_default="draft"),
        sa.Column("labour_cost",  sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("material_cost",sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(15,2),nullable=False, server_default="0"),
        sa.Column("approved_by_id",sa.Integer(),   sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes",        sa.Text(),       nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Indexes
    op.create_index("ix_users_tenant_id",       "users",             ["tenant_id"])
    op.create_index("ix_projects_tenant_id",    "projects",          ["tenant_id"])
    op.create_index("ix_material_requests_status","material_requests",["status"])


def downgrade() -> None:
    # Drop in reverse dependency order
    for table in [
        "weekly_bills", "daily_activities", "work_orders",
        "material_request_items", "material_requests",
        "stocks", "material_catalog", "blocks", "project_plans", "projects",
        "stock_transactions", "inventory_levels", "products",
        "warehouses", "product_categories",
        "po_items", "purchase_orders",
        "invoice_payments", "invoice_items", "invoices",
        "client_communications", "client_contacts", "clients",
        "audit_logs", "users", "tenants",
    ]:
        op.drop_table(table)
