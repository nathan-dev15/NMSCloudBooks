import { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  invoicesThunks, invoicesSelectors, updateInvoiceStatus, recordPayment,
  cancelInvoice, downloadInvoicePdf,
  type Invoice, type InvoiceStatus, type PaymentMode,
} from '@/features/invoices/invoicesSlice'
import DataGrid from '@/components/ui/DataGrid/DataGrid'
import type { ColumnDef, RowAction } from '@/components/ui/DataGrid/gridTypes'
import GenericForm from '@/components/ui/GenericForm/GenericForm'
import type { FormSection } from '@/components/ui/GenericForm/formTypes'
import SingleSearch from '@/components/ui/SearchFilter/SingleSearch'
import AdvancedFilter from '@/components/ui/SearchFilter/AdvancedFilter'
import type { ActiveFilters, FilterField } from '@/components/ui/SearchFilter/filterTypes'
import { useNotification } from '@/hooks'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<InvoiceStatus, React.CSSProperties> = {
  draft:     { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',  border: '1px solid rgba(12,122,130,0.15)' },
  sent:      { background: 'rgba(0,212,255,0.1)',    color: '#00d4ff',            border: '1px solid rgba(0,212,255,0.3)'   },
  partial:   { background: 'rgba(255,193,7,0.1)',    color: '#ffc107',            border: '1px solid rgba(255,193,7,0.3)'   },
  paid:      { background: 'rgba(6,214,160,0.1)',    color: '#06d6a0',            border: '1px solid rgba(6,214,160,0.3)'   },
  overdue:   { background: 'rgba(255,107,53,0.1)',   color: '#ff6b35',            border: '1px solid rgba(255,107,53,0.3)'  },
  cancelled: { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)',  border: '1px solid rgba(12,122,130,0.1)'  },
  void:      { background: 'rgba(157,78,221,0.1)',   color: '#9d4edd',            border: '1px solid rgba(157,78,221,0.3)'  },
}

const STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft:     ['sent', 'cancelled'],
  sent:      ['partial', 'paid', 'overdue', 'cancelled'],
  partial:   ['paid', 'overdue', 'cancelled'],
  overdue:   ['paid', 'cancelled'],
  paid:      ['void'],
  cancelled: [],
  void:      [],
}

function fmtCurrency(amount: number, currency = 'INR') {
  return `${currency} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: ColumnDef<Invoice>[] = [
  {
    key: 'invoice_number',
    header: 'Invoice #',
    sortable: true,
    render: (r) => (
      <div>
        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.invoice_number}</div>
        {r.reference_no && <div className="text-xs" style={{ color: 'var(--text-faint)' }}>Ref: {r.reference_no}</div>}
      </div>
    ),
  },
  {
    key: 'billing_name',
    header: 'Client',
    render: (r) => r.billing_name ?? `Client #${r.client_id}`,
  },
  { key: 'invoice_date', header: 'Date',     sortable: true, render: (r) => r.invoice_date },
  { key: 'due_date',     header: 'Due Date', sortable: true, render: (r) => r.due_date },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (r) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={STATUS_STYLE[r.status]}>
        {r.status.toUpperCase()}
      </span>
    ),
  },
  {
    key: 'grand_total',
    header: 'Total',
    sortable: true,
    render: (r) => <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(r.grand_total, r.currency)}</span>,
  },
  {
    key: 'amount_paid',
    header: 'Paid',
    render: (r) => (
      <span style={{ color: r.amount_paid > 0 ? '#06d6a0' : 'var(--text-faint)' }}>
        {fmtCurrency(r.amount_paid, r.currency)}
      </span>
    ),
  },
  {
    key: 'amount_due',
    header: 'Due',
    render: (r) => (
      <span className={r.amount_due > 0 ? 'font-medium' : ''} style={{ color: r.amount_due > 0 ? '#ff6b35' : 'var(--text-faint)' }}>
        {fmtCurrency(r.amount_due, r.currency)}
      </span>
    ),
  },
]

// ── Filter fields ─────────────────────────────────────────────────────────────

const FILTER_FIELDS: FilterField[] = [
  { key: 'status',    label: 'Status',    type: 'select', options: ['draft','sent','partial','paid','overdue','cancelled','void'] },
  { key: 'from_date', label: 'From Date', type: 'date' },
  { key: 'to_date',   label: 'To Date',   type: 'date' },
]

// ── Invoice form ──────────────────────────────────────────────────────────────

const INVOICE_FORM_SECTIONS: FormSection[] = [
  {
    title: 'Invoice Details',
    fields: [
      { key: 'invoice_number', label: 'Invoice Number', type: 'text', placeholder: 'Auto-generated if blank', colSpan: 2 },
      { key: 'reference_no',   label: 'Reference / PO No.', type: 'text' },
      { key: 'invoice_date',   label: 'Invoice Date', type: 'date', required: true },
      { key: 'due_date',       label: 'Due Date',     type: 'date', required: true },
      { key: 'supply_date',    label: 'Supply Date',  type: 'date' },
    ],
  },
  {
    title: 'Client',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'number', required: true, hint: 'Enter the client ID' },
    ],
  },
  {
    title: 'GST Settings',
    fields: [
      {
        key: 'gst_type', label: 'GST Type', type: 'select', defaultValue: 'cgst_sgst',
        options: [
          { label: 'CGST + SGST (Intra-state)', value: 'cgst_sgst' },
          { label: 'IGST (Interstate)',          value: 'igst' },
          { label: 'None / Exempt',              value: 'none' },
        ],
      },
      { key: 'place_of_supply', label: 'Place of Supply', type: 'text', placeholder: 'e.g. Tamil Nadu' },
      {
        key: 'currency', label: 'Currency', type: 'select', defaultValue: 'INR',
        options: [
          { label: 'INR', value: 'INR' },
          { label: 'USD', value: 'USD' },
          { label: 'EUR', value: 'EUR' },
        ],
      },
    ],
  },
  {
    title: 'Notes & Terms',
    fields: [
      { key: 'notes', label: 'Notes', type: 'textarea', colSpan: 3 },
      { key: 'terms', label: 'Terms & Conditions', type: 'textarea', colSpan: 3 },
    ],
  },
]

// ── Payment form ──────────────────────────────────────────────────────────────

const PAYMENT_FORM_SECTIONS: FormSection[] = [
  {
    fields: [
      { key: 'payment_date', label: 'Payment Date', type: 'date', required: true },
      { key: 'amount',       label: 'Amount',       type: 'number', required: true, min: 0.01 },
      {
        key: 'mode', label: 'Mode', type: 'select', required: true, defaultValue: 'bank',
        options: [
          { label: 'Bank Transfer', value: 'bank' },
          { label: 'Cash',          value: 'cash' },
          { label: 'UPI',           value: 'upi' },
          { label: 'Cheque',        value: 'cheque' },
          { label: 'NEFT / RTGS',   value: 'neft' },
          { label: 'Credit / Adj.', value: 'credit' },
        ],
      },
      { key: 'reference', label: 'Transaction Ref.',  type: 'text' },
      { key: 'notes',     label: 'Notes',             type: 'text' },
    ],
  },
]

// ── Page component ────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const dispatch   = useAppDispatch()
  const notify     = useNotification()

  const items    = useAppSelector(invoicesSelectors.selectItems as (s: any) => Invoice[])
  const isLoading = useAppSelector(invoicesSelectors.selectLoading as (s: any) => boolean)
  const isSaving  = useAppSelector(invoicesSelectors.selectSaving  as (s: any) => boolean)
  const { total, page, pageSize } = useAppSelector(invoicesSelectors.selectPagination as (s: any) => { total: number; page: number; pageSize: number; pages: number })

  const [search,        setSearch]        = useState('')
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ conditions: [], logic: 'AND' })
  const [showForm,      setShowForm]      = useState(false)
  const [editTarget,    setEditTarget]    = useState<Invoice | null>(null)
  const [payTarget,     setPayTarget]     = useState<Invoice | null>(null)
  const [statusTarget,  setStatusTarget]  = useState<Invoice | null>(null)
  const [newStatus,     setNewStatus]     = useState<InvoiceStatus | ''>('')

  const loadInvoices = useCallback(() => {
    const fp: Record<string, unknown> = {}
    activeFilters.conditions.forEach((c) => {
      if (c.value !== '' && c.value !== undefined) fp[c.field] = c.value
    })
    dispatch(invoicesThunks.fetchAll({ page, size: pageSize, search: search || undefined, ...fp }))
  }, [dispatch, page, pageSize, search, activeFilters])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  // ── Row actions ─────────────────────────────────────────────────────────────

  const ROW_ACTIONS: RowAction<Invoice>[] = [
    {
      label: 'Edit',
      visible: (r) => ['draft', 'sent'].includes(r.status),
      onClick: (r) => { setEditTarget(r); setShowForm(true) },
    },
    {
      label: 'Record Payment',
      visible: (r) => ['sent', 'partial', 'overdue'].includes(r.status),
      onClick: (r) => setPayTarget(r),
    },
    {
      label: 'Change Status',
      onClick: (r) => { setStatusTarget(r); setNewStatus('') },
    },
    {
      label: 'Cancel',
      visible: (r) => ['draft', 'sent', 'partial', 'overdue'].includes(r.status),
      onClick: async (r) => {
        if (!confirm(`Cancel invoice ${r.invoice_number}? This cannot be undone.`)) return
        try {
          await dispatch(cancelInvoice(r.id)).unwrap()
          notify.success(`Invoice ${r.invoice_number} cancelled`)
          loadInvoices()
        } catch { notify.error('Cancel failed') }
      },
    },
    {
      label: 'Download PDF',
      onClick: async (r) => {
        try {
          await dispatch(downloadInvoicePdf(r.id)).unwrap()
        } catch { notify.error('Download failed') }
      },
    },
  ]

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSave(values: Record<string, unknown>) {
    try {
      if (editTarget) {
        await dispatch(invoicesThunks.update({ id: editTarget.id, ...values })).unwrap()
        notify.success('Invoice updated')
      } else {
        // Items come from a separate inline editor; for now the form handles basic details
        // and sends items as a JSON array
        const payload = { ...values, items: values.items ?? [] }
        await dispatch(invoicesThunks.create(payload)).unwrap()
        notify.success('Invoice created')
      }
      setShowForm(false); setEditTarget(null); loadInvoices()
    } catch { notify.error('Save failed') }
  }

  async function handlePayment(values: Record<string, unknown>) {
    if (!payTarget) return
    try {
      await dispatch(recordPayment({
        invoiceId: payTarget.id,
        data: {
          payment_date: values.payment_date as string,
          amount:       Number(values.amount),
          mode:         values.mode as PaymentMode,
          reference:    values.reference as string | undefined,
          notes:        values.notes as string | undefined,
        },
      })).unwrap()
      notify.success('Payment recorded')
      setPayTarget(null); loadInvoices()
    } catch { notify.error('Payment failed') }
  }

  async function handleStatusChange() {
    if (!statusTarget || !newStatus) return
    try {
      await dispatch(updateInvoiceStatus({ invoiceId: statusTarget.id, status: newStatus })).unwrap()
      notify.success(`Status changed to ${newStatus}`)
      setStatusTarget(null); loadInvoices()
    } catch { notify.error('Status update failed') }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Invoices</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--primary-400)' }}>{total}</span> total
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
          style={{ background: 'linear-gradient(135deg, #0c7a82 0%, #0e949e 100%)', boxShadow: '0 0 20px rgba(12,122,130,0.35)' }}
        >
          + New Invoice
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SingleSearch
            placeholder="Search by invoice #, reference, client…"
            value={search}
            onChange={setSearch}
            storageKey="invoices-search"
          />
        </div>
        <AdvancedFilter
          fields={FILTER_FIELDS}
          value={activeFilters}
          onChange={setActiveFilters}
        />
      </div>

      {/* Summary cards */}
      <InvoiceSummaryCards items={items} />

      {/* Data Grid */}
      <DataGrid<Invoice>
        columns={COLUMNS}
        data={items}
        loading={isLoading}
        rowKey="id"
        rowActions={ROW_ACTIONS}
        selectable
        exportable
        exportFilename="invoices"
        pagination={{
          page,
          pageSize,
          total,
          onPageChange:     (p) => dispatch(invoicesThunks.fetchAll({ page: p,    size: pageSize })),
          onPageSizeChange: (s) => dispatch(invoicesThunks.fetchAll({ page: 1,    size: s })),
        }}
        emptyMessage="No invoices found."
      />

      {/* Create / Edit Invoice Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4" style={{ background: 'rgba(6,9,18,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl animate-slide-up" style={{ background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)', border: '1px solid rgba(12,122,130,0.25)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{editTarget ? 'Edit Invoice' : 'New Invoice'}</h2>
              </div>
              <button onClick={() => { setShowForm(false); setEditTarget(null) }} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: 'var(--text-muted)', border: '1px solid rgba(12,122,130,0.15)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <GenericForm sections={INVOICE_FORM_SECTIONS} initialValues={editTarget ?? {}} onSubmit={handleSave} onCancel={() => { setShowForm(false); setEditTarget(null) }} loading={isSaving} submitLabel={editTarget ? 'Update Invoice' : 'Create Invoice'} />
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(6,9,18,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-lg rounded-2xl animate-slide-up" style={{ background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)', border: '1px solid rgba(12,122,130,0.25)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #06d6a0, #0c7a82)' }} />
                  <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Record Payment</h2>
                </div>
                <p className="text-xs mt-0.5 ml-3" style={{ color: 'var(--text-muted)' }}>
                  {payTarget.invoice_number} — Due: {fmtCurrency(payTarget.amount_due, payTarget.currency)}
                </p>
              </div>
              <button onClick={() => setPayTarget(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: 'var(--text-muted)', border: '1px solid rgba(12,122,130,0.15)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-4">
              <GenericForm sections={PAYMENT_FORM_SECTIONS} initialValues={{ payment_date: new Date().toISOString().slice(0, 10) }} onSubmit={handlePayment} onCancel={() => setPayTarget(null)} loading={isSaving} submitLabel="Record Payment" />
            </div>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(6,9,18,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4 animate-slide-up" style={{ background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)', border: '1px solid rgba(12,122,130,0.25)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Change Invoice Status</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {statusTarget.invoice_number} — Current:{' '}
              <span style={{ color: 'var(--primary-400)', fontWeight: 600 }}>{statusTarget.status.toUpperCase()}</span>
            </p>
            <div className="space-y-2">
              {STATUS_TRANSITIONS[statusTarget.status].map((s) => (
                <button key={s} onClick={() => setNewStatus(s)}
                  className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                  style={newStatus === s
                    ? { background: 'rgba(12,122,130,0.15)', color: 'var(--primary-400)', border: '1px solid rgba(12,122,130,0.4)' }
                    : { background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', border: '1px solid rgba(12,122,130,0.12)' }
                  }
                >
                  {s.toUpperCase()}
                </button>
              ))}
              {STATUS_TRANSITIONS[statusTarget.status].length === 0 && (
                <p className="text-sm italic" style={{ color: 'var(--text-faint)' }}>No further transitions available.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setStatusTarget(null)} className="px-4 py-2 text-sm rounded-xl" style={{ color: 'var(--text-muted)', border: '1px solid rgba(12,122,130,0.2)' }}>Cancel</button>
              <button onClick={handleStatusChange} disabled={!newStatus}
                className="px-4 py-2 text-sm rounded-xl font-semibold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #0c7a82, #0e949e)' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Summary cards ─────────────────────────────────────────────────────────────

function InvoiceSummaryCards({ items }: { items: Invoice[] }) {
  const totalDue  = items.reduce((s, i) => s + i.amount_due,  0)
  const totalPaid = items.reduce((s, i) => s + i.amount_paid, 0)
  const overdue   = items.filter((i) => i.status === 'overdue').length
  const draft     = items.filter((i) => i.status === 'draft').length

  const cards = [
    { label: 'Total Outstanding', value: fmtCurrency(totalDue),  color: '#ff6b35' },
    { label: 'Total Collected',   value: fmtCurrency(totalPaid), color: '#06d6a0' },
    { label: 'Overdue',           value: String(overdue),        color: '#ffc107' },
    { label: 'Drafts',            value: String(draft),          color: 'var(--text-muted)' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl p-4"
          style={{
            background: 'var(--dark-800)',
            border: '1px solid rgba(12,122,130,0.2)',
          }}
        >
          <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{c.label}</p>
          <p className="text-xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}
