"""Create mind_maps, mind_map_nodes, mind_map_edges, mind_map_activity_logs

Revision ID: 0007_mind_maps
Revises: 0006_gstin_varchar50
Create Date: 2026-10-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_mind_maps"
down_revision = "0006_gstin_varchar50"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mind_maps",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("tenant_id", sa.BigInteger, sa.ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        # TimestampMixin
        sa.Column("created_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.BigInteger, nullable=True),
        sa.Column("updated_by", sa.BigInteger, nullable=True),
        # SoftDeleteMixin
        sa.Column("is_deleted", sa.Boolean, nullable=False, default=False, index=True),
        sa.Column("deleted_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.BigInteger, nullable=True),
    )

    op.create_table(
        "mind_map_nodes",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("mind_map_id", sa.BigInteger, sa.ForeignKey("mind_maps.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("parent_node_id", sa.BigInteger, sa.ForeignKey("mind_map_nodes.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("title", sa.String(255), nullable=False, server_default="New Node"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("position_x", sa.Float, nullable=False, server_default="0"),
        sa.Column("position_y", sa.Float, nullable=False, server_default="0"),
        sa.Column("color", sa.String(50), nullable=True),
        sa.Column("style_data", sa.JSON, nullable=True),
        sa.Column("is_collapsed", sa.Boolean, nullable=False, default=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        # TimestampMixin
        sa.Column("created_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.BigInteger, nullable=True),
        sa.Column("updated_by", sa.BigInteger, nullable=True),
    )

    op.create_table(
        "mind_map_edges",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("mind_map_id", sa.BigInteger, sa.ForeignKey("mind_maps.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("source_node_id", sa.BigInteger, sa.ForeignKey("mind_map_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_node_id", sa.BigInteger, sa.ForeignKey("mind_map_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("edge_type", sa.String(50), nullable=False, server_default="default"),
        sa.Column("style_data", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("mind_map_id", "source_node_id", "target_node_id", name="uq_edge_src_tgt"),
    )

    op.create_table(
        "mind_map_activity_logs",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("mind_map_id", sa.BigInteger, sa.ForeignKey("mind_maps.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("old_value", sa.JSON, nullable=True),
        sa.Column("new_value", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("mind_map_activity_logs")
    op.drop_table("mind_map_edges")
    op.drop_table("mind_map_nodes")
    op.drop_table("mind_maps")
