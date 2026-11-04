import { useEffect, useState, FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchAllSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
} from '@/features/subscriptions/subscriptionPlansSlice'
import Header from '@/components/layout/Header'
import Table, { Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Alert from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import type { SubscriptionPlan } from '@/types'

const MODULE_OPTIONS = ['general', 'retail', 'civil', 'agriculture']

// ── Plan Form ────────────────────────────────────────────────────────────────

interface PlanFormState {
  name: string
  slug: string
  description: string
  price_monthly: string
  price_quarterly: string
  price_yearly: string
  trial_days: string
  max_users: string
  max_companies: string
  enabled_modules: string[]
  features: string
  display_order: string
  is_active: boolean
}

const EMPTY_FORM: PlanFormState = {
  name: '', slug: '', description: '',
  price_monthly: '0', price_quarterly: '0', price_yearly: '0',
  trial_days: '30',
  max_users: '', max_companies: '',
  enabled_modules: [],
  features: '',
  display_order: '0',
  is_active: true,
}

function toForm(p: SubscriptionPlan): PlanFormState {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description ?? '',
    price_monthly: String(p.price_monthly),
    price_quarterly: String(p.price_quarterly),
    price_yearly: String(p.price_yearly),
    trial_days: String(p.trial_days),
    max_users: p.max_users != null ? String(p.max_users) : '',
    max_companies: p.max_companies != null ? String(p.max_companies) : '',
    enabled_modules: p.enabled_modules as string[],
    features: p.features.join('\n'),
    display_order: String(p.display_order),
    is_active: p.is_active,
  }
}

function fromForm(f: PlanFormState): Record<string, unknown> {
  return {
    name: f.name.trim(),
    slug: f.slug.trim(),
    description: f.description.trim() || null,
    price_monthly: parseFloat(f.price_monthly) || 0,
    price_quarterly: parseFloat(f.price_quarterly) || 0,
    price_yearly: parseFloat(f.price_yearly) || 0,
    trial_days: parseInt(f.trial_days) || 30,
    max_users: f.max_users ? parseInt(f.max_users) : null,
    max_companies: f.max_companies ? parseInt(f.max_companies) : null,
    enabled_modules: f.enabled_modules,
    features: f.features.split('\n').map((s) => s.trim()).filter(Boolean),
    display_order: parseInt(f.display_order) || 0,
    is_active: f.is_active,
  }
}

interface PlanFormProps {
  title: string
  form: PlanFormState
  setForm: React.Dispatch<React.SetStateAction<PlanFormState>>
  onSubmit: (e: FormEvent) => Promise<void>
  loading: boolean
  error: string | null
  onClose: () => void
}

function PlanFormModal({ title, form, setForm, onSubmit, loading, error, onClose }: PlanFormProps) {
  const set = (key: keyof PlanFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }))

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setForm((p) => ({ ...p, name, slug: autoSlug(name) }))
  }

  const toggleModule = (mod: string) => {
    setForm((p) => ({
      ...p,
      enabled_modules: p.enabled_modules.includes(mod)
        ? p.enabled_modules.filter((m) => m !== mod)
        : [...p.enabled_modules, mod],
    }))
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="plan-form" loading={loading}>Save Plan</Button>
        </>
      }
    >
      {error && <Alert message={error} className="mb-4" />}
      <form id="plan-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Plan Name" required value={form.name} onChange={handleNameChange} placeholder="Pro" />
          <Input label="Slug" required value={form.slug} onChange={set('slug')} placeholder="pro" hint="Auto-generated from name" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Description</label>
          <textarea
            className="w-full rounded-lg px-3 py-2 text-sm resize-none"
            style={{
              background: 'var(--dark-700)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', outline: 'none',
            }}
            rows={2}
            value={form.description}
            onChange={set('description')}
            placeholder="Short description of this plan"
          />
        </div>

        {/* Billing period prices */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
            Pricing by Billing Period
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}
            >
              <p className="text-xs font-semibold mb-2" style={{ color: '#34d399' }}>
                🎁 1 Month Free
              </p>
              <Input
                label="Trial Days"
                type="number"
                value={form.trial_days}
                onChange={set('trial_days')}
                placeholder="30"
                hint="Days at ₹0"
              />
            </div>
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(12,122,130,0.06)', border: '1px solid rgba(12,122,130,0.2)' }}
            >
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--primary-400)' }}>
                📅 3 Months
              </p>
              <Input
                label="Quarterly Price (₹)"
                type="number"
                step="0.01"
                value={form.price_quarterly}
                onChange={set('price_quarterly')}
                placeholder="0"
              />
            </div>
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(157,78,221,0.06)', border: '1px solid rgba(157,78,221,0.2)' }}
            >
              <p className="text-xs font-semibold mb-2" style={{ color: '#9d4edd' }}>
                🏆 1 Year
              </p>
              <Input
                label="Yearly Price (₹)"
                type="number"
                step="0.01"
                value={form.price_yearly}
                onChange={set('price_yearly')}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Max Users" type="number" value={form.max_users} onChange={set('max_users')} placeholder="Leave blank = unlimited" />
          <Input label="Max Companies" type="number" value={form.max_companies} onChange={set('max_companies')} placeholder="Leave blank = unlimited" />
        </div>

        {/* Enabled modules */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Enabled Modules</label>
          <div className="flex flex-wrap gap-2">
            {MODULE_OPTIONS.map((mod) => {
              const active = form.enabled_modules.includes(mod)
              return (
                <button
                  key={mod}
                  type="button"
                  onClick={() => toggleModule(mod)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '99px',
                    fontSize: '12px',
                    fontWeight: 500,
                    border: `1px solid ${active ? 'var(--primary-400)' : 'var(--border)'}`,
                    background: active ? 'rgba(12,122,130,0.15)' : 'transparent',
                    color: active ? 'var(--primary-400)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {mod}
                </button>
              )
            })}
          </div>
        </div>

        {/* Features — one per line */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Features <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(one per line)</span>
          </label>
          <textarea
            className="w-full rounded-lg px-3 py-2 text-sm resize-none font-mono"
            style={{
              background: 'var(--dark-700)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', outline: 'none',
            }}
            rows={4}
            value={form.features}
            onChange={set('features')}
            placeholder={"Unlimited invoicing\nPriority support\nCustom branding"}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 items-center">
          <Input label="Display Order" type="number" value={form.display_order} onChange={set('display_order')} />
          <div className="flex items-center gap-2 mt-5">
            <input
              id="is_active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              style={{ accentColor: 'var(--primary-400)' }}
            />
            <label htmlFor="is_active" className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Active (visible to tenants)
            </label>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan, onEdit, onDelete,
}: { plan: SubscriptionPlan; onEdit: () => void; onDelete: () => void }) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: 'var(--dark-800)',
        border: '1px solid rgba(12,122,130,0.18)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Active badge */}
      <div
        style={{
          position: 'absolute', top: '12px', right: '12px',
          width: '8px', height: '8px', borderRadius: '50%',
          background: plan.is_active ? '#34d399' : '#ef4444',
        }}
        title={plan.is_active ? 'Active' : 'Inactive'}
      />

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {plan.name}
          </span>
          <Badge color="teal">{plan.slug}</Badge>
        </div>
        {plan.description && (
          <p style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{plan.description}</p>
        )}
      </div>

      {/* Billing period pricing */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(12,122,130,0.15)' }}>
        {/* Free trial */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ background: 'rgba(52,211,153,0.06)', borderBottom: '1px solid rgba(12,122,130,0.1)' }}
        >
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#34d399' }}>🎁 {plan.trial_days}-day free trial</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#34d399' }}>₹0</span>
        </div>
        {/* Quarterly */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ background: 'rgba(12,122,130,0.04)', borderBottom: '1px solid rgba(12,122,130,0.1)' }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📅 3 months</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-400)' }}>
            {plan.price_quarterly === 0 ? 'Custom' : `₹${plan.price_quarterly}`}
          </span>
        </div>
        {/* Yearly */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ background: 'rgba(157,78,221,0.04)' }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🏆 1 year</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#9d4edd' }}>
            {plan.price_yearly === 0 ? 'Custom' : `₹${plan.price_yearly}`}
          </span>
        </div>
      </div>

      {/* Limits */}
      <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{plan.max_users != null ? `${plan.max_users} users` : 'Unlimited users'}</span>
        <span>·</span>
        <span>{plan.max_companies != null ? `${plan.max_companies} companies` : 'Unlimited companies'}</span>
      </div>

      {/* Modules */}
      {plan.enabled_modules.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {plan.enabled_modules.map((mod) => (
            <span
              key={mod}
              style={{
                fontSize: '10px', padding: '2px 8px', borderRadius: '99px',
                background: 'rgba(12,122,130,0.12)', color: 'var(--primary-400)',
                textTransform: 'capitalize',
              }}
            >
              {mod}
            </span>
          ))}
        </div>
      )}

      {/* Features */}
      {plan.features.length > 0 && (
        <ul className="space-y-1">
          {plan.features.map((f, i) => (
            <li key={i} style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}>
              <span style={{ color: '#34d399', flexShrink: 0 }}>✓</span>
              {f}
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-2">
        <Button size="sm" variant="outline" onClick={onEdit} style={{ flex: 1 }}>Edit</Button>
        <Button size="sm" variant="danger" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionPlansPage() {
  const dispatch = useAppDispatch()
  const { items, isLoading, error } = useAppSelector((s) => s.subscriptionPlans)

  const [createOpen, setCreateOpen]   = useState(false)
  const [editTarget, setEditTarget]   = useState<SubscriptionPlan | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null)

  const [form, setForm]       = useState<PlanFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { dispatch(fetchAllSubscriptionPlans()) }, [dispatch])

  const openCreate = () => { setForm(EMPTY_FORM); setFormError(null); setCreateOpen(true) }
  const openEdit   = (p: SubscriptionPlan) => { setForm(toForm(p)); setFormError(null); setEditTarget(p) }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null); setSaving(true)
    const result = await dispatch(createSubscriptionPlan(fromForm(form)))
    setSaving(false)
    if (createSubscriptionPlan.fulfilled.match(result)) {
      setCreateOpen(false)
    } else {
      setFormError(result.payload as string)
    }
  }

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setFormError(null); setSaving(true)
    const result = await dispatch(updateSubscriptionPlan({ id: editTarget.id, ...fromForm(form) }))
    setSaving(false)
    if (updateSubscriptionPlan.fulfilled.match(result)) {
      setEditTarget(null)
    } else {
      setFormError(result.payload as string)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await dispatch(deleteSubscriptionPlan(deleteTarget.id))
    setDeleting(false)
    setDeleteTarget(null)
  }

  const columns: Column<SubscriptionPlan>[] = [
    {
      key: 'name',
      header: 'Plan',
      render: (p) => (
        <div>
          <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{p.slug}</p>
        </div>
      ),
    },
    {
      key: 'pricing',
      header: 'Billing Periods',
      render: (p) => (
        <div className="space-y-0.5">
          <p className="text-xs" style={{ color: '#34d399' }}>
            🎁 {p.trial_days}d free trial
          </p>
          <p className="text-xs" style={{ color: 'var(--primary-400)' }}>
            📅 {p.price_quarterly === 0 ? 'Custom' : `₹${p.price_quarterly}`} / 3 mo
          </p>
          <p className="text-xs" style={{ color: '#9d4edd' }}>
            🏆 {p.price_yearly === 0 ? 'Custom' : `₹${p.price_yearly}`} / yr
          </p>
        </div>
      ),
    },
    {
      key: 'limits',
      header: 'Limits',
      render: (p) => (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {p.max_users != null ? `${p.max_users} users` : '∞ users'} ·{' '}
          {p.max_companies != null ? `${p.max_companies} co.` : '∞ co.'}
        </span>
      ),
    },
    {
      key: 'modules',
      header: 'Modules',
      render: (p) => (
        <div className="flex flex-wrap gap-1">
          {p.enabled_modules.length === 0
            ? <span style={{ color: 'var(--text-faint)', fontSize: '12px' }}>None</span>
            : p.enabled_modules.map((m) => (
              <span
                key={m}
                style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: '99px',
                  background: 'rgba(12,122,130,0.12)', color: 'var(--primary-400)',
                  textTransform: 'capitalize',
                }}
              >{m}</span>
            ))
          }
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <span
          style={{
            fontSize: '11px', padding: '2px 8px', borderRadius: '99px', fontWeight: 600,
            background: p.is_active ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
            color: p.is_active ? '#34d399' : '#ef4444',
          }}
        >
          {p.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteTarget(p)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Subscription Plans"
        actions={
          <Button
            variant="gradient"
            onClick={openCreate}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            }
          >
            New Plan
          </Button>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && <Alert message={error} />}

        {/* Card grid for visual plan comparison */}
        {!isLoading && items.length > 0 && (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            }}
          >
            {items.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={() => openEdit(plan)}
                onDelete={() => setDeleteTarget(plan)}
              />
            ))}
          </div>
        )}

        {/* Full table for admin management */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(12,122,130,0.15)' }}
        >
          <div className="px-5 py-3" style={{ background: 'var(--dark-800)', borderBottom: '1px solid rgba(12,122,130,0.12)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>All Plans</p>
          </div>
          <Table
            columns={columns}
            data={items}
            keyExtractor={(p) => p.id}
            loading={isLoading}
            emptyMessage="No subscription plans found."
          />
        </div>
      </main>

      {/* Create modal */}
      {createOpen && (
        <PlanFormModal
          title="Create Subscription Plan"
          form={form}
          setForm={setForm}
          onSubmit={handleCreate}
          loading={saving}
          error={formError}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <PlanFormModal
          title={`Edit Plan: ${editTarget.name}`}
          form={form}
          setForm={setForm}
          onSubmit={handleEdit}
          loading={saving}
          error={formError}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title="Delete Plan"
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Delete Plan
              </Button>
            </>
          }
        >
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.name}</strong>?
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
            This will fail if any tenants are currently on this plan.
          </p>
        </Modal>
      )}
    </div>
  )
}
