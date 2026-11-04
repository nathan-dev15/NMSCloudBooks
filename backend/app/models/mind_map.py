import enum

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, JSON,
    String, Text, UniqueConstraint, func, text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin


class MindMap(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "mind_maps"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    tenant_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    nodes: Mapped[list["MindMapNode"]] = relationship(
        back_populates="mind_map", cascade="all, delete-orphan", lazy="selectin",
    )
    edges: Mapped[list["MindMapEdge"]] = relationship(
        back_populates="mind_map", cascade="all, delete-orphan", lazy="selectin",
    )


class MindMapNode(Base, TimestampMixin):
    __tablename__ = "mind_map_nodes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    mind_map_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("mind_maps.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    parent_node_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("mind_map_nodes.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="New Node")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    position_x: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    position_y: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    color: Mapped[str | None] = mapped_column(String(50), nullable=True)
    style_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_collapsed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    mind_map: Mapped["MindMap"] = relationship(back_populates="nodes")


class MindMapEdge(Base):
    __tablename__ = "mind_map_edges"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    mind_map_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("mind_maps.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    source_node_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("mind_map_nodes.id", ondelete="CASCADE"), nullable=False,
    )
    target_node_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("mind_map_nodes.id", ondelete="CASCADE"), nullable=False,
    )
    edge_type: Mapped[str] = mapped_column(String(50), nullable=False, default="default")
    style_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    mind_map: Mapped["MindMap"] = relationship(back_populates="edges")

    __table_args__ = (
        UniqueConstraint("mind_map_id", "source_node_id", "target_node_id", name="uq_edge_src_tgt"),
    )


class MindMapActivityLog(Base):
    __tablename__ = "mind_map_activity_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    mind_map_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("mind_maps.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("user_accounts.id", ondelete="SET NULL"), nullable=True,
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    old_value: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    new_value: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
