import { ApiService } from '@/services/core/apiService'
import type { QueryParams } from '@/services/core/apiService'

export type ErrorSeverity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

export interface ErrorLogEntry {
  id:                number
  error_code:        string | null
  error_type:        string | null
  error_message:     string
  error_stack_trace: string | null
  service_name:      string | null
  function_name:     string | null
  file_path:         string | null
  line_number:       number | null
  user_id:           number | null
  request_id:        string | null
  endpoint:          string | null
  http_method:       string | null
  ip_address:        string | null
  severity:          ErrorSeverity | null
  is_resolved:       boolean
  resolution_notes:  string | null
  created_date:      string
}

export interface ErrorLogsResponse {
  items:      ErrorLogEntry[]
  total:      number
  page:       number
  size:       number
  pages:      number
  unresolved: number
}

export interface ErrorLogQueryParams extends QueryParams {
  severity?: ErrorSeverity
  is_resolved?: boolean
  service_name?: string
  from_date?: string
  to_date?: string
}

class ErrorLogService extends ApiService<ErrorLogEntry> {
  constructor() { super('/error-logs') }

  /** GET /error-logs — custom paginated response with unresolved count */
  query(params?: ErrorLogQueryParams) {
    return this.raw.get<ErrorLogsResponse>(this.base, { params })
  }

  resolve(id: number, notes?: string) {
    return this.patch(id, {
      is_resolved: true,
      ...(notes ? { resolution_notes: notes } : {}),
    })
  }

  unresolve(id: number) {
    return this.patch(id, { is_resolved: false })
  }

  /** PATCH /error-logs/bulk-resolve */
  bulkResolve(ids: number[], notes?: string) {
    return this.raw.patch<{ updated: number }>(`${this.base}/bulk-resolve`, {
      ids,
      ...(notes ? { resolution_notes: notes } : {}),
    })
  }

  /** DELETE /error-logs/bulk-delete */
  bulkDelete(ids: number[]) {
    return this.raw.post<{ deleted: number }>(`${this.base}/bulk-delete`, { ids })
  }
}

export const errorLogService = new ErrorLogService()
export default errorLogService
