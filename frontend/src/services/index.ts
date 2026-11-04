/**
 * Services barrel export
 *
 * Architecture:
 *   apiHandler  (low-level HTTP with retry, circuit-breaker, dedup)
 *       ↓
 *   ApiService  (generic base class — typed CRUD helpers)
 *       ↓
 *   Module services  (domain-typed, singleton instances)
 *
 * Import pattern:
 *   import { invoiceService } from '@/services'
 *   import type { InvoiceQueryParams } from '@/services/modules/invoiceService'
 */

// ── Core ───────────────────────────────────────────────────────────────────────
export { ApiService }                            from './core/apiService'
export type { ApiResponse, RequestOptions, QueryParams } from './core/apiService'
export { tokenService }                          from './core/tokenService'
export type { Tokens }                           from './core/tokenService'

// ── Auth & profile ─────────────────────────────────────────────────────────────
export { authService }                           from './modules/authService'
export { profileService }                        from './profileService'

// ── Users & tenants ────────────────────────────────────────────────────────────
export { userService }                           from './modules/userService'
export { tenantService }                         from './modules/tenantService'
export { companyService }                        from './modules/companyService'

// ── Civil module ───────────────────────────────────────────────────────────────
export { projectService, blockService, materialRequestService } from './modules/civilService'

// ── Clients & billing documents ────────────────────────────────────────────────
export { clientService }                         from './modules/clientService'
export { invoiceService }                        from './modules/invoiceService'
export { purchaseOrderService }                  from './modules/purchaseOrderService'
export { purchaseRequisitionService }            from './modules/purchaseRequisitionService'
export { deliveryChallanService }               from './modules/deliveryChallanService'

// ── Inventory ──────────────────────────────────────────────────────────────────
export { productService, categoryService, warehouseService } from './modules/inventoryService'

// ── Retail ─────────────────────────────────────────────────────────────────────
export { storeService, posSessionService, saleService } from './modules/retailService'

// ── Agriculture ────────────────────────────────────────────────────────────────
export { farmService, cropCycleService }         from './modules/agricultureService'

// ── General billing ────────────────────────────────────────────────────────────
export {
  billingServiceCatalogue,
  subscriptionPlanService,
  clientSubscriptionService,
  recurringTemplateService,
  genInvoiceService,
}                                                from './modules/generalBillingService'

// ── Mind Maps ─────────────────────────────────────────────────────────────────
export { mindMapService }                        from './modules/mindMapService'

// ── System ─────────────────────────────────────────────────────────────────────
export { errorLogService }                       from './modules/errorLogService'
export { settingsService }                       from './modules/settingsService'
