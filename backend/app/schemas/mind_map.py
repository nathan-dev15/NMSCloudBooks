from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


# ── Node schemas ──────────────────────────────────────────────────────────────

class NodeCreate(BaseModel):
    parent_node_id: int | None = None
    title: str = "New Node"
    description: str | None = None
    position_x: float = 0.0
    position_y: float = 0.0
    color: str | None = None
    style_data: dict | None = None
    is_collapsed: bool = False
    sort_order: int = 0

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Node title cannot be empty")
        return v


class NodeUpdate(BaseModel):
    parent_node_id: int | None = None
    title: str | None = None
    description: str | None = None
    position_x: float | None = None
    position_y: float | None = None
    color: str | None = None
    style_data: dict | None = None
    is_collapsed: bool | None = None
    sort_order: int | None = None


class NodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mind_map_id: int
    parent_node_id: int | None
    title: str
    description: str | None
    position_x: float
    position_y: float
    color: str | None
    style_data: dict | None
    is_collapsed: bool
    sort_order: int


# ── Edge schemas ──────────────────────────────────────────────────────────────

class EdgeCreate(BaseModel):
    source_node_id: int
    target_node_id: int
    edge_type: str = "default"
    style_data: dict | None = None


class EdgeUpdate(BaseModel):
    edge_type: str | None = None
    style_data: dict | None = None


class EdgeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mind_map_id: int
    source_node_id: int
    target_node_id: int
    edge_type: str
    style_data: dict | None


# ── Mind map schemas ──────────────────────────────────────────────────────────

class MindMapCreate(BaseModel):
    title: str
    description: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        return v


class MindMapUpdate(BaseModel):
    title: str | None = None
    description: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Title cannot be empty")
        return v


class MindMapSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    node_count: int = 0


class MindMapDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = None
    tenant_id: int | None = None
    title: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    nodes: list[NodeResponse]
    edges: list[EdgeResponse]


# ── Layout save ───────────────────────────────────────────────────────────────

class NodePosition(BaseModel):
    id: int
    position_x: float
    position_y: float


class LayoutSave(BaseModel):
    positions: list[NodePosition]
