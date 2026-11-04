/**
 * TokenService — single source of truth for auth tokens.
 *
 * Responsibilities:
 *  • Persist tokens in localStorage (survives page refresh)
 *  • Keep an in-memory copy for synchronous access during API calls
 *  • Notify subscribers (used by apiHandler interceptor) on token change
 *
 * Redux stores the same tokens for UI reactivity; this service stays in
 * sync via authSlice thunks. api.ts reads from here — no circular dep.
 */

export interface Tokens {
  access_token: string
  refresh_token: string
}

type Listener = (tokens: Tokens | null) => void

const KEYS = { ACCESS: 'nms_access_token', REFRESH: 'nms_refresh_token' } as const

class TokenService {
  private _access: string | null = localStorage.getItem(KEYS.ACCESS)
  private _refresh: string | null = localStorage.getItem(KEYS.REFRESH)
  private _listeners: Listener[] = []

  // ── Read ──────────────────────────────────────────────────────────

  get accessToken(): string | null { return this._access }
  get refreshToken(): string | null { return this._refresh }

  hasTokens(): boolean { return !!this._access && !!this._refresh }

  getTokens(): Tokens | null {
    if (!this._access || !this._refresh) return null
    return { access_token: this._access, refresh_token: this._refresh }
  }

  // ── Write ─────────────────────────────────────────────────────────

  setTokens(tokens: Tokens): void {
    this._access = tokens.access_token
    this._refresh = tokens.refresh_token
    localStorage.setItem(KEYS.ACCESS, tokens.access_token)
    localStorage.setItem(KEYS.REFRESH, tokens.refresh_token)
    this._notify(tokens)
  }

  clearTokens(): void {
    this._access = null
    this._refresh = null
    localStorage.removeItem(KEYS.ACCESS)
    localStorage.removeItem(KEYS.REFRESH)
    this._notify(null)
  }

  // ── Subscribe ─────────────────────────────────────────────────────

  /** Called by api.ts to update the Authorization header after a refresh. */
  subscribe(listener: Listener): () => void {
    this._listeners.push(listener)
    return () => { this._listeners = this._listeners.filter((l) => l !== listener) }
  }

  private _notify(tokens: Tokens | null): void {
    this._listeners.forEach((l) => l(tokens))
  }
}

export const tokenService = new TokenService()
export default tokenService
