from fastapi import APIRouter

from app.core.deps import DB
from app.schemas.mind_map import (
    MindMapCreate, MindMapUpdate, MindMapSummary, MindMapDetail,
    NodeCreate, NodeUpdate, NodeResponse,
    EdgeCreate, EdgeUpdate, EdgeResponse,
    LayoutSave,
)
from app.services.mind_map_service import MindMapService

router = APIRouter(prefix="/mind-maps", tags=["Mind Maps"])


@router.get("", response_model=list[MindMapSummary])
async def list_mind_maps(db: DB):
    return await MindMapService(db).list_mind_maps()


@router.post("", response_model=MindMapDetail, status_code=201)
async def create_mind_map(payload: MindMapCreate, db: DB):
    return await MindMapService(db).create_mind_map(payload)


@router.get("/{mind_map_id}", response_model=MindMapDetail)
async def get_mind_map(mind_map_id: int, db: DB):
    return await MindMapService(db).get_mind_map(mind_map_id)


@router.put("/{mind_map_id}", response_model=MindMapDetail)
async def update_mind_map(mind_map_id: int, payload: MindMapUpdate, db: DB):
    return await MindMapService(db).update_mind_map(mind_map_id, payload)


@router.delete("/{mind_map_id}", status_code=204)
async def delete_mind_map(mind_map_id: int, db: DB):
    await MindMapService(db).delete_mind_map(mind_map_id)


# ── Nodes ────────────────────────────────────────────────────────────────────

@router.post("/{mind_map_id}/nodes", response_model=NodeResponse, status_code=201)
async def add_node(mind_map_id: int, payload: NodeCreate, db: DB):
    return await MindMapService(db).add_node(mind_map_id, payload)


@router.patch("/{mind_map_id}/nodes/{node_id}", response_model=NodeResponse)
async def update_node(mind_map_id: int, node_id: int, payload: NodeUpdate, db: DB):
    return await MindMapService(db).update_node(mind_map_id, node_id, payload)


@router.delete("/{mind_map_id}/nodes/{node_id}", status_code=204)
async def delete_node(mind_map_id: int, node_id: int, db: DB):
    await MindMapService(db).delete_node(mind_map_id, node_id)


# ── Edges ────────────────────────────────────────────────────────────────────

@router.post("/{mind_map_id}/edges", response_model=EdgeResponse, status_code=201)
async def add_edge(mind_map_id: int, payload: EdgeCreate, db: DB):
    return await MindMapService(db).add_edge(mind_map_id, payload)


@router.patch("/{mind_map_id}/edges/{edge_id}", response_model=EdgeResponse)
async def update_edge(mind_map_id: int, edge_id: int, payload: EdgeUpdate, db: DB):
    return await MindMapService(db).update_edge(mind_map_id, edge_id, payload)


@router.delete("/{mind_map_id}/edges/{edge_id}", status_code=204)
async def delete_edge(mind_map_id: int, edge_id: int, db: DB):
    await MindMapService(db).delete_edge(mind_map_id, edge_id)


# ── Layout ───────────────────────────────────────────────────────────────────

@router.put("/{mind_map_id}/layout", response_model=MindMapDetail)
async def save_layout(mind_map_id: int, payload: LayoutSave, db: DB):
    return await MindMapService(db).save_layout(mind_map_id, payload)
