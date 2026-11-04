import { ApiService } from '@/services/core/apiService'
import type { MindMapDetail, MindMapSummary } from '@/types'

export interface CreateMindMapPayload {
  title: string
  description?: string | null
}

export interface UpdateMindMapPayload {
  title?: string
  description?: string | null
}

export interface CreateNodePayload {
  parent_node_id?: number | null
  title?: string
  description?: string | null
  position_x?: number
  position_y?: number
  color?: string | null
  style_data?: Record<string, unknown> | null
}

export interface UpdateNodePayload {
  parent_node_id?: number | null
  title?: string
  description?: string | null
  position_x?: number
  position_y?: number
  color?: string | null
  style_data?: Record<string, unknown> | null
  is_collapsed?: boolean
  sort_order?: number
}

export interface CreateEdgePayload {
  source_node_id: number
  target_node_id: number
  edge_type?: string
  style_data?: Record<string, unknown> | null
}

export interface UpdateEdgePayload {
  edge_type?: string
  style_data?: Record<string, unknown> | null
}

export interface NodePosition {
  id: number
  position_x: number
  position_y: number
}

class MindMapService extends ApiService<MindMapDetail> {
  constructor() { super('/mind-maps') }

  listMindMaps() {
    return this.raw.get<MindMapSummary[]>(this.base)
  }

  getMindMap(id: number) { return this.getById(id) }
  createMindMap(payload: CreateMindMapPayload) { return this.create(payload) }
  updateMindMap(id: number, payload: UpdateMindMapPayload) { return this.raw.put<MindMapDetail>(this.url(id), payload) }
  deleteMindMap(id: number) { return this.remove(id) }

  addNode(mindMapId: number, payload: CreateNodePayload) {
    return this.createRelated(mindMapId, 'nodes', payload)
  }

  updateNode(mindMapId: number, nodeId: number, payload: UpdateNodePayload) {
    return this.raw.patch<MindMapDetail>(this.url(mindMapId, 'nodes', String(nodeId)), payload)
  }

  deleteNode(mindMapId: number, nodeId: number) {
    return this.raw.delete<void>(this.url(mindMapId, 'nodes', String(nodeId)))
  }

  addEdge(mindMapId: number, payload: CreateEdgePayload) {
    return this.raw.post<MindMapDetail>(this.url(mindMapId, 'edges'), payload)
  }

  updateEdge(mindMapId: number, edgeId: number, payload: UpdateEdgePayload) {
    return this.raw.patch<MindMapDetail>(this.url(mindMapId, 'edges', String(edgeId)), payload)
  }

  deleteEdge(mindMapId: number, edgeId: number) {
    return this.raw.delete<void>(this.url(mindMapId, 'edges', String(edgeId)))
  }

  saveLayout(mindMapId: number, positions: NodePosition[]) {
    return this.raw.put<MindMapDetail>(this.url(mindMapId, 'layout'), { positions })
  }
}

export const mindMapService = new MindMapService()
export default mindMapService
