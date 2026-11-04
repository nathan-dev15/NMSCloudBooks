import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { api, extractError } from '@/services/api'
import type { SubscriptionPlan } from '@/types'

interface SubscriptionPlansState {
  items: SubscriptionPlan[]
  isLoading: boolean
  error: string | null
}

const initialState: SubscriptionPlansState = { items: [], isLoading: false, error: null }

export const fetchSubscriptionPlans = createAsyncThunk(
  'subscriptionPlans/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get<SubscriptionPlan[]>('/subscription-plans')
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const fetchAllSubscriptionPlans = createAsyncThunk(
  'subscriptionPlans/fetchAllAdmin',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get<SubscriptionPlan[]>('/subscription-plans/all')
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const createSubscriptionPlan = createAsyncThunk(
  'subscriptionPlans/create',
  async (payload: Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.post<SubscriptionPlan>('/subscription-plans', payload)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const updateSubscriptionPlan = createAsyncThunk(
  'subscriptionPlans/update',
  async ({ id, ...payload }: { id: number } & Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.patch<SubscriptionPlan>(`/subscription-plans/${id}`, payload)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const deleteSubscriptionPlan = createAsyncThunk(
  'subscriptionPlans/delete',
  async (id: number, { rejectWithValue }) => {
    try {
      await api.delete(`/subscription-plans/${id}`)
      return id
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

const subscriptionPlansSlice = createSlice({
  name: 'subscriptionPlans',
  initialState,
  reducers: { clearError: (state) => { state.error = null } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubscriptionPlans.pending,  (state) => { state.isLoading = true; state.error = null })
      .addCase(fetchSubscriptionPlans.fulfilled, (state, { payload }) => { state.isLoading = false; state.items = payload })
      .addCase(fetchSubscriptionPlans.rejected,  (state, { payload }) => { state.isLoading = false; state.error = payload as string })
      .addCase(fetchAllSubscriptionPlans.pending,  (state) => { state.isLoading = true; state.error = null })
      .addCase(fetchAllSubscriptionPlans.fulfilled, (state, { payload }) => { state.isLoading = false; state.items = payload })
      .addCase(fetchAllSubscriptionPlans.rejected,  (state, { payload }) => { state.isLoading = false; state.error = payload as string })
      .addCase(createSubscriptionPlan.fulfilled, (state, { payload }) => {
        state.items.push(payload)
        state.items.sort((a, b) => a.display_order - b.display_order)
      })
      .addCase(updateSubscriptionPlan.fulfilled, (state, { payload }) => {
        const idx = state.items.findIndex((p) => p.id === payload.id)
        if (idx !== -1) state.items[idx] = payload
      })
      .addCase(deleteSubscriptionPlan.fulfilled, (state, { payload }) => {
        state.items = state.items.filter((p) => p.id !== payload)
      })
  },
})

export const { clearError } = subscriptionPlansSlice.actions
export default subscriptionPlansSlice.reducer
