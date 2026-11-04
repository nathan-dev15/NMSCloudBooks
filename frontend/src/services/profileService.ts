import { ApiService } from '@/services/core/apiService'
import type { User } from '@/types'

// ── Domain types ───────────────────────────────────────────────────────────────

export interface BusinessType {
  id:          number
  name:        string
  code:        string
  description: string | null
}

export interface UpdateProfilePayload {
  full_name:        string
  business_type_id?: number | null
}

export interface ChangePasswordPayload {
  current_password: string
  new_password:     string
  confirm_password: string
}

// ── Service ────────────────────────────────────────────────────────────────────

class ProfileService extends ApiService {
  constructor() { super('/profile') }

  /** GET /settings/business-types */
  getBusinessTypes() {
    return this.raw.get<BusinessType[]>('/settings/business-types')
  }

  /** PATCH /profile */
  updateProfile(payload: UpdateProfilePayload) {
    return this.raw.patch<User>(this.base, payload)
  }

  /** POST /profile/avatar  (multipart) */
  uploadAvatar(file: File) {
    const form = new FormData()
    form.append('avatar', file)
    return this.raw.post<User>(`${this.base}/avatar`, form)
  }

  /** POST /profile/change-password */
  changePassword(payload: ChangePasswordPayload) {
    return this.raw.post<void>(`${this.base}/change-password`, payload)
  }
}

export const profileService = new ProfileService()
export default profileService
