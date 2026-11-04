import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { authService } from '@/services/modules/authService'
import { tokenService } from '@/services/core/tokenService'
import type { User } from '@/types'

// ── State ─────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null
  access_token: string | null
  refresh_token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

const initialState: AuthState = {
  user: null,
  access_token: tokenService.accessToken,
  refresh_token: tokenService.refreshToken,
  isAuthenticated: tokenService.hasTokens(),
  isLoading: false,
  error: null,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const extractError = (e: unknown): string => {
  if (e && typeof e === 'object') {
    // ApiError from apiHandler (plain object with kind/message/detail)
    if ('detail' in e && e.detail) {
      const d = (e as { detail: unknown }).detail
      if (Array.isArray(d)) return d.map((x: Record<string, unknown>) => String(x.msg ?? x)).join('; ')
      if (typeof d === 'string') return d
    }
    if ('message' in e && typeof (e as { message: unknown }).message === 'string') {
      return (e as { message: string }).message
    }
    // Legacy AxiosError shape
    if ('response' in e) {
      const r = (e as { response?: { data?: { detail?: unknown } } }).response
      const detail = r?.data?.detail
      if (Array.isArray(detail)) return detail.map((x: Record<string, unknown>) => String(x.msg ?? x)).join('; ')
      if (typeof detail === 'string') return detail
    }
  }
  if (e instanceof Error) return e.message
  return 'An unexpected error occurred'
}

// ── Thunks ────────────────────────────────────────────────────────────────────

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data: tokens } = await authService.login(credentials)
      tokenService.setTokens(tokens)
      const { data: user } = await authService.me()
      return { tokens, user }
    } catch (e) {
      return rejectWithValue(extractError(e))
    }
  }
)

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await authService.me()
      return data
    } catch (e) {
      return rejectWithValue(extractError(e))
    }
  }
)

export const refreshTokens = createAsyncThunk(
  'auth/refreshTokens',
  async (_, { rejectWithValue }) => {
    const rt = tokenService.refreshToken
    if (!rt) return rejectWithValue('No refresh token available')
    try {
      const { data: tokens } = await authService.refresh({ refresh_token: rt })
      tokenService.setTokens(tokens)
      return tokens
    } catch (e) {
      tokenService.clearTokens()
      return rejectWithValue(extractError(e))
    }
  }
)

export const logout = createAsyncThunk('auth/logout', async () => {
  try { await authService.logout() } catch { /* ignore */ }
  tokenService.clearTokens()
})

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (email: string, { rejectWithValue }) => {
    try {
      const { data } = await authService.forgotPassword({ email })
      return data
    } catch (e) {
      return rejectWithValue(extractError(e))
    }
  }
)

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (payload: { token: string; new_password: string }, { rejectWithValue }) => {
    try {
      const { data } = await authService.resetPassword(payload)
      return data
    } catch (e) {
      return rejectWithValue(extractError(e))
    }
  }
)

// ── Slice ─────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null },
    setUser: (state, action: PayloadAction<User>) => { state.user = action.payload },
    // Called by api.ts after a silent token refresh
    tokenRefreshed: (state, action: PayloadAction<{ access_token: string; refresh_token: string }>) => {
      state.access_token = action.payload.access_token
      state.refresh_token = action.payload.refresh_token
    },
  },
  extraReducers: (builder) => {
    builder
      // login
      .addCase(login.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.isLoading = false
        state.isAuthenticated = true
        state.user = payload.user
        state.access_token = payload.tokens.access_token
        state.refresh_token = payload.tokens.refresh_token
      })
      .addCase(login.rejected, (state, { payload }) => {
        state.isLoading = false
        state.error = payload as string
      })

      // fetchCurrentUser
      .addCase(fetchCurrentUser.fulfilled, (state, { payload }) => {
        state.user = payload
        state.isAuthenticated = true
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.isAuthenticated = false
        state.user = null
        state.access_token = null
        state.refresh_token = null
      })

      // refreshTokens
      .addCase(refreshTokens.fulfilled, (state, { payload }) => {
        state.access_token = payload.access_token
        state.refresh_token = payload.refresh_token
        state.isAuthenticated = true
      })
      .addCase(refreshTokens.rejected, (state) => {
        state.user = null
        state.isAuthenticated = false
        state.access_token = null
        state.refresh_token = null
      })

      // logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.isAuthenticated = false
        state.access_token = null
        state.refresh_token = null
      })
  },
})

export const { clearError, setUser, tokenRefreshed } = authSlice.actions
export default authSlice.reducer
