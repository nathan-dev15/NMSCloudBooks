import { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  servicesThunks, servicesSelectors,
  genInvoicesThunks, genInvoicesSelectors,
  subscriptionsThunks, subscriptionsSelectors,
  fetchPlans, fetchTemplates, generateFromTemplate, updateGenInvoiceStatus,
  generalAuxSelectors,
  type Service, type GenInvoice, type ClientSubscription,
  type SubscriptionPlan, type RecurringTemplate, type GenInvoiceStatus,
  type BillingCycle,
} from '@/features/general/generalSlice'
import DataGrid from '@/components/ui/DataGrid/DataGrid'
import type { ColumnDef, RowAction } from '@/components/ui/DataGrid/gridTypes'
import GenericForm from '@/components/ui/GenericForm/GenericForm'
import type { FormSection } from '@/components/ui/GenericForm/formTypes'
import SingleSearch from '@/components/ui/SearchFilter/SingleSearch'
import AdvancedFilter from '@/components/ui/SearchFilter/AdvancedFilter'
import type { ActiveFilters, FilterField } from '@/components/ui/SearchFilter/filterTypes'
import { useNotification } from '@/hooks'
import type React from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────

const INV_STATUS_STYLE: Record<GenInvoiceStatus, React.CSSProperties> = {
  draft:     { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',  border: '1px solid rgba(12,122,130,0.15)' },
  sent:      { background: 'rgba(0,212,255,0.1)',    color: '#00d4ff',            border: '1px solid rgba(0,212,255,0.3)'   },
  paid:      { background: 'rgba(6,214,160,0.1)',    color: '#06d6a0',            border: '1px solid rgba(6,214,160,0.3)'   },
  partial:   { background: 'rgba(255,193,7,0.1)',    color: '#ffc107',            border: '1px solid rgba(255,193,7,0.3)'   },
  overdue:   { background: 'rgba(255,107,53,0.1)',   color: '#ff6b35',            border: '1px solid rgba(255,107,53,0.3)'  },
  cancelled: { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)',  border: '1px solid rgba(12,122,130,0.1)'  },
}

const SUB_STATUS_STYLE: Record<string, React.CSSProperties> = {
  trial:     { background: 'rgba(0,212,255,0.08)',   color: '#00d4ff',            border: '1px solid rgba(0,212,255,0.25)'  },
  active:    { background: 'rgba(6,214,160,0.1)',    color: '#06d6a0',            border: '1px solid rgba(6,214,160,0.3)'   },
  paused:    { background: 'rgba(255,193,7,0.1)',    color: '#ffc107',            border: '1px solid rgba(255,193,7,0.3)'   },
  expired:   { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',  border: '1px solid rgba(12,122,130,0.15)' },
  cancelled: { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)',  border: '1px solid rgba(12,122,130,0.1)'  },
}

const CYCLE_LABELS: Record<BillingCycle, string> = {
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
  quarterly: 'Quarterly', half_yearly: 'Half-Yearly',
  annual: 'Annual', one_time: 'One-Time',
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }

// ── Column definitions ────────────────────────────────────────────────────────

const SERVICE_COLS: ColumnDef<Service>[] = [
  {
    key: 'name',
    header: 'Service',
    sortable: true,
    render: (r) => (
      <div>
        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</div>
        {r.code && <div className="text-xs" style={{ color: 'var(--text-faint)' }}>{r.code}</div>}
      </div>
    ),
  },
  { key: 'unit',     header: 'Unit',    render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.unit}</span> },
  { key: 'rate',     header: 'Rate',    sortable: true, render: (r) => <span style={{ color: 'var(--text-primary)' }}>{fmt(r.rate)}</span> },
  { key: 'tax_rate', header: 'GST %',   render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.tax_rate}%</span> },
  { key: 'hsn_sac',  header: 'HSN/SAC', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.hsn_sac ?? '—'}</span> },
  {
    key: 'is_active',
    header: 'Status',
    render: (r) => (
      <span
        className="inline-flex px-2 py-0.5 rounded text-xs font-semibold"
        style={r.is_active
          ? { background: 'rgba(6,214,160,0.1)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)' }
          : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)', border: '1px solid rgba(12,122,130,0.1)' }
        }
      >
        {r.is_active ? 'Active' : 'Inactive'}
      </span>
    ),
  },
]

const INVOICE_COLS: ColumnDef<GenInvoice>[] = [
  {
    key: 'invoice_number',
    header: 'Invoice #',
    sortable: true,
    render: (r) => (
      <div>
        <div className="font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.invoice_number}</div>
        {r.billing_name && <div className="text-xs" style={{ color: 'var(--text-faint)' }}>{r.billing_name}</div>}
      </div>
    ),
  },
  { key: 'invoice_date', header: 'Date', sortable: true, render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.invoice_date}</span> },
  { key: 'due_date',     header: 'Due',  render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.due_date}</span> },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <span
        className="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
        style={INV_STATUS_STYLE[r.status]}
      >
        {r.status}
      </span>
    ),
  },
  { key: 'grand_total', header: 'Total', sortable: true, render: (r) => <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(r.grand_total)}</span> },
  { key: 'amount_paid', header: 'Paid',  render: (r) => <span style={{ color: r.amount_paid > 0 ? '#06d6a0' : 'var(--text-faint)' }}>{fmt(r.amount_paid)}</span> },
  { key: 'amount_due',  header: 'Due',   render: (r) => <span style={{ color: r.amount_due > 0 ? '#ff6b35' : 'var(--text-faint)', fontWeight: r.amount_due > 0 ? 600 : 400 }}>{fmt(r.amount_due)}</span> },
]

const SUB_COLS: ColumnDef<ClientSubscription>[] = [
  { key: 'plan_id',    header: 'Plan',     render: (r) => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Plan #{r.plan_id}</span> },
  { key: 'client_id',  header: 'Client',   render: (r) => <span style={{ color: 'var(--text-muted)' }}>Client #{r.client_id}</span> },
  { key: 'start_date', header: 'Start',    render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.start_date}</span> },
  { key: 'next_billing_date', header: 'Next Bill', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.next_billing_date ?? '—'}</span> },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <span
        className="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
        style={SUB_STATUS_STYLE[r.status] ?? SUB_STATUS_STYLE.expired}
      >
        {r.status}
      </span>
    ),
  },
  { key: 'invoices_generated', header: 'Invoices',     render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.invoices_generated}</span> },
  { key: 'total_billed',       header: 'Total Billed', render: (r) => <span style={{ color: 'var(--text-primary)' }}>{fmt(r.total_billed)}</span> },
]

// ── Filter fields ─────────────────────────────────────────────────────────────

const INVOICE_FILTERS: FilterField[] = [
  { key: 'status',    label: 'Status',    type: 'select', options: ['draft','sent','paid','partial','overdue','cancelled'] },
  { key: 'from_date', label: 'From Date', type: 'date' },
  { key: 'to_date',   label: 'To Date',   type: 'date' },
]

const SUB_FILTERS: FilterField[] = [
  { key: 'status', label: 'Status', type: 'select', options: ['trial','active','paused','expired','cancelled'] },
]

// ── Forms ─────────────────────────────────────────────────────────────────────

const SERVICE_FORM: FormSection[] = [
  {
    title: 'Service Details',
    fields: [
      { key: 'name',        label: 'Service Name', type: 'text',   required: true, colSpan: 2 },
      { key: 'code',        label: 'Service Code', type: 'text' },
      { key: 'category_id', label: 'Category ID',  type: 'number' },
      { key: 'description', label: 'Description',  type: 'textarea', colSpan: 3 },
    ],
  },
  {
    title: 'Pricing',
    fields: [
      { key: 'unit',    label: 'Unit',     type: 'text',   defaultValue: 'hr', placeholder: 'hr / visit / month / unit' },
      { key: 'rate',    label: 'Rate (₹)', type: 'number', min: 0, required: true },
      {
        key: 'tax_rate', label: 'GST Rate (%)', type: 'select', defaultValue: '18',
        options: [{ label: '0%', value: '0' }, { label: '5%', value: '5' }, { label: '12%', value: '12' }, { label: '18%', value: '18' }, { label: '28%', value: '28' }],
      },
      { key: 'hsn_sac',                label: 'HSN/SAC',             type: 'text' },
      { key: 'is_active',              label: 'Active',              type: 'checkbox', defaultValue: true },
      { key: 'is_recurring_eligible',  label: 'Recurring Eligible',  type: 'checkbox', defaultValue: true },
    ],
  },
]

const INVOICE_FORM: FormSection[] = [
  {
    title: 'Invoice Details',
    fields: [
      { key: 'client_id',    label: 'Client ID',    type: 'number', required: true },
      { key: 'invoice_number', label: 'Invoice #',  type: 'text',   placeholder: 'Auto if blank' },
      { key: 'invoice_date', label: 'Invoice Date', type: 'date',   required: true },
      { key: 'due_date',     label: 'Due Date',     type: 'date',   required: true },
      { key: 'service_period_start', label: 'Service Period Start', type: 'date' },
      { key: 'service_period_end',   label: 'Service Period End',   type: 'date' },
      {
        key: 'currency', label: 'Currency', type: 'select', defaultValue: 'INR',
        options: [{ label: 'INR', value: 'INR' }, { label: 'USD', value: 'USD' }, { label: 'EUR', value: 'EUR' }],
      },
      { key: 'discount_amount', label: 'Header Discount (₹)', type: 'number', min: 0, defaultValue: 0 },
    ],
  },
  {
    title: 'Notes',
    fields: [
      { key: 'notes', label: 'Notes',              type: 'textarea', colSpan: 3 },
      { key: 'terms', label: 'Terms & Conditions', type: 'textarea', colSpan: 3 },
    ],
  },
]

const SUB_FORM: FormSection[] = [
  {
    fields: [
      { key: 'client_id',    label: 'Client ID',   type: 'number', required: true },
      { key: 'plan_id',      label: 'Plan ID',      type: 'number', required: true },
      { key: 'start_date',   label: 'Start Date',   type: 'date',   required: true },
      { key: 'custom_price', label: 'Custom Price', type: 'number', min: 0, hint: 'Leave blank to use plan price' },
      { key: 'discount_pct', label: 'Discount %',   type: 'number', min: 0, max: 100, defaultValue: 0 },
      { key: 'auto_renew',   label: 'Auto Renew',   type: 'checkbox', defaultValue: true },
      { key: 'notes',        label: 'Notes',        type: 'textarea', colSpan: 3 },
    ],
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GeneralBillingPage() {
  const dispatch = useAppDispatch()
  const notify   = useNotification()

  const services   = useAppSelector(servicesSelectors.selectItems    as (s: any) => Service[])
  const svcLoading = useAppSelector(servicesSelectors.selectLoading  as (s: any) => boolean)
  const svcSaving  = useAppSelector(servicesSelectors.selectSaving   as (s: any) => boolean)
  const svcPag     = useAppSelector(servicesSelectors.selectPagination as (s: any) => { total: number; page: number; pageSize: number; pages: number })

  const invoices   = useAppSelector(genInvoicesSelectors.selectItems    as (s: any) => GenInvoice[])
  const invLoading = useAppSelector(genInvoicesSelectors.selectLoading  as (s: any) => boolean)
  const invSaving  = useAppSelector(genInvoicesSelectors.selectSaving   as (s: any) => boolean)
  const invPag     = useAppSelector(genInvoicesSelectors.selectPagination as (s: any) => { total: number; page: number; pageSize: number; pages: number })

  const subs       = useAppSelector(subscriptionsSelectors.selectItems    as (s: any) => ClientSubscription[])
  const subLoading = useAppSelector(subscriptionsSelectors.selectLoading  as (s: any) => boolean)
  const subPag     = useAppSelector(subscriptionsSelectors.selectPagination as (s: any) => { total: number; page: number; pageSize: number; pages: number })

  const plans     = useAppSelector(generalAuxSelectors.plans)
  const templates = useAppSelector(generalAuxSelectors.templates)

  const [tab,          setTab]          = useState<'invoices' | 'services' | 'subscriptions' | 'plans' | 'recurring'>('invoices')
  const [svcSearch,    setSvcSearch]    = useState('')
  const [invSearch,    setInvSearch]    = useState('')
  const [invFilters,   setInvFilters]   = useState<ActiveFilters>({ conditions: [], logic: 'AND' })
  const [subFilters,   setSubFilters]   = useState<ActiveFilters>({ conditions: [], logic: 'AND' })
  const [showSvcForm,  setShowSvcForm]  = useState(false)
  const [showInvForm,  setShowInvForm]  = useState(false)
  const [showSubForm,  setShowSubForm]  = useState(false)
  const [editSvc,      setEditSvc]      = useState<Service | null>(null)
  const [statusTarget, setStatusTarget] = useState<GenInvoice | null>(null)
  const [newStatus,    setNewStatus]    = useState<GenInvoiceStatus | ''>('')
  const [payAmount,    setPayAmount]    = useState('')
  const [genTmplTarget, setGenTmplTarget] = useState<RecurringTemplate | null>(null)
  const [genDate,       setGenDate]       = useState(new Date().toISOString().slice(0, 10))

  const loadServices = useCallback(() => {
    dispatch(servicesThunks.fetchAll({ page: svcPag.page, size: svcPag.pageSize, search: svcSearch || undefined }))
  }, [dispatch, svcPag.page, svcPag.pageSize, svcSearch])

  const loadInvoices = useCallback(() => {
    const fp: Record<string, unknown> = {}
    invFilters.conditions.forEach((c) => { if (c.value !== '' && c.value !== undefined) fp[c.field] = c.value })
    dispatch(genInvoicesThunks.fetchAll({ page: invPag.page, size: invPag.pageSize, search: invSearch || undefined, ...fp }))
  }, [dispatch, invPag.page, invPag.pageSize, invSearch, invFilters])

  const loadSubs = useCallback(() => {
    const fp: Record<string, unknown> = {}
    subFilters.conditions.forEach((c) => { if (c.value !== '' && c.value !== undefined) fp[c.field] = c.value })
    dispatch(subscriptionsThunks.fetchAll({ page: subPag.page, size: subPag.pageSize, ...fp }))
  }, [dispatch, subPag.page, subPag.pageSize, subFilters])

  useEffect(() => {
    loadServices(); loadInvoices(); loadSubs()
    dispatch(fetchPlans()); dispatch(fetchTemplates())
  }, [])

  useEffect(() => { loadServices() }, [loadServices])
  useEffect(() => { loadInvoices() }, [loadInvoices])
  useEffect(() => { loadSubs()     }, [loadSubs])

  // ── Row actions ─────────────────────────────────────────────────────────────

  const SVC_ACTIONS: RowAction<Service>[] = [
    { label: 'Edit', onClick: (r) => { setEditSvc(r); setShowSvcForm(true) } },
    { label: 'Delete', variant: 'danger', onClick: async (r) => {
      if (!confirm(`Delete "${r.name}"?`)) return
      await dispatch(servicesThunks.delete(r.id)).unwrap(); notify.success('Service deleted'); loadServices()
    }},
  ]

  const INV_ACTIONS: RowAction<GenInvoice>[] = [
    { label: 'Update Status', onClick: (r) => { setStatusTarget(r); setNewStatus(''); setPayAmount('') } },
    {
      label: 'Delete', variant: 'danger',
      visible: (r) => ['draft','cancelled'].includes(r.status),
      onClick: async (r) => {
        if (!confirm(`Delete invoice ${r.invoice_number}?`)) return
        await dispatch(genInvoicesThunks.delete(r.id)).unwrap(); notify.success('Deleted'); loadInvoices()
      },
    },
  ]

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSvcSave(values: Record<string, unknown>) {
    try {
      if (editSvc) { await dispatch(servicesThunks.update({ id: editSvc.id, ...values })).unwrap(); notify.success('Service updated') }
      else         { await dispatch(servicesThunks.create(values)).unwrap(); notify.success('Service created') }
      setShowSvcForm(false); setEditSvc(null); loadServices()
    } catch { notify.error('Save failed') }
  }

  async function handleInvSave(values: Record<string, unknown>) {
    try {
      await dispatch(genInvoicesThunks.create({ ...values, items: [] })).unwrap()
      notify.success('Invoice created'); setShowInvForm(false); loadInvoices()
    } catch { notify.error('Create failed') }
  }

  async function handleSubSave(values: Record<string, unknown>) {
    try {
      await dispatch(subscriptionsThunks.create(values)).unwrap()
      notify.success('Subscription created'); setShowSubForm(false); loadSubs()
    } catch { notify.error('Create failed') }
  }

  async function handleStatusUpdate() {
    if (!statusTarget || !newStatus) return
    try {
      await dispatch(updateGenInvoiceStatus({
        invoiceId: statusTarget.id,
        status: newStatus,
        amount_paid: payAmount ? Number(payAmount) : undefined,
      })).unwrap()
      notify.success('Status updated'); setStatusTarget(null); loadInvoices()
    } catch { notify.error('Update failed') }
  }

  async function handleGenerate() {
    if (!genTmplTarget) return
    try {
      await dispatch(generateFromTemplate({ templateId: genTmplTarget.id, invoice_date: genDate })).unwrap()
      notify.success('Invoice generated'); setGenTmplTarget(null); loadInvoices()
      dispatch(fetchTemplates())
    } catch { notify.error('Generation failed') }
  }

  const TABS: [typeof tab, string][] = [
    ['invoices', 'Invoices'],
    ['services', 'Services'],
    ['subscriptions', 'Subscriptions'],
    ['plans', 'Plans'],
    ['recurring', 'Recurring'],
  ]

  const darkInputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(12,122,130,0.25)',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    outline: 'none',
    width: '100%',
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>General Billing</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>Service billing, subscriptions & recurring invoices</p>
        </div>
        <div className="flex gap-2">
          {tab === 'invoices'      && <GradientBtn onClick={() => setShowInvForm(true)}>+ New Invoice</GradientBtn>}
          {tab === 'services'      && <GradientBtn onClick={() => { setEditSvc(null); setShowSvcForm(true) }}>+ New Service</GradientBtn>}
          {tab === 'subscriptions' && <GradientBtn onClick={() => setShowSubForm(true)}>+ Subscribe</GradientBtn>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
        {TABS.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={
              tab === t
                ? { borderBottom: '2px solid #0c7a82', color: '#0e949e', paddingBottom: '6px' }
                : { borderBottom: '2px solid transparent', color: 'var(--text-faint)', paddingBottom: '6px' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Invoices tab */}
      {tab === 'invoices' && (
        <>
          <GenBillingSummary invoices={invoices} />
          <div className="flex gap-3">
            <div className="flex-1"><SingleSearch placeholder="Search by invoice #, client…" value={invSearch} onChange={setInvSearch} storageKey="gen-inv-search" /></div>
            <AdvancedFilter fields={INVOICE_FILTERS} value={invFilters} onChange={setInvFilters} />
          </div>
          <DataGrid<GenInvoice>
            columns={INVOICE_COLS} data={invoices} loading={invLoading} rowKey="id"
            rowActions={INV_ACTIONS} selectable exportable exportFilename="gen-invoices"
            pagination={{ page: invPag.page, pageSize: invPag.pageSize, total: invPag.total,
              onPageChange: (p) => dispatch(genInvoicesThunks.fetchAll({ page: p, size: invPag.pageSize })),
              onPageSizeChange: (s) => dispatch(genInvoicesThunks.fetchAll({ page: 1, size: s })) }}
            emptyMessage="No invoices found."
          />
        </>
      )}

      {/* Services tab */}
      {tab === 'services' && (
        <>
          <div className="flex gap-3">
            <div className="flex-1"><SingleSearch placeholder="Search services…" value={svcSearch} onChange={setSvcSearch} storageKey="gen-svc-search" /></div>
          </div>
          <DataGrid<Service>
            columns={SERVICE_COLS} data={services} loading={svcLoading} rowKey="id"
            rowActions={SVC_ACTIONS} exportable exportFilename="services"
            pagination={{ page: svcPag.page, pageSize: svcPag.pageSize, total: svcPag.total,
              onPageChange: (p) => dispatch(servicesThunks.fetchAll({ page: p, size: svcPag.pageSize })),
              onPageSizeChange: (s) => dispatch(servicesThunks.fetchAll({ page: 1, size: s })) }}
            emptyMessage="No services defined."
          />
        </>
      )}

      {/* Subscriptions tab */}
      {tab === 'subscriptions' && (
        <>
          <div className="flex gap-3">
            <AdvancedFilter fields={SUB_FILTERS} value={subFilters} onChange={setSubFilters} />
          </div>
          <DataGrid<ClientSubscription>
            columns={SUB_COLS} data={subs} loading={subLoading} rowKey="id"
            exportable exportFilename="subscriptions"
            pagination={{ page: subPag.page, pageSize: subPag.pageSize, total: subPag.total,
              onPageChange: (p) => dispatch(subscriptionsThunks.fetchAll({ page: p, size: subPag.pageSize })),
              onPageSizeChange: (s) => dispatch(subscriptionsThunks.fetchAll({ page: 1, size: s })) }}
            emptyMessage="No subscriptions found."
          />
        </>
      )}

      {tab === 'plans'     && <PlansGrid plans={plans} />}
      {tab === 'recurring' && <RecurringTemplatesTable templates={templates} onGenerate={(t) => { setGenTmplTarget(t); setGenDate(new Date().toISOString().slice(0, 10)) }} />}

      {/* Form modals */}
      {showSvcForm && <DarkFormModal title={editSvc ? 'Edit Service' : 'New Service'} sections={SERVICE_FORM} initial={editSvc ?? {}} onSave={handleSvcSave} onClose={() => { setShowSvcForm(false); setEditSvc(null) }} saving={svcSaving} />}
      {showInvForm && <DarkFormModal title="New Invoice" sections={INVOICE_FORM} initial={{ invoice_date: new Date().toISOString().slice(0,10) }} onSave={handleInvSave} onClose={() => setShowInvForm(false)} saving={invSaving} />}
      {showSubForm && <DarkFormModal title="New Subscription" sections={SUB_FORM} initial={{ start_date: new Date().toISOString().slice(0,10) }} onSave={handleSubSave} onClose={() => setShowSubForm(false)} saving={false} />}

      {/* Invoice status modal */}
      {statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)', border: '1px solid rgba(12,122,130,0.3)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Update Invoice Status</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {statusTarget.invoice_number} —{' '}
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase" style={INV_STATUS_STYLE[statusTarget.status]}>{statusTarget.status}</span>
            </p>
            <div className="space-y-2">
              {(['sent','paid','partial','overdue','cancelled'] as GenInvoiceStatus[])
                .filter((s) => s !== statusTarget.status)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => setNewStatus(s)}
                    className="w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={
                      newStatus === s
                        ? { background: 'rgba(12,122,130,0.15)', border: '1px solid rgba(12,122,130,0.5)', color: '#0e949e' }
                        : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(12,122,130,0.12)', color: 'var(--text-secondary)' }
                    }
                    onMouseEnter={(e) => { if (newStatus !== s) e.currentTarget.style.background = 'rgba(12,122,130,0.08)' }}
                    onMouseLeave={(e) => { if (newStatus !== s) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
            </div>
            {(newStatus === 'paid' || newStatus === 'partial') && (
              <input
                type="number"
                placeholder="Amount paid (₹)"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                style={darkInputStyle}
              />
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setStatusTarget(null)}
                className="px-4 py-2 text-sm rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(12,122,130,0.2)', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              >Cancel</button>
              <button
                onClick={handleStatusUpdate}
                disabled={!newStatus}
                className="px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #0c7a82, #0e949e)', color: '#fff', boxShadow: '0 0 16px rgba(12,122,130,0.35)' }}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Generate from template modal */}
      {genTmplTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)', border: '1px solid rgba(12,122,130,0.3)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Generate Invoice</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{genTmplTarget.name}</p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-faint)' }}>Invoice Date</label>
              <input type="date" value={genDate} onChange={(e) => setGenDate(e.target.value)} style={darkInputStyle} />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setGenTmplTarget(null)}
                className="px-4 py-2 text-sm rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(12,122,130,0.2)', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              >Cancel</button>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 text-sm font-semibold rounded-xl"
                style={{ background: 'linear-gradient(135deg, #06d6a0, #0aab80)', color: '#fff', boxShadow: '0 0 16px rgba(6,214,160,0.3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 24px rgba(6,214,160,0.5)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 16px rgba(6,214,160,0.3)' }}
              >Generate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function GradientBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-sm font-semibold rounded-xl transition-all"
      style={{ background: 'linear-gradient(135deg, #0c7a82, #0e949e)', color: '#fff', boxShadow: '0 0 20px rgba(12,122,130,0.35)' }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 28px rgba(12,122,130,0.55)' }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(12,122,130,0.35)' }}
    >
      {children}
    </button>
  )
}

function DarkFormModal({ title, sections, initial, onSave, onClose, saving }: {
  title: string; sections: FormSection[]
  initial: object
  onSave: (v: Record<string, unknown>) => void
  onClose: () => void; saving: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)', border: '1px solid rgba(12,122,130,0.3)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-xl w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b35'; e.currentTarget.style.background = 'rgba(255,107,53,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.background = 'transparent' }}
          >
            &times;
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <GenericForm sections={sections} initialValues={initial} onSubmit={onSave} onCancel={onClose} loading={saving} submitLabel="Save" />
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GenBillingSummary({ invoices }: { invoices: GenInvoice[] }) {
  const totalDue  = invoices.reduce((s, i) => s + i.amount_due,  0)
  const totalPaid = invoices.reduce((s, i) => s + i.amount_paid, 0)
  const overdue   = invoices.filter((i) => i.status === 'overdue').length
  const recurring = invoices.filter((i) => i.template_id !== null).length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Outstanding',       value: fmt(totalDue),   color: '#ff6b35' },
        { label: 'Collected',         value: fmt(totalPaid),  color: '#06d6a0' },
        { label: 'Overdue',           value: String(overdue), color: '#ffc107' },
        { label: 'Recurring-sourced', value: String(recurring), color: '#818cf8' },
      ].map((c) => (
        <div
          key={c.label}
          className="rounded-xl p-4"
          style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.2)' }}
        >
          <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{c.label}</p>
          <p className="text-xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}

function PlansGrid({ plans }: { plans: SubscriptionPlan[] }) {
  if (!plans.length) return <p className="text-center py-16" style={{ color: 'var(--text-faint)' }}>No subscription plans defined.</p>
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {plans.map((p) => (
        <div
          key={p.id}
          className="rounded-xl p-6 space-y-3"
          style={{
            background: 'var(--dark-800)',
            border: p.is_active ? '1px solid rgba(12,122,130,0.25)' : '1px solid rgba(12,122,130,0.1)',
            opacity: p.is_active ? 1 : 0.6,
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
              {p.code && <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>{p.code}</p>}
            </div>
            <span
              className="text-xs px-2 py-0.5 rounded font-semibold"
              style={p.is_active
                ? { background: 'rgba(6,214,160,0.1)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)' }
                : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)', border: '1px solid rgba(12,122,130,0.1)' }
              }
            >
              {p.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="text-2xl font-bold" style={{ color: '#0e949e' }}>
            {fmt(p.price)} <span className="text-sm font-normal" style={{ color: 'var(--text-faint)' }}>/ {CYCLE_LABELS[p.billing_cycle]}</span>
          </div>
          {p.trial_days > 0 && (
            <p className="text-xs font-medium" style={{ color: '#00d4ff' }}>{p.trial_days} day free trial</p>
          )}
          {p.features.length > 0 && (
            <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
              {p.features.map((f, i) => <li key={i} className="flex items-center gap-1.5"><span style={{ color: '#06d6a0' }}>✓</span>{f}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function RecurringTemplatesTable({ templates, onGenerate }: { templates: RecurringTemplate[]; onGenerate: (t: RecurringTemplate) => void }) {
  if (!templates.length) return <p className="text-center py-16" style={{ color: 'var(--text-faint)' }}>No recurring templates defined.</p>
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.2)' }}
    >
      <table className="w-full text-sm">
        <thead style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
          <tr className="text-xs uppercase text-left" style={{ color: 'var(--text-faint)' }}>
            <th className="px-4 py-3">Template</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Cycle</th>
            <th className="px-4 py-3">Next Run</th>
            <th className="px-4 py-3 text-right">Generated</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id} style={{ borderBottom: '1px solid rgba(12,122,130,0.08)' }}>
              <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{t.name}</td>
              <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>Client #{t.client_id}</td>
              <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{CYCLE_LABELS[t.billing_cycle]}</td>
              <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{t.next_run_date}</td>
              <td className="px-4 py-3 text-right" style={{ color: 'var(--text-muted)' }}>{t.invoices_generated}</td>
              <td className="px-4 py-3">
                <span
                  className="inline-flex px-2 py-0.5 rounded text-xs font-semibold"
                  style={
                    t.status === 'active' ? { background: 'rgba(6,214,160,0.1)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)' } :
                    t.status === 'paused' ? { background: 'rgba(255,193,7,0.1)', color: '#ffc107', border: '1px solid rgba(255,193,7,0.3)' } :
                                            { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)', border: '1px solid rgba(12,122,130,0.1)' }
                  }
                >
                  {t.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {t.status === 'active' && (
                  <button
                    onClick={() => onGenerate(t)}
                    className="text-xs px-3 py-1 rounded-lg font-semibold transition-all"
                    style={{ background: 'rgba(12,122,130,0.15)', color: '#0e949e', border: '1px solid rgba(12,122,130,0.3)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(12,122,130,0.25)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(12,122,130,0.15)' }}
                  >
                    Generate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
