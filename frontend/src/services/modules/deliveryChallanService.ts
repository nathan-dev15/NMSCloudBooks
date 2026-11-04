import { ApiService } from '@/services/core/apiService'
import type { DeliveryChallan, DCStatus } from '@/features/deliveryChallans/deliveryChallansSlice'
import type { QueryParams } from '@/services/core/apiService'

export interface DCQueryParams extends QueryParams {
  client_id?: number
  status?: DCStatus
  from_date?: string
  to_date?: string
}

class DeliveryChallanService extends ApiService<DeliveryChallan> {
  constructor() { super('/delivery-challans') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  changeStatus(id: number, status: DCStatus) {
    return this.patchAction(id, 'status', { status })
  }

  /** POST /delivery-challans/:id/cancel */
  cancel(id: number) {
    return this.createRelated<DeliveryChallan>(id, 'cancel', {})
  }

  /** GET /delivery-challans/:id/download */
  downloadPdf(id: number, dcNumber: string) {
    return this.download(id, `dc-${dcNumber}.pdf`, 'download')
  }
}

export const deliveryChallanService = new DeliveryChallanService()
export default deliveryChallanService
