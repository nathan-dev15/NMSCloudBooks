import { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  retailThunks, retailSelectors, retailAuxSelectors,
  fetchStores, fetchPromotions,
  type Sale, type Store, type Promotion, type SaleStatus, type PaymentMethod,
} from '@/features/retail/retailSlice'
import DataGrid from '@/components/ui/DataGrid/DataGrid'
import type { ColumnDef, RowAction } from '@/components/ui/DataGrid/gridTypes'
import GenericForm from '@/components/ui/GenericForm/GenericForm'
import type { FormSection } from '@/components/ui/GenericForm/formTypes'
import SingleSearch from '@/components/ui/SearchFilter/SingleSearch'
import AdvancedFilter from '@/components/ui/SearchFilter/AdvancedFilter'
import type { ActiveFilters, FilterField } from '@/components/ui/SearchFilter/filterTypes'
import { useNotification } from '@/hooks'
import type React from 'react'

// ── Colour helpers ────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<SaleStatus, React.CSSProperties> = {
  draft:          { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',  border: '1px solid rgba(12,122,130,0.15)' },
  completed:      { background: 'rgba(6,214,160,0.1)',    color: '#06d6a0',            border: '1px solid rgba(6,214,160,0.3)'   },
  cancelled:      { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)',  border: '1px solid rgba(12,122,130,0.1)'  },
  refunded:       { background: 'rgba(157,78,221,0.1)',   color: '#9d4edd',            border: '1px solid rgba(157,78,221,0.3)'  },
  partial_refund: { background: 'rgba(255,107,53,0.1)',   color: '#ff6b35',            border: '1px solid rgba(255,107,53,0.3)'  },
}

const METHOD_ICON: Record<PaymentMethod, string> = {
  cash: '💵', card: '💳', upi: '📱', wallet: '👛', split: '⚡', credit: '📝',
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

// ── Columns ───────────────────────────────────────────────────────────────────

const COLUMNS: ColumnDef<Sale>[] = [
  {
    key: 'bill_number',
    header: 'Bill #',
    sortable: true,
    render: (r) => <span className="font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.bill_number}</span>,
  },
  { key: 'sale_date', header: 'Date', sortable: true, render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.sale_date}</span> },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <span
        className="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
        style={STATUS_STYLE[r.status]}
      >
        {r.status.replace('_', ' ')}
      </span>
    ),
  },
  {
    key: 'payment_method',
    header: 'Payment',
    render: (r) => (
      <span className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span>{METHOD_ICON[r.payment_method]}</span>
        <span className="capitalize">{r.payment_method}</span>
      </span>
    ),
  },
  {
    key: 'grand_total',
    header: 'Total',
    sortable: true,
    render: (r) => <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(r.grand_total)}</span>,
  },
  {
    key: 'discount_amount',
    header: 'Discount',
    render: (r) => r.discount_amount > 0
      ? <span style={{ color: '#06d6a0' }}>-{fmt(r.discount_amount)}</span>
      : <span style={{ color: 'var(--text-faint)' }}>—</span>,
  },
  {
    key: 'loyalty_points_earned',
    header: 'Points',
    render: (r) => r.loyalty_points_earned > 0
      ? <span className="font-medium" style={{ color: '#ffc107' }}>+{r.loyalty_points_earned}</span>
      : <span style={{ color: 'var(--text-faint)' }}>0</span>,
  },
]

// ── Filter fields ─────────────────────────────────────────────────────────────

const FILTER_FIELDS: FilterField[] = [
  { key: 'status',    label: 'Status',    type: 'select', options: ['draft','completed','cancelled','refunded','partial_refund'] },
  { key: 'from_date', label: 'From Date', type: 'date' },
  { key: 'to_date',   label: 'To Date',   type: 'date' },
  { key: 'store_id',  label: 'Store ID',  type: 'text' },
]

// ── Sale form sections ────────────────────────────────────────────────────────

const SALE_FORM_SECTIONS: FormSection[] = [
  {
    title: 'Sale Details',
    fields: [
      { key: 'store_id',    label: 'Store ID',   type: 'number', required: true },
      { key: 'customer_id', label: 'Customer ID', type: 'number', hint: 'Optional — for loyalty tracking' },
      { key: 'sale_date',   label: 'Sale Date',  type: 'date',   required: true },
      { key: 'sale_time',   label: 'Sale Time',  type: 'time' },
      {
        key: 'payment_method', label: 'Payment Method', type: 'select', defaultValue: 'cash',
        options: [
          { label: 'Cash',   value: 'cash' },
          { label: 'Card',   value: 'card' },
          { label: 'UPI',    value: 'upi' },
          { label: 'Wallet', value: 'wallet' },
          { label: 'Split',  value: 'split' },
          { label: 'Credit', value: 'credit' },
        ],
      },
      { key: 'amount_tendered',     label: 'Amount Tendered',     type: 'number', min: 0 },
      { key: 'discount_amount',     label: 'Header Discount (₹)', type: 'number', min: 0, defaultValue: 0 },
      { key: 'loyalty_points_used', label: 'Loyalty Points Used', type: 'number', min: 0, defaultValue: 0 },
      { key: 'notes',               label: 'Notes',               type: 'textarea', colSpan: 3 },
    ],
  },
]

// ── Page component ────────────────────────────────────────────────────────────

export default function RetailPage() {
  const dispatch = useAppDispatch()
  const notify   = useNotification()

  const sales     = useAppSelector(retailSelectors.selectItems   as (s: any) => Sale[])
  const isLoading = useAppSelector(retailSelectors.selectLoading as (s: any) => boolean)
  const isSaving  = useAppSelector(retailSelectors.selectSaving  as (s: any) => boolean)
  const { total, page, pageSize } = useAppSelector(retailSelectors.selectPagination as (s: any) => { total: number; page: number; pageSize: number; pages: number })
  const stores     = useAppSelector(retailAuxSelectors.stores)
  const promotions = useAppSelector(retailAuxSelectors.promotions)

  const [tab,           setTab]           = useState<'sales' | 'stores' | 'promotions'>('sales')
  const [search,        setSearch]        = useState('')
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ conditions: [], logic: 'AND' })
  const [showForm,      setShowForm]      = useState(false)
  const [viewSale,      setViewSale]      = useState<Sale | null>(null)

  const load = useCallback(() => {
    const fp: Record<string, unknown> = {}
    activeFilters.conditions.forEach((c) => { if (c.value !== '' && c.value !== undefined) fp[c.field] = c.value })
    dispatch(retailThunks.fetchAll({ page, size: pageSize, search: search || undefined, ...fp }))
  }, [dispatch, page, pageSize, search, activeFilters])

  useEffect(() => {
    load()
    dispatch(fetchStores())
    dispatch(fetchPromotions())
  }, [])

  useEffect(() => { load() }, [load])

  const ROW_ACTIONS: RowAction<Sale>[] = [
    { label: 'View Details', onClick: (r) => setViewSale(r) },
    {
      label: 'Refund',
      variant: 'danger',
      visible: (r) => r.status === 'completed',
      onClick: async (r) => {
        if (!confirm(`Refund bill ${r.bill_number}?`)) return
        try {
          await dispatch(retailThunks.update({ id: r.id, status: 'refunded' })).unwrap()
          notify.success('Refund processed')
          load()
        } catch { notify.error('Refund failed') }
      },
    },
  ]

  async function handleSave(values: Record<string, unknown>) {
    try {
      await dispatch(retailThunks.create({ ...values, items: [] })).unwrap()
      notify.success('Sale created')
      setShowForm(false)
      load()
    } catch { notify.error('Sale creation failed') }
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Retail Billing</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>
            {stores.length} store{stores.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        {tab === 'sales' && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm font-semibold rounded-xl transition-all"
            style={{
              background: 'linear-gradient(135deg, #0c7a82, #0e949e)',
              color: '#fff',
              boxShadow: '0 0 20px rgba(12,122,130,0.35)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 28px rgba(12,122,130,0.55)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(12,122,130,0.35)' }}
          >
            + New Sale
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
        {(['sales', 'stores', 'promotions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium capitalize transition-colors"
            style={
              tab === t
                ? { borderBottom: '2px solid #0c7a82', color: '#0e949e', paddingBottom: '6px' }
                : { borderBottom: '2px solid transparent', color: 'var(--text-faint)', paddingBottom: '6px' }
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'sales' && (
        <>
          <RetailSummaryCards sales={sales} />
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <SingleSearch
                placeholder="Search by bill number…"
                value={search}
                onChange={setSearch}
                storageKey="retail-search"
              />
            </div>
            <AdvancedFilter fields={FILTER_FIELDS} value={activeFilters} onChange={setActiveFilters} />
          </div>
          <DataGrid<Sale>
            columns={COLUMNS}
            data={sales}
            loading={isLoading}
            rowKey="id"
            rowActions={ROW_ACTIONS}
            selectable
            exportable
            exportFilename="retail-sales"
            pagination={{
              page, pageSize, total,
              onPageChange:     (p) => dispatch(retailThunks.fetchAll({ page: p, size: pageSize })),
              onPageSizeChange: (s) => dispatch(retailThunks.fetchAll({ page: 1, size: s })),
            }}
            emptyMessage="No sales found."
          />
        </>
      )}

      {tab === 'stores'     && <StoreGrid stores={stores} />}
      {tab === 'promotions' && <PromotionsTable promotions={promotions} />}

      {/* Create Sale Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
              border: '1px solid rgba(12,122,130,0.3)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>New Sale</h2>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-xl w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ color: 'var(--text-faint)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b35'; e.currentTarget.style.background = 'rgba(255,107,53,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.background = 'transparent' }}
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <GenericForm
                sections={SALE_FORM_SECTIONS}
                initialValues={{ sale_date: new Date().toISOString().slice(0, 10) }}
                onSubmit={handleSave}
                onCancel={() => setShowForm(false)}
                loading={isSaving}
                submitLabel="Record Sale"
              />
            </div>
          </div>
        </div>
      )}

      {/* View Sale Modal */}
      {viewSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
              border: '1px solid rgba(12,122,130,0.3)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
                <div>
                  <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Bill #{viewSale.bill_number}</h2>
                  <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{viewSale.sale_date} — {viewSale.payment_method.toUpperCase()}</p>
                </div>
              </div>
              <button
                onClick={() => setViewSale(null)}
                className="text-xl w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ color: 'var(--text-faint)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b35'; e.currentTarget.style.background = 'rgba(255,107,53,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.background = 'transparent' }}
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* Items */}
              <table className="w-full text-sm">
                <thead style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
                  <tr className="text-left text-xs uppercase" style={{ color: 'var(--text-faint)' }}>
                    <th className="pb-2">Item</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewSale.items.map((i) => (
                    <tr key={i.id} style={{ borderBottom: '1px solid rgba(12,122,130,0.06)' }}>
                      <td className="py-2" style={{ color: 'var(--text-secondary)' }}>{i.product_name}</td>
                      <td className="py-2 text-right" style={{ color: 'var(--text-muted)' }}>{i.quantity} {i.unit}</td>
                      <td className="py-2 text-right" style={{ color: 'var(--text-muted)' }}>{fmt(i.unit_price)}</td>
                      <td className="py-2 text-right font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(i.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Totals */}
              <div className="space-y-1 text-sm pt-1" style={{ borderTop: '1px solid rgba(12,122,130,0.15)' }}>
                {[
                  { label: 'Subtotal',  value: fmt(viewSale.subtotal) },
                  { label: 'Discount',  value: `-${fmt(viewSale.discount_amount)}`, hide: !viewSale.discount_amount },
                  { label: 'Tax',       value: fmt(viewSale.tax_amount) },
                  { label: 'Round Off', value: fmt(viewSale.round_off), hide: !viewSale.round_off },
                ].filter((r) => !r.hide).map((r) => (
                  <div key={r.label} className="flex justify-between" style={{ color: 'var(--text-muted)' }}>
                    <span>{r.label}</span><span>{r.value}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-base pt-2 mt-1" style={{ borderTop: '1px solid rgba(12,122,130,0.15)', color: 'var(--text-primary)' }}>
                  <span>Grand Total</span><span style={{ color: '#06d6a0' }}>{fmt(viewSale.grand_total)}</span>
                </div>
                {viewSale.loyalty_points_earned > 0 && (
                  <p className="text-xs text-right" style={{ color: '#ffc107' }}>+{viewSale.loyalty_points_earned} loyalty points earned</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RetailSummaryCards({ sales }: { sales: Sale[] }) {
  const completed = sales.filter((s) => s.status === 'completed')
  const revenue   = completed.reduce((sum, s) => sum + s.grand_total, 0)
  const avgTicket = completed.length ? revenue / completed.length : 0
  const refunds   = sales.filter((s) => s.status === 'refunded').length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Revenue',      value: fmt(revenue),           color: '#06d6a0' },
        { label: 'Transactions', value: String(completed.length), color: '#00d4ff' },
        { label: 'Avg. Ticket',  value: fmt(avgTicket),         color: '#818cf8' },
        { label: 'Refunds',      value: String(refunds),        color: '#ff6b35' },
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

function StoreGrid({ stores }: { stores: Store[] }) {
  if (!stores.length) return <p className="text-center py-16" style={{ color: 'var(--text-faint)' }}>No stores configured.</p>
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {stores.map((s) => (
        <div
          key={s.id}
          className="rounded-xl p-5 space-y-2"
          style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.2)' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
              {s.code && <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>Code: {s.code}</p>}
            </div>
            <div className="flex flex-col gap-1 items-end">
              {s.is_default && (
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ background: 'rgba(12,122,130,0.15)', color: '#0e949e', border: '1px solid rgba(12,122,130,0.3)' }}
                >
                  Default
                </span>
              )}
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={s.status === 'active'
                  ? { background: 'rgba(6,214,160,0.1)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)', border: '1px solid rgba(12,122,130,0.1)' }
                }
              >
                {s.status}
              </span>
            </div>
          </div>
          {s.phone   && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>📞 {s.phone}</p>}
          {s.address && <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{s.address}</p>}
          {s.gstin   && <p className="text-xs" style={{ color: 'var(--text-faint)' }}>GSTIN: {s.gstin}</p>}
        </div>
      ))}
    </div>
  )
}

function PromotionsTable({ promotions }: { promotions: Promotion[] }) {
  if (!promotions.length) return <p className="text-center py-16" style={{ color: 'var(--text-faint)' }}>No promotions created.</p>
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.2)' }}
    >
      <table className="w-full text-sm">
        <thead style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
          <tr className="text-xs uppercase text-left" style={{ color: 'var(--text-faint)' }}>
            <th className="px-4 py-3">Promotion</th>
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Valid</th>
            <th className="px-4 py-3 text-right">Used</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {promotions.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid rgba(12,122,130,0.08)' }}>
              <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</td>
              <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{p.code ?? '—'}</td>
              <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-secondary)' }}>{p.promo_type.replace(/_/g, ' ')}</td>
              <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.discount_value}{p.promo_type === 'percent_discount' ? '%' : '₹'}</td>
              <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{p.start_date} — {p.end_date}</td>
              <td className="px-4 py-3 text-right" style={{ color: 'var(--text-muted)' }}>{p.usage_count}{p.usage_limit ? `/${p.usage_limit}` : ''}</td>
              <td className="px-4 py-3">
                <span
                  className="inline-flex px-2 py-0.5 rounded text-xs font-semibold"
                  style={p.is_active
                    ? { background: 'rgba(6,214,160,0.1)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)' }
                    : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)', border: '1px solid rgba(12,122,130,0.1)' }
                  }
                >
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
