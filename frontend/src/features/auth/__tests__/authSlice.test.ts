import { configureStore } from '@reduxjs/toolkit'
import axios from 'axios'
import authReducer, {
  login,
  logout,
  fetchCurrentUser,
  clearError,
  setUser,
} from '../authSlice'
import type { User } from '@/types'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

// ---------------------------------------------------------------------------
// Helpers
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
      payload: mockUser,
    })
    expect(result.isAuthenticated).toBe(true)
    expect(result.user).toEqual(mockUser)
    expect(result.isLoading).toBe(false)
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
// Thunk integration tests (with mocked axios)
// ---------------------------------------------------------------------------

describe('login thunk', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })

  it('dispatches fulfilled on successful login', async () => {
    mockedAxios.create.mockReturnThis()
    mockedAxios.post
      .mockResolvedValueOnce({ data: mockTokens })   // /auth/login
    mockedAxios.get
      .mockResolvedValueOnce({ data: mockUser })      // /auth/me

    const store = makeStore()
    const result = await store.dispatch(login({ email: 'admin@test.com', password: 'Password123' }))

    expect(login.fulfilled.match(result)).toBe(true)
    if (login.fulfilled.match(result)) {
      expect(result.payload).toEqual(mockUser)
    }
  })

  it('dispatches rejected on failed login', async () => {
    mockedAxios.create.mockReturnThis()
    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { detail: 'Invalid email or password' } },
    })

    const store = makeStore()
    const result = await store.dispatch(login({ email: 'bad@test.com', password: 'wrong' }))

    expect(login.rejected.match(result)).toBe(true)
    expect(store.getState().auth.error).toBeTruthy()
  })

  it('stores tokens in localStorage on success', async () => {
    mockedAxios.create.mockReturnThis()
    mockedAxios.post.mockResolvedValueOnce({ data: mockTokens })
    mockedAxios.get.mockResolvedValueOnce({ data: mockUser })

    const store = makeStore()
    await store.dispatch(login({ email: 'admin@test.com', password: 'Password123' }))

    expect(localStorage.getItem('access_token')).toBe(mockTokens.access_token)
    expect(localStorage.getItem('refresh_token')).toBe(mockTokens.refresh_token)
  })
})

describe('logout thunk', () => {
  it('clears localStorage on logout', async () => {
    localStorage.setItem('access_token', 'some-token')
    localStorage.setItem('refresh_token', 'some-refresh')

    mockedAxios.create.mockReturnThis()
    mockedAxios.post.mockResolvedValueOnce({})

    const store = makeStore()
    await store.dispatch(logout())

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('clears localStorage even if logout API fails', async () => {
    localStorage.setItem('access_token', 'some-token')
    mockedAxios.create.mockReturnThis()
    mockedAxios.post.mockRejectedValueOnce(new Error('Network error'))

    const store = makeStore()
    await store.dispatch(logout())

    expect(localStorage.getItem('access_token')).toBeNull()
  })
})
