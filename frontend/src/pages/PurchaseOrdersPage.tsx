import { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  purchaseOrdersThunks, purchaseOrdersSelectors,
  changePOStatus, receiveGoods, cancelPO, downloadPOPdf,
  type PurchaseOrder, type POStatus,
} from '@/features/purchaseOrders/purchaseOrdersSlice'
import DataGrid from '@/components/ui/DataGrid/DataGrid'
import type { ColumnDef, RowAction } from '@/components/ui/DataGrid/gridTypes'
import GenericForm from '@/components/ui/GenericForm/GenericForm'
import type { FormSection } from '@/components/ui/GenericForm/formTypes'
import SingleSearch from '@/components/ui/SearchFilter/SingleSearch'
import AdvancedFilter from '@/components/ui/SearchFilter/AdvancedFilter'
import type { ActiveFilters, FilterField } from '@/components/ui/SearchFilter/filterTypes'
import { useNotification } from '@/hooks'
import type React from 'react'

// ── Colour maps ───────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<POStatus, React.CSSProperties> = {
  draft:     { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',  border: '1px solid rgba(12,122,130,0.15)' },
  pending:   { background: 'rgba(255,193,7,0.1)',    color: '#ffc107',            border: '1px solid rgba(255,193,7,0.3)'   },
  approved:  { background: 'rgba(0,212,255,0.1)',    color: '#00d4ff',            border: '1px solid rgba(0,212,255,0.3)'   },
  ordered:   { background: 'rgba(99,102,241,0.15)',  color: '#818cf8',            border: '1px solid rgba(99,102,241,0.3)'  },
  partial:   { background: 'rgba(255,107,53,0.1)',   color: '#ff6b35',            border: '1px solid rgba(255,107,53,0.3)'  },
  received:  { background: 'rgba(6,214,160,0.1)',    color: '#06d6a0',            border: '1px solid rgba(6,214,160,0.3)'   },
  cancelled: { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)',  border: '1px solid rgba(12,122,130,0.1)'  },
  closed:    { background: 'rgba(157,78,221,0.1)',   color: '#9d4edd',            border: '1px solid rgba(157,78,221,0.3)'  },
}

const PRIORITY_STYLE: Record<string, React.CSSProperties> = {
  low:    { background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)',  border: '1px solid rgba(12,122,130,0.15)' },
  medium: { background: 'rgba(0,212,255,0.08)',   color: '#00d4ff',            border: '1px solid rgba(0,212,255,0.25)'  },
  high:   { background: 'rgba(255,107,53,0.1)',   color: '#ff6b35',            border: '1px solid rgba(255,107,53,0.3)'  },
  urgent: { background: 'rgba(157,78,221,0.15)',  color: '#c084fc',            border: '1px solid rgba(157,78,221,0.4)'  },
}

const STATUS_TRANSITIONS: Record<POStatus, POStatus[]> = {
  draft:     ['pending', 'cancelled'],
  pending:   ['approved', 'cancelled'],
  approved:  ['ordered', 'cancelled'],
  ordered:   ['partial', 'received', 'cancelled'],
  partial:   ['received', 'closed'],
  received:  ['closed'],
  cancelled: [],
  closed:    [],
}

function fmt(n: number, cur = 'INR') {
  return `${cur} ${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

// ── Columns ───────────────────────────────────────────────────────────────────

const COLUMNS: ColumnDef<PurchaseOrder>[] = [
  {
    key: 'po_number',
    header: 'PO Number',
    sortable: true,
    render: (r) => (
      <div>
        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.po_number}</div>
        {r.reference_no && <div className="text-xs" style={{ color: 'var(--text-faint)' }}>Ref: {r.reference_no}</div>}
      </div>
    ),
  },
  {
    key: 'vendor_name',
    header: 'Vendor',
    render: (r) => r.vendor_name
      ? <span style={{ color: 'var(--text-secondary)' }}>{r.vendor_name}</span>
      : <span className="italic" style={{ color: 'var(--text-faint)' }}>No vendor</span>,
  },
  { key: 'order_date',    header: 'Order Date',    sortable: true, render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.order_date}</span> },
  { key: 'expected_date', header: 'Expected',      render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.expected_date ?? '—'}</span> },
  {
    key: 'priority',
    header: 'Priority',
    render: (r) => (
      <span
        className="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
        style={PRIORITY_STYLE[r.priority] ?? PRIORITY_STYLE.medium}
      >
        {r.priority}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (r) => (
      <span
        className="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
        style={STATUS_STYLE[r.status]}
      >
        {r.status}
      </span>
    ),
  },
  {
    key: 'grand_total',
    header: 'Total',
    sortable: true,
    render: (r) => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(r.grand_total, r.currency)}</span>,
  },
]

// ── Filter fields ─────────────────────────────────────────────────────────────

const FILTER_FIELDS: FilterField[] = [
  { key: 'status',    label: 'Status',    type: 'select', options: ['draft','pending','approved','ordered','partial','received','cancelled','closed'] },
  { key: 'priority',  label: 'Priority',  type: 'select', options: ['low','medium','high','urgent'] },
  { key: 'from_date', label: 'From Date', type: 'date' },
  { key: 'to_date',   label: 'To Date',   type: 'date' },
]

// ── Form sections ─────────────────────────────────────────────────────────────

const PO_FORM_SECTIONS: FormSection[] = [
  {
    title: 'Order Details',
    fields: [
      { key: 'po_number',    label: 'PO Number',     type: 'text',   placeholder: 'Auto-generated if blank', colSpan: 2 },
      { key: 'reference_no', label: 'Reference No.', type: 'text' },
      { key: 'order_date',   label: 'Order Date',    type: 'date',   required: true },
      { key: 'expected_date',label: 'Expected Date', type: 'date' },
      {
        key: 'priority', label: 'Priority', type: 'select', defaultValue: 'medium',
        options: [
          { label: 'Low',    value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High',   value: 'high' },
          { label: 'Urgent', value: 'urgent' },
        ],
      },
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
    title: 'Vendor',
    fields: [
      { key: 'vendor_id', label: 'Vendor ID', type: 'number', hint: 'Enter client/vendor ID' },
    ],
  },
  {
    title: 'Delivery',
    fields: [
      { key: 'delivery_address', label: 'Delivery Address', type: 'textarea', colSpan: 3 },
      { key: 'shipping_terms',   label: 'Shipping Terms',   type: 'text', colSpan: 2 },
      { key: 'payment_terms',    label: 'Payment Terms',    type: 'text' },
    ],
  },
  {
    title: 'Notes',
    fields: [
      { key: 'notes',          label: 'Vendor Notes',   type: 'textarea', colSpan: 3 },
      { key: 'internal_notes', label: 'Internal Notes', type: 'textarea', colSpan: 3 },
    ],
  },
]

// ── Page component ────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const dispatch = useAppDispatch()
  const notify   = useNotification()

  const items     = useAppSelector(purchaseOrdersSelectors.selectItems    as (s: any) => PurchaseOrder[])
  const isLoading = useAppSelector(purchaseOrdersSelectors.selectLoading  as (s: any) => boolean)
  const isSaving  = useAppSelector(purchaseOrdersSelectors.selectSaving   as (s: any) => boolean)
  const { total, page, pageSize } = useAppSelector(purchaseOrdersSelectors.selectPagination as (s: any) => { total: number; page: number; pageSize: number; pages: number })

  const [search,        setSearch]        = useState('')
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ conditions: [], logic: 'AND' })
  const [showForm,      setShowForm]      = useState(false)
  const [editTarget,    setEditTarget]    = useState<PurchaseOrder | null>(null)
  const [statusTarget,  setStatusTarget]  = useState<PurchaseOrder | null>(null)
  const [newStatus,     setNewStatus]     = useState<POStatus | ''>('')
  const [rejectReason,  setRejectReason]  = useState('')
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null)
  const [receiveQtys,   setReceiveQtys]   = useState<Record<number, string>>({})
  const [receiveDate,   setReceiveDate]   = useState(new Date().toISOString().slice(0, 10))

  const load = useCallback(() => {
    const fp: Record<string, unknown> = {}
    activeFilters.conditions.forEach((c) => { if (c.value !== '' && c.value !== undefined) fp[c.field] = c.value })
    dispatch(purchaseOrdersThunks.fetchAll({ page, size: pageSize, search: search || undefined, ...fp }))
  }, [dispatch, page, pageSize, search, activeFilters])

  useEffect(() => { load() }, [load])

  // ── Row actions ─────────────────────────────────────────────────────────────

  const ROW_ACTIONS: RowAction<PurchaseOrder>[] = [
    {
      label: 'Edit',
      visible: (r) => ['draft', 'pending'].includes(r.status),
      onClick: (r) => { setEditTarget(r); setShowForm(true) },
    },
    {
      label: 'Change Status',
      onClick: (r) => { setStatusTarget(r); setNewStatus(''); setRejectReason('') },
    },
    {
      label: 'Receive Goods',
      visible: (r) => ['ordered', 'partial'].includes(r.status),
      onClick: (r) => {
        setReceiveTarget(r)
        const init: Record<number, string> = {}
        r.items.forEach((i) => { if (!i.is_closed) init[i.id] = '' })
        setReceiveQtys(init)
        setReceiveDate(new Date().toISOString().slice(0, 10))
      },
    },
    {
      label: 'Cancel',
      visible: (r) => !['cancelled', 'closed', 'received'].includes(r.status),
      onClick: async (r) => {
        if (!confirm(`Cancel PO ${r.po_number}? This cannot be undone.`)) return
        try {
          await dispatch(cancelPO(r.id)).unwrap()
          notify.success(`PO ${r.po_number} cancelled`)
          load()
        } catch { notify.error('Cancel failed') }
      },
    },
    {
      label: 'Download PDF',
      onClick: async (r) => {
        try {
          await dispatch(downloadPOPdf(r.id)).unwrap()
        } catch { notify.error('Download failed') }
      },
    },
  ]

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSave(values: Record<string, unknown>) {
    try {
      if (editTarget) {
        await dispatch(purchaseOrdersThunks.update({ id: editTarget.id, ...values })).unwrap()
        notify.success('PO updated')
      } else {
        await dispatch(purchaseOrdersThunks.create({ ...values, items: values.items ?? [] })).unwrap()
        notify.success('PO created')
      }
      setShowForm(false); setEditTarget(null); load()
    } catch { notify.error('Save failed') }
  }

  async function handleStatusChange() {
    if (!statusTarget || !newStatus) return
    try {
      await dispatch(changePOStatus({
        poId: statusTarget.id,
        status: newStatus,
        rejection_reason: rejectReason || undefined,
      })).unwrap()
      notify.success(`Status → ${newStatus}`)
      setStatusTarget(null); load()
    } catch { notify.error('Status update failed') }
  }

  async function handleReceive() {
    if (!receiveTarget) return
    const itemsPayload = Object.entries(receiveQtys)
      .filter(([, v]) => v !== '' && Number(v) > 0)
      .map(([id, qty]) => ({ item_id: Number(id), qty_received: Number(qty) }))
    if (!itemsPayload.length) { notify.warning('Enter at least one quantity'); return }
    try {
      await dispatch(receiveGoods({
        poId: receiveTarget.id,
        data: { received_date: receiveDate, items: itemsPayload },
      })).unwrap()
      notify.success('Goods receipt recorded')
      setReceiveTarget(null); load()
    } catch { notify.error('Receipt failed') }
  }

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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Purchase Orders</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>{total} total</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="px-4 py-2 text-sm font-semibold rounded-xl transition-all"
          style={{
            background: 'linear-gradient(135deg, #0c7a82, #0e949e)',
            color: '#fff',
            boxShadow: '0 0 20px rgba(12,122,130,0.35)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 28px rgba(12,122,130,0.55)' }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(12,122,130,0.35)' }}
        >
          + New PO
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SingleSearch
            placeholder="Search by PO #, reference, vendor…"
            value={search}
            onChange={setSearch}
            storageKey="po-search"
          />
        </div>
        <AdvancedFilter fields={FILTER_FIELDS} value={activeFilters} onChange={setActiveFilters} />
      </div>

      {/* Summary strip */}
      <POSummaryStrip items={items} />

      {/* Grid */}
      <DataGrid<PurchaseOrder>
        columns={COLUMNS}
        data={items}
        loading={isLoading}
        rowKey="id"
        rowActions={ROW_ACTIONS}
        selectable
        exportable
        exportFilename="purchase-orders"
        pagination={{
          page, pageSize, total,
          onPageChange:     (p) => dispatch(purchaseOrdersThunks.fetchAll({ page: p, size: pageSize })),
          onPageSizeChange: (s) => dispatch(purchaseOrdersThunks.fetchAll({ page: 1, size: s })),
        }}
        emptyMessage="No purchase orders found."
      />

      {/* Create / Edit PO Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
              border: '1px solid rgba(12,122,130,0.3)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(12,122,130,0.08)',
            }}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {editTarget ? 'Edit Purchase Order' : 'New Purchase Order'}
                </h2>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditTarget(null) }}
                className="text-xl w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: 'var(--text-faint)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b35'; e.currentTarget.style.background = 'rgba(255,107,53,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.background = 'transparent' }}
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <GenericForm
                sections={PO_FORM_SECTIONS}
                initialValues={editTarget ?? {}}
                onSubmit={handleSave}
                onCancel={() => { setShowForm(false); setEditTarget(null) }}
                loading={isSaving}
                submitLabel={editTarget ? 'Update PO' : 'Create PO'}
              />
            </div>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{
              background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
              border: '1px solid rgba(12,122,130,0.3)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Change PO Status</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {statusTarget.po_number} — Current:{' '}
              <span
                className="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase"
                style={STATUS_STYLE[statusTarget.status]}
              >
                {statusTarget.status}
              </span>
            </p>
            <div className="space-y-2">
              {STATUS_TRANSITIONS[statusTarget.status].map((s) => (
                <button
                  key={s}
                  onClick={() => setNewStatus(s)}
                  className="w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-all"
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
              {STATUS_TRANSITIONS[statusTarget.status].length === 0 && (
                <p className="text-sm italic" style={{ color: 'var(--text-faint)' }}>No further transitions available.</p>
              )}
            </div>
            {newStatus === 'cancelled' && (
              <textarea
                placeholder="Rejection / cancellation reason (optional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="input-dark w-full"
                rows={2}
              />
            )}
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setStatusTarget(null)}
                className="px-4 py-2 text-sm rounded-xl transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(12,122,130,0.2)', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                disabled={!newStatus}
                className="px-4 py-2 text-sm font-semibold rounded-xl transition-all disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #0c7a82, #0e949e)',
                  color: '#fff',
                  boxShadow: '0 0 16px rgba(12,122,130,0.35)',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Goods Modal */}
      {receiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-lg rounded-2xl p-6 space-y-4"
            style={{
              background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
              border: '1px solid rgba(12,122,130,0.3)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Receive Goods</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{receiveTarget.po_number}</p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-faint)' }}>
                Receipt Date
              </label>
              <input
                type="date"
                value={receiveDate}
                onChange={(e) => setReceiveDate(e.target.value)}
                style={darkInputStyle}
              />
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {receiveTarget.items.filter((i) => !i.is_closed).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(12,122,130,0.12)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.description}</p>
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      Ordered: {item.quantity} {item.unit ?? ''} | Received: {item.qty_received}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={item.quantity - item.qty_received}
                    step={0.001}
                    placeholder="Qty"
                    value={receiveQtys[item.id] ?? ''}
                    onChange={(e) => setReceiveQtys((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    style={{ ...darkInputStyle, width: '6rem' }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setReceiveTarget(null)}
                className="px-4 py-2 text-sm rounded-xl transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(12,122,130,0.2)', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleReceive}
                className="px-4 py-2 text-sm font-semibold rounded-xl transition-all"
                style={{
                  background: 'linear-gradient(135deg, #06d6a0, #0aab80)',
                  color: '#fff',
                  boxShadow: '0 0 16px rgba(6,214,160,0.3)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 24px rgba(6,214,160,0.5)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 16px rgba(6,214,160,0.3)' }}
              >
                Confirm Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function POSummaryStrip({ items }: { items: PurchaseOrder[] }) {
  const pending  = items.filter((i) => i.status === 'pending').length
  const approved = items.filter((i) => i.status === 'approved').length
  const ordered  = items.filter((i) => i.status === 'ordered').length
  const partial  = items.filter((i) => i.status === 'partial').length
  const totalVal = items.reduce((s, i) => s + i.grand_total, 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[
        { label: 'Pending Approval', value: String(pending),  color: '#ffc107' },
        { label: 'Approved',         value: String(approved), color: '#00d4ff' },
        { label: 'Ordered',          value: String(ordered),  color: '#818cf8' },
        { label: 'Partial Receipt',  value: String(partial),  color: '#ff6b35' },
        { label: 'Total Value',      value: `₹${totalVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'var(--text-primary)' },
      ].map((c) => (
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
