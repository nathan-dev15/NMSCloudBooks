import { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  deliveryChallansThunks, deliveryChallansSelectors,
  changeDCStatus, cancelDC,
  type DeliveryChallan, type DCStatus,
} from '@/features/deliveryChallans/deliveryChallansSlice'
import DataGrid from '@/components/ui/DataGrid/DataGrid'
import type { ColumnDef, RowAction } from '@/components/ui/DataGrid/gridTypes'
import GenericForm from '@/components/ui/GenericForm/GenericForm'
import type { FormSection } from '@/components/ui/GenericForm/formTypes'
import SingleSearch from '@/components/ui/SearchFilter/SingleSearch'
import AdvancedFilter from '@/components/ui/SearchFilter/AdvancedFilter'
import type { ActiveFilters, FilterField } from '@/components/ui/SearchFilter/filterTypes'
import { useNotification } from '@/hooks'
import type React from 'react'

const STATUS_STYLE: Record<DCStatus, React.CSSProperties> = {
  draft:      { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',  border: '1px solid rgba(12,122,130,0.15)' },
  dispatched: { background: 'rgba(0,212,255,0.1)',    color: '#00d4ff',            border: '1px solid rgba(0,212,255,0.3)'   },
  delivered:  { background: 'rgba(6,214,160,0.1)',    color: '#06d6a0',            border: '1px solid rgba(6,214,160,0.3)'   },
  returned:   { background: 'rgba(255,107,53,0.1)',   color: '#ff6b35',            border: '1px solid rgba(255,107,53,0.3)'  },
  cancelled:  { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)',  border: '1px solid rgba(12,122,130,0.1)'  },
}

const STATUS_TRANSITIONS: Record<DCStatus, DCStatus[]> = {
  draft:      ['dispatched', 'cancelled'],
  dispatched: ['delivered', 'returned', 'cancelled'],
  delivered:  [],
  returned:   [],
  cancelled:  [],
}

const COLUMNS: ColumnDef<DeliveryChallan>[] = [
  {
    key: 'dc_number',
    header: 'DC Number',
    sortable: true,
    render: (r) => (
      <div>
        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.dc_number}</div>
        {r.reference_no && <div className="text-xs" style={{ color: 'var(--text-faint)' }}>Ref: {r.reference_no}</div>}
      </div>
    ),
  },
  { key: 'consignee_name', header: 'Consignee',  render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.consignee_name ?? '—'}</span> },
  { key: 'dc_date',        header: 'DC Date',    sortable: true, render: (r) => <span style={{ color: 'var(--text-muted)' }}>{(r as any).dc_date}</span> },
  { key: 'delivery_date',  header: 'Delivered',  render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.delivery_date ?? '—'}</span> },
  { key: 'vehicle_number', header: 'Vehicle',    render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.vehicle_number ?? '—'}</span> },
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
    key: 'items',
    header: 'Items',
    render: (r) => (
      <span style={{ color: 'var(--text-muted)' }}>
        {r.items.length} item{r.items.length !== 1 ? 's' : ''}
      </span>
    ),
  },
]

const FILTER_FIELDS: FilterField[] = [
  { key: 'status',    label: 'Status',    type: 'select', options: ['draft','dispatched','delivered','returned','cancelled'] },
  { key: 'from_date', label: 'From Date', type: 'date' },
  { key: 'to_date',   label: 'To Date',   type: 'date' },
]

const DC_FORM_SECTIONS: FormSection[] = [
  {
    title: 'Challan Details',
    fields: [
      { key: 'dc_number',    label: 'DC Number',     type: 'text', placeholder: 'Auto-generated if blank', colSpan: 2 },
      { key: 'reference_no', label: 'Reference No.', type: 'text' },
      { key: 'dc_date',      label: 'DC Date',       type: 'date', required: true },
      { key: 'delivery_date',label: 'Delivery Date', type: 'date' },
      { key: 'client_id',    label: 'Client ID',     type: 'number', hint: 'Optional client/customer ID' },
    ],
  },
  {
    title: 'Delivery Info',
    fields: [
      { key: 'consignee_name', label: 'Consignee Name', type: 'text', colSpan: 2 },
      { key: 'vehicle_number', label: 'Vehicle Number', type: 'text' },
      { key: 'driver_name',    label: 'Driver Name',    type: 'text', colSpan: 2 },
      { key: 'from_address',   label: 'From Address',   type: 'textarea', colSpan: 3 },
      { key: 'to_address',     label: 'To Address',     type: 'textarea', colSpan: 3 },
    ],
  },
  {
    title: 'Notes',
    fields: [
      { key: 'notes', label: 'Notes', type: 'textarea', colSpan: 3 },
    ],
  },
]

export default function DeliveryChallansPage() {
  const dispatch = useAppDispatch()
  const notify   = useNotification()

  const items     = useAppSelector(deliveryChallansSelectors.selectItems    as (s: any) => DeliveryChallan[])
  const isLoading = useAppSelector(deliveryChallansSelectors.selectLoading  as (s: any) => boolean)
  const isSaving  = useAppSelector(deliveryChallansSelectors.selectSaving   as (s: any) => boolean)
  const { total, page, pageSize } = useAppSelector(deliveryChallansSelectors.selectPagination as (s: any) => any)

  const [search,        setSearch]        = useState('')
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ conditions: [], logic: 'AND' })
  const [showForm,      setShowForm]      = useState(false)
  const [editTarget,    setEditTarget]    = useState<DeliveryChallan | null>(null)
  const [statusTarget,  setStatusTarget]  = useState<DeliveryChallan | null>(null)
  const [newStatus,     setNewStatus]     = useState<DCStatus | ''>('')

  const load = useCallback(() => {
    const fp: Record<string, unknown> = {}
    activeFilters.conditions.forEach((c) => { if (c.value !== '' && c.value !== undefined) fp[c.field] = c.value })
    dispatch(deliveryChallansThunks.fetchAll({ page, size: pageSize, search: search || undefined, ...fp }))
  }, [dispatch, page, pageSize, search, activeFilters])

  useEffect(() => { load() }, [load])

  const ROW_ACTIONS: RowAction<DeliveryChallan>[] = [
    {
      label: 'Edit',
      visible: (r) => r.status === 'draft',
      onClick: (r) => { setEditTarget(r); setShowForm(true) },
    },
    {
      label: 'Change Status',
      visible: (r) => STATUS_TRANSITIONS[r.status].length > 0,
      onClick: (r) => { setStatusTarget(r); setNewStatus('') },
    },
    {
      label: 'Cancel',
      visible: (r) => !['cancelled', 'delivered', 'returned'].includes(r.status),
      onClick: async (r) => {
        if (!confirm(`Cancel DC ${r.dc_number}?`)) return
        try {
          await dispatch(cancelDC(r.id)).unwrap()
          notify.success(`DC ${r.dc_number} cancelled`)
          load()
        } catch { notify.error('Cancel failed') }
      },
    },
  ]

  async function handleSave(values: Record<string, unknown>) {
    try {
      if (editTarget) {
        await dispatch(deliveryChallansThunks.update({ id: editTarget.id, ...values })).unwrap()
        notify.success('DC updated')
      } else {
        await dispatch(deliveryChallansThunks.create({ ...values, items: [] })).unwrap()
        notify.success('DC created')
      }
      setShowForm(false); setEditTarget(null); load()
    } catch { notify.error('Save failed') }
  }

  async function handleStatusChange() {
    if (!statusTarget || !newStatus) return
    try {
      await dispatch(changeDCStatus({ dcId: statusTarget.id, status: newStatus })).unwrap()
      notify.success(`Status → ${newStatus}`)
      setStatusTarget(null); load()
    } catch { notify.error('Status update failed') }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Delivery Challans</h1>
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
          + New DC
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SingleSearch placeholder="Search by DC #, reference, consignee…" value={search} onChange={setSearch} storageKey="dc-search" />
        </div>
        <AdvancedFilter fields={FILTER_FIELDS} value={activeFilters} onChange={setActiveFilters} />
      </div>

      <DCSummaryStrip items={items} />

      <DataGrid<DeliveryChallan>
        columns={COLUMNS}
        data={items}
        loading={isLoading}
        rowKey="id"
        rowActions={ROW_ACTIONS}
        selectable
        exportable
        exportFilename="delivery-challans"
        pagination={{
          page, pageSize, total,
          onPageChange:     (p) => dispatch(deliveryChallansThunks.fetchAll({ page: p, size: pageSize })),
          onPageSizeChange: (s) => dispatch(deliveryChallansThunks.fetchAll({ page: 1, size: s })),
        }}
        emptyMessage="No delivery challans found."
      />

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
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
                  {editTarget ? 'Edit Delivery Challan' : 'New Delivery Challan'}
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
                sections={DC_FORM_SECTIONS}
                initialValues={editTarget ?? {}}
                onSubmit={handleSave}
                onCancel={() => { setShowForm(false); setEditTarget(null) }}
                loading={isSaving}
                submitLabel={editTarget ? 'Update DC' : 'Create DC'}
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
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Change DC Status</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {statusTarget.dc_number} — Current:{' '}
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
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setStatusTarget(null)}
                className="px-4 py-2 text-sm rounded-xl transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(12,122,130,0.2)', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              >
                Close
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
    </div>
  )
}

function DCSummaryStrip({ items }: { items: DeliveryChallan[] }) {
  const draft      = items.filter((i) => i.status === 'draft').length
  const dispatched = items.filter((i) => i.status === 'dispatched').length
  const delivered  = items.filter((i) => i.status === 'delivered').length
  const returned   = items.filter((i) => i.status === 'returned').length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Draft',      value: String(draft),      color: 'var(--text-muted)' },
        { label: 'Dispatched', value: String(dispatched), color: '#00d4ff' },
        { label: 'Delivered',  value: String(delivered),  color: '#06d6a0' },
        { label: 'Returned',   value: String(returned),   color: '#ff6b35' },
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
