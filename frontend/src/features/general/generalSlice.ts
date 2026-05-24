import { createEntitySlice } from '@/app/createEntitySlice'
import apiHandler from '@/services/apiHandler'
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

export type BillingCycle       = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half_yearly' | 'annual' | 'one_time'
export type SubscriptionStatus = 'trial' | 'active' | 'paused' | 'expired' | 'cancelled'
export type GenInvoiceStatus   = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled'
export type RecurringStatus    = 'active' | 'paused' | 'stopped'

export interface Service {
  id:          number
  tenant_id:   number
  category_id: number | null
  name:        string
  code:        string | null
  description: string | null
  unit:        string
  rate:        number
  tax_rate:    number
  hsn_sac:     string | null
  is_active:   boolean
  tags:        string[]
}

export interface SubscriptionPlan {
  id:            number
  tenant_id:     number
  name:          string
  code:          string | null
  billing_cycle: BillingCycle
  price:         number
  tax_rate:      number
  trial_days:    number
  features:      string[]
  is_active:     boolean
  currency:      string
}

export interface ClientSubscription {
  id:                  number
  tenant_id:           number
  client_id:           number
  plan_id:             number
  status:              SubscriptionStatus
  start_date:          string
  next_billing_date:   string | null
  end_date:            string | null
  custom_price:        number | null
  discount_pct:        number
  auto_renew:          boolean
  invoices_generated:  number
  total_billed:        number
}

export interface RecurringTemplate {
  id:                 number
  tenant_id:          number
  client_id:          number
  name:               string
  billing_cycle:      BillingCycle
  status:             RecurringStatus
  next_run_date:      string
  end_date:           string | null
  payment_due_days:   number
  currency:           string
  invoices_generated: number
  line_items:         any[]
}

export interface GenInvoice {
  id:               number
  tenant_id:        number
  client_id:        number
  subscription_id:  number | null
  template_id:      number | null
  invoice_number:   string
  invoice_date:     string
  due_date:         string
  service_period_start: string | null
  service_period_end:   string | null
  status:           GenInvoiceStatus
  currency:         string
  subtotal:         number
  discount_amount:  number
  taxable_amount:   number
  tax_amount:       number
  round_off:        number
  grand_total:      number
  amount_paid:      number
  amount_due:       number
  billing_name:     string | null
  notes:            string | null
  terms:            string | null
  tags:             string[]
  items:            any[]
}

// ── Entity slices ─────────────────────────────────────────────────────────────

const serviceEntity      = createEntitySlice<Service>('services', '/general/services')
const invoiceEntity      = createEntitySlice<GenInvoice>('genInvoices', '/general/invoices')
const subscriptionEntity = createEntitySlice<ClientSubscription>('subscriptions', '/general/subscriptions')

export const {
  slice: servicesSlice,   reducer: servicesReducer,
  thunks: servicesThunks, selectors: servicesSelectors,
} = serviceEntity

export const {
  slice: genInvoicesSlice,   reducer: genInvoicesReducer,
  thunks: genInvoicesThunks, selectors: genInvoicesSelectors,
} = invoiceEntity

export const {
  slice: subscriptionsSlice,   reducer: subscriptionsReducer,
  thunks: subscriptionsThunks, selectors: subscriptionsSelectors,
} = subscriptionEntity

// ── Aux state ─────────────────────────────────────────────────────────────────

interface GeneralAuxState {
  plans:     SubscriptionPlan[]
  templates: RecurringTemplate[]
  loading:   boolean
}

export const fetchPlans     = createAsyncThunk('generalAux/fetchPlans',     async () => (await apiHandler.get<SubscriptionPlan[]>('/general/plans')).data!)
export const fetchTemplates = createAsyncThunk('generalAux/fetchTemplates', async () => (await apiHandler.get<RecurringTemplate[]>('/general/recurring-templates')).data!)

export const generateFromTemplate = createAsyncThunk(
  'generalAux/generateFromTemplate',
  async ({ templateId, invoice_date }: { templateId: number; invoice_date: string }) => {
    const res = await apiHandler.post<GenInvoice>(`/general/recurring-templates/${templateId}/generate`, { template_id: templateId, invoice_date })
    return res.data!
  }
)

export const updateGenInvoiceStatus = createAsyncThunk(
  'generalAux/updateInvoiceStatus',
  async ({ invoiceId, status, amount_paid }: { invoiceId: number; status: GenInvoiceStatus; amount_paid?: number }) => {
    const res = await apiHandler.patch<GenInvoice>(`/general/invoices/${invoiceId}/status`, { status, amount_paid })
    return res.data!
  }
)

const auxSlice = createSlice({
  name: 'generalAux',
  initialState: { plans: [], templates: [], loading: false } as GeneralAuxState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchPlans.fulfilled,     (s, a) => { s.plans     = a.payload; s.loading = false })
    b.addCase(fetchTemplates.fulfilled, (s, a) => { s.templates = a.payload; s.loading = false })
    b.addCase(fetchPlans.pending, (s) => { s.loading = true })
    b.addCase(fetchPlans.rejected,(s) => { s.loading = false })
  },
})

export const generalAuxReducer = auxSlice.reducer
export const generalAuxSelectors = {
  plans:     (s: any) => s.generalAux.plans     as SubscriptionPlan[],
  templates: (s: any) => s.generalAux.templates as RecurringTemplate[],
}

export default servicesReducer
