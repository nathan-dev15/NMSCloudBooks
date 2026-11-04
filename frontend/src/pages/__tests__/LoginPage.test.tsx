import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import LoginPage from '../LoginPage'
import authReducer, { login } from '@/features/auth/authSlice'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

jest.mock('@/features/auth/authSlice', () => {
  const actual = jest.requireActual('@/features/auth/authSlice')
  const mockedLogin = Object.assign(jest.fn(), {
    fulfilled: actual.login.fulfilled,
    rejected:  actual.login.rejected,
    pending:   actual.login.pending,
    typePrefix: actual.login.typePrefix,
  })
  return { __esModule: true, ...actual, login: mockedLogin }
})

const mockedLogin = login as jest.MockedFunction<typeof login>

function makeStore(preloadedState = {}) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState,
  })
}

function renderLoginPage(storeState = {}) {
  const store = makeStore(storeState)
  return {
    ...render(
      <Provider store={store}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </Provider>
    ),
    store,
  }
}

// ---------------------------------------------------------------------------
// Rendering tests
// ---------------------------------------------------------------------------

describe('LoginPage rendering', () => {
  it('renders the app name', () => {
    renderLoginPage()
    expect(screen.getByText('NMSCloudBooks')).toBeInTheDocument()
  })

  it('renders email and password fields', () => {
    renderLoginPage()
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('renders the sign in button', () => {
    renderLoginPage()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows error message when auth state has error', () => {
    renderLoginPage({
      auth: {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Invalid email or password',
      },
    })
    expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
  })

  it('disables button while loading', () => {
    renderLoginPage({
      auth: {
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
      },
    })
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    expect(screen.getByText(/signing in/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Interaction tests
// ---------------------------------------------------------------------------

describe('LoginPage interactions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('updates email field on input', async () => {
    renderLoginPage()
    const emailInput = screen.getByPlaceholderText('you@company.com')
    await userEvent.type(emailInput, 'test@example.com')
    expect(emailInput).toHaveValue('test@example.com')
  })

  it('updates password field on input', async () => {
    renderLoginPage()
    const passwordInput = screen.getByPlaceholderText('••••••••')
    await userEvent.type(passwordInput, 'secret123')
    expect(passwordInput).toHaveValue('secret123')
  })

  it('calls login dispatch on form submit', async () => {
    mockedLogin.mockReturnValue({
      type: 'auth/login/rejected',
      payload: 'error',
    } as any)

    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'admin@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'Password123')
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockedLogin).toHaveBeenCalledWith({
        email: 'admin@test.com',
        password: 'Password123',
      })
    })
  })

  it('does not submit with empty email', async () => {
    renderLoginPage()
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }))
    expect(mockedLogin).not.toHaveBeenCalled()
  })
})
