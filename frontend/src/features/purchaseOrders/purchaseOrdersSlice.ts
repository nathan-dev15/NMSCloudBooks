import { createEntitySlice } from '@/app/createEntitySlice'
import apiHandler from '@/services/apiHandler'
import { createAsyncThunk } from '@reduxjs/toolkit'

export type POStatus   = 'draft' | 'pending' | 'approved' | 'ordered' | 'partial' | 'received' | 'cancelled' | 'closed'
export type POPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface POItem {
  id:                number
  purchase_order_id: number
  item_order:        number
  description:       string
  sku:               string | null
  hsn_sac:           string | null
  unit:              string | null
  quantity:          number
  unit_price:        number
  tax_rate:          number
  tax_amount:        number
  line_total:        number
  qty_received:      number
  is_closed:         boolean
}

export interface PurchaseOrder {
  id:                    number
  tenant_id:             number
  vendor_id:             number | null
  created_by_id:         number | null
  approved_by_id:        number | null
  po_number:             string
  reference_no:          string | null
  order_date:            string
  expected_date:         string | null
  approved_date:         string | null
  received_date:         string | null
  status:                POStatus
  priority:              POPriority
  vendor_name:           string | null
  vendor_address:        string | null
  vendor_gstin:          string | null
  currency:              string
  subtotal:              number
  tax_amount:            number
  discount_amount:       number
  grand_total:           number
  amount_received_value: number
  delivery_address:      string | null
  shipping_terms:        string | null
  payment_terms:         string | null
  notes:                 string | null
  internal_notes:        string | null
  rejection_reason:      string | null
  tags:                  string[]
  items:                 POItem[]
}

const entity = createEntitySlice<PurchaseOrder>('purchaseOrders', '/purchase-orders')

export const {
  slice:     purchaseOrdersSlice,
  reducer:   purchaseOrdersReducer,
  thunks:    purchaseOrdersThunks,
  selectors: purchaseOrdersSelectors,
} = entity

// ── Extra thunks ──────────────────────────────────────────────────────────────

export const changePOStatus = createAsyncThunk(
  'purchaseOrders/changeStatus',
  async ({ poId, status, rejection_reason }: { poId: number; status: POStatus; rejection_reason?: string }) => {
    const res = await apiHandler.patch<PurchaseOrder>(`/purchase-orders/${poId}/status`, { status, rejection_reason })
    return res.data!
  }
)

export const receiveGoods = createAsyncThunk(
  'purchaseOrders/receiveGoods',
  async ({
    poId, data,
  }: {
    poId: number
    data: { received_date: string; items: { item_id: number; qty_received: number }[]; notes?: string }
  }) => {
    const res = await apiHandler.post<PurchaseOrder>(`/purchase-orders/${poId}/receive`, data)
    return res.data!
  }
)

export const cancelPO = createAsyncThunk(
  'purchaseOrders/cancel',
  async (poId: number) => {
    const res = await apiHandler.post<PurchaseOrder>(`/purchase-orders/${poId}/cancel`, {})
    return res.data!
  }
)

export const downloadPOPdf = createAsyncThunk(
  'purchaseOrders/downloadPdf',
  async (poId: number) => {
    await apiHandler.download(`/purchase-orders/${poId}/download`, `purchase-order-${poId}.pdf`)
  }
)

export default purchaseOrdersSlice.reducer
