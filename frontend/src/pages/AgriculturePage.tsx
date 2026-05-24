import { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  farmsThunks, farmsSelectors,
  cyclesThunks, cyclesSelectors,
  addExpense, addHarvest, fetchAgriInvoices,
  agricultureAuxSelectors,
  type Farm, type CropCycle, type CycleStatus,
} from '@/features/agriculture/agricultureSlice'
import DataGrid from '@/components/ui/DataGrid/DataGrid'
import type { ColumnDef, RowAction } from '@/components/ui/DataGrid/gridTypes'
import GenericForm from '@/components/ui/GenericForm/GenericForm'
import type { FormSection } from '@/components/ui/GenericForm/formTypes'
import SingleSearch from '@/components/ui/SearchFilter/SingleSearch'
import AdvancedFilter from '@/components/ui/SearchFilter/AdvancedFilter'
import type { ActiveFilters, FilterField } from '@/components/ui/SearchFilter/filterTypes'
import { useNotification } from '@/hooks'
import type React from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<CycleStatus, React.CSSProperties> = {
  planned:    { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',  border: '1px solid rgba(12,122,130,0.15)' },
  sowing:     { background: 'rgba(255,193,7,0.1)',    color: '#ffc107',            border: '1px solid rgba(255,193,7,0.3)'   },
  growing:    { background: 'rgba(6,214,160,0.12)',   color: '#06d6a0',            border: '1px solid rgba(6,214,160,0.3)'   },
  harvesting: { background: 'rgba(255,107,53,0.1)',   color: '#ff6b35',            border: '1px solid rgba(255,107,53,0.3)'  },
  completed:  { background: 'rgba(12,122,130,0.12)',  color: '#0e949e',            border: '1px solid rgba(12,122,130,0.35)' },
  failed:     { background: 'rgba(157,78,221,0.1)',   color: '#9d4edd',            border: '1px solid rgba(157,78,221,0.3)'  },
}

const SEASON_ICON: Record<string, string> = {
  kharif: '🌧️', rabi: '❄️', zaid: '☀️', annual: '🔄',
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }

// ── Farm columns ──────────────────────────────────────────────────────────────

const FARM_COLUMNS: ColumnDef<Farm>[] = [
  {
    key: 'name',
    header: 'Farm',
    sortable: true,
    render: (r) => (
      <div>
        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</div>
        {r.farm_code && <div className="text-xs" style={{ color: 'var(--text-faint)' }}>{r.farm_code}</div>}
      </div>
    ),
  },
  {
    key: 'district',
    header: 'Location',
    render: (r) => (
      <span style={{ color: 'var(--text-muted)' }}>
        {[r.village, r.taluk, r.district, r.state].filter(Boolean).join(', ') || '—'}
      </span>
    ),
  },
  {
    key: 'total_area',
    header: 'Area',
    sortable: true,
    render: (r) => <span style={{ color: 'var(--text-secondary)' }}>{r.total_area} {r.land_unit}</span>,
  },
  {
    key: 'irrigated_area',
    header: 'Irrigated',
    render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.irrigated_area ? `${r.irrigated_area} ${r.land_unit}` : '—'}</span>,
  },
  { key: 'soil_type',    header: 'Soil',  render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.soil_type   ?? '—'}</span> },
  { key: 'water_source', header: 'Water', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.water_source ?? '—'}</span> },
  {
    key: 'is_active',
    header: 'Status',
    render: (r) => (
      <span
        className="inline-flex px-2 py-0.5 rounded text-xs font-semibold"
        style={r.is_active
          ? { background: 'rgba(6,214,160,0.1)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)' }
          : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)', border: '1px solid rgba(12,122,130,0.1)' }
        }
      >
        {r.is_active ? 'Active' : 'Inactive'}
      </span>
    ),
  },
]

// ── Cycle columns ─────────────────────────────────────────────────────────────

const CYCLE_COLUMNS: ColumnDef<CropCycle>[] = [
  {
    key: 'crop_name',
    header: 'Crop',
    sortable: true,
    render: (r) => (
      <div>
        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.crop_name}</div>
        {r.variety && <div className="text-xs" style={{ color: 'var(--text-faint)' }}>{r.variety}</div>}
      </div>
    ),
  },
  {
    key: 'season',
    header: 'Season',
    render: (r) => (
      <span style={{ color: 'var(--text-secondary)' }}>
        {SEASON_ICON[r.season]} <span className="capitalize">{r.season} {r.year}</span>
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (r) => (
      <span
        className="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
        style={STATUS_STYLE[r.status]}
      >
        {r.status}
      </span>
    ),
  },
  {
    key: 'area_cultivated',
    header: 'Area',
    render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.area_cultivated} {r.land_unit}</span>,
  },
  {
    key: 'actual_yield',
    header: 'Yield',
    render: (r) => r.actual_yield > 0
      ? <span style={{ color: 'var(--text-secondary)' }}>{r.actual_yield} {r.yield_unit}</span>
      : <span style={{ color: 'var(--text-faint)' }}>— / {r.expected_yield} {r.yield_unit}</span>,
  },
  {
    key: 'total_expense',
    header: 'Expense',
    sortable: true,
    render: (r) => <span style={{ color: '#ff6b35' }}>{fmt(r.total_expense)}</span>,
  },
  {
    key: 'total_revenue',
    header: 'Revenue',
    sortable: true,
    render: (r) => <span style={{ color: '#06d6a0' }}>{fmt(r.total_revenue)}</span>,
  },
  {
    key: 'net_profit',
    header: 'P&L',
    sortable: true,
    render: (r) => (
      <span className="font-semibold" style={{ color: r.net_profit >= 0 ? '#06d6a0' : '#ff6b35' }}>
        {r.net_profit >= 0 ? '+' : ''}{fmt(r.net_profit)}
      </span>
    ),
  },
]

// ── Filter fields ─────────────────────────────────────────────────────────────

const FARM_FILTERS: FilterField[] = [
  { key: 'district',  label: 'District', type: 'text' },
  { key: 'state',     label: 'State',    type: 'text' },
  { key: 'is_active', label: 'Active',   type: 'boolean' },
]

const CYCLE_FILTERS: FilterField[] = [
  { key: 'season',    label: 'Season',    type: 'select', options: ['kharif','rabi','zaid','annual'] },
  { key: 'status',    label: 'Status',    type: 'select', options: ['planned','sowing','growing','harvesting','completed','failed'] },
  { key: 'year',      label: 'Year',      type: 'text' },
  { key: 'crop_name', label: 'Crop Name', type: 'text' },
]

// ── Form sections ─────────────────────────────────────────────────────────────

const FARM_FORM: FormSection[] = [
  {
    title: 'Farm Details',
    fields: [
      { key: 'name',      label: 'Farm Name',  type: 'text', required: true, colSpan: 2 },
      { key: 'farm_code', label: 'Farm Code',  type: 'text' },
      { key: 'village',   label: 'Village',    type: 'text' },
      { key: 'taluk',     label: 'Taluk',      type: 'text' },
      { key: 'district',  label: 'District',   type: 'text' },
      { key: 'state',     label: 'State',      type: 'text' },
      { key: 'survey_no', label: 'Survey No.', type: 'text' },
    ],
  },
  {
    title: 'Land Details',
    fields: [
      { key: 'total_area', label: 'Total Area', type: 'number', required: true, min: 0.001 },
      {
        key: 'land_unit', label: 'Unit', type: 'select', defaultValue: 'acre',
        options: [
          { label: 'Acre',    value: 'acre' },
          { label: 'Hectare', value: 'hectare' },
          { label: 'Guntha',  value: 'guntha' },
          { label: 'Bigha',   value: 'bigha' },
          { label: 'Sq. Ft.', value: 'sqft' },
        ],
      },
      { key: 'irrigated_area', label: 'Irrigated Area', type: 'number', min: 0 },
      { key: 'soil_type',      label: 'Soil Type',      type: 'text', placeholder: 'black / red / alluvial' },
      { key: 'water_source',   label: 'Water Source',   type: 'text', placeholder: 'borewell / canal / rain-fed' },
      { key: 'owner_id',       label: 'Owner (Client ID)', type: 'number' },
      { key: 'is_active',      label: 'Active',         type: 'checkbox', defaultValue: true },
    ],
  },
  { title: 'Notes', fields: [{ key: 'notes', label: 'Notes', type: 'textarea', colSpan: 3 }] },
]

const CYCLE_FORM: FormSection[] = [
  {
    title: 'Crop Details',
    fields: [
      { key: 'farm_id',   label: 'Farm ID',   type: 'number', required: true },
      { key: 'crop_name', label: 'Crop Name', type: 'text',   required: true },
      { key: 'variety',   label: 'Variety',   type: 'text' },
      {
        key: 'season', label: 'Season', type: 'select', required: true,
        options: [
          { label: 'Kharif (Jun–Nov)', value: 'kharif' },
          { label: 'Rabi (Nov–Apr)',   value: 'rabi' },
          { label: 'Zaid (Apr–Jun)',   value: 'zaid' },
          { label: 'Annual',           value: 'annual' },
        ],
      },
      { key: 'year',                   label: 'Year',             type: 'number', required: true, min: 2000 },
      { key: 'sowing_date',            label: 'Sowing Date',      type: 'date' },
      { key: 'expected_harvest_date',  label: 'Expected Harvest', type: 'date' },
    ],
  },
  {
    title: 'Area & Yield',
    fields: [
      { key: 'area_cultivated', label: 'Area Cultivated', type: 'number', required: true, min: 0.001 },
      {
        key: 'land_unit', label: 'Unit', type: 'select', defaultValue: 'acre',
        options: [{ label: 'Acre', value: 'acre' }, { label: 'Hectare', value: 'hectare' }, { label: 'Guntha', value: 'guntha' }],
      },
      { key: 'expected_yield', label: 'Expected Yield', type: 'number', min: 0 },
      {
        key: 'yield_unit', label: 'Yield Unit', type: 'select', defaultValue: 'kg',
        options: [{ label: 'kg', value: 'kg' }, { label: 'quintal', value: 'quintal' }, { label: 'tonne', value: 'tonne' }, { label: 'bags', value: 'bags' }],
      },
    ],
  },
  { title: 'Notes', fields: [{ key: 'notes', label: 'Notes', type: 'textarea', colSpan: 3 }] },
]

const EXPENSE_FORM: FormSection[] = [
  {
    fields: [
      { key: 'expense_date', label: 'Date',     type: 'date', required: true },
      {
        key: 'category', label: 'Category', type: 'select', required: true,
        options: [
          { label: 'Seeds',         value: 'seeds' },
          { label: 'Fertilizer',    value: 'fertilizer' },
          { label: 'Pesticide',     value: 'pesticide' },
          { label: 'Irrigation',    value: 'irrigation' },
          { label: 'Labour',        value: 'labour' },
          { label: 'Machinery',     value: 'machinery' },
          { label: 'Transport',     value: 'transport' },
          { label: 'Storage',       value: 'storage' },
          { label: 'Miscellaneous', value: 'miscellaneous' },
        ],
      },
      { key: 'description', label: 'Description',  type: 'text',   required: true, colSpan: 2 },
      { key: 'quantity',    label: 'Quantity',      type: 'number', min: 0 },
      { key: 'unit',        label: 'Unit',          type: 'text' },
      { key: 'unit_cost',   label: 'Unit Cost',     type: 'number', min: 0 },
      { key: 'amount',      label: 'Total Amount',  type: 'number', required: true, min: 0.01 },
      { key: 'is_paid',     label: 'Paid',          type: 'checkbox', defaultValue: true },
      { key: 'receipt_no',  label: 'Receipt No.',   type: 'text' },
    ],
  },
]

const HARVEST_FORM: FormSection[] = [
  {
    fields: [
      { key: 'harvest_date',      label: 'Harvest Date',      type: 'date',   required: true },
      { key: 'quantity',          label: 'Quantity',          type: 'number', required: true, min: 0.001 },
      {
        key: 'unit', label: 'Unit', type: 'select', defaultValue: 'kg',
        options: [{ label: 'kg', value: 'kg' }, { label: 'quintal', value: 'quintal' }, { label: 'tonne', value: 'tonne' }, { label: 'bags', value: 'bags' }],
      },
      {
        key: 'quality_grade', label: 'Quality Grade', type: 'select',
        options: [{ label: 'Premium', value: 'premium' }, { label: 'Grade A', value: 'A' }, { label: 'Grade B', value: 'B' }, { label: 'Grade C', value: 'C' }],
      },
      { key: 'moisture_pct',     label: 'Moisture %',        type: 'number', min: 0, max: 100 },
      { key: 'market_rate',      label: 'Market Rate/unit',  type: 'number', min: 0 },
      { key: 'sale_amount',      label: 'Sale Amount (₹)',   type: 'number', min: 0 },
      { key: 'buyer_id',         label: 'Buyer (Client ID)', type: 'number' },
      { key: 'storage_location', label: 'Storage Location',  type: 'text' },
      { key: 'notes',            label: 'Notes',             type: 'textarea', colSpan: 3 },
    ],
  },
]

// ── Page component ────────────────────────────────────────────────────────────

export default function AgriculturePage() {
  const dispatch = useAppDispatch()
  const notify   = useNotification()

  const farms     = useAppSelector(farmsSelectors.selectItems    as (s: any) => Farm[])
  const farmLoad  = useAppSelector(farmsSelectors.selectLoading  as (s: any) => boolean)
  const farmSave  = useAppSelector(farmsSelectors.selectSaving   as (s: any) => boolean)
  const farmPag   = useAppSelector(farmsSelectors.selectPagination as (s: any) => { total: number; page: number; pageSize: number; pages: number })

  const cycles    = useAppSelector(cyclesSelectors.selectItems   as (s: any) => CropCycle[])
  const cycleLoad = useAppSelector(cyclesSelectors.selectLoading as (s: any) => boolean)
  const cycleSave = useAppSelector(cyclesSelectors.selectSaving  as (s: any) => boolean)
  const cyclePag  = useAppSelector(cyclesSelectors.selectPagination as (s: any) => { total: number; page: number; pageSize: number; pages: number })

  const agriInvoices = useAppSelector(agricultureAuxSelectors.invoices)

  const [tab,           setTab]           = useState<'farms' | 'cycles' | 'invoices'>('farms')
  const [farmSearch,    setFarmSearch]    = useState('')
  const [cycleSearch,   setCycleSearch]   = useState('')
  const [farmFilters,   setFarmFilters]   = useState<ActiveFilters>({ conditions: [], logic: 'AND' })
  const [cycleFilters,  setCycleFilters]  = useState<ActiveFilters>({ conditions: [], logic: 'AND' })
  const [showFarmForm,  setShowFarmForm]  = useState(false)
  const [showCycleForm, setShowCycleForm] = useState(false)
  const [editFarm,      setEditFarm]      = useState<Farm | null>(null)
  const [editCycle,     setEditCycle]     = useState<CropCycle | null>(null)
  const [expCycle,      setExpCycle]      = useState<CropCycle | null>(null)
  const [harvCycle,     setHarvCycle]     = useState<CropCycle | null>(null)

  const loadFarms = useCallback(() => {
    const fp: Record<string, unknown> = {}
    farmFilters.conditions.forEach((c) => { if (c.value !== '' && c.value !== undefined) fp[c.field] = c.value })
    dispatch(farmsThunks.fetchAll({ page: farmPag.page, size: farmPag.pageSize, search: farmSearch || undefined, ...fp }))
  }, [dispatch, farmPag.page, farmPag.pageSize, farmSearch, farmFilters])

  const loadCycles = useCallback(() => {
    const fp: Record<string, unknown> = {}
    cycleFilters.conditions.forEach((c) => { if (c.value !== '' && c.value !== undefined) fp[c.field] = c.value })
    dispatch(cyclesThunks.fetchAll({ page: cyclePag.page, size: cyclePag.pageSize, search: cycleSearch || undefined, ...fp }))
  }, [dispatch, cyclePag.page, cyclePag.pageSize, cycleSearch, cycleFilters])

  useEffect(() => { loadFarms(); loadCycles(); dispatch(fetchAgriInvoices({})) }, [])
  useEffect(() => { loadFarms() },  [loadFarms])
  useEffect(() => { loadCycles() }, [loadCycles])

  const CYCLE_ACTIONS: RowAction<CropCycle>[] = [
    { label: 'Edit',        onClick: (r) => { setEditCycle(r); setShowCycleForm(true) } },
    { label: 'Add Expense', onClick: (r) => setExpCycle(r) },
    { label: 'Add Harvest', onClick: (r) => setHarvCycle(r) },
    {
      label: 'Delete', variant: 'danger',
      visible: (r) => ['planned', 'failed'].includes(r.status),
      onClick: async (r) => {
        if (!confirm(`Delete cycle for "${r.crop_name}"?`)) return
        await dispatch(cyclesThunks.delete(r.id)).unwrap()
        notify.success('Cycle deleted'); loadCycles()
      },
    },
  ]

  const FARM_ACTIONS: RowAction<Farm>[] = [
    { label: 'Edit', onClick: (r) => { setEditFarm(r); setShowFarmForm(true) } },
    {
      label: 'Delete', variant: 'danger',
      onClick: async (r) => {
        if (!confirm(`Delete farm "${r.name}"?`)) return
        await dispatch(farmsThunks.delete(r.id)).unwrap()
        notify.success('Farm deleted'); loadFarms()
      },
    },
  ]

  async function handleFarmSave(values: Record<string, unknown>) {
    try {
      if (editFarm) { await dispatch(farmsThunks.update({ id: editFarm.id, ...values })).unwrap(); notify.success('Farm updated') }
      else          { await dispatch(farmsThunks.create(values)).unwrap(); notify.success('Farm created') }
      setShowFarmForm(false); setEditFarm(null); loadFarms()
    } catch { notify.error('Save failed') }
  }

  async function handleCycleSave(values: Record<string, unknown>) {
    try {
      if (editCycle) { await dispatch(cyclesThunks.update({ id: editCycle.id, ...values })).unwrap(); notify.success('Cycle updated') }
      else           { await dispatch(cyclesThunks.create(values)).unwrap(); notify.success('Cycle created') }
      setShowCycleForm(false); setEditCycle(null); loadCycles()
    } catch { notify.error('Save failed') }
  }

  async function handleExpense(values: Record<string, unknown>) {
    if (!expCycle) return
    try {
      await dispatch(addExpense({ cycleId: expCycle.id, data: values })).unwrap()
      notify.success('Expense recorded'); setExpCycle(null); loadCycles()
    } catch { notify.error('Failed') }
  }

  async function handleHarvest(values: Record<string, unknown>) {
    if (!harvCycle) return
    try {
      await dispatch(addHarvest({ cycleId: harvCycle.id, data: values })).unwrap()
      notify.success('Harvest recorded'); setHarvCycle(null); loadCycles()
    } catch { notify.error('Failed') }
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Agriculture</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>{farmPag.total} farms · {cyclePag.total} crop cycles</p>
        </div>
        <div className="flex gap-2">
          {tab === 'farms' && (
            <button
              onClick={() => { setEditFarm(null); setShowFarmForm(true) }}
              className="px-4 py-2 text-sm font-semibold rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #06d6a0, #0aab80)', color: '#fff', boxShadow: '0 0 16px rgba(6,214,160,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 24px rgba(6,214,160,0.5)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 16px rgba(6,214,160,0.3)' }}
            >
              + New Farm
            </button>
          )}
          {tab === 'cycles' && (
            <button
              onClick={() => { setEditCycle(null); setShowCycleForm(true) }}
              className="px-4 py-2 text-sm font-semibold rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #0c7a82, #0e949e)', color: '#fff', boxShadow: '0 0 20px rgba(12,122,130,0.35)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 28px rgba(12,122,130,0.55)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(12,122,130,0.35)' }}
            >
              + New Cycle
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
        {(['farms', 'cycles', 'invoices'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium capitalize transition-colors"
            style={
              tab === t
                ? { borderBottom: '2px solid #0c7a82', color: '#0e949e', paddingBottom: '6px' }
                : { borderBottom: '2px solid transparent', color: 'var(--text-faint)', paddingBottom: '6px' }
            }
          >
            {t === 'cycles' ? 'Crop Cycles' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'farms' && (
        <>
          <div className="flex gap-3">
            <div className="flex-1"><SingleSearch placeholder="Search farms…" value={farmSearch} onChange={setFarmSearch} storageKey="agri-farm-search" /></div>
            <AdvancedFilter fields={FARM_FILTERS} value={farmFilters} onChange={setFarmFilters} />
          </div>
          <DataGrid<Farm>
            columns={FARM_COLUMNS} data={farms} loading={farmLoad} rowKey="id"
            rowActions={FARM_ACTIONS} selectable exportable exportFilename="farms"
            pagination={{ page: farmPag.page, pageSize: farmPag.pageSize, total: farmPag.total,
              onPageChange: (p) => dispatch(farmsThunks.fetchAll({ page: p, size: farmPag.pageSize })),
              onPageSizeChange: (s) => dispatch(farmsThunks.fetchAll({ page: 1, size: s })) }}
            emptyMessage="No farms found."
          />
        </>
      )}

      {tab === 'cycles' && (
        <>
          <AgriSummaryCards cycles={cycles} />
          <div className="flex gap-3">
            <div className="flex-1"><SingleSearch placeholder="Search crop cycles…" value={cycleSearch} onChange={setCycleSearch} storageKey="agri-cycle-search" /></div>
            <AdvancedFilter fields={CYCLE_FILTERS} value={cycleFilters} onChange={setCycleFilters} />
          </div>
          <DataGrid<CropCycle>
            columns={CYCLE_COLUMNS} data={cycles} loading={cycleLoad} rowKey="id"
            rowActions={CYCLE_ACTIONS} selectable exportable exportFilename="crop-cycles"
            pagination={{ page: cyclePag.page, pageSize: cyclePag.pageSize, total: cyclePag.total,
              onPageChange: (p) => dispatch(cyclesThunks.fetchAll({ page: p, size: cyclePag.pageSize })),
              onPageSizeChange: (s) => dispatch(cyclesThunks.fetchAll({ page: 1, size: s })) }}
            emptyMessage="No crop cycles found."
          />
        </>
      )}

      {tab === 'invoices' && <AgriInvoiceTable invoices={agriInvoices} />}

      {/* Modals */}
      {showFarmForm  && <DarkFormModal title={editFarm  ? 'Edit Farm'  : 'New Farm'}  sections={FARM_FORM}  initial={editFarm  ?? {}} onSave={handleFarmSave}  onClose={() => { setShowFarmForm(false);  setEditFarm(null)  }} saving={farmSave}  />}
      {showCycleForm && <DarkFormModal title={editCycle ? 'Edit Cycle' : 'New Cycle'} sections={CYCLE_FORM} initial={editCycle ?? {}} onSave={handleCycleSave} onClose={() => { setShowCycleForm(false); setEditCycle(null) }} saving={cycleSave} />}
      {expCycle  && <DarkFormModal title={`Add Expense — ${expCycle.crop_name}`}  sections={EXPENSE_FORM}  initial={{ expense_date: new Date().toISOString().slice(0,10) }} onSave={handleExpense}  onClose={() => setExpCycle(null)}  saving={false} />}
      {harvCycle && <DarkFormModal title={`Add Harvest — ${harvCycle.crop_name}`} sections={HARVEST_FORM}  initial={{ harvest_date: new Date().toISOString().slice(0,10) }} onSave={handleHarvest} onClose={() => setHarvCycle(null)} saving={false} />}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AgriSummaryCards({ cycles }: { cycles: CropCycle[] }) {
  const active       = cycles.filter((c) => ['sowing','growing','harvesting'].includes(c.status)).length
  const completed    = cycles.filter((c) => c.status === 'completed').length
  const totalRevenue = cycles.reduce((s, c) => s + c.total_revenue, 0)
  const totalProfit  = cycles.reduce((s, c) => s + c.net_profit, 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Active Cycles', value: String(active),    color: '#06d6a0' },
        { label: 'Completed',     value: String(completed), color: '#0e949e' },
        { label: 'Total Revenue', value: fmt(totalRevenue), color: '#00d4ff' },
        { label: 'Net P&L',       value: `${totalProfit >= 0 ? '+' : ''}${fmt(totalProfit)}`, color: totalProfit >= 0 ? '#06d6a0' : '#ff6b35' },
      ].map((c) => (
        <div
          key={c.label}
          className="rounded-xl p-4"
          style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.2)' }}
        >
          <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{c.label}</p>
          <p className="text-xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}

function AgriInvoiceTable({ invoices }: { invoices: any[] }) {
  if (!invoices.length) return (
    <p className="text-center py-16" style={{ color: 'var(--text-faint)' }}>No agriculture invoices found.</p>
  )
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.2)' }}
    >
      <table className="w-full text-sm">
        <thead style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
          <tr className="text-xs uppercase text-left" style={{ color: 'var(--text-faint)' }}>
            <th className="px-4 py-3">Invoice #</th>
            <th className="px-4 py-3">Crop</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Due</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} style={{ borderBottom: '1px solid rgba(12,122,130,0.08)' }}>
              <td className="px-4 py-3 font-mono text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{inv.invoice_number}</td>
              <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>{inv.crop_name}</td>
              <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{inv.invoice_date}</td>
              <td className="px-4 py-3 text-right" style={{ color: 'var(--text-muted)' }}>{inv.quantity} {inv.unit}</td>
              <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(inv.grand_total)}</td>
              <td className="px-4 py-3 text-right font-medium" style={{ color: '#ff6b35' }}>{fmt(inv.amount_due)}</td>
              <td className="px-4 py-3">
                <span
                  className="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase"
                  style={
                    inv.status === 'paid'  ? { background: 'rgba(6,214,160,0.1)',    color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)'   } :
                    inv.status === 'draft' ? { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(12,122,130,0.15)' } :
                                             { background: 'rgba(255,193,7,0.1)',    color: '#ffc107', border: '1px solid rgba(255,193,7,0.3)'   }
                  }
                >
                  {inv.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DarkFormModal({ title, sections, initial, onSave, onClose, saving }: {
  title: string
  sections: FormSection[]
  initial: object
  onSave: (v: Record<string, unknown>) => void
  onClose: () => void
  saving: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
          border: '1px solid rgba(12,122,130,0.3)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-xl w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b35'; e.currentTarget.style.background = 'rgba(255,107,53,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.background = 'transparent' }}
          >
            &times;
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <GenericForm sections={sections} initialValues={initial} onSubmit={onSave} onCancel={onClose} loading={saving} submitLabel="Save" />
        </div>
      </div>
    </div>
  )
}
