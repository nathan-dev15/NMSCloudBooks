import { ApiService } from '@/services/core/apiService'
import type {
  Farm, CropCycle, FarmExpense, HarvestRecord,
  CycleStatus,
} from '@/features/agriculture/agricultureSlice'
import type { QueryParams } from '@/services/core/apiService'

export interface FarmQueryParams extends QueryParams {
  district?: string
  state?: string
  is_active?: boolean
}

export interface CycleQueryParams extends QueryParams {
  farm_id?: number
  status?: CycleStatus
  year?: number
}

// ── Farms ─────────────────────────────────────────────────────────────────────

class FarmService extends ApiService<Farm> {
  constructor() { super('/agriculture/farms') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  cycles(farmId: number, params?: CycleQueryParams) {
    return this.getRelated<CropCycle[]>(farmId, 'cycles', params)
  }
}

// ── Crop Cycles ───────────────────────────────────────────────────────────────

class CropCycleService extends ApiService<CropCycle> {
  constructor() { super('/agriculture/cycles') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  changeStatus(id: number, status: CycleStatus) {
    return this.patchAction(id, 'status', { status })
  }

  expenses(cycleId: number, params?: QueryParams) {
    return this.getRelated<FarmExpense[]>(cycleId, 'expenses', params)
  }

  addExpense(cycleId: number, payload: Record<string, unknown>) {
    return this.createRelated<FarmExpense>(cycleId, 'expenses', payload)
  }

  harvests(cycleId: number) {
    return this.getRelated<HarvestRecord[]>(cycleId, 'harvests')
  }

  addHarvest(cycleId: number, payload: Record<string, unknown>) {
    return this.createRelated<HarvestRecord>(cycleId, 'harvests', payload)
  }

  /** GET /agriculture/cycles/:id/profitability */
  profitability(cycleId: number) {
    return this.getRelated<Record<string, unknown>>(cycleId, 'profitability')
  }
}

// ── Singleton exports ─────────────────────────────────────────────────────────

export const farmService      = new FarmService()
export const cropCycleService = new CropCycleService()

const agricultureService = { farms: farmService, cycles: cropCycleService }
export default agricultureService
