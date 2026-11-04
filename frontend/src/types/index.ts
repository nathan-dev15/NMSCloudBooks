export type UserRole = 'super_admin' | 'admin' | 'primary_user' | 'secondary_user'

export type DomainModule = 'civil' | 'retail' | 'agriculture' | 'general'

export type BillingPeriod = 'trial' | 'quarterly' | 'yearly'

export interface SubscriptionPlan {
  id: number
  name: string
  slug: string
  description: string | null
  price_monthly: number
  price_quarterly: number
  price_yearly: number
  trial_days: number
  max_users: number | null
  max_companies: number | null
  enabled_modules: DomainModule[]
  features: string[]
  is_active: boolean
  display_order: number
}

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
  business_type_id?: number
}

export interface Tenant {
  id: number
  name: string
  slug: string
  is_active: boolean
  subscription_plan_id: number | null
  subscription_plan: SubscriptionPlan | null
  billing_period: BillingPeriod | null
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

export interface Company {
  id: number
  created_by_admin_id: number
  tenant_id: number
  name: string
  slug: string
  invoice_prefix: string
  invoice_starting_number: number
  email: string
  phone: string
  address: string
  gstin: string
  logo_url: string | null
  seal_url: string | null
  signature_url: string | null
  is_active: boolean
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

// ── Mind Maps ───────────────────────────────────────────────────────────────

export interface MindMapNode {
  id: number
  mind_map_id: number
  parent_node_id: number | null
  title: string
  description: string | null
  position_x: number
  position_y: number
  color: string | null
  style_data: Record<string, unknown> | null
  is_collapsed: boolean
  sort_order: number
}

export interface MindMapEdge {
  id: number
  mind_map_id: number
  source_node_id: number
  target_node_id: number
  edge_type: string
  style_data: Record<string, unknown> | null
}

export interface MindMapSummary {
  id: number
  title: string
  description: string | null
  created_at: string
  updated_at: string
  node_count: number
}

export interface MindMapDetail {
  id: number
  user_id: number | null
  tenant_id: number | null
  title: string
  description: string | null
  created_at: string
  updated_at: string
  nodes: MindMapNode[]
  edges: MindMapEdge[]
}
