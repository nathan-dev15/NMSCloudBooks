import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { api, extractError } from '@/services/api'
import type { Project, ProjectPlan, Block, MaterialRequest, StockEntry, DailyActivity, WeeklyBill } from './civilTypes'
import type { PaginatedResponse } from '@/types'

interface CivilState {
  projects: Project[]
  projectsTotal: number
  selectedProject: Project | null
  plans: ProjectPlan[]
  selectedBlock: Block | null

  requests: MaterialRequest[]
  requestsTotal: number

  stock: StockEntry[]
  activities: DailyActivity[]
  weeklyBills: WeeklyBill[]

  isLoading: boolean
  error: string | null
}

const initialState: CivilState = {
  projects: [], projectsTotal: 0, selectedProject: null,
  plans: [], selectedBlock: null,
  requests: [], requestsTotal: 0,
  stock: [], activities: [], weeklyBills: [],
  isLoading: false, error: null,
}

// ── Projects ─────────────────────────────────────────────────────────────────

export const fetchProjects = createAsyncThunk(
  'civil/fetchProjects',
  async (params: { page?: number; state?: string; district?: string } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get<PaginatedResponse<Project>>('/civil/projects', { params })
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const createProject = createAsyncThunk(
  'civil/createProject',
  async (payload: Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.post<Project>('/civil/projects', payload)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const updateProject = createAsyncThunk(
  'civil/updateProject',
  async ({ id, ...payload }: { id: number } & Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.patch<Project>(`/civil/projects/${id}`, payload)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

// ── Plans & Blocks ────────────────────────────────────────────────────────────

export const fetchPlans = createAsyncThunk(
  'civil/fetchPlans',
  async (projectId: number, { rejectWithValue }) => {
    try {
      const { data } = await api.get<ProjectPlan[]>(`/civil/projects/${projectId}/plans`)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const createPlan = createAsyncThunk(
  'civil/createPlan',
  async ({ projectId, ...payload }: { projectId: number } & Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.post<ProjectPlan>(`/civil/projects/${projectId}/plans`, payload)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const createBlock = createAsyncThunk(
  'civil/createBlock',
  async ({ projectId, planId, ...payload }: { projectId: number; planId: number } & Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.post<Block>(`/civil/projects/${projectId}/plans/${planId}/blocks`, payload)
      return { planId, block: data }
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const updateBlock = createAsyncThunk(
  'civil/updateBlock',
  async ({ id, ...payload }: { id: number } & Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.patch<Block>(`/civil/projects/blocks/${id}`, payload)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

// ── Material Requests ─────────────────────────────────────────────────────────

export const fetchRequests = createAsyncThunk(
  'civil/fetchRequests',
  async ({ projectId, status }: { projectId: number; status?: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.get<PaginatedResponse<MaterialRequest>>('/civil/requests', {
        params: { project_id: projectId, status },
      })
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const createRequest = createAsyncThunk(
  'civil/createRequest',
  async (payload: Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.post<MaterialRequest>('/civil/requests', payload)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const submitRequest = createAsyncThunk(
  'civil/submitRequest',
  async (requestId: number, { rejectWithValue }) => {
    try {
      const { data } = await api.post<MaterialRequest>(`/civil/requests/${requestId}/submit`)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const sendOTP = createAsyncThunk(
  'civil/sendOTP',
  async (requestId: number, { rejectWithValue }) => {
    try {
      const { data } = await api.post<MaterialRequest>(`/civil/requests/${requestId}/otp/send`)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const verifyOTP = createAsyncThunk(
  'civil/verifyOTP',
  async ({ requestId, otp }: { requestId: number; otp: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post<MaterialRequest>(`/civil/requests/${requestId}/otp/verify`, { otp })
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const rejectRequest = createAsyncThunk(
  'civil/rejectRequest',
  async ({ requestId, reason }: { requestId: number; reason: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post<MaterialRequest>(`/civil/requests/${requestId}/reject`, { reason })
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

// ── Stock ─────────────────────────────────────────────────────────────────────

export const fetchStock = createAsyncThunk(
  'civil/fetchStock',
  async (projectId: number, { rejectWithValue }) => {
    try {
      const { data } = await api.get<StockEntry[]>('/civil/stock', { params: { project_id: projectId } })
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

// ── Activities ────────────────────────────────────────────────────────────────

export const fetchActivities = createAsyncThunk(
  'civil/fetchActivities',
  async ({ blockId, fromDate, toDate }: { blockId: number; fromDate?: string; toDate?: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.get<DailyActivity[]>('/civil/billing/activities', {
        params: { block_id: blockId, from_date: fromDate, to_date: toDate },
      })
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const logActivity = createAsyncThunk(
  'civil/logActivity',
  async (payload: Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.post<DailyActivity>('/civil/billing/activities', payload)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

// ── Weekly Bills ──────────────────────────────────────────────────────────────

export const fetchWeeklyBills = createAsyncThunk(
  'civil/fetchWeeklyBills',
  async (blockId: number, { rejectWithValue }) => {
    try {
      const { data } = await api.get<WeeklyBill[]>('/civil/billing/weekly-bills', { params: { block_id: blockId } })
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const generateWeeklyBill = createAsyncThunk(
  'civil/generateWeeklyBill',
  async ({ blockId, refDate }: { blockId: number; refDate?: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post<WeeklyBill>('/civil/billing/weekly-bills/generate', null, {
        params: { block_id: blockId, ref_date: refDate },
      })
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

// ── Slice ─────────────────────────────────────────────────────────────────────

function upsertRequest(items: MaterialRequest[], updated: MaterialRequest): MaterialRequest[] {
  const idx = items.findIndex((r) => r.id === updated.id)
  if (idx !== -1) { const next = [...items]; next[idx] = updated; return next }
  return [updated, ...items]
}

const civilSlice = createSlice({
  name: 'civil',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null },
    setSelectedProject: (state, action: PayloadAction<Project | null>) => { state.selectedProject = action.payload },
    setSelectedBlock: (state, action: PayloadAction<Block | null>) => { state.selectedBlock = action.payload },
  },
  extraReducers: (builder) => {
    builder
      // Projects
      .addCase(fetchProjects.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(fetchProjects.fulfilled, (state, { payload }) => {
        state.isLoading = false; state.projects = payload.items; state.projectsTotal = payload.total
      })
      .addCase(fetchProjects.rejected, (state, { payload }) => { state.isLoading = false; state.error = payload as string })
      .addCase(createProject.fulfilled, (state, { payload }) => { state.projects.unshift(payload) })
      .addCase(updateProject.fulfilled, (state, { payload }) => {
        const i = state.projects.findIndex((p) => p.id === payload.id)
        if (i !== -1) state.projects[i] = payload
        if (state.selectedProject?.id === payload.id) state.selectedProject = payload
      })
      // Plans & Blocks
      .addCase(fetchPlans.fulfilled, (state, { payload }) => { state.plans = payload })
      .addCase(createPlan.fulfilled, (state, { payload }) => {
        state.plans.unshift({ ...payload, blocks: [] })
      })
      .addCase(createBlock.fulfilled, (state, { payload: { planId, block } }) => {
        const plan = state.plans.find((p) => p.id === planId)
        if (plan) plan.blocks.push(block)
      })
      .addCase(updateBlock.fulfilled, (state, { payload }) => {
        for (const plan of state.plans) {
          const bi = plan.blocks.findIndex((b) => b.id === payload.id)
          if (bi !== -1) { plan.blocks[bi] = payload; break }
        }
        if (state.selectedBlock?.id === payload.id) state.selectedBlock = payload
      })
      // Requests
      .addCase(fetchRequests.fulfilled, (state, { payload }) => {
        state.requests = payload.items; state.requestsTotal = payload.total
      })
      .addCase(createRequest.fulfilled, (state, { payload }) => { state.requests.unshift(payload) })
      .addCase(submitRequest.fulfilled, (state, { payload }) => { state.requests = upsertRequest(state.requests, payload) })
      .addCase(sendOTP.fulfilled, (state, { payload }) => { state.requests = upsertRequest(state.requests, payload) })
      .addCase(verifyOTP.fulfilled, (state, { payload }) => { state.requests = upsertRequest(state.requests, payload) })
      .addCase(rejectRequest.fulfilled, (state, { payload }) => { state.requests = upsertRequest(state.requests, payload) })
      // Stock
      .addCase(fetchStock.fulfilled, (state, { payload }) => { state.stock = payload })
      // Activities
      .addCase(fetchActivities.fulfilled, (state, { payload }) => { state.activities = payload })
      .addCase(logActivity.fulfilled, (state, { payload }) => { state.activities.unshift(payload) })
      // Weekly bills
      .addCase(fetchWeeklyBills.fulfilled, (state, { payload }) => { state.weeklyBills = payload })
      .addCase(generateWeeklyBill.fulfilled, (state, { payload }) => {
        const i = state.weeklyBills.findIndex((b) => b.bill_number === payload.bill_number)
        if (i !== -1) state.weeklyBills[i] = payload
        else state.weeklyBills.unshift(payload)
      })
  },
})

export const { clearError, setSelectedProject, setSelectedBlock } = civilSlice.actions
export default civilSlice.reducer
