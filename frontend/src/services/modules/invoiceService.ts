import { ApiService } from '@/services/core/apiService'
import type { Invoice, InvoicePayment, InvoiceStatus } from '@/features/invoices/invoicesSlice'
import type { QueryParams } from '@/services/core/apiService'

export interface InvoiceQueryParams extends QueryParams {
  client_id?: number
  status?: InvoiceStatus
  from_date?: string
  to_date?: string
}

export interface RecordPaymentPayload {
  payment_date: string
  amount: number
  mode: string
  reference?: string | null
  notes?: string | null
}

class InvoiceService extends ApiService<Invoice> {
  constructor() { super('/invoices') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  changeStatus(id: number, status: InvoiceStatus) {
    return this.patchAction(id, 'status', { status })
  }

  /** POST /invoices/:id/send — email the invoice to the client */
  send(id: number) {
    return this.createRelated<{ message: string }>(id, 'send', {})
  }

  /** POST /invoices/:id/payments */
  recordPayment(id: number, payload: RecordPaymentPayload) {
    return this.createRelated<InvoicePayment>(id, 'payments', payload)
  }

  /** GET /invoices/:id/payments */
  payments(id: number) {
    return this.getRelated<InvoicePayment[]>(id, 'payments')
  }

  /** GET /invoices/:id/download */
  downloadPdf(id: number, invoiceNumber: string) {
    return this.download(id, `invoice-${invoiceNumber}.pdf`, 'download')
  }

  /** GET /invoices/summary */
  summary(params?: QueryParams) {
    return this.raw.get<Record<string, unknown>>(`${this.base}/summary`, { params })
  }
}

export const invoiceService = new InvoiceService()
export default invoiceService
