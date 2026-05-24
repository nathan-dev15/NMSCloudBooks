import { useEffect, useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchProjects, createProject, fetchPlans, createPlan, createBlock } from '@/features/civil/civilSlice'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Alert from '@/components/ui/Alert'
import type { Project } from '@/features/civil/civilTypes'

// ── Status metadata (spec-aligned) ───────────────────────────────────────────

interface StatusMeta {
  label: string
  color: string
  bg: string
  dot: 'solid' | 'hollow'
}

const STATUS_META: Record<string, StatusMeta> = {
  planning:  { label: 'Planning',   color: 'var(--status-planning)',  bg: 'rgba(208,208,216,0.10)', dot: 'hollow'  },
  active:    { label: 'Active',     color: 'var(--status-active)',    bg: 'rgba(134,239,172,0.10)', dot: 'solid'   },
  on_hold:   { label: 'On Hold',    color: 'var(--status-hold)',      bg: 'rgba(251,191,36,0.10)',  dot: 'solid'   },
  completed: { label: 'Completed',  color: 'var(--status-done)',      bg: 'rgba(110,231,183,0.10)', dot: 'solid'   },
  cancelled: { label: 'Cancelled',  color: 'var(--status-error)',     bg: 'rgba(252,165,165,0.10)', dot: 'solid'   },
  in_progress:{ label: 'In Progress',color: 'var(--status-progress)', bg: 'rgba(147,197,253,0.10)', dot: 'solid'  },
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META['planning']
  return (
    <span
      className="status-badge"
      style={{ background: meta.bg, color: meta.color }}
    >
      <span
        className="status-dot"
        style={{
          background: meta.dot === 'solid' ? meta.color : 'transparent',
          border: meta.dot === 'hollow' ? `1.5px solid ${meta.color}` : 'none',
        }}
      />
      {meta.label}
    </span>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '5px',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</span>
        <span className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-3)' }}>{pct.toFixed(0)}%</span>
      </div>
      <div className="spec-progress-track">
        <div className="spec-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({ project, onManage }: { project: Project; onManage: (p: Project) => void }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        cursor: 'pointer',
        transition: 'border-color 150ms, box-shadow 150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-strong)'
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          {/* Project code chip */}
          <span className="tabular-nums" style={{
            display: 'inline-block',
            fontSize: '10.5px',
            fontWeight: 500,
            color: 'var(--text-4)',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 'var(--r-sm)',
            padding: '2px 6px',
            marginBottom: '5px',
            letterSpacing: '0.02em',
          }}>
            {project.code}
          </span>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </h3>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {(project.state || project.district) && (
        <p style={{ fontSize: '12px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          {[project.state, project.district, project.zone].filter(Boolean).join(' › ')}
        </p>
      )}

      <ProgressBar value={project.overall_progress} />

      {project.contract_value && (
        <p style={{ fontSize: '12px', color: 'var(--text-4)' }}>
          Contract:{' '}
          <span className="tabular-nums" style={{ color: 'var(--text-2)', fontWeight: 500 }}>
            ₹{project.contract_value.toLocaleString('en-IN')}
          </span>
        </p>
      )}

      <div className="flex gap-2 mt-1">
        <Button size="sm" variant="primary" className="flex-1" onClick={() => onManage(project)}>
          Open Project
        </Button>
      </div>
    </div>
  )
}

// ── Create project modal ──────────────────────────────────────────────────────

function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [form, setForm] = useState({
    name: '', code: '', state: '', district: '', zone: '', contract_value: '', description: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const autoCode = (name: string) =>
    name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 10)

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, name: e.target.value, code: autoCode(e.target.value) }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true)
    const result = await dispatch(createProject({
      ...form,
      contract_value: form.contract_value ? Number(form.contract_value) : undefined,
      description: form.description || undefined,
      state: form.state || undefined,
      district: form.district || undefined,
      zone: form.zone || undefined,
    }))
    setLoading(false)
    if (createProject.fulfilled.match(result)) {
      setForm({ name: '', code: '', state: '', district: '', zone: '', contract_value: '', description: '' })
      onClose()
    } else { setError(result.payload as string) }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Civil Project" size="lg"
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="create-project-form" loading={loading}>Create Project</Button>
      </>}
    >
      {error && <Alert message={error} className="mb-4" />}
      <form id="create-project-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Project Name" required value={form.name} onChange={handleNameChange} placeholder="NH-44 Highway Widening" />
          <Input label="Project Code" required value={form.code} onChange={set('code')} placeholder="NH44-HW" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="State"    value={form.state}    onChange={set('state')}    placeholder="Tamil Nadu" />
          <Input label="District" value={form.district} onChange={set('district')} placeholder="Chennai" />
          <Input label="Zone"     value={form.zone}     onChange={set('zone')}     placeholder="North" />
        </div>
        <Input label="Contract Value (₹)" type="number" value={form.contract_value} onChange={set('contract_value')} placeholder="10000000" />
        <Input label="Description" value={form.description} onChange={set('description')} placeholder="Optional project description" />
      </form>
    </Modal>
  )
}

// ── Add Plan modal ────────────────────────────────────────────────────────────

function AddPlanModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: number }) {
  const dispatch = useAppDispatch()
  const [form, setForm] = useState({ plan_code: '', name: '', description: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true)
    const result = await dispatch(createPlan({ projectId, ...form }))
    setLoading(false)
    if (createPlan.fulfilled.match(result)) { setForm({ plan_code: '', name: '', description: '' }); onClose() }
    else { setError(result.payload as string) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Project Plan"
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="add-plan-form" loading={loading}>Add Plan</Button>
      </>}
    >
      {error && <Alert message={error} className="mb-4" />}
      <form id="add-plan-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Plan Code" required value={form.plan_code} onChange={set('plan_code')} placeholder="PLAN-001" />
          <Input label="Plan Name" required value={form.name} onChange={set('name')} placeholder="Revised Plan v1" />
        </div>
        <Input label="Description" value={form.description} onChange={set('description')} />
      </form>
    </Modal>
  )
}

// ── Add Block modal ───────────────────────────────────────────────────────────

function AddBlockModal({ open, onClose, projectId, planId }: { open: boolean; onClose: () => void; projectId: number; planId: number }) {
  const dispatch = useAppDispatch()
  const [form, setForm] = useState({ block_code: '', name: '', start_date: '', end_date: '', planned_quantity: '', unit_of_measure: 'sqm', estimated_cost: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true)
    const result = await dispatch(createBlock({
      projectId, planId, ...form,
      planned_quantity: form.planned_quantity ? Number(form.planned_quantity) : undefined,
      estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : undefined,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
    }))
    setLoading(false)
    if (createBlock.fulfilled.match(result)) {
      setForm({ block_code: '', name: '', start_date: '', end_date: '', planned_quantity: '', unit_of_measure: 'sqm', estimated_cost: '' })
      onClose()
    } else { setError(result.payload as string) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Block" size="lg"
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="add-block-form" loading={loading}>Add Block</Button>
      </>}
    >
      {error && <Alert message={error} className="mb-4" />}
      <form id="add-block-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Block Code" required value={form.block_code} onChange={set('block_code')} placeholder="BLK-001" />
          <Input label="Block Name" required value={form.name} onChange={set('name')} placeholder="Section A - Foundation" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Start Date" type="date" value={form.start_date} onChange={set('start_date')} />
          <Input label="End Date"   type="date" value={form.end_date}   onChange={set('end_date')} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Planned Qty" type="number" value={form.planned_quantity} onChange={set('planned_quantity')} />
          <Select label="Unit" value={form.unit_of_measure} onChange={set('unit_of_measure')}
            options={[
              { label: 'sqm', value: 'sqm' }, { label: 'cum', value: 'cum' },
              { label: 'nos', value: 'nos' }, { label: 'rmt', value: 'rmt' },
              { label: 'MT',  value: 'mt'  }, { label: 'kg',  value: 'kg'  },
            ]}
          />
          <Input label="Estimated Cost (₹)" type="number" value={form.estimated_cost} onChange={set('estimated_cost')} />
        </div>
      </form>
    </Modal>
  )
}

// ── Project detail panel ──────────────────────────────────────────────────────

function ProjectDetailPanel({ project }: { project: Project }) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { plans } = useAppSelector((s) => s.civil)

  const [addPlanOpen, setAddPlanOpen] = useState(false)
  const [addBlockTarget, setAddBlockTarget] = useState<number | null>(null)

  useEffect(() => { dispatch(fetchPlans(project.id)) }, [dispatch, project.id])

  return (
    <div className="space-y-4">
      {plans.length === 0 ? (
        <div
          style={{
            borderRadius: 'var(--r-xl)', padding: '20px',
            textAlign: 'center', fontSize: '13px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            color: 'var(--text-4)',
          }}
        >
          No plans yet. Add a plan to start structuring this project.
        </div>
      ) : (
        plans.map((plan) => (
          <div
            key={plan.id}
            style={{ borderRadius: 'var(--r-xl)', overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            {/* Plan header */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px',
                background: 'rgba(255,255,255,0.02)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)' }}>{plan.name}</span>
                <span className="tabular-nums" style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-4)' }}>{plan.plan_code}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setAddBlockTarget(plan.id)}>+ Block</Button>
            </div>

            {/* Blocks */}
            {plan.blocks.length === 0 ? (
              <p style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-4)' }}>No blocks in this plan yet.</p>
            ) : (
              <div>
                {plan.blocks.map((block) => (
                  <div
                    key={block.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border-soft)',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>{block.name}</span>
                        <StatusBadge status={block.status} />
                      </div>
                      <p className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '2px' }}>{block.block_code}</p>
                    </div>
                    <div style={{ width: '120px' }} className="hidden md:block">
                      <ProgressBar value={block.progress} />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/civil/blocks/${block.id}`)}>
                      Manage
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      <Button size="sm" variant="outline" onClick={() => setAddPlanOpen(true)} leftIcon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      }>
        Add Plan
      </Button>

      <AddPlanModal open={addPlanOpen} onClose={() => setAddPlanOpen(false)} projectId={project.id} />
      {addBlockTarget && (
        <AddBlockModal
          open={!!addBlockTarget}
          onClose={() => setAddBlockTarget(null)}
          projectId={project.id}
          planId={addBlockTarget}
        />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const dispatch = useAppDispatch()
  const { projects, isLoading, error } = useAppSelector((s) => s.civil)
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<Project | null>(null)
  const [filterState, setFilterState] = useState('')

  useEffect(() => { dispatch(fetchProjects({})) }, [dispatch])

  const filtered = filterState
    ? projects.filter((p) => p.state?.toLowerCase().includes(filterState.toLowerCase()))
    : projects

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Civil Construction Projects"
        actions={
          <Button variant="gradient" onClick={() => setCreateOpen(true)} leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }>
            New Project
          </Button>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && <Alert message={error} />}

        {/* Filter bar */}
        <div className="flex items-center gap-3">
          <Input
            placeholder="Filter by state…"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="max-w-xs"
          />
          <span className="text-sm" style={{ color: 'var(--text-faint)' }}>{filtered.length} project{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-faint)' }}>
            <p className="text-lg mb-2">No projects found</p>
            <p className="text-sm">Create your first civil construction project to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} onManage={setSelected} />
            ))}
          </div>
        )}

        {/* Project detail drawer */}
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
                <div>
                  <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.name}</h2>
                  <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                    {[selected.state, selected.district].filter(Boolean).join(' › ')}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>✕ Close</Button>
            </div>
            <ProjectDetailPanel project={selected} />
          </div>
        )}
      </main>

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
