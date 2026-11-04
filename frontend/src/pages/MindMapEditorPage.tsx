import { useParams, useNavigate } from 'react-router-dom'
import { useAppSelector } from '@/app/hooks'
import MindMapCanvas from '@/features/mindMaps/components/MindMapCanvas'
import Spinner from '@/components/ui/Spinner'

export default function MindMapEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isLoading } = useAppSelector((s) => s.mindMaps)

  const mindMapId = Number(id)
  if (!id || isNaN(mindMapId)) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: '12px',
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px',
          background: 'rgba(239,68,68,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-1)' }}>Invalid mind map ID</span>
        <button
          onClick={() => navigate('/mind-maps')}
          style={{
            fontSize: '13px', color: 'var(--accent)',
            background: 'none', border: 'none', cursor: 'pointer',
            textDecoration: 'underline', textUnderlineOffset: '3px',
          }}
        >
          Back to mind maps
        </button>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {isLoading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '12px',
          background: 'rgba(10, 10, 12, 0.7)',
          backdropFilter: 'blur(4px)',
        }}>
          <Spinner size="lg" />
          <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>Loading mind map...</span>
        </div>
      )}
      <MindMapCanvas mindMapId={mindMapId} onBack={() => navigate('/mind-maps')} />
    </div>
  )
}
