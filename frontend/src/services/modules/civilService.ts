import { ApiService } from '@/services/core/apiService'
import type {
  Project, ProjectPlan, Block, MaterialRequest,
  StockEntry, DailyActivity, WeeklyBill,
  BlockStatus, RequestStatus,
} from '@/features/civil/civilTypes'
import type { QueryParams } from '@/services/core/apiService'

export interface ProjectQueryParams extends QueryParams {
  state?: string
  district?: string
  status?: string
}

export interface RequestQueryParams extends QueryParams {
  project_id?: number
  block_id?: number
  status?: RequestStatus
}

// ── Projects ──────────────────────────────────────────────────────────────────

class ProjectService extends ApiService<Project> {
  constructor() { super('/civil/projects') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  plans(projectId: number) {
    return this.getRelated<ProjectPlan[]>(projectId, 'plans')
  }

  createPlan(projectId: number, payload: Record<string, unknown>) {
    return this.createRelated<ProjectPlan>(projectId, 'plans', payload)
  }

  createBlock(projectId: number, planId: number, payload: Record<string, unknown>) {
    return this.raw.post<Block>(`${this.url(projectId, 'plans')}/${planId}/blocks`, payload)
  }
}

// ── Blocks ────────────────────────────────────────────────────────────────────

class BlockService extends ApiService<Block> {
  constructor() { super('/civil/projects/blocks') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  updateStatus(id: number, status: BlockStatus) {
    return this.patchAction(id, 'status', { status })
  }

  activities(blockId: number, params?: QueryParams) {
    return this.getRelated<DailyActivity[]>(blockId, 'activities', params)
  }

  logActivity(blockId: number, payload: Record<string, unknown>) {
    return this.createRelated<DailyActivity>(blockId, 'activities', payload)
  }

  weeklyBills(blockId: number) {
    return this.getRelated<WeeklyBill[]>(blockId, 'weekly-bills')
  }

  submitWeeklyBill(billId: number) {
    return this.raw.post<WeeklyBill>(`/civil/billing/weekly-bills/${billId}/submit`, {})
  }

  approveWeeklyBill(billId: number) {
    return this.raw.post<WeeklyBill>(`/civil/billing/weekly-bills/${billId}/approve`, {})
  }
}

// ── Material Requests ─────────────────────────────────────────────────────────

class MaterialRequestService extends ApiService<MaterialRequest> {
  constructor() { super('/civil/material-requests') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  changeStatus(id: number, status: RequestStatus, reason?: string) {
    return this.patchAction(
      id, 'status',
      { status, ...(reason ? { rejection_reason: reason } : {}) },
    )
  }

  /** GET /civil/material-requests/:id/stock — stock levels for request items */
  stock(id: number) {
    return this.getRelated<StockEntry[]>(id, 'stock')
  }
}

// ── Singleton exports ─────────────────────────────────────────────────────────

export const projectService         = new ProjectService()
export const blockService           = new BlockService()
export const materialRequestService = new MaterialRequestService()

const civilService = { projects: projectService, blocks: blockService, requests: materialRequestService }
export default civilService
