import { useRef } from 'react'

interface Props {
  label: string
  value: string | null
  onChange: (value: string | null) => void
}

export default function ImageUpload({ label, value, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => onChange(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) handleFile(f)
  }

  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>{label}</p>

      {value ? (
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <img
            src={value}
            alt={label}
            style={{
              height: 80, maxWidth: 180, objectFit: 'contain',
              borderRadius: 8, border: '1px solid #cbd5e1',
              background: '#f8fafc', padding: 8,
            }}
          />
          {/* Replace button */}
          <button
            type="button"
            onClick={() => ref.current?.click()}
            style={{
              position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
              fontSize: 10, fontWeight: 600, color: '#0c7a82',
              background: '#f0fdfe', border: '1px solid #a5f3fc',
              borderRadius: 4, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Replace
          </button>
          {/* Remove ✕ */}
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{
              position: 'absolute', top: -8, right: -8,
              width: 20, height: 20, borderRadius: '50%',
              background: '#ef4444', border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', lineHeight: '20px', textAlign: 'center',
            }}
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          style={{
            width: '100%', height: 80,
            border: '2px dashed #cbd5e1', borderRadius: 8,
            background: '#f8fafc', cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            transition: 'border-color .15s, background .15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = '#0c7a82'
            ;(e.currentTarget as HTMLElement).style.background = '#f0fdfe'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1'
            ;(e.currentTarget as HTMLElement).style.background = '#f8fafc'
          }}
        >
          {/* Upload icon */}
          <svg width="20" height="20" fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Click or drag image here</span>
          <span style={{ fontSize: 10, color: '#cbd5e1' }}>PNG, JPG, WEBP · max 2 MB</span>
        </button>
      )}

      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={onInputChange}
      />
    </div>
  )
}
