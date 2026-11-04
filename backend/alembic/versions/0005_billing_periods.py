"""Add billing period fields to plans and tenants

Revision ID: 0005_billing_periods
Revises: 0004_subscription_plans
Create Date: 2026-05-25

Changes:
  - Adds price_quarterly and trial_days columns to tenant_subscription_plans
  - Adds billing_period column to tenants
  - Updates seeded plans with quarterly prices and 30-day trial
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "0005_billing_periods"
down_revision = "0004_subscription_plans"
branch_labels = None
depends_on = None


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
    # ── 1. Add price_quarterly to tenant_subscription_plans ─────────────────
    if not _column_exists("tenant_subscription_plans", "price_quarterly"):
        op.add_column(
            "tenant_subscription_plans",
            sa.Column("price_quarterly", sa.Numeric(10, 2), nullable=False, server_default="0"),
        )

    # ── 2. Add trial_days to tenant_subscription_plans ───────────────────────
    if not _column_exists("tenant_subscription_plans", "trial_days"):
        op.add_column(
            "tenant_subscription_plans",
            sa.Column("trial_days", sa.Integer(), nullable=False, server_default="30"),
        )

    # ── 3. Add billing_period to tenants ────────────────────────────────────
    if not _column_exists("tenants", "billing_period"):
        op.add_column(
            "tenants",
            sa.Column("billing_period", sa.String(20), nullable=True),
        )

    # ── 4. Seed quarterly prices for default plans ───────────────────────────
    # quarterly = monthly * 3 with a small discount (save ~8%)
    op.execute(text("""
        UPDATE tenant_subscription_plans SET
            price_quarterly = CASE slug
                WHEN 'starter'    THEN  25.00
                WHEN 'basic'      THEN  79.00
                WHEN 'pro'        THEN 215.00
                WHEN 'enterprise' THEN 540.00
                WHEN 'custom'     THEN   0.00
                ELSE price_quarterly
            END,
            trial_days = 30
        WHERE slug IN ('starter', 'basic', 'pro', 'enterprise', 'custom')
    """))


def downgrade() -> None:
    if _column_exists("tenants", "billing_period"):
        op.drop_column("tenants", "billing_period")

    if _column_exists("tenant_subscription_plans", "trial_days"):
        op.drop_column("tenant_subscription_plans", "trial_days")

    if _column_exists("tenant_subscription_plans", "price_quarterly"):
        op.drop_column("tenant_subscription_plans", "price_quarterly")
