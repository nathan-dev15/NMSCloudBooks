import { useState, useRef, useEffect } from 'react'
import Swal from 'sweetalert2'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setUser } from '@/features/auth/authSlice'
import { toastSuccess, toastError, toastWarning } from '@/features/notifications/notificationsSlice'
import Header from '@/components/layout/Header'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import profileService from '@/services/profileService'
import type { BusinessType } from '@/services/profileService'
import apiHandler, { API_BASE_URL } from '@/services/apiHandler'

// ── Role config ────────────────────────────────────────────────────────────────

type UserRole = 'super_admin' | 'admin' | 'primary_user' | 'secondary_user'

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin:    'Super Admin',
  admin:          'Admin',
  primary_user:   'Primary User',
  secondary_user: 'Secondary User',
}

const ROLE_COLORS: Record<UserRole, { bg: string; color: string; border: string }> = {
  super_admin:    { bg: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: 'rgba(124,58,237,0.3)' },
  admin:          { bg: 'var(--accent-bg)',       color: 'var(--accent)', border: 'var(--border-strong)' },
  primary_user:   { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  secondary_user: { bg: 'rgba(107,114,128,0.12)', color: 'var(--text-3)', border: 'rgba(107,114,128,0.3)' },
}

const CAN_EDIT_PROFILE: UserRole[]       = ['super_admin', 'admin', 'primary_user']
const CAN_EDIT_BIZ_TYPE: UserRole[]      = ['super_admin', 'admin']

// ── Password strength ──────────────────────────────────────────────────────────

interface StrengthInfo { score: number; label: string; color: string }

function getStrength(pw: string): StrengthInfo {
  if (!pw) return { score: 0, label: '', color: 'var(--border)' }
  let pts = 0
  if (pw.length >= 8)              pts++
  if (pw.length >= 12)             pts++
  if (/[A-Z]/.test(pw))           pts++
  if (/[a-z]/.test(pw))           pts++
  if (/[0-9]/.test(pw))           pts++
  if (/[^A-Za-z0-9]/.test(pw))   pts++
  const s = Math.min(4, Math.floor(pts * 4 / 6))
  const levels = [
    { label: 'Too weak',    color: 'var(--status-error)' },
    { label: 'Weak',        color: '#f97316' },
    { label: 'Fair',        color: 'var(--status-hold)' },
    { label: 'Strong',      color: 'var(--status-active)' },
    { label: 'Very strong', color: 'var(--status-done)' },
  ]
  return { score: s, ...levels[s] }
}

function PasswordStrengthBar({ password }: { password: string }) {
  const { score, label, color } = getStrength(password)
  if (!password) return null
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '5px' }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1, height: '3px', borderRadius: '2px',
              background: i < score ? color : 'var(--border-strong)',
              transition: 'background 280ms ease',
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: '11px', fontWeight: 600, color }}>{label}</p>
    </div>
  )
}

// ── Read-only field row ────────────────────────────────────────────────────────

function InfoRow({
  icon, label, value, mono,
}: { icon: React.ReactNode; label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 12px', borderRadius: 'var(--r-md)',
      background: 'var(--bg-hover)',
    }}>
      <div style={{ color: 'var(--text-4)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--text-4)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px',
        }}>
          {label}
        </p>
        <p style={{
          fontSize: '13px',
          color: value ? 'var(--text-2)' : 'var(--text-5)',
          fontFamily: mono ? 'var(--font-mono)' : undefined,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value ?? '—'}
        </p>
      </div>
    </div>
  )
}

// ── SweetAlert2 theme helper ───────────────────────────────────────────────────

function swalTheme() {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string) => s.getPropertyValue(name).trim()
  return {
    background:           v('--bg-card')     || '#16161a',
    color:                v('--text-1')      || '#f1f1f4',
    confirmButtonColor:   v('--accent')      || '#0d9488',
    cancelButtonColor:    v('--bg-card-hi')  || '#1a1a1f',
  }
}

// ── SVG icon helpers ───────────────────────────────────────────────────────────

const EyeOff = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
)
const EyeOn = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
)

function EyeToggle({
  show, onToggle, hasError,
}: { show: boolean; onToggle: () => void; hasError?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: 'absolute', right: '10px',
        bottom: hasError ? '24px' : '10px',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-4)', padding: '2px', lineHeight: 0,
      }}
    >
      {show ? <EyeOff /> : <EyeOn />}
    </button>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((s) => s.auth)

  // Resolve avatar URL — backend serves /media/* from a different origin in dev
  const resolveAvatar = (url: string | null | undefined): string | null => {
    if (!url) return null
    if (url.startsWith('/media')) return `${API_BASE_URL}${url}`
    return url
  }

  // Profile form
  const [fullName, setFullName]         = useState(user?.full_name ?? '')
  const [bizTypeId, setBizTypeId]       = useState<string>(
    user?.preferences?.business_type_id ? String(user.preferences.business_type_id) : ''
  )
  const [bizTypes, setBizTypes]         = useState<BusinessType[]>([])
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileErrors, setProfileErrors] = useState<{ full_name?: string }>({})

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(resolveAvatar(user?.avatar_url))
  const [avatarFile, setAvatarFile]       = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password modal
  const [pwOpen, setPwOpen]             = useState(false)
  const [currentPw, setCurrentPw]       = useState('')
  const [newPw, setNewPw]               = useState('')
  const [confirmPw, setConfirmPw]       = useState('')
  const [showCurrent, setShowCurrent]   = useState(false)
  const [showNew, setShowNew]           = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [pwSaving, setPwSaving]         = useState(false)
  const [pwErrors, setPwErrors]         = useState<{
    current_password?: string
    new_password?: string
    confirm_password?: string
  }>({})

  const role        = user?.role as UserRole | undefined
  const canEdit     = role && CAN_EDIT_PROFILE.includes(role)
  const canEditBiz  = role && CAN_EDIT_BIZ_TYPE.includes(role)
  const initials    = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  // Load business types for admin+
  useEffect(() => {
    if (!canEditBiz) return
    profileService.getBusinessTypes()
      .then(({ data }) => setBizTypes(data))
      .catch(() => { /* endpoint may not exist in dev */ })
  }, [canEditBiz])

  // Sync user data when revisiting page
  useEffect(() => {
    setFullName(user?.full_name ?? '')
    setAvatarPreview(resolveAvatar(user?.avatar_url))
    setBizTypeId(user?.preferences?.business_type_id ? String(user.preferences.business_type_id) : '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ── Avatar handlers ──────────────────────────────────────────────

  const handleAvatarClick = () => canEdit && fileInputRef.current?.click()

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      dispatch(toastWarning('File too large', 'Avatar must be under 2 MB.'))
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  // ── Profile save ─────────────────────────────────────────────────

  const validateProfile = (): boolean => {
    const errs: typeof profileErrors = {}
    const name = fullName.trim()
    if (!name)             errs.full_name = 'Full name is required.'
    else if (name.length < 2) errs.full_name = 'Name must be at least 2 characters.'
    else if (name.length > 100) errs.full_name = 'Name cannot exceed 100 characters.'
    setProfileErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validateProfile()) return

    const result = await Swal.fire({
      title: 'Save Changes?',
      text: 'Your profile information will be updated.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, save',
      cancelButtonText: 'Cancel',
      ...swalTheme(),
    })
    if (!result.isConfirmed) return

    setProfileSaving(true)
    try {
      if (avatarFile) {
        const { data: uploadedUser } = await profileService.uploadAvatar(avatarFile)
        setAvatarFile(null)
        setAvatarPreview(resolveAvatar(uploadedUser.avatar_url))
        dispatch(setUser(uploadedUser))
      }
      const { data: updated } = await profileService.updateProfile({
        full_name: fullName.trim(),
        ...(canEditBiz && { business_type_id: bizTypeId ? Number(bizTypeId) : null }),
      })
      dispatch(setUser(updated))
      dispatch(toastSuccess('Profile updated', 'Your changes have been saved.'))
    } catch (err) {
      dispatch(toastError('Update failed', apiHandler.extractError(err)))
    } finally {
      setProfileSaving(false)
    }
  }

  // ── Password change ───────────────────────────────────────────────

  const validatePassword = (): boolean => {
    const errs: typeof pwErrors = {}
    if (!currentPw) {
      errs.current_password = 'Current password is required.'
    }
    if (!newPw) {
      errs.new_password = 'New password is required.'
    } else if (newPw.length < 8) {
      errs.new_password = 'Password must be at least 8 characters.'
    } else if (!/[A-Z]/.test(newPw)) {
      errs.new_password = 'Must include at least one uppercase letter.'
    } else if (!/[a-z]/.test(newPw)) {
      errs.new_password = 'Must include at least one lowercase letter.'
    } else if (!/[0-9]/.test(newPw)) {
      errs.new_password = 'Must include at least one number.'
    } else if (!/[^A-Za-z0-9]/.test(newPw)) {
      errs.new_password = 'Must include at least one special character.'
    } else if (getStrength(newPw).score < 2) {
      errs.new_password = 'Password is too weak. Make it longer or more complex.'
    }
    if (!confirmPw) {
      errs.confirm_password = 'Please confirm your new password.'
    } else if (newPw !== confirmPw) {
      errs.confirm_password = 'Passwords do not match.'
    }
    setPwErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleChangePassword = async () => {
    if (!validatePassword()) return
    setPwSaving(true)
    try {
      await profileService.changePassword({ current_password: currentPw, new_password: newPw, confirm_password: confirmPw })
      resetPasswordModal()
      await Swal.fire({
        title: 'Password Updated!',
        text: 'Your password has been changed successfully.',
        icon: 'success',
        timer: 2500,
        timerProgressBar: true,
        showConfirmButton: false,
        ...swalTheme(),
      })
    } catch (err) {
      const msg = apiHandler.extractError(err)
      if (/current|incorrect|wrong/i.test(msg)) {
        setPwErrors({ current_password: 'Current password is incorrect.' })
      } else {
        dispatch(toastError('Password change failed', msg))
      }
    } finally {
      setPwSaving(false)
    }
  }

  const resetPasswordModal = () => {
    setPwOpen(false)
    setCurrentPw(''); setNewPw(''); setConfirmPw('')
    setShowCurrent(false); setShowNew(false); setShowConfirm(false)
    setPwErrors({})
  }

  const bizOptions = bizTypes.map((bt) => ({ label: bt.name, value: String(bt.id) }))

  if (!user) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Header title="My Profile" />

      {/* ── Scrollable content ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{
          maxWidth: '980px', margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: '20px',
          alignItems: 'start',
        }}>

          {/* ╔═══════════════════════╗
              ║   Left – profile card  ║
              ╚═══════════════════════╝ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Avatar + identity card */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-xl)',
              padding: '24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
            }}>
              {/* Avatar */}
              <div style={{ position: 'relative' }}>
                <div
                  onClick={handleAvatarClick}
                  style={{
                    width: '88px', height: '88px', borderRadius: '50%',
                    border: '2px solid var(--border-strong)',
                    overflow: 'hidden',
                    background: 'var(--bg-card-hi)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: canEdit ? 'pointer' : 'default',
                    transition: 'border-color 200ms',
                  }}
                  title={canEdit ? 'Click to change avatar' : undefined}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em' }}>
                      {initials}
                    </span>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={handleAvatarClick}
                    title="Change avatar"
                    style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: '26px', height: '26px', borderRadius: '50%',
                      border: '2px solid var(--bg-card)',
                      background: 'var(--accent)',
                      color: 'var(--accent-ink)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'transform 150ms ease',
                      lineHeight: 0,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.12)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                  >
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                    </svg>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </div>

              {/* Name & role badge */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '8px', lineHeight: 1.2 }}>
                  {user.full_name}
                </p>
                {role && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '3px 10px', borderRadius: 'var(--r-xl)',
                    fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em',
                    background: ROLE_COLORS[role].bg,
                    color: ROLE_COLORS[role].color,
                    border: `1px solid ${ROLE_COLORS[role].border}`,
                  }}>
                    {ROLE_LABELS[role]}
                  </span>
                )}
              </div>

              {/* Status pills */}
              <div style={{
                display: 'flex', gap: '10px',
                padding: '10px 0 0',
                borderTop: '1px solid var(--border)',
                width: '100%', justifyContent: 'center',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: user.is_active ? 'var(--status-active)' : 'var(--status-error)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: user.is_active ? 'var(--status-active)' : 'var(--status-error)', display: 'inline-block' }} />
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
                {user.is_verified && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--status-done)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.491 4.491 0 0 1-3.498-1.307 4.491 4.491 0 0 1-1.307-3.496A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                )}
              </div>
            </div>

            {/* Account info card */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-xl)', padding: '16px',
              display: 'flex', flexDirection: 'column', gap: '6px',
            }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 4px', marginBottom: '6px' }}>
                Account Info
              </p>
              <InfoRow
                icon={<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>}
                label="Email" value={user.email} mono
              />
              <InfoRow
                icon={<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>}
                label="Mobile" value={user.phone} mono
              />
              <InfoRow
                icon={<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>}
                label="Admin ID" value={`#${user.id}`} mono
              />
              {user.tenant_id != null && (
                <InfoRow
                  icon={<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>}
                  label="Tenant" value={`Tenant #${user.tenant_id}`} mono
                />
              )}
            </div>

            {/* Secondary-user restriction notice */}
            {role === 'secondary_user' && (
              <div style={{
                background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
                borderRadius: 'var(--r-xl)', padding: '14px 16px',
                display: 'flex', gap: '10px', alignItems: 'flex-start',
              }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--status-hold)', flexShrink: 0, marginTop: '1px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--status-hold)', marginBottom: '3px' }}>Read-Only Access</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.6 }}>
                    Your role cannot edit profile details. Contact your admin to update.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ╔═════════════════════════════════╗
              ║   Right – edit form + security   ║
              ╚═════════════════════════════════╝ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── Profile Information card ───────── */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '3px', height: '16px', background: 'var(--accent)', borderRadius: '2px', flexShrink: 0 }} />
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Profile Information</h2>
                {!canEdit && (
                  <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 500, color: 'var(--text-4)', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '2px 8px' }}>
                    Read-only
                  </span>
                )}
              </div>

              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

                {/* Full Name */}
                <Input
                  label="Full Name"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setProfileErrors({}) }}
                  error={profileErrors.full_name}
                  placeholder="Enter your full name"
                  disabled={!canEdit}
                  required
                  maxLength={100}
                />

                {/* Business Type — admin/super_admin only */}
                {canEditBiz && (
                  bizOptions.length > 0 ? (
                    <Select
                      label="Organization Business Type"
                      value={bizTypeId}
                      onChange={(e) => setBizTypeId(e.target.value)}
                      options={bizOptions}
                      placeholder="Select business type…"
                    />
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Organization Business Type
                      </label>
                      <div style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-card-hi)', fontSize: '13px', color: 'var(--text-4)' }}>
                        No business types configured yet.
                      </div>
                    </div>
                  )
                )}

                {/* Read-only fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Email Address
                    </label>
                    <div style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-card-hi)', fontSize: '12.5px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </div>
                    <p style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-5)' }}>Cannot be changed here.</p>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Mobile Number
                    </label>
                    <div style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-card-hi)', fontSize: '12.5px', color: user.phone ? 'var(--text-3)' : 'var(--text-5)', fontFamily: 'var(--font-mono)' }}>
                      {user.phone ?? 'Not provided'}
                    </div>
                    <p style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-5)' }}>Contact admin to update.</p>
                  </div>
                </div>

                {canEdit && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
                    <Button
                      variant="primary"
                      size="md"
                      loading={profileSaving}
                      onClick={handleSave}
                      leftIcon={
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                      }
                    >
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Security card ──────────────────── */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '3px', height: '16px', background: 'var(--status-hold)', borderRadius: '2px', flexShrink: 0 }} />
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Security</h2>
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderRadius: 'var(--r-lg)',
                  background: 'var(--bg-card-hi)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: 'var(--r-md)',
                      background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--status-hold)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '2px' }}>Password</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-4)' }}>Manage your account password</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setPwOpen(true)}>
                    Change Password
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Change Password Modal ──────────────────────────────────── */}
      <Modal
        open={pwOpen}
        onClose={resetPasswordModal}
        title="Change Password"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={resetPasswordModal} disabled={pwSaving}>Cancel</Button>
            <Button variant="primary" size="sm" loading={pwSaving} onClick={handleChangePassword}>Update Password</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Current password */}
          <div style={{ position: 'relative' }}>
            <Input
              label="Current Password"
              type={showCurrent ? 'text' : 'password'}
              value={currentPw}
              onChange={(e) => { setCurrentPw(e.target.value); setPwErrors((p) => ({ ...p, current_password: undefined })) }}
              error={pwErrors.current_password}
              placeholder="Enter current password"
              required
              autoComplete="current-password"
              style={{ paddingRight: '36px' }}
            />
            <EyeToggle show={showCurrent} onToggle={() => setShowCurrent((v) => !v)} hasError={!!pwErrors.current_password} />
          </div>

          <div style={{ height: '1px', background: 'var(--border)' }} />

          {/* New password */}
          <div>
            <div style={{ position: 'relative' }}>
              <Input
                label="New Password"
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => { setNewPw(e.target.value); setPwErrors((p) => ({ ...p, new_password: undefined })) }}
                error={pwErrors.new_password}
                placeholder="Enter new password"
                required
                autoComplete="new-password"
                style={{ paddingRight: '36px' }}
              />
              <EyeToggle show={showNew} onToggle={() => setShowNew((v) => !v)} hasError={!!pwErrors.new_password} />
            </div>
            <PasswordStrengthBar password={newPw} />
          </div>

          {/* Confirm password */}
          <div style={{ position: 'relative' }}>
            <Input
              label="Confirm New Password"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPw}
              onChange={(e) => { setConfirmPw(e.target.value); setPwErrors((p) => ({ ...p, confirm_password: undefined })) }}
              error={pwErrors.confirm_password}
              placeholder="Re-enter new password"
              required
              autoComplete="new-password"
              style={{ paddingRight: '36px' }}
            />
            <EyeToggle show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} hasError={!!pwErrors.confirm_password} />
          </div>

          {/* Live requirements checklist */}
          <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', marginBottom: '8px' }}>
              Password Requirements
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {([
                ['At least 8 characters',         newPw.length >= 8],
                ['Uppercase letter (A–Z)',         /[A-Z]/.test(newPw)],
                ['Lowercase letter (a–z)',         /[a-z]/.test(newPw)],
                ['Number (0–9)',                   /[0-9]/.test(newPw)],
                ['Special character (!@#$…)',      /[^A-Za-z0-9]/.test(newPw)],
              ] as [string, boolean][]).map(([label, met]) => (
                <li key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                  <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor" style={{ color: met ? 'var(--status-done)' : 'var(--text-5)', flexShrink: 0 }}>
                    {met ? (
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
                    )}
                  </svg>
                  <span style={{ color: met ? 'var(--text-2)' : 'var(--text-4)' }}>{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  )
}
