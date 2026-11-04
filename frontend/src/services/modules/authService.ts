import { ApiService } from '@/services/core/apiService'
import type { User, AuthTokens } from '@/types'

export interface LoginPayload {
  email: string
  password: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  token: string
  new_password: string
}

export interface RefreshPayload {
  refresh_token: string
}

class AuthService extends ApiService {
  constructor() { super('/auth') }

  login(payload: LoginPayload) {
    return this.raw.post<AuthTokens>(`${this.base}/login`, payload)
  }

  logout() {
    return this.raw.post<void>(`${this.base}/logout`, {})
  }

  me() {
    return this.raw.get<User>(`${this.base}/me`)
  }

  refresh(payload: RefreshPayload) {
    return this.raw.post<AuthTokens>(`${this.base}/refresh`, payload)
  }

  forgotPassword(payload: ForgotPasswordPayload) {
    return this.raw.post<{ message: string; reset_token?: string }>(
      `${this.base}/forgot-password`,
      payload,
    )
  }

  resetPassword(payload: ResetPasswordPayload) {
    return this.raw.post<{ message: string }>(
      `${this.base}/reset-password`,
      payload,
    )
  }
}

export const authService = new AuthService()
export default authService
