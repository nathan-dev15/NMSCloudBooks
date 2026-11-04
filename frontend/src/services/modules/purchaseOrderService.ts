import { ApiService } from '@/services/core/apiService'
import type { PurchaseOrder, POStatus } from '@/features/purchaseOrders/purchaseOrdersSlice'
import type { QueryParams } from '@/services/core/apiService'

export interface POQueryParams extends QueryParams {
  vendor_id?: number
  status?: POStatus
  from_date?: string
  to_date?: string
}

export interface ReceiveGoodsPayload {
  items: Array<{
    po_item_id: number
    qty_received: number
    notes?: string
  }>
  received_date?: string
}

class PurchaseOrderService extends ApiService<PurchaseOrder> {
  constructor() { super('/purchase-orders') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  changeStatus(id: number, status: POStatus, rejectionReason?: string) {
    return this.patchAction(
      id, 'status',
      { status, ...(rejectionReason ? { rejection_reason: rejectionReason } : {}) },
    )
  }

  /** POST /purchase-orders/:id/receive — log goods received */
  receiveGoods(id: number, payload: ReceiveGoodsPayload) {
    return this.createRelated<PurchaseOrder>(id, 'receive', payload)
  }

  /** GET /purchase-orders/:id/download */
  downloadPdf(id: number, poNumber: string) {
    return this.download(id, `po-${poNumber}.pdf`, 'download')
  }
}

export const purchaseOrderService = new PurchaseOrderService()
export default purchaseOrderService
