import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchCurrentUser } from '@/features/auth/authSlice'

// Layout
import AppLayout from '@/components/layout/AppLayout'
import PublicPageLayout from '@/components/layout/PublicPageLayout'
import RoleGate from '@/components/layout/RoleGate'

// Core pages
import LoginPage             from '@/pages/LoginPage'
import ForgotPasswordPage   from '@/pages/ForgotPasswordPage'
import ResetPasswordPage    from '@/pages/ResetPasswordPage'
import DashboardPage         from '@/pages/DashboardPage'
import UsersPage             from '@/pages/UsersPage'
import TenantsPage              from '@/pages/TenantsPage'
import CompaniesPage            from '@/pages/CompaniesPage'
import SubscriptionPlansPage    from '@/pages/SubscriptionPlansPage'
import NotFoundPage             from '@/pages/NotFoundPage'

// Civil module pages
import ProjectsPage          from '@/pages/civil/ProjectsPage'
import BlockDetailPage       from '@/pages/civil/BlockDetailPage'
import MaterialRequestsPage  from '@/pages/civil/MaterialRequestsPage'

// Client module pages
import ClientsPage           from '@/pages/ClientsPage'
import InvoicesPage          from '@/pages/InvoicesPage'
import PurchaseOrdersPage         from '@/pages/PurchaseOrdersPage'
import PurchaseRequisitionsPage   from '@/pages/PurchaseRequisitionsPage'
import DeliveryChallansPage       from '@/pages/DeliveryChallansPage'
import InventoryPage         from '@/pages/InventoryPage'
import RetailPage            from '@/pages/RetailPage'
import AgriculturePage      from '@/pages/AgriculturePage'
import GeneralBillingPage   from '@/pages/GeneralBillingPage'
import ErrorLogsPage        from '@/pages/ErrorLogsPage'
import ProfilePage           from '@/pages/ProfilePage'
import MindMapsPage          from '@/pages/MindMapsPage'
import MindMapEditorPage     from '@/pages/MindMapEditorPage'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-6" style={{
        background: 'rgba(10,14,23,0.85)',
        borderBottom: '1px solid rgba(12,122,130,0.15)',
      }}>
        <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h1>
      </div>
      <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-faint)' }}>
        {title} module coming soon…
      </div>
    </div>
  )
}

export default function App() {
  const dispatch = useAppDispatch()
  const { isAuthenticated } = useAppSelector((s) => s.auth)

  useEffect(() => {
    if (isAuthenticated) dispatch(fetchCurrentUser())
  }, [dispatch, isAuthenticated])

  return (
    <Routes>
      {/* Public */}
      <Route path="/login"           element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password"  element={<ResetPasswordPage />} />

      {/* Public tools — no auth required */}
      <Route element={<PublicPageLayout />}>
        <Route path="mind-maps" element={<MindMapsPage />} />
        <Route path="mind-maps/:id" element={<MindMapEditorPage />} />
      </Route>

      {/* Protected — inside AppLayout */}
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />

        {/* Super Admin only */}
        <Route path="tenants" element={
          <RoleGate allow={['super_admin']} fallback={<Navigate to="/" replace />}>
            <TenantsPage />
          </RoleGate>
        } />
        <Route path="subscription-plans" element={
          <RoleGate allow={['super_admin']} fallback={<Navigate to="/" replace />}>
            <SubscriptionPlansPage />
          </RoleGate>
        } />

        {/* Admin and above */}
        <Route path="users" element={
          <RoleGate allow={['super_admin', 'admin']} fallback={<Navigate to="/" replace />}>
            <UsersPage />
          </RoleGate>
        } />
        <Route path="companies" element={
          <RoleGate allow={['admin']} fallback={<Navigate to="/" replace />}>
            <CompaniesPage />
          </RoleGate>
        } />

        {/* Civil module — all authenticated users (module access enforced server-side) */}
        <Route path="civil">
          <Route path="projects"              element={<ProjectsPage />} />
          <Route path="blocks/:blockId"       element={<BlockDetailPage />} />
          <Route path="requests"              element={<MaterialRequestsPage />} />
        </Route>

        {/* Client module */}
        <Route path="clients"  element={<ClientsPage />} />
        <Route path="invoices"         element={<InvoicesPage />} />
        <Route path="purchase-orders"        element={<PurchaseOrdersPage />} />
        <Route path="purchase-requisitions" element={<PurchaseRequisitionsPage />} />
        <Route path="delivery-challans"     element={<DeliveryChallansPage />} />
        <Route path="inventory"        element={<InventoryPage />} />
        <Route path="retail"           element={<RetailPage />} />
        <Route path="agriculture"      element={<AgriculturePage />} />
        <Route path="general-billing"  element={<GeneralBillingPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<PlaceholderPage title="Settings" />} />
        <Route path="error-logs" element={
          <RoleGate allow={['super_admin']} fallback={<Navigate to="/" replace />}>
            <ErrorLogsPage />
          </RoleGate>
        } />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
