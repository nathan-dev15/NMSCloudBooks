import { ApiService } from '@/services/core/apiService'
import type { User, PaginatedResponse } from '@/types'
import type { UserLog } from '@/features/users/usersSlice'
import type { QueryParams } from '@/services/core/apiService'

export interface CreateUserPayload {
  email: string
  full_name: string
  role: string
  phone?: string | null
  tenant_id?: number | null
  password?: string
}

export interface UpdateUserPayload {
  full_name?: string
  role?: string
  phone?: string | null
  is_active?: boolean
}

export interface UserQueryParams extends QueryParams {
  role?: string
}

class UserService extends ApiService<User> {
  constructor() { super('/users') }

  update(id: number, payload: UpdateUserPayload) {
    return this.patch(id, payload)
  }

  /** GET /users/:id/logs */
  logs(userId: number, limit = 50) {
    return this.getRelated<UserLog[]>(userId, 'logs', { limit })
  }

  /** GET /users/:adminId/team */
  team(adminId: number, params?: UserQueryParams) {
    return this.getRelated<PaginatedResponse<User>>(adminId, 'team', { size: 200, ...params })
  }

  /** PATCH /users/:id/activate | /deactivate */
  setActive(id: number, active: boolean) {
    return this.patchAction(id, active ? 'activate' : 'deactivate', { is_active: active })
  }
}

export const userService = new UserService()
export default userService
