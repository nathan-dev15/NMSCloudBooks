import { configureStore } from '@reduxjs/toolkit'
import authReducer, {
  login,
  logout,
  fetchCurrentUser,
  clearError,
  setUser,
} from '../authSlice'
import type { User } from '@/types'

// Mock the service layer — prevents apiHandler/axios initialisation in jsdom
jest.mock('@/services/modules/authService', () => ({
  authService: {
    login: jest.fn(),
    logout: jest.fn(),
    me: jest.fn(),
    refresh: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  },
}))

import { authService } from '@/services/modules/authService'

const mockedAuthService = authService as jest.Mocked<typeof authService>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser: User = {
  id: 1,
  email: 'admin@test.com',
  full_name: 'Test Admin',
  role: 'admin',
  is_active: true,
  is_verified: true,
  phone: null,
  avatar_url: null,
  tenant_id: 1,
  preferences: { theme: 'light', notifications: true, timezone: 'Asia/Kolkata' },
}

const mockTokens = {
  access_token: 'mock.access.token',
  refresh_token: 'mock.refresh.token',
  token_type: 'bearer',
}

function makeStore() {
  return configureStore({ reducer: { auth: authReducer } })
}

// ---------------------------------------------------------------------------
// Reducer unit tests
// ---------------------------------------------------------------------------

describe('authSlice reducer', () => {
  const initialState = {
    user: null,
    access_token: null as string | null,
    refresh_token: null as string | null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  }

  it('returns initial state', () => {
    expect(authReducer(undefined, { type: '@@INIT' })).toMatchObject({
      user: null,
      isLoading: false,
      error: null,
    })
  })

  it('clearError resets error', () => {
    const state = { ...initialState, error: 'Some error' }
    const result = authReducer(state, clearError())
    expect(result.error).toBeNull()
  })

  it('setUser updates user', () => {
    const result = authReducer(initialState, setUser(mockUser))
    expect(result.user).toEqual(mockUser)
  })

  it('login.pending sets isLoading and clears error', () => {
    const state = { ...initialState, error: 'old error' }
    const result = authReducer(state, { type: login.pending.type })
    expect(result.isLoading).toBe(true)
    expect(result.error).toBeNull()
  })

  it('login.fulfilled sets user and isAuthenticated', () => {
    const result = authReducer(initialState, {
      type: login.fulfilled.type,
      payload: { tokens: mockTokens, user: mockUser },
    })
    expect(result.isAuthenticated).toBe(true)
    expect(result.user).toEqual(mockUser)
    expect(result.isLoading).toBe(false)
    expect(result.access_token).toBe(mockTokens.access_token)
  })

  it('login.rejected sets error and clears isLoading', () => {
    const result = authReducer(initialState, {
      type: login.rejected.type,
      payload: 'Invalid credentials',
    })
    expect(result.isLoading).toBe(false)
    expect(result.error).toBe('Invalid credentials')
    expect(result.isAuthenticated).toBe(false)
  })

  it('logout.fulfilled clears user and isAuthenticated', () => {
    const loggedIn = { ...initialState, user: mockUser, isAuthenticated: true }
    const result = authReducer(loggedIn, { type: logout.fulfilled.type })
    expect(result.user).toBeNull()
    expect(result.isAuthenticated).toBe(false)
  })

  it('fetchCurrentUser.fulfilled sets user', () => {
    const result = authReducer(initialState, {
      type: fetchCurrentUser.fulfilled.type,
      payload: mockUser,
    })
    expect(result.user).toEqual(mockUser)
    expect(result.isAuthenticated).toBe(true)
  })

  it('fetchCurrentUser.rejected clears auth', () => {
    const loggedIn = { ...initialState, user: mockUser, isAuthenticated: true }
    const result = authReducer(loggedIn, { type: fetchCurrentUser.rejected.type })
    expect(result.user).toBeNull()
    expect(result.isAuthenticated).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Thunk integration tests
// ---------------------------------------------------------------------------

describe('login thunk', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })

  it('dispatches fulfilled on successful login', async () => {
    mockedAuthService.login.mockResolvedValueOnce({ data: mockTokens, status: 200, headers: {} } as never)
    mockedAuthService.me.mockResolvedValueOnce({ data: mockUser, status: 200, headers: {} } as never)

    const store = makeStore()
    const result = await store.dispatch(login({ email: 'admin@test.com', password: 'Password123' }))

    expect(login.fulfilled.match(result)).toBe(true)
    if (login.fulfilled.match(result)) {
      expect(result.payload.user).toEqual(mockUser)
    }
  })

  it('dispatches rejected on failed login', async () => {
    mockedAuthService.login.mockRejectedValueOnce({ message: 'Invalid email or password' })

    const store = makeStore()
    const result = await store.dispatch(login({ email: 'bad@test.com', password: 'wrong' }))

    expect(login.rejected.match(result)).toBe(true)
    expect(store.getState().auth.error).toBeTruthy()
  })

  it('stores tokens in localStorage on success', async () => {
    mockedAuthService.login.mockResolvedValueOnce({ data: mockTokens, status: 200, headers: {} } as never)
    mockedAuthService.me.mockResolvedValueOnce({ data: mockUser, status: 200, headers: {} } as never)

    const store = makeStore()
    await store.dispatch(login({ email: 'admin@test.com', password: 'Password123' }))

    // tokenService stores under nms_* keys
    expect(localStorage.getItem('nms_access_token')).toBe(mockTokens.access_token)
    expect(localStorage.getItem('nms_refresh_token')).toBe(mockTokens.refresh_token)
  })
})

describe('logout thunk', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })

  it('clears localStorage on logout', async () => {
    localStorage.setItem('nms_access_token', 'some-token')
    localStorage.setItem('nms_refresh_token', 'some-refresh')
    mockedAuthService.logout.mockResolvedValueOnce({ data: undefined, status: 200, headers: {} } as never)

    const store = makeStore()
    await store.dispatch(logout())

    expect(localStorage.getItem('nms_access_token')).toBeNull()
    expect(localStorage.getItem('nms_refresh_token')).toBeNull()
  })

  it('clears localStorage even if logout API fails', async () => {
    localStorage.setItem('nms_access_token', 'some-token')
    mockedAuthService.logout.mockRejectedValueOnce(new Error('Network error'))

    const store = makeStore()
    await store.dispatch(logout())

    expect(localStorage.getItem('nms_access_token')).toBeNull()
  })
})
