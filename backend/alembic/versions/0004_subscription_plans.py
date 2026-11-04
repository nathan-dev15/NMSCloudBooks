"""Add dynamic tenant_subscription_plans table and migrate tenant plan FK

Revision ID: 0004_subscription_plans
Revises: 0003_align_to_sql_spec
Create Date: 2026-05-25

Changes:
  - Creates tenant_subscription_plans table with 5 seeded default plans
  - Adds subscription_plan_id FK to tenants
  - Migrates existing tenants from old plan string to new FK
  - Drops old plan column from tenants

Note: Idempotent — handles the case where tenant_subscription_plans was
pre-created by SQLAlchemy create_all before migrations were stamped.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "0004_subscription_plans"
down_revision = "0003_align_to_sql_spec"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    return op.get_bind().execute(
        sa.text(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = current_schema() AND table_name = :t)"
        ),
        {"t": name},
    ).scalar()


def _column_exists(table: str, column: str) -> bool:
    return op.get_bind().execute(
        sa.text(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = current_schema() "
            "AND table_name = :t AND column_name = :c)"
        ),
        {"t": table, "c": column},
    ).scalar()


def upgrade() -> None:
    # ── 1. Create tenant_subscription_plans table (skip if already exists) ──
    if not _table_exists("tenant_subscription_plans"):
        op.create_table(
            "tenant_subscription_plans",
            sa.Column("id",               sa.Integer(),       primary_key=True, autoincrement=True),
            sa.Column("name",             sa.String(100),     nullable=False, unique=True),
            sa.Column("slug",             sa.String(50),      nullable=False, unique=True),
            sa.Column("description",      sa.Text(),          nullable=True),
            sa.Column("price_monthly",    sa.Numeric(10, 2),  nullable=False, server_default="0"),
            sa.Column("price_yearly",     sa.Numeric(10, 2),  nullable=False, server_default="0"),
            sa.Column("max_users",        sa.Integer(),       nullable=True),
            sa.Column("max_companies",    sa.Integer(),       nullable=True),
            sa.Column("enabled_modules",  sa.JSON(),          nullable=False, server_default="[]"),
            sa.Column("features",         sa.JSON(),          nullable=False, server_default="[]"),
            sa.Column("is_active",        sa.Boolean(),       nullable=False, server_default="true"),
            sa.Column("display_order",    sa.Integer(),       nullable=False, server_default="0"),
            sa.Column("created_date",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_date",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("created_by",       sa.BigInteger(),    nullable=True),
            sa.Column("updated_by",       sa.BigInteger(),    nullable=True),
        )
        op.create_index("ix_tenant_sub_plans_slug", "tenant_subscription_plans", ["slug"])

    # ── 2. Seed 5 default plans (skip if plans already exist) ───────────────
    plan_count = op.get_bind().execute(
        sa.text("SELECT COUNT(*) FROM tenant_subscription_plans")
    ).scalar()

    if plan_count == 0:
        op.execute(text("""
            INSERT INTO tenant_subscription_plans
                (name, slug, description, price_monthly, price_yearly, max_users, max_companies,
                 enabled_modules, features, is_active, display_order)
            VALUES
                ('Starter',    'starter',    'For small teams getting started',
                 9.00,   90.00,   5,    1,
                 '["general"]',
                 '["Basic invoicing","1 company","5 users","Email support"]',
                 TRUE, 1),

                ('Basic',      'basic',      'For growing businesses',
                 29.00,  290.00,  10,   3,
                 '["general","retail"]',
                 '["All invoicing","3 companies","10 users","Priority support"]',
                 TRUE, 2),

                ('Pro',        'pro',        'For established businesses',
                 79.00,  790.00,  25,   10,
                 '["general","retail","civil"]',
                 '["All modules","10 companies","25 users","Phone support","Custom branding"]',
                 TRUE, 3),

                ('Enterprise', 'enterprise', 'For large organisations',
                 199.00, 1990.00, NULL, NULL,
                 '["general","retail","civil","agriculture"]',
                 '["All modules","Unlimited companies","Unlimited users","Dedicated support","SLA guarantee"]',
                 TRUE, 4),

                ('Custom',     'custom',     'Tailored plan — contact sales',
                 0.00,   0.00,    NULL, NULL,
                 '["general","retail","civil","agriculture"]',
                 '["Custom pricing","Custom limits","Dedicated account manager","White-label option"]',
                 TRUE, 5)
        """))

    # ── 3. Add subscription_plan_id FK to tenants (skip if already exists) ──
    if not _column_exists("tenants", "subscription_plan_id"):
        op.add_column(
            "tenants",
            sa.Column(
                "subscription_plan_id",
                sa.Integer(),
                sa.ForeignKey("tenant_subscription_plans.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index("ix_tenants_subscription_plan_id", "tenants", ["subscription_plan_id"])

    # ── 4. Migrate existing tenants: map old plan string → new FK ───────────
    if _column_exists("tenants", "plan"):
        op.execute(text("""
            UPDATE tenants
            SET subscription_plan_id = sp.id
            FROM tenant_subscription_plans sp
            WHERE tenants.plan::text = sp.slug
        """))

        # Any tenant whose old plan value doesn't match maps to starter
        op.execute(text("""
            UPDATE tenants
            SET subscription_plan_id = (
                SELECT id FROM tenant_subscription_plans WHERE slug = 'starter' LIMIT 1
            )
            WHERE subscription_plan_id IS NULL
        """))

    # ── 5. Drop old plan column (skip if already dropped) ───────────────────
    if _column_exists("tenants", "plan"):
        op.drop_column("tenants", "plan")


def downgrade() -> None:
    # Re-add plan column
    op.add_column(
        "tenants",
        sa.Column("plan", sa.String(50), nullable=False, server_default="basic"),
    )

    # Restore plan string from FK
    op.execute(text("""
        UPDATE tenants
        SET plan = sp.slug
        FROM tenant_subscription_plans sp
        WHERE tenants.subscription_plan_id = sp.id
    """))

    # Drop FK column
    op.drop_index("ix_tenants_subscription_plan_id", table_name="tenants")
    op.drop_column("tenants", "subscription_plan_id")

    # Drop tenant_subscription_plans table
    op.drop_index("ix_tenant_sub_plans_slug", table_name="tenant_subscription_plans")
    op.drop_table("tenant_subscription_plans")
