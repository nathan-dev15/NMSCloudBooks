import { createEntitySlice } from '@/app/createEntitySlice'
import apiHandler from '@/services/apiHandler'
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

export type SaleStatus    = 'draft' | 'completed' | 'cancelled' | 'refunded' | 'partial_refund'
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'split' | 'credit'
export type StoreStatus   = 'active' | 'inactive' | 'closed'
export type PromotionType = 'percent_discount' | 'flat_discount' | 'buy_x_get_y' | 'free_item' | 'loyalty_multiplier'

export interface Store {
  id:         number
  tenant_id:  number
  name:       string
  code:       string | null
  address:    string | null
  phone:      string | null
  gstin:      string | null
  status:     StoreStatus
  is_default: boolean
  currency:   string
  settings:   Record<string, unknown>
  manager_id: number | null
}

export interface POSSession {
  id:              number
  store_id:        number
  cashier_id:      number | null
  opened_at:       string
  closed_at:       string | null
  opening_cash:    number
  closing_cash:    number
  expected_cash:   number
  cash_difference: number
  total_sales:     number
  total_refunds:   number
  is_open:         boolean
  notes:           string | null
}

export interface SaleItem {
  id:            number
  sale_id:       number
  product_id:    number
  item_order:    number
  product_name:  string
  sku:           string | null
  unit:          string
  quantity:      number
  unit_price:    number
  mrp:           number
  discount_pct:  number
  discount_amt:  number
  tax_rate:      number
  tax_amount:    number
  line_total:    number
  promotion_id:  number | null
}

export interface Sale {
  id:                    number
  tenant_id:             number
  store_id:              number
  session_id:            number | null
  cashier_id:            number | null
  customer_id:           number | null
  bill_number:           string
  sale_date:             string
  sale_time:             string | null
  status:                SaleStatus
  payment_method:        PaymentMethod
  subtotal:              number
  discount_amount:       number
  taxable_amount:        number
  tax_amount:            number
  round_off:             number
  grand_total:           number
  amount_tendered:       number
  change_due:            number
  loyalty_points_used:   number
  loyalty_points_earned: number
  notes:                 string | null
  items:                 SaleItem[]
}

export interface Promotion {
  id:             number
  tenant_id:      number
  name:           string
  code:           string | null
  promo_type:     PromotionType
  discount_value: number
  start_date:     string
  end_date:       string
  is_active:      boolean
  usage_count:    number
  usage_limit:    number | null
}

// ── Sales entity slice ────────────────────────────────────────────────────────

const entity = createEntitySlice<Sale>('retail', '/retail/sales')
export const {
  slice:     retailSlice,
  reducer:   retailReducer,
  thunks:    retailThunks,
  selectors: retailSelectors,
} = entity

// ── Aux state: stores, sessions, promotions ───────────────────────────────────

interface RetailAuxState {
  stores:     Store[]
  sessions:   POSSession[]
  promotions: Promotion[]
  loading:    boolean
}

export const fetchStores     = createAsyncThunk('retailAux/fetchStores',     async () => (await apiHandler.get<Store[]>('/retail/stores')).data!)
export const fetchPromotions = createAsyncThunk('retailAux/fetchPromotions', async () => (await apiHandler.get<Promotion[]>('/retail/promotions')).data!)

export const openSession = createAsyncThunk('retailAux/openSession',
  async ({ storeId, opening_cash }: { storeId: number; opening_cash: number }) => {
    const res = await apiHandler.post<POSSession>(`/retail/stores/${storeId}/sessions/open`, { opening_cash })
    return res.data!
  }
)

export const closeSession = createAsyncThunk('retailAux/closeSession',
  async ({ sessionId, closing_cash }: { sessionId: number; closing_cash: number }) => {
    const res = await apiHandler.post<POSSession>(`/retail/sessions/${sessionId}/close`, { closing_cash })
    return res.data!
  }
)

const auxSlice = createSlice({
  name: 'retailAux',
  initialState: { stores: [], sessions: [], promotions: [], loading: false } as RetailAuxState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchStores.fulfilled,     (s, a) => { s.stores     = a.payload; s.loading = false })
    b.addCase(fetchPromotions.fulfilled, (s, a) => { s.promotions = a.payload; s.loading = false })
    b.addCase(openSession.fulfilled,     (s, a) => { s.sessions.unshift(a.payload) })
    b.addCase(fetchStores.pending, (s) => { s.loading = true })
    b.addCase(fetchStores.rejected,(s) => { s.loading = false })
  },
})

export const retailAuxReducer = auxSlice.reducer
export const retailAuxSelectors = {
  stores:     (state: any) => state.retailAux.stores     as Store[],
  sessions:   (state: any) => state.retailAux.sessions   as POSSession[],
  promotions: (state: any) => state.retailAux.promotions as Promotion[],
}

export default retailSlice.reducer
