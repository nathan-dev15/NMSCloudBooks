import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { api, extractError } from '@/services/api'
import type { User, PaginatedResponse } from '@/types'

export interface UserLog {
  id: number
  action: string
  resource_type: string
  resource_id: string | null
  description: string | null
  status: string | null
  timestamp: string | null
}

interface UsersState {
  items: User[]
  total: number
  page: number
  pages: number
  isLoading: boolean
  error: string | null
}

const initialState: UsersState = {
  items: [], total: 0, page: 1, pages: 0, isLoading: false, error: null,
}

export const fetchUsers = createAsyncThunk(
  'users/fetchAll',
  async ({ page = 1, size = 20, role, search }: { page?: number; size?: number; role?: string; search?: string }, { rejectWithValue }) => {
    try {
      const params: Record<string, unknown> = { page, size }
      if (role)   params.role   = role
      if (search) params.search = search
      const { data } = await api.get<PaginatedResponse<User>>('/users', { params })
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const fetchAdminTeam = createAsyncThunk(
  'users/fetchAdminTeam',
  async ({ adminId, role }: { adminId: number; role?: string }, { rejectWithValue }) => {
    try {
      const params: Record<string, unknown> = { size: 200 }
      if (role) params.role = role
      const { data } = await api.get<PaginatedResponse<User>>(`/users/${adminId}/team`, { params })
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const fetchUserLogs = createAsyncThunk(
  'users/fetchLogs',
  async (userId: number, { rejectWithValue }) => {
    try {
      const { data } = await api.get<UserLog[]>(`/users/${userId}/logs`, { params: { limit: 50 } })
      return { userId, logs: data }
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const createUser = createAsyncThunk(
  'users/create',
  async (payload: Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.post<User>('/users', payload)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const updateUser = createAsyncThunk(
  'users/update',
  async ({ id, ...payload }: { id: number } & Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.patch<User>(`/users/${id}`, payload)
      return data
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

export const deleteUser = createAsyncThunk(
  'users/delete',
  async (id: number, { rejectWithValue }) => {
    try {
      await api.delete(`/users/${id}`)
      return id
    } catch (e) { return rejectWithValue(extractError(e)) }
  }
)

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: { clearError: (state) => { state.error = null } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(fetchUsers.fulfilled, (state, { payload }) => {
        state.isLoading = false
        state.items  = payload.items
        state.total  = payload.total
        state.page   = payload.page
        state.pages  = payload.pages
      })
      .addCase(fetchUsers.rejected, (state, { payload }) => {
        state.isLoading = false; state.error = payload as string
      })
      .addCase(createUser.fulfilled, (state, { payload }) => {
        state.items.unshift(payload); state.total += 1
      })
      .addCase(updateUser.fulfilled, (state, { payload }) => {
        const idx = state.items.findIndex((u) => u.id === payload.id)
        if (idx !== -1) state.items[idx] = payload
      })
      .addCase(deleteUser.fulfilled, (state, { payload }) => {
        state.items = state.items.filter((u) => u.id !== payload)
        state.total -= 1
      })
  },
})

export const { clearError } = usersSlice.actions
export default usersSlice.reducer
