import { ApiService } from '@/services/core/apiService'
import type {
  Store, POSSession, Sale, SaleStatus, PaymentMethod,
} from '@/features/retail/retailSlice'
import type { QueryParams } from '@/services/core/apiService'

export interface SaleQueryParams extends QueryParams {
  store_id?: number
  session_id?: number
  status?: SaleStatus
  payment_method?: PaymentMethod
  from_date?: string
  to_date?: string
}

export interface OpenSessionPayload {
  store_id: number
  opening_cash: number
  notes?: string
}

export interface CloseSessionPayload {
  closing_cash: number
  notes?: string
}

// ── Stores ────────────────────────────────────────────────────────────────────

class StoreService extends ApiService<Store> {
  constructor() { super('/retail/stores') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }
}

// ── POS Sessions ──────────────────────────────────────────────────────────────

class POSSessionService extends ApiService<POSSession> {
  constructor() { super('/retail/sessions') }

  open(payload: OpenSessionPayload) {
    return this.create(payload)
  }

  close(sessionId: number, payload: CloseSessionPayload) {
    return this.patchAction(sessionId, 'close', payload)
  }

  summary(sessionId: number) {
    return this.getRelated<Record<string, unknown>>(sessionId, 'summary')
  }
}

// ── Sales ─────────────────────────────────────────────────────────────────────

class SaleService extends ApiService<Sale> {
  constructor() { super('/retail/sales') }

  cancel(id: number, reason?: string) {
    return this.createRelated<Sale>(id, 'cancel', { reason })
  }

  refund(id: number, payload: Record<string, unknown>) {
    return this.createRelated<Sale>(id, 'refund', payload)
  }

  downloadReceipt(id: number, billNumber: string) {
    return this.download(id, `receipt-${billNumber}.pdf`, 'receipt')
  }

  /** GET /retail/sales/summary */
  summary(params?: QueryParams) {
    return this.raw.get<Record<string, unknown>>(`${this.base}/summary`, { params })
  }
}

// ── Singleton exports ─────────────────────────────────────────────────────────

export const storeService      = new StoreService()
export const posSessionService = new POSSessionService()
export const saleService       = new SaleService()

const retailService = { stores: storeService, sessions: posSessionService, sales: saleService }
export default retailService
