"""Increase tenants.gstin from VARCHAR(15) to VARCHAR(50)

Revision ID: 0006_gstin_varchar50
Revises: 0005_billing_periods
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_gstin_varchar50"
down_revision = "0005_billing_periods"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "tenants", "gstin",
        existing_type=sa.String(15),
        type_=sa.String(50),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "tenants", "gstin",
        existing_type=sa.String(50),
        type_=sa.String(15),
        existing_nullable=True,
    )
