import { ApiService } from '@/services/core/apiService'
import type {
  Service as BillingService,
  SubscriptionPlan,
  ClientSubscription,
  RecurringTemplate,
  GenInvoice,
  GenInvoiceStatus,
} from '@/features/general/generalSlice'
import type { QueryParams } from '@/services/core/apiService'

export interface GenInvoiceQueryParams extends QueryParams {
  client_id?: number
  status?: GenInvoiceStatus
  from_date?: string
  to_date?: string
}

// ── Services catalogue ────────────────────────────────────────────────────────

class BillingServiceCatalogue extends ApiService<BillingService> {
  constructor() { super('/general/services') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }
}

// ── Subscription plans ────────────────────────────────────────────────────────

class SubscriptionPlanService extends ApiService<SubscriptionPlan> {
  constructor() { super('/general/plans') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }
}

// ── Client subscriptions ──────────────────────────────────────────────────────

class ClientSubscriptionService extends ApiService<ClientSubscription> {
  constructor() { super('/general/subscriptions') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  cancel(id: number) {
    return this.createRelated<ClientSubscription>(id, 'cancel', {})
  }
}

// ── Recurring templates ───────────────────────────────────────────────────────

class RecurringTemplateService extends ApiService<RecurringTemplate> {
  constructor() { super('/general/recurring-templates') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  pause(id: number) {
    return this.patchAction(id, 'status', { status: 'paused' })
  }

  resume(id: number) {
    return this.patchAction(id, 'status', { status: 'active' })
  }
}

// ── General invoices ──────────────────────────────────────────────────────────

class GenInvoiceService extends ApiService<GenInvoice> {
  constructor() { super('/general/invoices') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  changeStatus(id: number, status: GenInvoiceStatus) {
    return this.patchAction(id, 'status', { status })
  }

  send(id: number) {
    return this.createRelated<{ message: string }>(id, 'send', {})
  }

  downloadPdf(id: number, invoiceNumber: string) {
    return this.download(id, `gen-invoice-${invoiceNumber}.pdf`, 'download')
  }
}

// ── Singleton exports ─────────────────────────────────────────────────────────

export const billingServiceCatalogue   = new BillingServiceCatalogue()
export const subscriptionPlanService   = new SubscriptionPlanService()
export const clientSubscriptionService = new ClientSubscriptionService()
export const recurringTemplateService  = new RecurringTemplateService()
export const genInvoiceService         = new GenInvoiceService()

const generalBillingService = {
  services:      billingServiceCatalogue,
  plans:         subscriptionPlanService,
  subscriptions: clientSubscriptionService,
  recurring:     recurringTemplateService,
  invoices:      genInvoiceService,
}
export default generalBillingService
