import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchTenants, updateTenant } from '@/features/tenants/tenantsSlice'
import CreateTenantModal from '@/features/tenants/CreateTenantModal'
import ModuleToggleCard from '@/features/tenants/ModuleToggleCard'
import Header from '@/components/layout/Header'
import Table, { Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import Alert from '@/components/ui/Alert'
import type { Tenant } from '@/types'

const PLAN_COLORS: Record<string, 'teal' | 'cyan' | 'purple' | 'blue' | 'green'> = {
  starter: 'green', basic: 'teal', pro: 'cyan', enterprise: 'purple', custom: 'blue',
}

export default function TenantsPage() {
  const dispatch = useAppDispatch()
  const { items, isLoading, error } = useAppSelector((s) => s.tenants)
  const [createOpen, setCreateOpen] = useState(false)
  const [selected,   setSelected]   = useState<Tenant | null>(null)

  useEffect(() => { dispatch(fetchTenants()) }, [dispatch])

  const handleToggleActive = async (tenant: Tenant) => {
    await dispatch(updateTenant({ id: tenant.id, is_active: !tenant.is_active }))
  }

  const columns: Column<Tenant>[] = [
    {
      key: 'name',
      header: 'Organisation',
      render: (t) => (
        <div>
          <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{t.slug}</p>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (t) => {
        const slug = t.subscription_plan?.slug ?? ''
        const name = t.subscription_plan?.name ?? 'No Plan'
        const PERIOD_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
          trial:     { label: '1 mo free',  emoji: '🎁', color: '#34d399' },
          quarterly: { label: '3 months',   emoji: '📅', color: '#2aacb5' },
          yearly:    { label: '1 year',     emoji: '🏆', color: '#9d4edd' },
        }
        const period = t.billing_period ? PERIOD_LABELS[t.billing_period] : null
        return (
          <div className="flex flex-col gap-1">
            <Badge color={PLAN_COLORS[slug] ?? 'teal'}>{name}</Badge>
            {period && (
              <span style={{ fontSize: '11px', color: period.color, fontWeight: 500 }}>
                {period.emoji} {period.label}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'modules',
      header: 'Modules',
      render: (t) => (
        <span className="text-sm" style={{ color: t.enabled_modules.length === 0 ? 'var(--text-faint)' : 'var(--text-muted)' }}>
          {t.enabled_modules.length === 0 ? 'None' : t.enabled_modules.join(', ')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <StatusBadge active={t.is_active} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (t) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setSelected(t)}>Manage</Button>
          <Button
            size="sm"
            variant={t.is_active ? 'danger' : 'outline'}
            onClick={() => handleToggleActive(t)}
          >
            {t.is_active ? 'Disable' : 'Enable'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Tenant Management"
        actions={
          <Button
            variant="gradient"
            onClick={() => setCreateOpen(true)}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            }
          >
            New Tenant
          </Button>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && <Alert message={error} />}

        <Table
          columns={columns}
          data={items}
          keyExtractor={(t) => t.id}
          loading={isLoading}
          emptyMessage="No tenants found."
        />

        {/* Module management panel */}
        {selected && (
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: 'var(--dark-800)',
              border: '1px solid rgba(12,122,130,0.2)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Managing:{' '}
                  <span style={{ color: 'var(--primary-400)' }}>{selected.name}</span>
                </h2>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Close panel</Button>
            </div>
            <ModuleToggleCard
              tenant={items.find((t) => t.id === selected.id) ?? selected}
            />
          </div>
        )}
      </main>

      <CreateTenantModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
