import type { UserRole } from '@/types'
import { useAppSelector } from '@/app/hooks'

interface RoleGateProps {
  allow: UserRole[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function RoleGate({ allow, children, fallback = null }: RoleGateProps) {
  const { user } = useAppSelector((s) => s.auth)
  if (!user || !allow.includes(user.role)) return <>{fallback}</>
  return <>{children}</>
}

export function useRole() {
  return useAppSelector((s) => s.auth.user?.role)
}
