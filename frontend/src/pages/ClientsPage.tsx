import { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { clientsThunks, clientsSelectors, type Client } from '@/features/clients/clientsSlice'
import DataGrid from '@/components/ui/DataGrid/DataGrid'
import type { ColumnDef, RowAction } from '@/components/ui/DataGrid/gridTypes'
import GenericForm from '@/components/ui/GenericForm/GenericForm'
import type { FormSection } from '@/components/ui/GenericForm/formTypes'
import SingleSearch from '@/components/ui/SearchFilter/SingleSearch'
import AdvancedFilter from '@/components/ui/SearchFilter/AdvancedFilter'
import type { ActiveFilters, FilterField } from '@/components/ui/SearchFilter/filterTypes'
import { useNotification } from '@/hooks'

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: ColumnDef<Client>[] = [
  {
    key: 'display_name',
    header: 'Client Name',
    sortable: true,
    render: (row) => (
      <div>
        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{row.display_name}</div>
        {row.client_code && <div className="text-xs" style={{ color: 'var(--text-faint)' }}>{row.client_code}</div>}
      </div>
    ),
  },
  {
    key: 'client_type',
    header: 'Type',
    sortable: true,
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={TYPE_STYLE[row.client_type]}>
        {row.client_type}
      </span>
    ),
  },
  {
    key: 'segment',
    header: 'Segment',
    sortable: true,
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={SEGMENT_STYLE[row.segment]}>
        {row.segment}
      </span>
    ),
  },
  { key: 'email', header: 'Email', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.email ?? '—'}</span> },
  { key: 'phone', header: 'Phone', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.phone ?? '—'}</span> },
  { key: 'city',  header: 'City',  render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.city  ?? '—'}</span> },
  {
    key: 'outstanding_balance',
    header: 'Outstanding',
    sortable: true,
    render: (r) => (
      <span className="font-medium" style={{ color: r.outstanding_balance > 0 ? '#ff6b35' : 'var(--text-faint)' }}>
        {r.currency} {r.outstanding_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </span>
    ),
  },
  {
    key: 'is_active',
    header: 'Status',
    render: (r) => (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={r.is_active
          ? { background: 'rgba(6,214,160,0.1)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)' }
          : { background: 'rgba(255,107,53,0.08)', color: 'var(--text-muted)', border: '1px solid rgba(12,122,130,0.15)' }
        }
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.is_active ? '#06d6a0' : 'var(--text-faint)' }} />
        {r.is_active ? 'Active' : 'Inactive'}
      </span>
    ),
  },
]

// ── Filter field definitions ──────────────────────────────────────────────────

const FILTER_FIELDS: FilterField[] = [
  { key: 'display_name', label: 'Client Name', type: 'text' },
  { key: 'client_type',  label: 'Type',        type: 'select', options: ['individual','company','government','ngo'] },
  { key: 'segment',      label: 'Segment',     type: 'select', options: ['premium','standard','prospect','inactive'] },
  { key: 'city',         label: 'City',        type: 'text' },
  { key: 'is_active',    label: 'Active',      type: 'boolean' },
]

// ── Form sections ─────────────────────────────────────────────────────────────

const CLIENT_FORM_SECTIONS: FormSection[] = [
  {
    title: 'Identity',
    fields: [
      { key: 'display_name', label: 'Client Name', type: 'text', required: true, colSpan: 2 },
      { key: 'client_code',  label: 'Client Code', type: 'text', placeholder: 'AUTO if blank' },
      {
        key: 'client_type', label: 'Type', type: 'select', required: true,
        options: [
          { label: 'Company',    value: 'company' },
          { label: 'Individual', value: 'individual' },
          { label: 'Government', value: 'government' },
          { label: 'NGO',        value: 'ngo' },
        ],
      },
      {
        key: 'segment', label: 'Segment', type: 'select', required: true,
        options: [
          { label: 'Standard', value: 'standard' },
          { label: 'Premium',  value: 'premium' },
          { label: 'Prospect', value: 'prospect' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
      { key: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },
  {
    title: 'Contact',
    fields: [
      { key: 'email',    label: 'Email',         type: 'email', colSpan: 2 },
      { key: 'phone',    label: 'Phone',         type: 'text' },
      { key: 'alt_phone',label: 'Alt. Phone',    type: 'text' },
      { key: 'website',  label: 'Website',       type: 'text', colSpan: 2 },
    ],
  },
  {
    title: 'Address',
    fields: [
      { key: 'address_line1', label: 'Address Line 1', type: 'text', colSpan: 3 },
      { key: 'address_line2', label: 'Address Line 2', type: 'text', colSpan: 3 },
      { key: 'city',          label: 'City',           type: 'text' },
      { key: 'state',         label: 'State',          type: 'text' },
      { key: 'pincode',       label: 'Pincode',        type: 'text' },
      { key: 'country',       label: 'Country',        type: 'text', defaultValue: 'India' },
    ],
  },
  {
    title: 'Tax & Financial',
    fields: [
      { key: 'gstin',        label: 'GSTIN',         type: 'text', maxLength: 15 },
      { key: 'pan',          label: 'PAN',           type: 'text', maxLength: 10 },
      { key: 'credit_limit', label: 'Credit Limit',  type: 'number', min: 0 },
      { key: 'credit_days',  label: 'Credit Days',   type: 'number', min: 0 },
      {
        key: 'currency', label: 'Currency', type: 'select', defaultValue: 'INR',
        options: [
          { label: 'INR — Indian Rupee', value: 'INR' },
          { label: 'USD — US Dollar',    value: 'USD' },
          { label: 'EUR — Euro',         value: 'EUR' },
        ],
      },
    ],
  },
  {
    title: 'Notes',
    fields: [
      { key: 'notes', label: 'Notes', type: 'textarea', colSpan: 3, placeholder: 'Internal notes about this client…' },
    ],
  },
]

// ── Helper colour maps ────────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, React.CSSProperties> = {
  company:    { background: 'rgba(12,122,130,0.1)',  color: '#0e949e', border: '1px solid rgba(12,122,130,0.3)' },
  individual: { background: 'rgba(157,78,221,0.1)', color: '#9d4edd', border: '1px solid rgba(157,78,221,0.3)' },
  government: { background: 'rgba(255,193,7,0.1)',  color: '#ffc107', border: '1px solid rgba(255,193,7,0.3)'  },
  ngo:        { background: 'rgba(6,214,160,0.1)',  color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)'  },
}

const SEGMENT_STYLE: Record<string, React.CSSProperties> = {
  premium:  { background: 'rgba(255,107,53,0.1)',  color: '#ff6b35', border: '1px solid rgba(255,107,53,0.3)' },
  standard: { background: 'rgba(12,122,130,0.08)', color: 'var(--text-muted)', border: '1px solid rgba(12,122,130,0.15)' },
  prospect: { background: 'rgba(0,212,255,0.1)',   color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)'  },
  inactive: { background: 'rgba(255,107,53,0.08)', color: '#ff6b35', border: '1px solid rgba(255,107,53,0.2)' },
}

// ── Page component ────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const dispatch    = useAppDispatch()
  const notify      = useNotification()
  const items    = useAppSelector(clientsSelectors.selectItems as (s: any) => Client[])
  const isLoading = useAppSelector(clientsSelectors.selectLoading as (s: any) => boolean)
  const isSaving  = useAppSelector(clientsSelectors.selectSaving  as (s: any) => boolean)
  const { total, page, pageSize } = useAppSelector(clientsSelectors.selectPagination as (s: any) => { total: number; page: number; pageSize: number; pages: number })

  const [search,        setSearch]        = useState('')
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ conditions: [], logic: 'AND' })
  const [showForm,      setShowForm]      = useState(false)
  const [editTarget,    setEditTarget]    = useState<Client | null>(null)
  const [deleteTarget,  setDeleteTarget]  = useState<Client | null>(null)

  const loadClients = useCallback(() => {
    const filterParams: Record<string, unknown> = {}
    activeFilters.conditions.forEach((c) => {
      if (c.value !== '' && c.value !== undefined) filterParams[c.field] = c.value
    })
    dispatch(clientsThunks.fetchAll({
      page,
      size: pageSize,
      search: search || undefined,
      ...filterParams,
    }))
  }, [dispatch, page, pageSize, search, activeFilters])

  useEffect(() => { loadClients() }, [loadClients])

  const ROW_ACTIONS: RowAction<Client>[] = [
    {
      label: 'Edit',
      onClick: (row) => { setEditTarget(row); setShowForm(true) },
    },
    {
      label: 'Delete',
      variant: 'danger',
      onClick: (row) => setDeleteTarget(row),
    },
  ]

  async function handleSave(values: Record<string, unknown>) {
    try {
      if (editTarget) {
        await dispatch(clientsThunks.update({ id: editTarget.id, ...values })).unwrap()
        notify.success('Client updated')
      } else {
        await dispatch(clientsThunks.create(values)).unwrap()
        notify.success('Client created')
      }
      setShowForm(false)
      setEditTarget(null)
      loadClients()
    } catch {
      notify.error('Save failed')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await dispatch(clientsThunks.delete(deleteTarget.id)).unwrap()
      notify.success('Client deleted')
      setDeleteTarget(null)
      loadClients()
    } catch {
      notify.error('Delete failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Clients</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--primary-400)' }}>{total}</span> total
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #0c7a82 0%, #0e949e 100%)',
            boxShadow: '0 0 20px rgba(12,122,130,0.35)',
          }}
        >
          + New Client
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SingleSearch
            placeholder="Search by name, code, email, GSTIN…"
            value={search}
            onChange={setSearch}
            storageKey="clients-search"
          />
        </div>
        <AdvancedFilter
          fields={FILTER_FIELDS}
          value={activeFilters}
          onChange={setActiveFilters}
        />
      </div>

      {/* Data Grid */}
      <DataGrid<Client>
        columns={COLUMNS}
        data={items}
        loading={isLoading}
        rowKey="id"
        rowActions={ROW_ACTIONS}
        selectable
        exportable
        exportFilename="clients"
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: (p) => dispatch(clientsThunks.fetchAll({ page: p, size: pageSize })),
          onPageSizeChange: (s) => dispatch(clientsThunks.fetchAll({ page: 1, size: s })),
        }}
        emptyMessage="No clients found. Create your first client to get started."
      />

      {/* Create / Edit Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
          style={{ background: 'rgba(6,9,18,0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-2xl animate-slide-up"
            style={{
              background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
              border: '1px solid rgba(12,122,130,0.25)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {editTarget ? 'Edit Client' : 'New Client'}
                </h2>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditTarget(null) }}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
                style={{ color: 'var(--text-muted)', border: '1px solid rgba(12,122,130,0.15)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ff6b35'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,107,53,0.3)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(12,122,130,0.15)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <GenericForm
                sections={CLIENT_FORM_SECTIONS}
                initialValues={editTarget ?? {}}
                onSubmit={handleSave}
                onCancel={() => { setShowForm(false); setEditTarget(null) }}
                loading={isSaving}
                submitLabel={editTarget ? 'Update Client' : 'Create Client'}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(6,9,18,0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="rounded-2xl p-6 max-w-md w-full space-y-4 animate-slide-up"
            style={{
              background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
              border: '1px solid rgba(255,107,53,0.25)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.25)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#ff6b35' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Delete Client</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Are you sure you want to delete{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{deleteTarget.display_name}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm rounded-xl transition-all duration-150"
                style={{ color: 'var(--text-muted)', border: '1px solid rgba(12,122,130,0.2)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.08)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm rounded-xl font-semibold text-white transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #ff6b35, #e55a26)', boxShadow: '0 0 12px rgba(255,107,53,0.3)' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
