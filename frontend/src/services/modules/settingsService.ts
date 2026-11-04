import { ApiService } from '@/services/core/apiService'
import type { BusinessType } from '@/services/profileService'

export interface AppSetting {
  key:         string
  value:       unknown
  description: string | null
  is_public:   boolean
}

class SettingsService extends ApiService {
  constructor() { super('/settings') }

  /** GET /settings/business-types */
  businessTypes() {
    return this.raw.get<BusinessType[]>(`${this.base}/business-types`)
  }

  /** GET /settings  — all settings */
  all(params?: { is_public?: boolean }) {
    return this.raw.get<AppSetting[]>(this.base, { params })
  }

  /** PATCH /settings/:key */
  update(key: string, value: unknown) {
    return this.raw.patch<AppSetting>(`${this.base}/${key}`, { value })
  }

  /** GET /settings/tenant-branding */
  branding() {
    return this.raw.get<Record<string, unknown>>(`${this.base}/tenant-branding`)
  }

  /** PATCH /settings/tenant-branding */
  updateBranding(payload: Record<string, unknown>) {
    return this.raw.patch<Record<string, unknown>>(`${this.base}/tenant-branding`, payload)
  }
}

export const settingsService = new SettingsService()
export default settingsService
