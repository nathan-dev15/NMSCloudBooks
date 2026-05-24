import { createEntitySlice } from '@/app/createEntitySlice'
import apiHandler from '@/services/apiHandler'
import { createAsyncThunk } from '@reduxjs/toolkit'

export type DCStatus = 'draft' | 'dispatched' | 'delivered' | 'returned' | 'cancelled'

export interface DCItem {
  id:          number
  dc_id:       number
  item_order:  number
  description: string
  hsn_sac:     string | null
  unit:        string | null
  quantity:    number
  notes:       string | null
}

export interface DeliveryChallan {
  id:              number
  tenant_id:       number
  client_id:       number | null
  created_by_id:   number | null
  dc_number:       string
  reference_no:    string | null
  dc_date:         string
  delivery_date:   string | null
  status:          DCStatus
  from_address:    string | null
  to_address:      string | null
  consignee_name:  string | null
  vehicle_number:  string | null
  driver_name:     string | null
  notes:           string | null
  items:           DCItem[]
}

const entity = createEntitySlice<DeliveryChallan>('deliveryChallans', '/delivery-challans')

export const {
  slice:     deliveryChallansSlice,
  reducer:   deliveryChallansReducer,
  thunks:    deliveryChallansThunks,
  selectors: deliveryChallansSelectors,
} = entity

export const changeDCStatus = createAsyncThunk(
  'deliveryChallans/changeStatus',
  async ({ dcId, status }: { dcId: number; status: DCStatus }) => {
    const res = await apiHandler.patch<DeliveryChallan>(`/delivery-challans/${dcId}/status`, { status })
    return res.data!
  }
)

export const cancelDC = createAsyncThunk(
  'deliveryChallans/cancel',
  async (dcId: number) => {
    const res = await apiHandler.post<DeliveryChallan>(`/delivery-challans/${dcId}/cancel`, {})
    return res.data!
  }
)

export default deliveryChallansSlice.reducer
