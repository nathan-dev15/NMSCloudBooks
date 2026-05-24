import { createEntitySlice } from '@/app/createEntitySlice'
import apiHandler from '@/services/apiHandler'
import { createAsyncThunk } from '@reduxjs/toolkit'

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'void'
export type GSTType       = 'igst' | 'cgst_sgst' | 'none'
export type PaymentMode   = 'cash' | 'bank' | 'upi' | 'cheque' | 'neft' | 'credit'

export interface InvoiceItem {
  id:              number
  invoice_id:      number
  item_order:      number
  description:     string
  hsn_sac:         string | null
  unit:            string | null
  quantity:        number
  rate:            number
  discount_pct:    number
  taxable_amount:  number
  gst_rate:        number
  cgst_rate:       number
  sgst_rate:       number
  igst_rate:       number
  cgst_amount:     number
  sgst_amount:     number
  igst_amount:     number
  line_total:      number
}

export interface InvoicePayment {
  id:             number
  invoice_id:     number
  recorded_by_id: number | null
  payment_date:   string
  amount:         number
  mode:           PaymentMode
  reference:      string | null
  notes:          string | null
}

export interface Invoice {
  id:               number
  tenant_id:        number
  client_id:        number
  created_by_id:    number | null
  invoice_number:   string
  reference_no:     string | null
  invoice_date:     string
  due_date:         string
  supply_date:      string | null
  status:           InvoiceStatus
  gst_type:         GSTType
  place_of_supply:  string | null
  currency:         string
  subtotal:         number
  discount_amount:  number
  taxable_amount:   number
  cgst_amount:      number
  sgst_amount:      number
  igst_amount:      number
  total_tax_amount: number
  round_off:        number
  grand_total:      number
  amount_paid:      number
  amount_due:       number
  billing_name:     string | null
  billing_address:  string | null
  billing_gstin:    string | null
  notes:            string | null
  terms:            string | null
  is_recurring:     boolean
  tags:             string[]
  items:            InvoiceItem[]
  payments:         InvoicePayment[]
}

const entity = createEntitySlice<Invoice>('invoices', '/invoices')

export const {
  slice:     invoicesSlice,
  reducer:   invoicesReducer,
  thunks:    invoicesThunks,
  selectors: invoicesSelectors,
} = entity

// ── Extra thunks ──────────────────────────────────────────────────────────────

export const updateInvoiceStatus = createAsyncThunk(
  'invoices/updateStatus',
  async ({ invoiceId, status }: { invoiceId: number; status: InvoiceStatus }) => {
    const res = await apiHandler.patch<Invoice>(`/invoices/${invoiceId}/status`, { status })
    return res.data!
  }
)

export const recordPayment = createAsyncThunk(
  'invoices/recordPayment',
  async ({
    invoiceId, data,
  }: {
    invoiceId: number
    data: { payment_date: string; amount: number; mode: PaymentMode; reference?: string; notes?: string }
  }) => {
    const res = await apiHandler.post<InvoicePayment>(`/invoices/${invoiceId}/payments`, data)
    return res.data!
  }
)

export const cancelInvoice = createAsyncThunk(
  'invoices/cancel',
  async (invoiceId: number) => {
    const res = await apiHandler.post<Invoice>(`/invoices/${invoiceId}/cancel`, {})
    return res.data!
  }
)

export const downloadInvoicePdf = createAsyncThunk(
  'invoices/downloadPdf',
  async (invoiceId: number) => {
    await apiHandler.download(`/invoices/${invoiceId}/download`, `invoice-${invoiceId}.pdf`)
  }
)

export default invoicesSlice.reducer
