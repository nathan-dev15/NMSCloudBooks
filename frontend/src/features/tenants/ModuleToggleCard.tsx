import { useAppDispatch } from '@/app/hooks'
import { toggleModule } from './tenantsSlice'
import type { Tenant, DomainModule } from '@/types'
import Spinner from '@/components/ui/Spinner'
import { useState } from 'react'

const MODULE_META: Record<DomainModule, { label: string; description: string; color: string; icon: string }> = {
  civil:       { label: 'Civil Construction', description: 'Project hierarchy, block billing, material requests', color: 'bg-orange-50 border-orange-200', icon: '🏗️' },
  retail:      { label: 'Retail',             description: 'POS, multi-store, loyalty programs',               color: 'bg-blue-50 border-blue-200',   icon: '🛍️' },
  agriculture: { label: 'Agriculture',        description: 'Crop cycles, farm management, subsidy tracking',   color: 'bg-green-50 border-green-200', icon: '🌾' },
  general:     { label: 'General Billing',    description: 'Service billing, subscriptions, contracts',       color: 'bg-purple-50 border-purple-200', icon: '📋' },
}

const ALL_MODULES: DomainModule[] = ['civil', 'retail', 'agriculture', 'general']

export default function ModuleToggleCard({ tenant }: { tenant: Tenant }) {
  const dispatch = useAppDispatch()
  const [toggling, setToggling] = useState<DomainModule | null>(null)
  const enabled = new Set(tenant.enabled_modules)

  const handleToggle = async (module: DomainModule) => {
    setToggling(module)
    await dispatch(toggleModule({ tenantId: tenant.id, module, enabled: !enabled.has(module) }))
    setToggling(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-1">Domain Modules</h3>
      <p className="text-sm text-gray-500 mb-4">Enable industry-specific billing modules for this tenant.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALL_MODULES.map((mod) => {
          const meta = MODULE_META[mod]
          const isOn = enabled.has(mod)
          const loading = toggling === mod

          return (
            <button
              key={mod}
              onClick={() => handleToggle(mod)}
              disabled={loading}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all
                ${isOn ? meta.color : 'bg-gray-50 border-gray-200'}
                ${loading ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-sm cursor-pointer'}
              `}
            >
              <span className="text-2xl">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{meta.label}</span>
                  {loading
                    ? <Spinner size="sm" className="text-blue-500" />
                    : (
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${isOn ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        {isOn ? 'ON' : 'OFF'}
                      </span>
                    )
                  }
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{meta.description}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
