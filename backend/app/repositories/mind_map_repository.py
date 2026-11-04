from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.mind_map import MindMap, MindMapNode, MindMapEdge, MindMapActivityLog


class MindMapRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _active(self):
        return select(MindMap).where(MindMap.is_deleted == False)

    # ── Mind maps ────────────────────────────────────────────────────────────

    async def list_all(self) -> list[dict]:
        node_count = (
            select(
                MindMapNode.mind_map_id,
                func.count(MindMapNode.id).label("node_count"),
            )
            .group_by(MindMapNode.mind_map_id)
            .subquery()
        )
        stmt = (
            self._active()
            .outerjoin(node_count, MindMap.id == node_count.c.mind_map_id)
            .add_columns(func.coalesce(node_count.c.node_count, 0).label("node_count"))
            .order_by(MindMap.updated_at.desc())
        )
        result = await self.db.execute(stmt)
        return [
            {
                "id": m.id,
                "title": m.title,
                "description": m.description,
                "created_at": m.created_at,
                "updated_at": m.updated_at,
                "node_count": count,
            }
            for m, count in result.all()
        ]

    async def get_by_id(self, mind_map_id: int) -> MindMap | None:
        result = await self.db.execute(
            self._active()
            .where(MindMap.id == mind_map_id)
            .options(selectinload(MindMap.nodes), selectinload(MindMap.edges))
            .execution_options(populate_existing=True)
        )
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> MindMap:
        mm = MindMap(**kwargs)
        self.db.add(mm)
        await self.db.flush()
        await self.db.refresh(mm, attribute_names=["nodes", "edges"])
        return mm

    async def update(self, mm: MindMap, **kwargs) -> MindMap:
        for key, value in kwargs.items():
            if hasattr(mm, key):
                setattr(mm, key, value)
        await self.db.flush()
        await self.db.refresh(mm, attribute_names=["nodes", "edges"])
        return mm

    async def soft_delete(self, mm: MindMap) -> None:
        mm.soft_delete()
        await self.db.flush()

    # ── Nodes ────────────────────────────────────────────────────────────────

    async def get_node(self, node_id: int) -> MindMapNode | None:
        result = await self.db.execute(
            select(MindMapNode).where(MindMapNode.id == node_id)
        )
        return result.scalar_one_or_none()

    async def create_node(self, mind_map_id: int, **kwargs) -> MindMapNode:
        node = MindMapNode(mind_map_id=mind_map_id, **kwargs)
        self.db.add(node)
        await self.db.flush()
        await self.db.refresh(node)
        return node

    async def update_node(self, node: MindMapNode, **kwargs) -> MindMapNode:
        for key, value in kwargs.items():
            if hasattr(node, key):
                setattr(node, key, value)
        await self.db.flush()
        result = await self.db.execute(
            select(MindMapNode).where(MindMapNode.id == node.id)
            .execution_options(populate_existing=True)
        )
        return result.scalar_one()

    async def delete_node(self, node: MindMapNode) -> None:
        await self.db.execute(
            delete(MindMapEdge).where(
                (MindMapEdge.source_node_id == node.id) |
                (MindMapEdge.target_node_id == node.id)
            )
        )
        children_stmt = select(MindMapNode).where(MindMapNode.parent_node_id == node.id)
        children_res = await self.db.execute(children_stmt)
        for child in children_res.scalars().all():
            child.parent_node_id = node.parent_node_id
        await self.db.delete(node)
        await self.db.flush()

    async def bulk_update_positions(self, mind_map_id: int, positions: list[dict]) -> None:
        for pos in positions:
            stmt = (
                select(MindMapNode)
                .where(MindMapNode.id == pos["id"], MindMapNode.mind_map_id == mind_map_id)
            )
            result = await self.db.execute(stmt)
            node = result.scalar_one_or_none()
            if node:
                node.position_x = pos["position_x"]
                node.position_y = pos["position_y"]
        await self.db.flush()

    # ── Edges ────────────────────────────────────────────────────────────────

    async def create_edge(self, mind_map_id: int, **kwargs) -> MindMapEdge:
        edge = MindMapEdge(mind_map_id=mind_map_id, **kwargs)
        self.db.add(edge)
        await self.db.flush()
        await self.db.refresh(edge)
        return edge

    async def update_edge(self, edge_id: int, mind_map_id: int, **kwargs) -> MindMapEdge | None:
        result = await self.db.execute(
            select(MindMapEdge).where(
                MindMapEdge.id == edge_id,
                MindMapEdge.mind_map_id == mind_map_id,
            )
        )
        edge = result.scalar_one_or_none()
        if not edge:
            return None
        for k, v in kwargs.items():
            if v is not None:
                setattr(edge, k, v)
        await self.db.flush()
        await self.db.refresh(edge)
        return edge

    async def delete_edge(self, edge_id: int, mind_map_id: int) -> bool:
        result = await self.db.execute(
            select(MindMapEdge).where(
                MindMapEdge.id == edge_id,
                MindMapEdge.mind_map_id == mind_map_id,
            )
        )
        edge = result.scalar_one_or_none()
        if not edge:
            return False
        await self.db.delete(edge)
        await self.db.flush()
        return True

    # ── Activity log ─────────────────────────────────────────────────────────

    async def log_activity(
        self, mind_map_id: int, action: str,
        old_value: dict | None = None, new_value: dict | None = None,
    ) -> None:
        log = MindMapActivityLog(
            mind_map_id=mind_map_id, action=action,
            old_value=old_value, new_value=new_value,
        )
        self.db.add(log)
        await self.db.flush()
