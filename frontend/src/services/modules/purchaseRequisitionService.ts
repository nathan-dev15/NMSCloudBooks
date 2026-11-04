import { ApiService } from '@/services/core/apiService'
import type { PurchaseRequisition, PRStatus } from '@/features/purchaseRequisitions/purchaseRequisitionsSlice'
import type { QueryParams } from '@/services/core/apiService'

export interface PRQueryParams extends QueryParams {
  department?: string
  status?: PRStatus
  requested_by_id?: number
}

class PurchaseRequisitionService extends ApiService<PurchaseRequisition> {
  constructor() { super('/purchase-requisitions') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  changeStatus(id: number, status: PRStatus, rejectionReason?: string) {
    return this.patchAction(
      id, 'status',
      { status, ...(rejectionReason ? { rejection_reason: rejectionReason } : {}) },
    )
  }

  /** POST /purchase-requisitions/:id/cancel */
  cancel(id: number) {
    return this.createRelated<PurchaseRequisition>(id, 'cancel', {})
  }

  /** POST /purchase-requisitions/:id/convert — convert PR to PO */
  convertToPO(id: number, payload: Record<string, unknown>) {
    return this.createRelated<Record<string, unknown>>(id, 'convert', payload)
  }
}

export const purchaseRequisitionService = new PurchaseRequisitionService()
export default purchaseRequisitionService
