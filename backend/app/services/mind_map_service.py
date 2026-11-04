from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.mind_map_repository import MindMapRepository
from app.schemas.mind_map import (
    MindMapCreate, MindMapUpdate, NodeCreate, NodeUpdate, EdgeCreate, EdgeUpdate, LayoutSave,
)


class MindMapService:
    def __init__(self, db: AsyncSession):
        self.repo = MindMapRepository(db)

    async def list_mind_maps(self) -> list[dict]:
        return await self.repo.list_all()

    async def get_mind_map(self, mind_map_id: int):
        mm = await self.repo.get_by_id(mind_map_id)
        if not mm:
            raise HTTPException(status_code=404, detail="Mind map not found")
        return mm

    async def create_mind_map(self, payload: MindMapCreate):
        mm = await self.repo.create(**payload.model_dump())
        await self.repo.create_node(
            mind_map_id=mm.id,
            title=payload.title,
            position_x=0.0,
            position_y=0.0,
            color="#0c7a82",
        )
        await self.repo.log_activity(mm.id, "created")
        return await self.repo.get_by_id(mm.id)

    async def update_mind_map(self, mind_map_id: int, payload: MindMapUpdate):
        mm = await self.get_mind_map(mind_map_id)
        await self.repo.update(mm, **payload.model_dump(exclude_none=True))
        await self.repo.log_activity(mm.id, "updated_meta")
        return await self.repo.get_by_id(mm.id)

    async def delete_mind_map(self, mind_map_id: int) -> None:
        mm = await self.get_mind_map(mind_map_id)
        await self.repo.soft_delete(mm)
        await self.repo.log_activity(mm.id, "deleted")

    # ── Nodes ────────────────────────────────────────────────────────────────

    async def add_node(self, mind_map_id: int, payload: NodeCreate):
        mm = await self.get_mind_map(mind_map_id)
        if payload.parent_node_id:
            parent = await self.repo.get_node(payload.parent_node_id)
            if not parent or parent.mind_map_id != mm.id:
                raise HTTPException(status_code=400, detail="Invalid parent node")
        node = await self.repo.create_node(mind_map_id=mm.id, **payload.model_dump())
        if payload.parent_node_id:
            await self.repo.create_edge(
                mind_map_id=mm.id,
                source_node_id=payload.parent_node_id,
                target_node_id=node.id,
            )
        await self.repo.log_activity(mm.id, "node_added", new_value={"node_id": node.id})
        return node

    async def update_node(self, mind_map_id: int, node_id: int, payload: NodeUpdate):
        mm = await self.get_mind_map(mind_map_id)
        node = await self.repo.get_node(node_id)
        if not node or node.mind_map_id != mm.id:
            raise HTTPException(status_code=404, detail="Node not found")
        if payload.parent_node_id is not None:
            if payload.parent_node_id == node_id:
                raise HTTPException(status_code=400, detail="Node cannot be its own parent")
            if payload.parent_node_id != 0:
                parent = await self.repo.get_node(payload.parent_node_id)
                if not parent or parent.mind_map_id != mm.id:
                    raise HTTPException(status_code=400, detail="Invalid parent node")
        data = payload.model_dump(exclude_none=True)
        if "parent_node_id" in data and data["parent_node_id"] == 0:
            data["parent_node_id"] = None
        return await self.repo.update_node(node, **data)

    async def delete_node(self, mind_map_id: int, node_id: int) -> None:
        mm = await self.get_mind_map(mind_map_id)
        node = await self.repo.get_node(node_id)
        if not node or node.mind_map_id != mm.id:
            raise HTTPException(status_code=404, detail="Node not found")
        await self.repo.delete_node(node)
        await self.repo.log_activity(mm.id, "node_deleted", old_value={"node_id": node_id})

    # ── Layout ───────────────────────────────────────────────────────────────

    async def save_layout(self, mind_map_id: int, payload: LayoutSave):
        mm = await self.get_mind_map(mind_map_id)
        positions = [p.model_dump() for p in payload.positions]
        await self.repo.bulk_update_positions(mm.id, positions)
        await self.repo.log_activity(mm.id, "layout_saved")
        return await self.repo.get_by_id(mm.id)

    # ── Edges ────────────────────────────────────────────────────────────────

    async def add_edge(self, mind_map_id: int, payload: EdgeCreate):
        mm = await self.get_mind_map(mind_map_id)
        src = await self.repo.get_node(payload.source_node_id)
        tgt = await self.repo.get_node(payload.target_node_id)
        if not src or src.mind_map_id != mm.id:
            raise HTTPException(status_code=400, detail="Invalid source node")
        if not tgt or tgt.mind_map_id != mm.id:
            raise HTTPException(status_code=400, detail="Invalid target node")
        if payload.source_node_id == payload.target_node_id:
            raise HTTPException(status_code=400, detail="Self-referencing edge not allowed")
        existing = [
            e for e in mm.edges
            if e.source_node_id == payload.source_node_id
            and e.target_node_id == payload.target_node_id
        ]
        if existing:
            raise HTTPException(status_code=409, detail="Edge already exists between these nodes")
        return await self.repo.create_edge(mind_map_id=mm.id, **payload.model_dump())

    async def update_edge(self, mind_map_id: int, edge_id: int, payload: EdgeUpdate):
        await self.get_mind_map(mind_map_id)
        data = payload.model_dump(exclude_none=True)
        edge = await self.repo.update_edge(edge_id, mind_map_id, **data)
        if not edge:
            raise HTTPException(status_code=404, detail="Edge not found")
        return edge

    async def delete_edge(self, mind_map_id: int, edge_id: int) -> None:
        await self.get_mind_map(mind_map_id)
        deleted = await self.repo.delete_edge(edge_id, mind_map_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Edge not found")
