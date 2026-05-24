export type UserRole = 'super_admin' | 'admin' | 'primary_user' | 'secondary_user'

export type SubscriptionPlan = 'basic' | 'pro' | 'enterprise'

export type DomainModule = 'civil' | 'retail' | 'agriculture' | 'general'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  is_verified: boolean
  phone: string | null
  avatar_url: string | null
  tenant_id: number | null
  preferences: UserPreferences
}

export interface UserPreferences {
  theme: 'light' | 'dark'
  notifications: boolean
  timezone: string
}

export interface Tenant {
  id: number
  name: string
  slug: string
  is_active: boolean
  plan: SubscriptionPlan
  enabled_modules: DomainModule[]
  branding: TenantBranding
  email: string | null
  phone: string | null
  gstin: string | null
}

export interface TenantBranding {
  logo_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  font_family: string
  company_name: string
  tagline: string
  header_config: Record<string, unknown>
  footer_config: Record<string, unknown>
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export interface ApiError {
  detail: string
}
