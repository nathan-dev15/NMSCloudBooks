/**
 * NMSCloudBooks — Generic API Handler
 * SOW §6.4.5 / §6.4.6
 *
 * Features:
 *  • Automatic retry with exponential backoff (1s → 2s → 4s)
 *  • Retry only on network errors and 5xx — never on 4xx
 *  • Circuit breaker: stops after 5 consecutive failures, resets after 30s
 *  • Request deduplication: collapses identical GET calls within 500ms
 *  • Request cancellation via AbortController
 *  • Structured error classification
 *  • Dev-mode request/response logging
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios'
import { tokenService } from '@/services/core/tokenService'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ErrorKind = 'network' | 'server' | 'auth' | 'forbidden' | 'not_found' | 'validation' | 'unknown'

export interface ApiError {
  kind: ErrorKind
  message: string
  status?: number
  detail?: unknown
  retryable: boolean
}

export interface ApiResponse<T = unknown> {
  data: T
  status: number
  headers: Record<string, string>
}

interface RetryConfig {
  maxAttempts: number          // total attempts including initial (default 3)
  backoffMs: number[]          // delay per retry attempt in ms
  retryOn5xx: boolean
  retryOnNetwork: boolean
}

interface CircuitBreakerState {
  failures: number
  openedAt: number | null      // timestamp when circuit opened
  resetAfterMs: number         // how long circuit stays open
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

const CIRCUIT_BREAKER: CircuitBreakerState = {
  failures: 0,
  openedAt: null,
  resetAfterMs: 30_000,
}

const MAX_FAILURES_BEFORE_OPEN = 5

function isCircuitOpen(): boolean {
  if (CIRCUIT_BREAKER.openedAt === null) return false
  if (Date.now() - CIRCUIT_BREAKER.openedAt > CIRCUIT_BREAKER.resetAfterMs) {
    // Half-open: allow one probe
    CIRCUIT_BREAKER.openedAt = null
    CIRCUIT_BREAKER.failures = 0
    return false
  }
  return true
}

function recordSuccess(): void {
  CIRCUIT_BREAKER.failures = 0
  CIRCUIT_BREAKER.openedAt = null
}

function recordFailure(): void {
  CIRCUIT_BREAKER.failures += 1
  if (CIRCUIT_BREAKER.failures >= MAX_FAILURES_BEFORE_OPEN) {
    CIRCUIT_BREAKER.openedAt = Date.now()
    console.warn('[API] Circuit breaker OPENED — too many failures')
  }
}

// ─── Request Deduplication ────────────────────────────────────────────────────

const IN_FLIGHT: Map<string, Promise<ApiResponse<unknown>>> = new Map()
const DEDUP_WINDOW_MS = 500

function dedupKey(method: string, url: string, params?: unknown): string {
  return `${method.toUpperCase()}:${url}:${JSON.stringify(params ?? '')}`
}

// ─── Error Classification ─────────────────────────────────────────────────────

function classifyError(error: AxiosError): ApiError {
  if (!error.response) {
    // Pure network error (no response received)
    return {
      kind: 'network',
      message: 'Network error — check your connection',
      retryable: true,
    }
  }

  const status = error.response.status
  const detail = (error.response.data as Record<string, unknown>)?.detail ?? error.message

  if (status === 401) return { kind: 'auth',       message: 'Authentication required', status, detail, retryable: false }
  if (status === 403) return { kind: 'forbidden',  message: 'Access denied',           status, detail, retryable: false }
  if (status === 404) return { kind: 'not_found',  message: 'Resource not found',      status, detail, retryable: false }
  if (status === 422) return { kind: 'validation', message: String(detail),            status, detail, retryable: false }
  if (status >= 400 && status < 500) {
    return { kind: 'unknown', message: String(detail), status, detail, retryable: false }
  }
  if (status >= 500) {
    return { kind: 'server', message: 'Server error — retrying…', status, detail, retryable: true }
  }
  return { kind: 'unknown', message: String(detail), status, detail, retryable: false }
}

// ─── Sleep helper ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))

// ─── Logger ──────────────────────────────────────────────────────────────────

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true

function logRequest(method: string, url: string, attempt: number): void {
  if (!isDev) return
  const label = attempt > 1 ? ` [retry ${attempt - 1}]` : ''
  console.debug(`[API] ▶ ${method.toUpperCase()} ${url}${label}`)
}

function logResponse(method: string, url: string, status: number, ms: number): void {
  if (!isDev) return
  const color = status < 400 ? '\x1b[32m' : '\x1b[31m'
  console.debug(`[API] ◀ ${method.toUpperCase()} ${url} ${color}${status}\x1b[0m (${ms}ms)`)
}

// ─── Core Axios Instance ──────────────────────────────────────────────────────

const BASE_URL = typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : 'http://localhost:8000'
export const API_BASE_URL = BASE_URL

const axiosInstance: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

// ── Request interceptor — inject JWT ─────────────────────────────────────────
axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenService.accessToken
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor — auto-refresh on 401 ───────────────────────────────
axiosInstance.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const requestUrl = original.url ?? ''
    // Never intercept auth endpoints — let their 401s surface as normal errors
    const isAuthEndpoint = /\/auth\/(login|refresh|setup)/.test(requestUrl)
    const isPublicPage = /^\/mind-maps/.test(window.location.pathname)
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint && !isPublicPage) {
      original._retry = true
      const refresh = tokenService.refreshToken
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refresh_token: refresh })
          tokenService.setTokens(data)
          original.headers!.Authorization = `Bearer ${data.access_token}`
          return axiosInstance(original)
        } catch {
          tokenService.clearTokens()
          if (window.location.pathname !== '/login') window.location.href = '/login'
        }
      } else {
        tokenService.clearTokens()
        if (window.location.pathname !== '/login') window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ─── Core Request With Retry ──────────────────────────────────────────────────

const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 3,
  backoffMs: [1000, 2000, 4000],
  retryOn5xx: true,
  retryOnNetwork: true,
}

async function executeWithRetry<T>(
  config: AxiosRequestConfig,
  retryConfig: RetryConfig = DEFAULT_RETRY,
  signal?: AbortSignal,
): Promise<ApiResponse<T>> {
  if (isCircuitOpen()) {
    throw {
      kind: 'server',
      message: 'Service temporarily unavailable (circuit open)',
      retryable: false,
    } satisfies ApiError
  }

  let lastError: ApiError | null = null

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    const t0 = Date.now()
    logRequest(config.method ?? 'GET', config.url ?? '', attempt)

    try {
      const response: AxiosResponse<T> = await axiosInstance({ ...config, signal })
      const ms = Date.now() - t0
      logResponse(config.method ?? 'GET', config.url ?? '', response.status, ms)
      recordSuccess()

      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
      }
    } catch (err) {
      if (axios.isCancel(err)) {
        throw { kind: 'unknown', message: 'Request cancelled', retryable: false } satisfies ApiError
      }

      const apiError = classifyError(err as AxiosError)
      lastError = apiError
      logResponse(config.method ?? 'GET', config.url ?? '', apiError.status ?? 0, Date.now() - t0)

      const shouldRetry =
        apiError.retryable &&
        ((apiError.kind === 'network' && retryConfig.retryOnNetwork) ||
          (apiError.kind === 'server' && retryConfig.retryOn5xx))

      if (!shouldRetry || attempt === retryConfig.maxAttempts) {
        recordFailure()
        throw apiError
      }

      const delay = retryConfig.backoffMs[attempt - 1] ?? 4000
      if (isDev) console.debug(`[API] Retrying in ${delay}ms (attempt ${attempt}/${retryConfig.maxAttempts})…`)
      await sleep(delay)
    }
  }

  throw lastError!
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RequestOptions {
  params?: Record<string, unknown>
  headers?: Record<string, string>
  signal?: AbortSignal
  timeout?: number
  retry?: Partial<RetryConfig>
  deduplicate?: boolean          // default true for GET
  onUploadProgress?: (pct: number) => void
}

function mergeRetry(opts?: Partial<RetryConfig>): RetryConfig {
  return { ...DEFAULT_RETRY, ...opts }
}

/**
 * GET — with deduplication by default
 */
async function get<T>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { params, headers, signal, timeout, retry, deduplicate = true } = options
  const config: AxiosRequestConfig = { method: 'GET', url, params, headers, timeout }

  if (deduplicate) {
    const key = dedupKey('GET', url, params)
    const inflight = IN_FLIGHT.get(key)
    if (inflight) {
      if (isDev) console.debug(`[API] Dedup hit for GET ${url}`)
      return inflight as Promise<ApiResponse<T>>
    }
    const promise = executeWithRetry<T>(config, mergeRetry(retry), signal)
    IN_FLIGHT.set(key, promise as Promise<ApiResponse<unknown>>)
    setTimeout(() => IN_FLIGHT.delete(key), DEDUP_WINDOW_MS)
    return promise
  }

  return executeWithRetry<T>(config, mergeRetry(retry), signal)
}

async function post<T>(url: string, data?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { params, headers, signal, timeout, retry, onUploadProgress } = options
  const isFormData = data instanceof FormData
  const config: AxiosRequestConfig = {
    method: 'POST', url, data, params, timeout, signal,
    headers: isFormData ? { ...headers, 'Content-Type': 'multipart/form-data' } : headers,
    onUploadProgress: onUploadProgress
      ? (e) => { if (e.total) onUploadProgress(Math.round((e.loaded * 100) / e.total)) }
      : undefined,
  }
  // Don't retry mutations by default
  return executeWithRetry<T>(config, mergeRetry({ ...retry, maxAttempts: 1 }), signal)
}

async function put<T>(url: string, data?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { params, headers, signal, timeout, retry } = options
  return executeWithRetry<T>(
    { method: 'PUT', url, data, params, headers, timeout },
    mergeRetry({ ...retry, maxAttempts: 1 }),
    signal,
  )
}

async function patch<T>(url: string, data?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { params, headers, signal, timeout, retry } = options
  return executeWithRetry<T>(
    { method: 'PATCH', url, data, params, headers, timeout },
    mergeRetry({ ...retry, maxAttempts: 1 }),
    signal,
  )
}

async function del<T = void>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { params, headers, signal, timeout, retry } = options
  return executeWithRetry<T>(
    { method: 'DELETE', url, params, headers, timeout },
    mergeRetry({ ...retry, maxAttempts: 1 }),
    signal,
  )
}

/**
 * Download a file (PDF, CSV, Excel) — triggers browser Save-As dialog
 */
async function download(url: string, filename: string, options: RequestOptions = {}): Promise<void> {
  const { params, signal } = options
  const response = await axiosInstance.get(url, {
    params,
    responseType: 'blob',
    signal,
  })
  const blob = new Blob([response.data], { type: String(response.headers['content-type'] ?? '') })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

/**
 * Create a cancellable request pair — call cancel() to abort the request
 */
function createCancellable() {
  const controller = new AbortController()
  return { signal: controller.signal, cancel: () => controller.abort() }
}

/**
 * Extract a human-readable error string from a caught ApiError or unknown
 */
function extractError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as Record<string, unknown>)?.detail
    if (Array.isArray(detail)) {
      return detail.map((e: Record<string, unknown>) => String(e.msg ?? e)).join('; ')
    }
    if (detail && typeof detail === 'string') return detail
    return error.message
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as ApiError).message)
  }
  return 'An unexpected error occurred'
}

export const apiHandler = { get, post, put, patch, delete: del, download, createCancellable, extractError }

// Backward-compatible default axios instance for existing code
export { axiosInstance as api }
export default apiHandler
