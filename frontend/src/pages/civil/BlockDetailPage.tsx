import { useEffect, useState, FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchActivities, logActivity, fetchStock, fetchWeeklyBills,
  generateWeeklyBill, updateBlock,
} from '@/features/civil/civilSlice'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Alert from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { api } from '@/services/api'
import type { Block, DailyActivity, WeeklyBill } from '@/features/civil/civilTypes'

// ── Progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({ pct }: { pct: number }) {
  const r = 36, c = 2 * Math.PI * r
  const fill = ((100 - pct) / 100) * c
  const color = pct < 30 ? '#ff6b35' : pct < 70 ? '#ffc107' : '#06d6a0'
  return (
    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={c} strokeDashoffset={fill}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x="44" y="44" textAnchor="middle" dominantBaseline="central"
        fill="#e2e8f0" fontSize="14" fontWeight="700"
        style={{ transform: 'rotate(90deg)', transformOrigin: '44px 44px' }}>
        {pct.toFixed(0)}%
      </text>
    </svg>
  )
}

// ── Log Activity modal ────────────────────────────────────────────────────────

function LogActivityModal({ open, onClose, blockId }: { open: boolean; onClose: () => void; blockId: number }) {
  const dispatch = useAppDispatch()
  const [form, setForm] = useState({
    activity_date: new Date().toISOString().split('T')[0],
    activity_type: 'work_log',
    title: '', description: '', hours_worked: '', amount: '', is_billable: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true)
    const result = await dispatch(logActivity({
      block_id: blockId, ...form,
      hours_worked: form.hours_worked ? Number(form.hours_worked) : undefined,
      amount: form.amount ? Number(form.amount) : undefined,
    }))
    setLoading(false)
    if (logActivity.fulfilled.match(result)) {
      setForm({ activity_date: new Date().toISOString().split('T')[0], activity_type: 'work_log', title: '', description: '', hours_worked: '', amount: '', is_billable: true })
      onClose()
    } else { setError(result.payload as string) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log Daily Activity"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="log-activity" loading={loading}>Log Activity</Button></>}
    >
      {error && <Alert message={error} className="mb-4" />}
      <form id="log-activity" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Date" type="date" required value={form.activity_date} onChange={set('activity_date')} />
          <Select label="Type" value={form.activity_type} onChange={set('activity_type')} options={[
            { label: 'Work Log', value: 'work_log' }, { label: 'Expense', value: 'expense' },
            { label: 'Inspection', value: 'inspection' }, { label: 'Milestone', value: 'milestone' },
            { label: 'Issue', value: 'issue' }, { label: 'Note', value: 'note' },
          ]} />
        </div>
        <Input label="Title" required value={form.title} onChange={set('title')} placeholder="Excavation completed — Section A" />
        <Input label="Description" value={form.description} onChange={set('description')} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Hours Worked" type="number" value={form.hours_worked} onChange={set('hours_worked')} placeholder="8" />
          <Input label="Amount (₹)" type="number" value={form.amount} onChange={set('amount')} placeholder="12500" />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.is_billable} onChange={set('is_billable')}
            className="w-4 h-4 rounded" style={{ accentColor: '#0c7a82' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Billable activity</span>
        </label>
      </form>
    </Modal>
  )
}

// ── Update Progress modal ─────────────────────────────────────────────────────

function UpdateProgressModal({ open, onClose, block }: { open: boolean; onClose: () => void; block: Block }) {
  const dispatch = useAppDispatch()
  const [progress, setProgress] = useState(String(block.progress))
  const [actualQty, setActualQty] = useState(String(block.actual_quantity ?? ''))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true)
    const result = await dispatch(updateBlock({
      id: block.id,
      progress: Number(progress),
      actual_quantity: actualQty ? Number(actualQty) : undefined,
    }))
    setLoading(false)
    if (updateBlock.fulfilled.match(result)) { onClose() }
    else { setError(result.payload as string) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Update Block Progress"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="upd-progress" loading={loading}>Save</Button></>}
    >
      {error && <Alert message={error} className="mb-4" />}
      <form id="upd-progress" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Progress (%)" type="number" min={0} max={100} required value={progress} onChange={(e) => setProgress(e.target.value)} />
        <Input label={`Actual Quantity ${block.unit_of_measure ? `(${block.unit_of_measure})` : ''}`} type="number" value={actualQty} onChange={(e) => setActualQty(e.target.value)} />
      </form>
    </Modal>
  )
}

// ── Weekly Bill row ───────────────────────────────────────────────────────────

const BILL_STATUS_COLOR: Record<string, 'gray' | 'blue' | 'green' | 'yellow'> = {
  draft: 'gray', submitted: 'blue', approved: 'green', invoiced: 'yellow',
}

function WeeklyBillRow({ bill, onSubmit, onApprove, canApprove }: {
  bill: WeeklyBill; onSubmit: () => void; onApprove: () => void; canApprove: boolean
}) {
  return (
    <div className="flex items-center gap-4 py-3 last:border-0" style={{ borderBottom: '1px solid rgba(12,122,130,0.1)' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium font-mono" style={{ color: 'var(--text-primary)' }}>{bill.bill_number}</span>
          <Badge color={BILL_STATUS_COLOR[bill.status] ?? 'gray'}>{bill.status}</Badge>
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{bill.week_start_date} → {bill.week_end_date}</p>
      </div>
      <div className="text-right hidden md:block">
        <p className="text-sm font-semibold" style={{ color: '#06d6a0' }}>₹{bill.total_cost.toLocaleString('en-IN')}</p>
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Labour ₹{bill.labour_cost.toLocaleString()} + Material ₹{bill.material_cost.toLocaleString()}
        </p>
      </div>
      <div className="flex gap-2">
        {bill.status === 'draft' && <Button size="sm" variant="outline" onClick={onSubmit}>Submit</Button>}
        {bill.status === 'submitted' && canApprove && <Button size="sm" variant="primary" onClick={onApprove}>Approve</Button>}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BlockDetailPage() {
  const { blockId } = useParams<{ blockId: string }>()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const { activities, weeklyBills, stock, selectedBlock } = useAppSelector((s) => s.civil)
  const currentRole = useAppSelector((s) => s.auth.user?.role)

  const [block, setBlock] = useState<Block | null>(selectedBlock)
  const [blockLoading, setBlockLoading] = useState(!selectedBlock)
  const [logOpen, setLogOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'activities' | 'stock' | 'billing'>('activities')

  useEffect(() => {
    if (!blockId) return
    const id = Number(blockId)

    if (!block || block.id !== id) {
      setBlockLoading(true)
      api.get<Block>(`/civil/projects/blocks/${id}`)
        .then(({ data }) => { setBlock(data); setBlockLoading(false) })
        .catch(() => setBlockLoading(false))
    }

    dispatch(fetchActivities({ blockId: id }))
    dispatch(fetchStock(0))
    dispatch(fetchWeeklyBills(id))
  }, [blockId, dispatch])

  const handleGenerateBill = async () => {
    if (block) await dispatch(generateWeeklyBill({ blockId: block.id }))
  }

  const handleSubmitBill = async (billId: number) => {
    await api.post<WeeklyBill>(`/civil/billing/weekly-bills/${billId}/submit`)
    dispatch(fetchWeeklyBills(block!.id))
  }

  const handleApproveBill = async (billId: number) => {
    await api.post(`/civil/billing/weekly-bills/${billId}/approve`)
    dispatch(fetchWeeklyBills(block!.id))
  }

  const canApprove = currentRole && ['super_admin', 'admin'].includes(currentRole)

  if (blockLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Block Detail" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" className="text-[#0c7a82]" />
        </div>
      </div>
    )
  }

  if (!block) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Block not found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="mb-4" style={{ color: 'var(--text-muted)' }}>This block could not be found.</p>
            <Button onClick={() => navigate('/civil/projects')}>← Back to Projects</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title={block.name}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate(-1)}>← Back</Button>
            <Button size="sm" variant="outline" onClick={() => setProgressOpen(true)}>Update Progress</Button>
            <Button size="sm" variant="gradient" onClick={() => setLogOpen(true)}>+ Activity</Button>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Block summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1 rounded-xl p-5 flex flex-col items-center justify-center gap-2"
            style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.2)' }}>
            <ProgressRing pct={Number(block.progress)} />
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Overall Progress</p>
          </div>

          <div className="md:col-span-3 grid grid-cols-3 gap-4">
            {[
              { label: 'Status', value: <Badge color={({ not_started: 'gray', in_progress: 'blue', completed: 'green', on_hold: 'yellow' } as Record<string, 'gray'|'blue'|'green'|'yellow'>)[block.status] ?? 'gray'}>{block.status.replace('_', ' ')}</Badge> },
              { label: 'Block Code', value: <span className="font-mono text-sm" style={{ color: '#00d4ff' }}>{block.block_code}</span> },
              { label: 'Est. Cost', value: block.estimated_cost ? `₹${Number(block.estimated_cost).toLocaleString('en-IN')}` : '—', color: '#06d6a0' },
              { label: 'Start Date', value: block.start_date ?? '—' },
              { label: 'End Date',   value: block.end_date ?? '—' },
              { label: 'Planned Qty', value: block.planned_quantity ? `${block.planned_quantity} ${block.unit_of_measure ?? ''}` : '—' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-4"
                style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.2)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>{label}</p>
                <div className="text-sm font-semibold" style={{ color: color ?? 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl p-1 w-fit"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(12,122,130,0.15)' }}>
          {(['activities', 'stock', 'billing'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={activeTab === tab
                ? { background: 'rgba(12,122,130,0.2)', color: '#0e949e', border: '1px solid rgba(12,122,130,0.3)' }
                : { color: 'var(--text-muted)', border: '1px solid transparent' }}
            >
              {tab === 'billing' ? 'Weekly Billing' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Activities tab */}
        {activeTab === 'activities' && (
          <div className="rounded-xl" style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.2)' }}>
            <div className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Daily Activities</h3>
              <Button size="sm" variant="gradient" onClick={() => setLogOpen(true)}>+ Log Activity</Button>
            </div>
            {activities.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-faint)' }}>No activities logged yet.</p>
            ) : (
              <div>
                {activities.map((a: DailyActivity) => (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-3"
                    style={{ borderBottom: '1px solid rgba(12,122,130,0.08)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.title}</span>
                        <Badge color="gray">{a.activity_type.replace('_', ' ')}</Badge>
                        {!a.is_billable && <Badge color="yellow">Non-billable</Badge>}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{a.activity_date}</p>
                    </div>
                    <div className="text-right text-sm">
                      {a.hours_worked && <p style={{ color: 'var(--text-secondary)' }}>{a.hours_worked}h</p>}
                      {a.amount && <p className="font-semibold" style={{ color: '#06d6a0' }}>₹{Number(a.amount).toLocaleString('en-IN')}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stock tab */}
        {activeTab === 'stock' && (
          <div className="rounded-xl" style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.2)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Block Stock</h3>
            </div>
            {stock.filter((s) => s.block_id === block.id).length === 0 ? (
              <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-faint)' }}>No stock assigned to this block yet.</p>
            ) : (
              <div>
                {stock.filter((s) => s.block_id === block.id).map((s) => (
                  <div key={s.id} className="px-5 py-3 flex items-center gap-3"
                    style={{ borderBottom: '1px solid rgba(12,122,130,0.08)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Material #{s.material_id}</p>
                      {s.location_label && <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{s.location_label}</p>}
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold" style={{ color: '#06d6a0' }}>{Number(s.available_qty).toFixed(2)} available</p>
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        Total: {Number(s.quantity).toFixed(2)} | Reserved: {Number(s.reserved_qty).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Billing tab */}
        {activeTab === 'billing' && (
          <div className="rounded-xl" style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.2)' }}>
            <div className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Weekly Bills</h3>
              {canApprove && (
                <Button size="sm" variant="gradient" onClick={handleGenerateBill}>Generate This Week's Bill</Button>
              )}
            </div>
            {weeklyBills.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-faint)' }}>
                No weekly bills yet. Generate one to start billing.
              </p>
            ) : (
              <div className="px-5">
                {weeklyBills.map((bill: WeeklyBill) => (
                  <WeeklyBillRow
                    key={bill.id}
                    bill={bill}
                    canApprove={!!canApprove}
                    onSubmit={() => handleSubmitBill(bill.id)}
                    onApprove={() => handleApproveBill(bill.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <LogActivityModal open={logOpen} onClose={() => setLogOpen(false)} blockId={block.id} />
      <UpdateProgressModal open={progressOpen} onClose={() => setProgressOpen(false)} block={block} />
    </div>
  )
}
