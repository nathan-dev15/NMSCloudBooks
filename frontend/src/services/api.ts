import axios, { AxiosInstance, AxiosError } from 'axios'
import { tokenService } from '@/services/core/tokenService'

const BASE_URL = typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : 'http://localhost:8000'

export const api: AxiosInstance = (axios.create?.({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
}) ?? axios) as AxiosInstance

// Attach access token to every request via tokenService
api.interceptors?.request.use((config) => {
  const token = tokenService.accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401 — update tokenService, which keeps Redux in sync via subscriber
api.interceptors?.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = tokenService.refreshToken

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          })
          tokenService.setTokens(data)
          original.headers!.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          tokenService.clearTokens()
          window.location.href = '/login'
        }
      } else {
        tokenService.clearTokens()
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export const extractError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (Array.isArray(detail)) {
      return detail.map((e: Record<string, unknown>) => String(e.msg ?? e)).join('; ')
    }
    if (detail && typeof detail === 'string') return detail
    return error.message
  }
  return 'An unexpected error occurred'
}
