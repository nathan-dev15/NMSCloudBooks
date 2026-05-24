import { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  purchaseRequisitionsThunks, purchaseRequisitionsSelectors,
  changePRStatus, cancelPR,
  type PurchaseRequisition, type PRStatus, type PRPriority,
} from '@/features/purchaseRequisitions/purchaseRequisitionsSlice'
import DataGrid from '@/components/ui/DataGrid/DataGrid'
import type { ColumnDef, RowAction } from '@/components/ui/DataGrid/gridTypes'
import GenericForm from '@/components/ui/GenericForm/GenericForm'
import type { FormSection } from '@/components/ui/GenericForm/formTypes'
import SingleSearch from '@/components/ui/SearchFilter/SingleSearch'
import AdvancedFilter from '@/components/ui/SearchFilter/AdvancedFilter'
import type { ActiveFilters, FilterField } from '@/components/ui/SearchFilter/filterTypes'
import { useNotification } from '@/hooks'
import type React from 'react'

const STATUS_STYLE: Record<PRStatus, React.CSSProperties> = {
  draft:     { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',  border: '1px solid rgba(12,122,130,0.15)' },
  submitted: { background: 'rgba(255,193,7,0.1)',    color: '#ffc107',            border: '1px solid rgba(255,193,7,0.3)'   },
  approved:  { background: 'rgba(6,214,160,0.1)',    color: '#06d6a0',            border: '1px solid rgba(6,214,160,0.3)'   },
  rejected:  { background: 'rgba(255,107,53,0.1)',   color: '#ff6b35',            border: '1px solid rgba(255,107,53,0.3)'  },
  converted: { background: 'rgba(0,212,255,0.1)',    color: '#00d4ff',            border: '1px solid rgba(0,212,255,0.3)'   },
  cancelled: { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)',  border: '1px solid rgba(12,122,130,0.1)'  },
}

const PRIORITY_STYLE: Record<PRPriority, React.CSSProperties> = {
  low:    { background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)',  border: '1px solid rgba(12,122,130,0.15)' },
  medium: { background: 'rgba(0,212,255,0.08)',   color: '#00d4ff',            border: '1px solid rgba(0,212,255,0.25)'  },
  high:   { background: 'rgba(255,107,53,0.1)',   color: '#ff6b35',            border: '1px solid rgba(255,107,53,0.3)'  },
  urgent: { background: 'rgba(157,78,221,0.15)',  color: '#c084fc',            border: '1px solid rgba(157,78,221,0.4)'  },
}

const STATUS_TRANSITIONS: Record<PRStatus, PRStatus[]> = {
  draft:     ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected', 'cancelled'],
  approved:  ['converted', 'cancelled'],
  rejected:  [],
  converted: [],
  cancelled: [],
}

const COLUMNS: ColumnDef<PurchaseRequisition>[] = [
  {
    key: 'pr_number',
    header: 'PR Number',
    sortable: true,
    render: (r) => (
      <div>
        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.pr_number}</div>
        {r.reference_no && <div className="text-xs" style={{ color: 'var(--text-faint)' }}>Ref: {r.reference_no}</div>}
      </div>
    ),
  },
  { key: 'department',       header: 'Department',   render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.department ?? '—'}</span> },
  { key: 'request_date',     header: 'Request Date', sortable: true, render: (r) => <span style={{ color: 'var(--text-muted)' }}>{(r as any).request_date}</span> },
  { key: 'required_by_date', header: 'Required By',  render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.required_by_date ?? '—'}</span> },
  {
    key: 'priority',
    header: 'Priority',
    render: (r) => (
      <span
        className="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
        style={PRIORITY_STYLE[r.priority]}
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
  { key: 'status',    label: 'Status',   type: 'select', options: ['draft','submitted','approved','rejected','converted','cancelled'] },
  { key: 'priority',  label: 'Priority', type: 'select', options: ['low','medium','high','urgent'] },
  { key: 'from_date', label: 'From',     type: 'date' },
  { key: 'to_date',   label: 'To',       type: 'date' },
]

const PR_FORM_SECTIONS: FormSection[] = [
  {
    title: 'Requisition Details',
    fields: [
      { key: 'pr_number',       label: 'PR Number',     type: 'text', placeholder: 'Auto-generated if blank', colSpan: 2 },
      { key: 'reference_no',    label: 'Reference No.', type: 'text' },
      { key: 'request_date',    label: 'Request Date',  type: 'date', required: true },
      { key: 'required_by_date',label: 'Required By',   type: 'date' },
      {
        key: 'priority', label: 'Priority', type: 'select', defaultValue: 'medium',
        options: [
          { label: 'Low',    value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High',   value: 'high' },
          { label: 'Urgent', value: 'urgent' },
        ],
      },
      { key: 'department', label: 'Department', type: 'text' },
    ],
  },
  {
    title: 'Details',
    fields: [
      { key: 'purpose', label: 'Purpose', type: 'textarea', colSpan: 3 },
      { key: 'notes',   label: 'Notes',   type: 'textarea', colSpan: 3 },
    ],
  },
]

export default function PurchaseRequisitionsPage() {
  const dispatch = useAppDispatch()
  const notify   = useNotification()

  const items     = useAppSelector(purchaseRequisitionsSelectors.selectItems    as (s: any) => PurchaseRequisition[])
  const isLoading = useAppSelector(purchaseRequisitionsSelectors.selectLoading  as (s: any) => boolean)
  const isSaving  = useAppSelector(purchaseRequisitionsSelectors.selectSaving   as (s: any) => boolean)
  const { total, page, pageSize } = useAppSelector(purchaseRequisitionsSelectors.selectPagination as (s: any) => any)

  const [search,        setSearch]        = useState('')
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ conditions: [], logic: 'AND' })
  const [showForm,      setShowForm]      = useState(false)
  const [editTarget,    setEditTarget]    = useState<PurchaseRequisition | null>(null)
  const [statusTarget,  setStatusTarget]  = useState<PurchaseRequisition | null>(null)
  const [newStatus,     setNewStatus]     = useState<PRStatus | ''>('')
  const [rejectReason,  setRejectReason]  = useState('')

  const load = useCallback(() => {
    const fp: Record<string, unknown> = {}
    activeFilters.conditions.forEach((c) => { if (c.value !== '' && c.value !== undefined) fp[c.field] = c.value })
    dispatch(purchaseRequisitionsThunks.fetchAll({ page, size: pageSize, search: search || undefined, ...fp }))
  }, [dispatch, page, pageSize, search, activeFilters])

  useEffect(() => { load() }, [load])

  const ROW_ACTIONS: RowAction<PurchaseRequisition>[] = [
    {
      label: 'Edit',
      visible: (r) => r.status === 'draft',
      onClick: (r) => { setEditTarget(r); setShowForm(true) },
    },
    {
      label: 'Change Status',
      visible: (r) => STATUS_TRANSITIONS[r.status].length > 0,
      onClick: (r) => { setStatusTarget(r); setNewStatus(''); setRejectReason('') },
    },
    {
      label: 'Cancel',
      visible: (r) => !['cancelled', 'converted', 'rejected'].includes(r.status),
      onClick: async (r) => {
        if (!confirm(`Cancel PR ${r.pr_number}?`)) return
        try {
          await dispatch(cancelPR(r.id)).unwrap()
          notify.success(`PR ${r.pr_number} cancelled`)
          load()
        } catch { notify.error('Cancel failed') }
      },
    },
  ]

  async function handleSave(values: Record<string, unknown>) {
    try {
      if (editTarget) {
        await dispatch(purchaseRequisitionsThunks.update({ id: editTarget.id, ...values })).unwrap()
        notify.success('PR updated')
      } else {
        await dispatch(purchaseRequisitionsThunks.create({ ...values, items: [] })).unwrap()
        notify.success('PR created')
      }
      setShowForm(false); setEditTarget(null); load()
    } catch { notify.error('Save failed') }
  }

  async function handleStatusChange() {
    if (!statusTarget || !newStatus) return
    try {
      await dispatch(changePRStatus({
        prId: statusTarget.id,
        status: newStatus,
        rejection_reason: rejectReason || undefined,
      })).unwrap()
      notify.success(`Status → ${newStatus}`)
      setStatusTarget(null); load()
    } catch { notify.error('Status update failed') }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Purchase Requisitions</h1>
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
          + New PR
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SingleSearch placeholder="Search by PR #, reference, department…" value={search} onChange={setSearch} storageKey="pr-search" />
        </div>
        <AdvancedFilter fields={FILTER_FIELDS} value={activeFilters} onChange={setActiveFilters} />
      </div>

      <PRSummaryStrip items={items} />

      <DataGrid<PurchaseRequisition>
        columns={COLUMNS}
        data={items}
        loading={isLoading}
        rowKey="id"
        rowActions={ROW_ACTIONS}
        selectable
        exportable
        exportFilename="purchase-requisitions"
        pagination={{
          page, pageSize, total,
          onPageChange:     (p) => dispatch(purchaseRequisitionsThunks.fetchAll({ page: p, size: pageSize })),
          onPageSizeChange: (s) => dispatch(purchaseRequisitionsThunks.fetchAll({ page: 1, size: s })),
        }}
        emptyMessage="No purchase requisitions found."
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
                  {editTarget ? 'Edit Purchase Requisition' : 'New Purchase Requisition'}
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
                sections={PR_FORM_SECTIONS}
                initialValues={editTarget ?? {}}
                onSubmit={handleSave}
                onCancel={() => { setShowForm(false); setEditTarget(null) }}
                loading={isSaving}
                submitLabel={editTarget ? 'Update PR' : 'Create PR'}
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
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Change PR Status</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {statusTarget.pr_number} — Current:{' '}
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
            {newStatus === 'rejected' && (
              <textarea
                placeholder="Rejection reason (optional)"
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

function PRSummaryStrip({ items }: { items: PurchaseRequisition[] }) {
  const draft     = items.filter((i) => i.status === 'draft').length
  const submitted = items.filter((i) => i.status === 'submitted').length
  const approved  = items.filter((i) => i.status === 'approved').length
  const rejected  = items.filter((i) => i.status === 'rejected').length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Draft',     value: String(draft),     color: 'var(--text-muted)' },
        { label: 'Submitted', value: String(submitted), color: '#ffc107' },
        { label: 'Approved',  value: String(approved),  color: '#06d6a0' },
        { label: 'Rejected',  value: String(rejected),  color: '#ff6b35' },
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
