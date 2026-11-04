import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { companyService } from '@/services'
import type { Company } from '@/types'
import type { CreateCompanyPayload, UpdateCompanyPayload } from '@/services/modules/companyService'

interface CompaniesState {
  items: Company[]
  isLoading: boolean
  error: string | null
}

const initialState: CompaniesState = { items: [], isLoading: false, error: null }

const extractError = (e: unknown): string => {
  if (e && typeof e === 'object' && 'response' in e) {
    const r = (e as { response?: { data?: { detail?: string } } }).response
    return r?.data?.detail ?? 'An error occurred'
  }
  return 'An error occurred'
}

export const fetchCompanies = createAsyncThunk(
  'companies/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const res = await companyService.listCompanies()
      return res.data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const createCompany = createAsyncThunk(
  'companies/create',
  async (payload: CreateCompanyPayload, { rejectWithValue }) => {
    try {
      const res = await companyService.createCompany(payload)
      return res.data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const updateCompany = createAsyncThunk(
  'companies/update',
  async ({ id, ...payload }: { id: number } & UpdateCompanyPayload, { rejectWithValue }) => {
    try {
      const res = await companyService.updateCompany(id, payload)
      return res.data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const deleteCompany = createAsyncThunk(
  'companies/delete',
  async (id: number, { rejectWithValue }) => {
    try {
      await companyService.deleteCompany(id)
      return id
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

const companiesSlice = createSlice({
  name: 'companies',
  initialState,
  reducers: { clearError: (state) => { state.error = null } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanies.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(fetchCompanies.fulfilled, (state, { payload }) => { state.isLoading = false; state.items = payload })
      .addCase(fetchCompanies.rejected, (state, { payload }) => { state.isLoading = false; state.error = payload as string })

      .addCase(createCompany.fulfilled, (state, { payload }) => { state.items.unshift(payload) })
      .addCase(createCompany.rejected, (state, { payload }) => { state.error = payload as string })

      .addCase(updateCompany.fulfilled, (state, { payload }) => {
        const idx = state.items.findIndex((c) => c.id === payload.id)
        if (idx !== -1) state.items[idx] = payload
      })
      .addCase(updateCompany.rejected, (state, { payload }) => { state.error = payload as string })

      .addCase(deleteCompany.fulfilled, (state, { payload }) => {
        state.items = state.items.filter((c) => c.id !== payload)
      })
      .addCase(deleteCompany.rejected, (state, { payload }) => { state.error = payload as string })
  },
})

export const { clearError } = companiesSlice.actions
export default companiesSlice.reducer
