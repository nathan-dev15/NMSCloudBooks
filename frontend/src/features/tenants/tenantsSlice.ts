import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { api, extractError } from '@/services/api'
import type { Tenant, DomainModule } from '@/types'

interface TenantsState {
  items: Tenant[]
  isLoading: boolean
  error: string | null
}

const initialState: TenantsState = { items: [], isLoading: false, error: null }

export const fetchTenants = createAsyncThunk('tenants/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<Tenant[]>('/tenants')
    return data
  } catch (e) { return rejectWithValue(extractError(e)) }
})

export const createTenant = createAsyncThunk(
  'tenants/create',
  async (payload: Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.post<Tenant>('/tenants', payload)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const updateTenant = createAsyncThunk(
  'tenants/update',
  async ({ id, ...payload }: { id: number } & Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.patch<Tenant>(`/tenants/${id}`, payload)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const toggleModule = createAsyncThunk(
  'tenants/toggleModule',
  async ({ tenantId, module, enabled }: { tenantId: number; module: DomainModule; enabled: boolean }, { rejectWithValue }) => {
    try {
      const { data } = await api.post<Tenant>(`/tenants/${tenantId}/modules`, { module, enabled })
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

const tenantsSlice = createSlice({
  name: 'tenants',
  initialState,
  reducers: { clearError: (state) => { state.error = null } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTenants.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(fetchTenants.fulfilled, (state, { payload }) => { state.isLoading = false; state.items = payload })
      .addCase(fetchTenants.rejected, (state, { payload }) => { state.isLoading = false; state.error = payload as string })
      .addCase(createTenant.fulfilled, (state, { payload }) => { state.items.unshift(payload) })
      .addCase(updateTenant.fulfilled, (state, { payload }) => {
        const idx = state.items.findIndex((t) => t.id === payload.id)
        if (idx !== -1) state.items[idx] = payload
      })
      .addCase(toggleModule.fulfilled, (state, { payload }) => {
        const idx = state.items.findIndex((t) => t.id === payload.id)
        if (idx !== -1) state.items[idx] = payload
      })
  },
})

export const { clearError } = tenantsSlice.actions
export default tenantsSlice.reducer
