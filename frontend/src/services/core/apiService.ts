/**
 * ApiService<T> — Generic base class for all module services.
 *
 * T = the primary entity type for this resource.
 * All CRUD methods are typed to T at the class level so subclasses
 * just extend `ApiService<Invoice>` and inherit fully-typed methods
 * without any per-call type annotations.
 *
 * Extra methods (nested resources, actions) use method-level generics.
 *
 * Usage:
 *   class InvoiceService extends ApiService<Invoice> {
 *     constructor() { super('/invoices') }
 *
 *     // Inherited: list, paginate, getById, create, patch, remove …
 *
 *     // Module-specific extras:
 *     send(id: number) { return this.createRelated<{message:string}>(id,'send',{}) }
 *     recordPayment(id: number, p: RecordPaymentPayload) {
 *       return this.createRelated<InvoicePayment>(id, 'payments', p)
 *     }
 *   }
 *   export const invoiceService = new InvoiceService()
 */

import apiHandler from '@/services/apiHandler'
import type { ApiResponse, RequestOptions } from '@/services/apiHandler'
import type { PaginatedResponse } from '@/types'

// ── Re-exported types ────────────────────────────────────────────────────────

export type { ApiResponse, RequestOptions }

export interface QueryParams {
  page?: number
  size?: number
  search?: string
  [key: string]: unknown
}

// ── Base class ───────────────────────────────────────────────────────────────

export class ApiService<T = unknown> {
  protected readonly base: string

  constructor(basePath: string) {
    this.base = basePath
  }

  /** Build: /base, /base/id, /base/id/segment … */
  protected url(id?: string | number, ...segments: string[]): string {
    const parts: string[] = [this.base]
    if (id !== undefined) parts.push(String(id))
    parts.push(...segments)
    return parts.join('/')
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  /** GET /base  → T[] */
  list(params?: QueryParams, opts?: RequestOptions): Promise<ApiResponse<T[]>> {
    return apiHandler.get<T[]>(this.base, { ...opts, params })
  }

  /** GET /base  → PaginatedResponse<T> */
  paginate(params?: QueryParams, opts?: RequestOptions): Promise<ApiResponse<PaginatedResponse<T>>> {
    return apiHandler.get<PaginatedResponse<T>>(this.base, { ...opts, params })
  }

  /** GET /base/:id  → T */
  getById(id: string | number, opts?: RequestOptions): Promise<ApiResponse<T>> {
    return apiHandler.get<T>(this.url(id), opts)
  }

  /** GET /base/:id/:relation  → R (nested resource, typed at call site) */
  getRelated<R = unknown>(
    id: string | number,
    relation: string,
    params?: QueryParams,
    opts?: RequestOptions,
  ): Promise<ApiResponse<R>> {
    return apiHandler.get<R>(this.url(id, relation), { ...opts, params })
  }

  // ── Writes ────────────────────────────────────────────────────────────────

  /** POST /base  → T */
  create(body: unknown, opts?: RequestOptions): Promise<ApiResponse<T>> {
    return apiHandler.post<T>(this.base, body, opts)
  }

  /** POST /base/:id/:relation  → R */
  createRelated<R = unknown>(
    id: string | number,
    relation: string,
    body: unknown,
    opts?: RequestOptions,
  ): Promise<ApiResponse<R>> {
    return apiHandler.post<R>(this.url(id, relation), body, opts)
  }

  /** PUT /base/:id  → T */
  replace(id: string | number, body: unknown, opts?: RequestOptions): Promise<ApiResponse<T>> {
    return apiHandler.put<T>(this.url(id), body, opts)
  }

  /** PATCH /base/:id  → T */
  patch(id: string | number, body: unknown, opts?: RequestOptions): Promise<ApiResponse<T>> {
    return apiHandler.patch<T>(this.url(id), body, opts)
  }

  /** PATCH /base/:id/:action  → T  (status transitions, soft-actions) */
  patchAction(
    id: string | number,
    action: string,
    body: unknown,
    opts?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return apiHandler.patch<T>(this.url(id, action), body, opts)
  }

  /** DELETE /base/:id */
  remove(id: string | number, opts?: RequestOptions): Promise<ApiResponse<void>> {
    return apiHandler.delete<void>(this.url(id), opts)
  }

  // ── File ops ──────────────────────────────────────────────────────────────

  /** Multipart POST /base/:id/:segment — default field = "file" */
  upload<R = unknown>(
    id: string | number,
    segment: string,
    file: File,
    fieldName = 'file',
    opts?: RequestOptions,
  ): Promise<ApiResponse<R>> {
    const form = new FormData()
    form.append(fieldName, file)
    return apiHandler.post<R>(this.url(id, segment), form, opts)
  }

  /** GET /base/:id/:segment  → triggers browser Save-As */
  download(
    id: string | number,
    filename: string,
    segment = 'download',
    opts?: RequestOptions,
  ): Promise<void> {
    return apiHandler.download(this.url(id, segment), filename, opts)
  }

  // ── Escape hatch ──────────────────────────────────────────────────────────

  /** Direct apiHandler access for non-standard operations. */
  get raw() {
    return apiHandler
  }
}
