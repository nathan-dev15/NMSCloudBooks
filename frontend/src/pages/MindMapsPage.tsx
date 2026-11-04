import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchMindMaps, createMindMap, deleteMindMap, addNode, addEdge, fetchMindMap } from '@/features/mindMaps/mindMapsSlice'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'

type TemplateNode = { title: string; desc: string | null; x: number; y: number; color: string; size: 'sm' | 'md' | 'lg' }

const TEMPLATES = [
  {
    id: 'project',
    title: 'Project Planning',
    description: 'Plan projects with goals, timeline, team & resources',
    icon: '📋',
    color: '#5eead4',
    nodes: [
      { title: 'Project Planning', desc: 'Central hub', x: 0, y: 0, color: '#5eead4', size: 'lg' as const },
      { title: 'Goals', desc: 'Define objectives', x: -300, y: -180, color: '#f472b6', size: 'md' as const },
      { title: 'Timeline', desc: 'Milestones', x: 300, y: -180, color: '#818cf8', size: 'md' as const },
      { title: 'Team', desc: 'Roles', x: -300, y: 180, color: '#fb923c', size: 'md' as const },
      { title: 'Resources', desc: 'Budget & tools', x: 300, y: 180, color: '#34d399', size: 'md' as const },
      { title: 'Q1 Target', desc: null, x: -480, y: -280, color: '#f472b6', size: 'sm' as const },
      { title: 'Q2 Target', desc: null, x: -180, y: -280, color: '#f472b6', size: 'sm' as const },
      { title: 'Phase 1', desc: null, x: 180, y: -280, color: '#818cf8', size: 'sm' as const },
      { title: 'Phase 2', desc: null, x: 420, y: -280, color: '#818cf8', size: 'sm' as const },
      { title: 'Design', desc: null, x: -440, y: 280, color: '#fb923c', size: 'sm' as const },
      { title: 'Dev', desc: null, x: -220, y: 280, color: '#fb923c', size: 'sm' as const },
      { title: 'Budget', desc: null, x: 180, y: 280, color: '#34d399', size: 'sm' as const },
      { title: 'Software', desc: null, x: 420, y: 280, color: '#34d399', size: 'sm' as const },
    ] satisfies TemplateNode[],
    edges: [[0,1],[0,2],[0,3],[0,4],[1,5],[1,6],[2,7],[2,8],[3,9],[3,10],[4,11],[4,12]] as [number,number][],
  },
  {
    id: 'swot',
    title: 'SWOT Analysis',
    description: 'Strengths, Weaknesses, Opportunities & Threats',
    icon: '🎯',
    color: '#818cf8',
    nodes: [
      { title: 'SWOT Analysis', desc: 'Your topic here', x: 0, y: 0, color: '#818cf8', size: 'lg' as const },
      { title: 'Strengths', desc: 'Internal advantages', x: -250, y: -180, color: '#34d399', size: 'md' as const },
      { title: 'Weaknesses', desc: 'Internal challenges', x: 250, y: -180, color: '#f472b6', size: 'md' as const },
      { title: 'Opportunities', desc: 'External potential', x: -250, y: 180, color: '#5eead4', size: 'md' as const },
      { title: 'Threats', desc: 'External risks', x: 250, y: 180, color: '#ef4444', size: 'md' as const },
      { title: 'Point 1', desc: null, x: -420, y: -280, color: '#34d399', size: 'sm' as const },
      { title: 'Point 2', desc: null, x: -120, y: -280, color: '#34d399', size: 'sm' as const },
      { title: 'Point 1', desc: null, x: 120, y: -280, color: '#f472b6', size: 'sm' as const },
      { title: 'Point 2', desc: null, x: 420, y: -280, color: '#f472b6', size: 'sm' as const },
      { title: 'Point 1', desc: null, x: -420, y: 280, color: '#5eead4', size: 'sm' as const },
      { title: 'Point 2', desc: null, x: -120, y: 280, color: '#5eead4', size: 'sm' as const },
      { title: 'Point 1', desc: null, x: 120, y: 280, color: '#ef4444', size: 'sm' as const },
      { title: 'Point 2', desc: null, x: 420, y: 280, color: '#ef4444', size: 'sm' as const },
    ] satisfies TemplateNode[],
    edges: [[0,1],[0,2],[0,3],[0,4],[1,5],[1,6],[2,7],[2,8],[3,9],[3,10],[4,11],[4,12]] as [number,number][],
  },
  {
    id: 'brainstorm',
    title: 'Brainstorm',
    description: 'Radial idea map with central topic and branches',
    icon: '💡',
    color: '#f59e0b',
    nodes: [
      { title: 'Main Idea', desc: 'Your topic here', x: 0, y: 0, color: '#f59e0b', size: 'lg' as const },
      { title: 'Idea 1', desc: null, x: -220, y: -200, color: '#5eead4', size: 'md' as const },
      { title: 'Idea 2', desc: null, x: 220, y: -200, color: '#818cf8', size: 'md' as const },
      { title: 'Idea 3', desc: null, x: -320, y: 50, color: '#f472b6', size: 'md' as const },
      { title: 'Idea 4', desc: null, x: 320, y: 50, color: '#34d399', size: 'md' as const },
      { title: 'Idea 5', desc: null, x: -120, y: 220, color: '#fb923c', size: 'md' as const },
      { title: 'Idea 6', desc: null, x: 120, y: 220, color: '#6366f1', size: 'md' as const },
    ] satisfies TemplateNode[],
    edges: [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6]] as [number,number][],
  },
  {
    id: 'weekly',
    title: 'Weekly Planner',
    description: 'Plan your week with daily task branches',
    icon: '📅',
    color: '#3b82f6',
    nodes: [
      { title: 'This Week', desc: 'Weekly plan', x: 0, y: 0, color: '#3b82f6', size: 'lg' as const },
      { title: 'Monday', desc: null, x: -450, y: 150, color: '#ef4444', size: 'md' as const },
      { title: 'Tuesday', desc: null, x: -300, y: 150, color: '#f97316', size: 'md' as const },
      { title: 'Wednesday', desc: null, x: -150, y: 150, color: '#f59e0b', size: 'md' as const },
      { title: 'Thursday', desc: null, x: 0, y: 150, color: '#34d399', size: 'md' as const },
      { title: 'Friday', desc: null, x: 150, y: 150, color: '#3b82f6', size: 'md' as const },
      { title: 'Saturday', desc: null, x: 300, y: 150, color: '#818cf8', size: 'md' as const },
      { title: 'Sunday', desc: null, x: 450, y: 150, color: '#a855f7', size: 'md' as const },
    ] satisfies TemplateNode[],
    edges: [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7]] as [number,number][],
  },
]

export default function MindMapsPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { items, isLoading, error } = useAppSelector((s) => s.mindMaps)

  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)

  useEffect(() => { dispatch(fetchMindMaps()) }, [dispatch])

  const handleCreateFromTemplate = async (template: typeof TEMPLATES[number]) => {
    setCreatingTemplate(true)
    setTemplatePickerOpen(false)
    try {
      const result = await dispatch(createMindMap({
        title: template.title,
        description: template.description,
      }))
      if (!createMindMap.fulfilled.match(result)) return

      const mapId = result.payload.id
      const nodeIds: number[] = []
      for (const n of template.nodes) {
        const r = await dispatch(addNode({
          mindMapId: mapId,
          title: n.title,
          description: n.desc,
          position_x: n.x,
          position_y: n.y,
          color: n.color,
          style_data: { size: n.size },
        }))
        if (addNode.fulfilled.match(r)) nodeIds.push((r.payload as { id: number }).id)
      }

      for (const [s, t] of template.edges) {
        if (nodeIds[s] && nodeIds[t]) {
          await dispatch(addEdge({
            mindMapId: mapId,
            source_node_id: nodeIds[s],
            target_node_id: nodeIds[t],
          }))
        }
      }

      navigate(`/mind-maps/${mapId}`)
    } finally {
      setCreatingTemplate(false)
    }
  }

  const filtered = useMemo(
    () => search.trim()
      ? items.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
      : items,
    [items, search],
  )

  const handleCreate = async () => {
    if (!title.trim()) return
    const result = await dispatch(createMindMap({ title: title.trim(), description: description.trim() || null }))
    if (createMindMap.fulfilled.match(result)) {
      setCreateOpen(false)
      setTitle('')
      setDescription('')
      navigate(`/mind-maps/${result.payload.id}`)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirm === null) return
    await dispatch(deleteMindMap(deleteConfirm))
    setDeleteConfirm(null)
  }

  const handleDuplicate = async (id: number) => {
    const detailResult = await dispatch(fetchMindMap(id))
    if (!fetchMindMap.fulfilled.match(detailResult)) return
    const src = detailResult.payload
    const result = await dispatch(createMindMap({
      title: `${src.title} (copy)`,
      description: src.description,
    }))
    if (!createMindMap.fulfilled.match(result)) return
    const newId = result.payload.id
    const nodeIdMap = new Map<number, number>()
    for (const n of src.nodes) {
      const r = await dispatch(addNode({
        mindMapId: newId,
        title: n.title,
        description: n.description,
        position_x: n.position_x,
        position_y: n.position_y,
        color: n.color,
        style_data: n.style_data ?? undefined,
      }))
      if (addNode.fulfilled.match(r)) nodeIdMap.set(n.id, (r.payload as { id: number }).id)
    }
    for (const e of src.edges) {
      const newSrc = nodeIdMap.get(e.source_node_id)
      const newTgt = nodeIdMap.get(e.target_node_id)
      if (newSrc && newTgt) {
        await dispatch(addEdge({ mindMapId: newId, source_node_id: newSrc, target_node_id: newTgt }))
      }
    }
    dispatch(fetchMindMaps())
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div style={{
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'rgba(10, 10, 12, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{
            fontSize: '20px', fontWeight: 700,
            color: 'var(--text-1)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}>
            Mind Maps
          </h1>
          <p style={{
            fontSize: '12px', color: 'var(--text-4)',
            marginTop: '4px',
          }}>
            Create and organize your ideas visually
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="outline" onClick={() => setTemplatePickerOpen(true)} disabled={creatingTemplate}
            leftIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
          >
            {creatingTemplate ? 'Creating...' : 'Templates'}
          </Button>
          <Button variant="gradient" onClick={() => setCreateOpen(true)}
            leftIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>}
          >
            New Mind Map
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-5" style={{
        background: 'rgba(10, 10, 12, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        {error && <Alert message={error} />}

        {/* Search bar */}
        <div style={{
          position: 'relative',
          maxWidth: '360px',
        }}>
          <svg
            width="15" height="15" fill="none" stroke="var(--text-4)" viewBox="0 0 24 24"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mind maps..."
            style={{
              width: '100%',
              height: '36px',
              paddingLeft: '36px',
              paddingRight: '12px',
              fontSize: '13px',
              color: 'var(--text-1)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              outline: 'none',
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-4)', padding: '2px', lineHeight: 0,
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '48px 16px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '20px',
              background: 'var(--accent-bg)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '20px',
            }}>
              <svg width="36" height="36" fill="none" stroke="var(--accent)" viewBox="0 0 24 24" style={{ opacity: 0.7 }}>
                <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
                <circle cx="4" cy="6" r="2" strokeWidth={1.5} />
                <circle cx="20" cy="6" r="2" strokeWidth={1.5} />
                <circle cx="4" cy="18" r="2" strokeWidth={1.5} />
                <circle cx="20" cy="18" r="2" strokeWidth={1.5} />
                <line x1="9.5" y1="10.5" x2="5.5" y2="7.5" strokeWidth={1.5} />
                <line x1="14.5" y1="10.5" x2="18.5" y2="7.5" strokeWidth={1.5} />
                <line x1="9.5" y1="13.5" x2="5.5" y2="16.5" strokeWidth={1.5} />
                <line x1="14.5" y1="13.5" x2="18.5" y2="16.5" strokeWidth={1.5} />
              </svg>
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 6px' }}>
              {search ? 'No results found' : 'No mind maps yet'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-4)', maxWidth: '280px', lineHeight: '1.5' }}>
              {search
                ? `No mind maps match "${search}". Try a different search.`
                : 'Create your first mind map to start organizing ideas visually.'
              }
            </p>
            {!search && (
              <Button variant="gradient" size="sm" onClick={() => setCreateOpen(true)}
                style={{ marginTop: '20px' }}
                leftIcon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>}
              >
                Create Mind Map
              </Button>
            )}
          </div>
        ) : (
          <>
            <p style={{ fontSize: '12px', color: 'var(--text-4)' }}>
              {filtered.length} mind map{filtered.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: '16px',
            }}>
              {filtered.map((m) => (
                <MindMapCard
                  key={m.id}
                  id={m.id}
                  title={m.title}
                  description={m.description}
                  nodeCount={m.node_count}
                  updatedAt={formatDate(m.updated_at)}
                  onClick={() => navigate(`/mind-maps/${m.id}`)}
                  onDelete={() => setDeleteConfirm(m.id)}
                  onDuplicate={() => handleDuplicate(m.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Mind Map" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleCreate} disabled={!title.trim()}>Create</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required
            placeholder="e.g. Project Architecture"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          />
          <div>
            <label className="block text-xs font-semibold mb-1.5 tracking-wide" style={{ color: 'var(--text-muted)' }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="input-dark w-full"
              style={{ resize: 'vertical', fontSize: '13px', padding: '8px 12px', borderRadius: '8px' }}
              placeholder="Optional description..."
            />
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '4px',
            }}>
              <svg width="20" height="20" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>Delete Mind Map</h2>
            <p className="text-sm" style={{ color: 'var(--text-3)', lineHeight: '1.5' }}>
              This mind map and all its nodes will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      {/* Template picker modal */}
      {templatePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setTemplatePickerOpen(false)}
        >
          <div className="rounded-2xl p-6 max-w-lg w-full mx-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-1)' }}>Choose a Template</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-4)' }}>Start with a pre-built structure</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleCreateFromTemplate(t)}
                  disabled={creatingTemplate}
                  style={{
                    padding: '16px', borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-canvas)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 150ms, box-shadow 150ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = t.color
                    e.currentTarget.style.boxShadow = `0 0 0 1px ${t.color}40`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>{t.icon}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>{t.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-4)', lineHeight: '1.4' }}>{t.description}</div>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--text-5)' }}>
                    <span>{t.nodes.length} nodes</span>
                    <span>{t.edges.length} connections</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" size="sm" onClick={() => setTemplatePickerOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function MindMapCard({
  title, description, nodeCount, updatedAt, onClick, onDelete, onDuplicate,
}: {
  id: number
  title: string
  description: string | null
  nodeCount: number
  updatedAt: string
  onClick: () => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--bg-card-hi)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: '14px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 200ms ease',
        boxShadow: hovered
          ? '0 0 0 1px var(--accent), 0 8px 24px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(0,0,0,0.15)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent top bar */}
      <div style={{
        position: 'absolute', top: 0, left: '20px', right: '20px',
        height: '2px',
        background: hovered ? 'linear-gradient(90deg, #0c7a82, #5eead4)' : 'transparent',
        borderRadius: '0 0 2px 2px',
        transition: 'background 200ms ease',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: hovered
            ? 'linear-gradient(135deg, #0c7a82, #5eead4)'
            : 'var(--accent-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 200ms ease',
        }}>
          <svg width="18" height="18" fill="none" stroke={hovered ? '#fff' : 'var(--accent)'} viewBox="0 0 24 24" style={{ transition: 'stroke 200ms ease' }}>
            <circle cx="12" cy="12" r="3" strokeWidth={1.6} />
            <circle cx="5" cy="7" r="1.5" strokeWidth={1.6} />
            <circle cx="19" cy="7" r="1.5" strokeWidth={1.6} />
            <circle cx="5" cy="17" r="1.5" strokeWidth={1.6} />
            <circle cx="19" cy="17" r="1.5" strokeWidth={1.6} />
            <line x1="9.8" y1="10.5" x2="6.2" y2="8.3" strokeWidth={1.6} />
            <line x1="14.2" y1="10.5" x2="17.8" y2="8.3" strokeWidth={1.6} />
            <line x1="9.8" y1="13.5" x2="6.2" y2="15.7" strokeWidth={1.6} />
            <line x1="14.2" y1="13.5" x2="17.8" y2="15.7" strokeWidth={1.6} />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontSize: '14px', fontWeight: 600, color: 'var(--text-1)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            margin: 0,
          }}>
            {title}
          </h3>
          {description && (
            <p style={{
              fontSize: '12px', color: 'var(--text-3)', marginTop: '3px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              margin: 0,
            }}>
              {description}
            </p>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid var(--border-soft)',
      }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-4)' }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
            </svg>
            {nodeCount} node{nodeCount !== 1 ? 's' : ''}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-4)' }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {updatedAt}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate() }}
            title="Duplicate"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-5)', padding: '4px', borderRadius: '4px',
              transition: 'color 150ms, background 150ms',
              lineHeight: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)'
              e.currentTarget.style.background = 'var(--accent-bg)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-5)'
              e.currentTarget.style.background = 'none'
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            title="Delete"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-5)', padding: '4px', borderRadius: '4px',
              transition: 'color 150ms, background 150ms',
              lineHeight: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ef4444'
              e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-5)'
              e.currentTarget.style.background = 'none'
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
