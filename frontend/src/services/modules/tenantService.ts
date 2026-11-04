import { ApiService } from '@/services/core/apiService'
import type { Tenant, DomainModule } from '@/types'

export interface CreateTenantPayload {
  name: string
  email?: string | null
  phone?: string | null
  plan?: string
  enabled_modules?: DomainModule[]
  [key: string]: unknown
}

export interface UpdateTenantPayload {
  name?: string
  email?: string | null
  phone?: string | null
  is_active?: boolean
  plan?: string
  [key: string]: unknown
}

export interface ToggleModulePayload {
  module: DomainModule
  enabled: boolean
}

class TenantService extends ApiService<Tenant> {
  constructor() { super('/tenants') }

  update(id: number, payload: UpdateTenantPayload) {
    return this.patch(id, payload)
  }

  /** POST /tenants/:id/modules — enable or disable a domain module */
  toggleModule(tenantId: number, module: DomainModule, enabled: boolean) {
    return this.createRelated<Tenant>(tenantId, 'modules', { module, enabled })
  }

  /** GET /tenants/:id/usage — billing / quota stats */
  usage(tenantId: number) {
    return this.getRelated<Record<string, unknown>>(tenantId, 'usage')
  }
}

export const tenantService = new TenantService()
export default tenantService
