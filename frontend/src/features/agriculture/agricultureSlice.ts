import { createEntitySlice } from '@/app/createEntitySlice'
import apiHandler from '@/services/apiHandler'
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

export type LandUnit         = 'acre' | 'hectare' | 'guntha' | 'bigha' | 'sqft'
export type CropSeason       = 'kharif' | 'rabi' | 'zaid' | 'annual'
export type CycleStatus      = 'planned' | 'sowing' | 'growing' | 'harvesting' | 'completed' | 'failed'
export type ExpenseCategory  = 'seeds' | 'fertilizer' | 'pesticide' | 'irrigation' | 'labour' | 'machinery' | 'transport' | 'storage' | 'miscellaneous'
export type AgriInvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'cancelled'

export interface Farm {
  id:             number
  tenant_id:      number
  name:           string
  farm_code:      string | null
  village:        string | null
  taluk:          string | null
  district:       string | null
  state:          string | null
  survey_no:      string | null
  total_area:     number
  land_unit:      LandUnit
  irrigated_area: number
  soil_type:      string | null
  water_source:   string | null
  owner_id:       number | null
  is_active:      boolean
  notes:          string | null
}

export interface CropCycle {
  id:                    number
  farm_id:               number
  tenant_id:             number
  crop_name:             string
  variety:               string | null
  season:                CropSeason
  year:                  number
  status:                CycleStatus
  sowing_date:           string | null
  expected_harvest_date: string | null
  actual_harvest_date:   string | null
  area_cultivated:       number
  land_unit:             LandUnit
  expected_yield:        number
  actual_yield:          number
  yield_unit:            string
  total_expense:         number
  total_revenue:         number
  net_profit:            number
  notes:                 string | null
  tags:                  string[]
}

export interface FarmExpense {
  id:             number
  crop_cycle_id:  number
  expense_date:   string
  category:       ExpenseCategory
  description:    string
  amount:         number
  is_paid:        boolean
}

export interface HarvestRecord {
  id:             number
  crop_cycle_id:  number
  harvest_date:   string
  quantity:       number
  unit:           string
  quality_grade:  string | null
  market_rate:    number
  sale_amount:    number
  buyer_id:       number | null
}

export interface AgriInvoice {
  id:             number
  tenant_id:      number
  crop_cycle_id:  number
  invoice_number: string
  invoice_date:   string
  due_date:       string
  status:         AgriInvoiceStatus
  crop_name:      string
  quantity:       number
  unit:           string
  rate:           number
  grand_total:    number
  amount_paid:    number
  amount_due:     number
  currency:       string
}

// ── Farm slice ────────────────────────────────────────────────────────────────
const farmEntity = createEntitySlice<Farm>('farms', '/agriculture/farms')
export const { slice: farmsSlice, reducer: farmsReducer, thunks: farmsThunks, selectors: farmsSelectors } = farmEntity

// ── CropCycle slice ───────────────────────────────────────────────────────────
const cycleEntity = createEntitySlice<CropCycle>('cropCycles', '/agriculture/cycles')
export const { slice: cyclesSlice, reducer: cyclesReducer, thunks: cyclesThunks, selectors: cyclesSelectors } = cycleEntity

// ── Aux thunks ────────────────────────────────────────────────────────────────

export const addExpense = createAsyncThunk(
  'agriculture/addExpense',
  async ({ cycleId, data }: { cycleId: number; data: Partial<FarmExpense> }) => {
    const res = await apiHandler.post<FarmExpense>(`/agriculture/cycles/${cycleId}/expenses`, data)
    return res.data!
  }
)

export const addHarvest = createAsyncThunk(
  'agriculture/addHarvest',
  async ({ cycleId, data }: { cycleId: number; data: Partial<HarvestRecord> }) => {
    const res = await apiHandler.post<HarvestRecord>(`/agriculture/cycles/${cycleId}/harvests`, data)
    return res.data!
  }
)

export const fetchAgriInvoices = createAsyncThunk(
  'agriculture/fetchInvoices',
  async ({ cycleId }: { cycleId?: number }) => {
    const params = cycleId ? `?cycle_id=${cycleId}` : ''
    const res = await apiHandler.get<{ items: AgriInvoice[] }>(`/agriculture/invoices${params}`)
    return res.data!.items
  }
)

// ── Aux state ─────────────────────────────────────────────────────────────────

interface AgriAuxState {
  agriInvoices: AgriInvoice[]
  expenses:     FarmExpense[]
  harvests:     HarvestRecord[]
}

const auxSlice = createSlice({
  name: 'agricultureAux',
  initialState: { agriInvoices: [], expenses: [], harvests: [] } as AgriAuxState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchAgriInvoices.fulfilled, (s, a) => { s.agriInvoices = a.payload })
    b.addCase(addExpense.fulfilled, (s, a) => { s.expenses.unshift(a.payload) })
    b.addCase(addHarvest.fulfilled, (s, a) => { s.harvests.unshift(a.payload) })
  },
})

export const agricultureAuxReducer = auxSlice.reducer
export const agricultureAuxSelectors = {
  invoices: (s: any) => s.agricultureAux.agriInvoices as AgriInvoice[],
  expenses: (s: any) => s.agricultureAux.expenses     as FarmExpense[],
  harvests: (s: any) => s.agricultureAux.harvests     as HarvestRecord[],
}

export default farmsReducer
