import { useEffect, useState, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchCompanies, updateCompany, deleteCompany } from '@/features/companies/companiesSlice'
import CreateCompanyModal from '@/features/companies/CreateCompanyModal'
import EditCompanyModal from '@/features/companies/EditCompanyModal'
import Header from '@/components/layout/Header'
import Table, { Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import Alert from '@/components/ui/Alert'
import SingleSearch from '@/components/ui/SearchFilter/SingleSearch'
import type { Company } from '@/types'

function ImageThumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) return <span className="text-xs" style={{ color: 'var(--text-faint)' }}>—</span>
  return (
    <img
      src={url}
      alt={alt}
      style={{ height: 32, maxWidth: 64, objectFit: 'contain', borderRadius: 4, background: '#f1f5f9' }}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
    />
  )
}

export default function CompaniesPage() {
  const dispatch = useAppDispatch()
  const { items, isLoading, error } = useAppSelector((s) => s.companies)

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Company | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Company | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => { dispatch(fetchCompanies()) }, [dispatch])

  const filtered = useMemo(
    () => search.trim()
      ? items.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      : items,
    [items, search]
  )

  const suggestions = useMemo(
    () => items
      .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      .map((c) => ({ label: c.name, value: String(c.id), meta: c.slug })),
    [items, search]
  )

  const handleToggleActive = (company: Company) =>
    dispatch(updateCompany({ id: company.id, is_active: !company.is_active }))

  const handleDelete = async () => {
    if (!deleteConfirm) return
    await dispatch(deleteCompany(deleteConfirm.id))
    setDeleteConfirm(null)
  }

  const columns: Column<Company>[] = [
    {
      key: 'name',
      header: 'Company',
      render: (c) => (
        <div className="flex items-center gap-3">
          {c.logo_url ? (
            <img src={c.logo_url} alt={c.name}
              style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain', background: 'var(--dark-700)' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
              background: 'linear-gradient(135deg, #0c7a82, #00d4ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
            }}>
              {c.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{c.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'invoice',
      header: 'Invoice Format',
      render: (c) => (
        <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
          {c.invoice_prefix}-{String(c.invoice_starting_number).padStart(4, '0')}
        </span>
      ),
    },
    {
      key: 'gstin',
      header: 'GSTIN',
      render: (c) => <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{c.gstin}</span>,
    },
    {
      key: 'seal',
      header: 'Seal',
      render: (c) => <ImageThumb url={c.seal_url} alt="seal" />,
    },
    {
      key: 'sign',
      header: 'Signature',
      render: (c) => <ImageThumb url={c.signature_url} alt="signature" />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <StatusBadge active={c.is_active} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditTarget(c)}>Edit</Button>
          <Button size="sm" variant={c.is_active ? 'outline' : 'outline'} onClick={() => handleToggleActive(c)}>
            {c.is_active ? 'Disable' : 'Enable'}
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteConfirm(c)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="My Companies"
        actions={
          <Button variant="gradient" onClick={() => setCreateOpen(true)}
            leftIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>}
          >
            Add Company
          </Button>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && <Alert message={error} />}

        <div style={{ maxWidth: 340 }}>
          <SingleSearch
            value={search}
            onChange={setSearch}
            placeholder="Search company name…"
            suggestions={search.length > 0 ? suggestions : []}
            onSuggestionSelect={(s) => setSearch(s.label)}
            highlightMatch
          />
        </div>

        <Table
          columns={columns}
          data={filtered}
          keyExtractor={(c) => c.id}
          loading={isLoading}
          emptyMessage="No companies yet. Add your first company to get started."
        />
      </main>

      <CreateCompanyModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {editTarget && (
        <EditCompanyModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          company={items.find((c) => c.id === editTarget.id) ?? editTarget}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4"
            style={{ background: 'var(--dark-800)', border: '1px solid var(--border-strong)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Delete Company</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Delete <strong>{deleteConfirm.name}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
