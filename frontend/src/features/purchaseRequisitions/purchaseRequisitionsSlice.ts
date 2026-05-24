import { createEntitySlice } from '@/app/createEntitySlice'
import apiHandler from '@/services/apiHandler'
import { createAsyncThunk } from '@reduxjs/toolkit'

export type PRStatus   = 'draft' | 'submitted' | 'approved' | 'rejected' | 'converted' | 'cancelled'
export type PRPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface PRItem {
  id:                   number
  pr_id:                number
  item_order:           number
  description:          string
  sku:                  string | null
  unit:                 string | null
  quantity:             number
  estimated_unit_price: number
  estimated_total:      number
  notes:                string | null
}

export interface PurchaseRequisition {
  id:               number
  tenant_id:        number
  requested_by_id:  number | null
  approved_by_id:   number | null
  pr_number:        string
  reference_no:     string | null
  request_date:     string
  required_by_date: string | null
  approved_date:    string | null
  status:           PRStatus
  priority:         PRPriority
  department:       string | null
  purpose:          string | null
  notes:            string | null
  rejection_reason: string | null
  tags:             string[]
  items:            PRItem[]
}

const entity = createEntitySlice<PurchaseRequisition>('purchaseRequisitions', '/purchase-requisitions')

export const {
  slice:     purchaseRequisitionsSlice,
  reducer:   purchaseRequisitionsReducer,
  thunks:    purchaseRequisitionsThunks,
  selectors: purchaseRequisitionsSelectors,
} = entity

export const changePRStatus = createAsyncThunk(
  'purchaseRequisitions/changeStatus',
  async ({ prId, status, rejection_reason }: { prId: number; status: PRStatus; rejection_reason?: string }) => {
    const res = await apiHandler.patch<PurchaseRequisition>(`/purchase-requisitions/${prId}/status`, { status, rejection_reason })
    return res.data!
  }
)

export const cancelPR = createAsyncThunk(
  'purchaseRequisitions/cancel',
  async (prId: number) => {
    const res = await apiHandler.post<PurchaseRequisition>(`/purchase-requisitions/${prId}/cancel`, {})
    return res.data!
  }
)

export default purchaseRequisitionsSlice.reducer
