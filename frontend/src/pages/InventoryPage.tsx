import { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  inventoryThunks, inventorySelectors,
  fetchCategories, fetchWarehouses, fetchLowStock,
  adjustStock, fetchTxnHistory,
  inventoryAuxSelectors,
  type Product, type StockTxnType, type StockTransaction,
} from '@/features/inventory/inventorySlice'
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

function stockStyle(available: number, reorder: number): React.CSSProperties {
  if (available <= 0)       return { background: 'rgba(255,107,53,0.1)',  color: '#ff6b35', border: '1px solid rgba(255,107,53,0.3)'  }
  if (available <= reorder) return { background: 'rgba(255,193,7,0.1)',   color: '#ffc107', border: '1px solid rgba(255,193,7,0.3)'   }
  return                           { background: 'rgba(6,214,160,0.1)',   color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)'   }
}

function stockLabel(available: number, reorder: number) {
  if (available <= 0)       return 'Out of stock'
  if (available <= reorder) return 'Low stock'
  return 'In stock'
}

const TXN_LABELS: Record<StockTxnType, string> = {
  purchase_receipt: 'Purchase Receipt',
  sale_issue:       'Sale Issue',
  adjustment_in:    'Adjustment (+)',
  adjustment_out:   'Adjustment (−)',
  transfer_in:      'Transfer In',
  transfer_out:     'Transfer Out',
  return_in:        'Return',
  opening_stock:    'Opening Stock',
}

// ── Columns ───────────────────────────────────────────────────────────────────

const COLUMNS: ColumnDef<Product>[] = [
  {
    key: 'name',
    header: 'Product',
    sortable: true,
    render: (r) => (
      <div>
        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</div>
        <div className="text-xs space-x-2" style={{ color: 'var(--text-faint)' }}>
          {r.sku     && <span>SKU: {r.sku}</span>}
          {r.barcode && <span>• {r.barcode}</span>}
        </div>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => {
      const style: React.CSSProperties =
        r.status === 'active'       ? { background: 'rgba(6,214,160,0.1)',    color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)'   } :
        r.status === 'inactive'     ? { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',  border: '1px solid rgba(12,122,130,0.15)' } :
                                      { background: 'rgba(255,107,53,0.1)',   color: '#ff6b35', border: '1px solid rgba(255,107,53,0.3)'  }
      return (
        <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide" style={style}>
          {r.status}
        </span>
      )
    },
  },
  { key: 'unit', header: 'Unit', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.unit}</span> },
  {
    key: 'selling_price',
    header: 'Sale Price',
    sortable: true,
    render: (r) => <span style={{ color: 'var(--text-primary)' }}>₹{r.selling_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>,
  },
  {
    key: 'total_stock',
    header: 'Available',
    sortable: true,
    render: (r) => {
      const qty = r.total_stock ?? 0
      return (
        <div className="flex items-center gap-2">
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{qty.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={stockStyle(qty, r.reorder_level)}>
            {stockLabel(qty, r.reorder_level)}
          </span>
        </div>
      )
    },
  },
  {
    key: 'reorder_level',
    header: 'Reorder At',
    render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.reorder_level || '—'}</span>,
  },
  {
    key: 'tax_rate',
    header: 'GST %',
    render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.tax_rate}%</span>,
  },
]

// ── Filter fields ─────────────────────────────────────────────────────────────

const FILTER_FIELDS: FilterField[] = [
  { key: 'status',       label: 'Status', type: 'select', options: ['active','inactive','discontinued'] },
  { key: 'product_type', label: 'Type',   type: 'select', options: ['goods','service','digital'] },
  { key: 'category_id',  label: 'Category ID', type: 'text' },
]

// ── Product Form ──────────────────────────────────────────────────────────────

const PRODUCT_FORM_SECTIONS: FormSection[] = [
  {
    title: 'Basic Details',
    fields: [
      { key: 'name',        label: 'Product Name', type: 'text', required: true, colSpan: 2 },
      { key: 'sku',         label: 'SKU',          type: 'text' },
      { key: 'barcode',     label: 'Barcode',      type: 'text' },
      { key: 'brand',       label: 'Brand',        type: 'text' },
      { key: 'hsn_sac',     label: 'HSN / SAC',    type: 'text' },
      { key: 'description', label: 'Description',  type: 'textarea', colSpan: 3 },
    ],
  },
  {
    title: 'Classification',
    fields: [
      { key: 'category_id', label: 'Category ID', type: 'number' },
      {
        key: 'product_type', label: 'Type', type: 'select', defaultValue: 'goods',
        options: [
          { label: 'Goods',   value: 'goods' },
          { label: 'Service', value: 'service' },
          { label: 'Digital', value: 'digital' },
        ],
      },
      {
        key: 'status', label: 'Status', type: 'select', defaultValue: 'active',
        options: [
          { label: 'Active',       value: 'active' },
          { label: 'Inactive',     value: 'inactive' },
          { label: 'Discontinued', value: 'discontinued' },
        ],
      },
      { key: 'unit', label: 'Unit', type: 'text', defaultValue: 'nos', placeholder: 'nos / kg / sqft / hrs' },
    ],
  },
  {
    title: 'Pricing',
    fields: [
      { key: 'purchase_price', label: 'Purchase Price', type: 'number', min: 0 },
      { key: 'selling_price',  label: 'Selling Price',  type: 'number', min: 0 },
      { key: 'mrp',            label: 'MRP',            type: 'number', min: 0 },
      {
        key: 'tax_rate', label: 'GST Rate (%)', type: 'select', defaultValue: '18',
        options: [
          { label: '0%',  value: '0' },
          { label: '5%',  value: '5' },
          { label: '12%', value: '12' },
          { label: '18%', value: '18' },
          { label: '28%', value: '28' },
        ],
      },
    ],
  },
  {
    title: 'Stock Thresholds',
    fields: [
      { key: 'reorder_level',   label: 'Reorder Level',       type: 'number', min: 0, hint: 'Alert when stock drops to this level' },
      { key: 'reorder_qty',     label: 'Reorder Quantity',     type: 'number', min: 0 },
      { key: 'max_stock_level', label: 'Max Stock Level',      type: 'number', min: 0 },
      { key: 'track_inventory', label: 'Track Inventory',      type: 'checkbox', defaultValue: true },
      { key: 'allow_negative',  label: 'Allow Negative Stock', type: 'checkbox', defaultValue: false },
    ],
  },
]

const ADJUST_FORM_SECTIONS: FormSection[] = [
  {
    fields: [
      { key: 'warehouse_id', label: 'Warehouse ID', type: 'number', required: true },
      {
        key: 'txn_type', label: 'Transaction Type', type: 'select', required: true,
        options: [
          { label: 'Opening Stock',    value: 'opening_stock' },
          { label: 'Adjustment (+)',   value: 'adjustment_in' },
          { label: 'Adjustment (−)',   value: 'adjustment_out' },
          { label: 'Purchase Receipt', value: 'purchase_receipt' },
          { label: 'Transfer In',      value: 'transfer_in' },
          { label: 'Transfer Out',     value: 'transfer_out' },
          { label: 'Return',           value: 'return_in' },
        ],
      },
      { key: 'qty',       label: 'Quantity',  type: 'number', required: true, hint: 'Use negative for outward' },
      { key: 'unit_cost', label: 'Unit Cost', type: 'number', min: 0 },
      { key: 'batch_no',  label: 'Batch No.', type: 'text' },
      { key: 'notes',     label: 'Notes',     type: 'textarea', colSpan: 3 },
    ],
  },
]

// ── Page component ────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const dispatch = useAppDispatch()
  const notify   = useNotification()

  const products  = useAppSelector(inventorySelectors.selectItems    as (s: any) => Product[])
  const isLoading = useAppSelector(inventorySelectors.selectLoading  as (s: any) => boolean)
  const isSaving  = useAppSelector(inventorySelectors.selectSaving   as (s: any) => boolean)
  const { total, page, pageSize } = useAppSelector(inventorySelectors.selectPagination as (s: any) => { total: number; page: number; pageSize: number; pages: number })
  const lowStock   = useAppSelector(inventoryAuxSelectors.lowStock)
  const warehouses = useAppSelector(inventoryAuxSelectors.warehouses)
  const txnHistory = useAppSelector(inventoryAuxSelectors.txnHistory)

  const [search,        setSearch]        = useState('')
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ conditions: [], logic: 'AND' })
  const [tab,           setTab]           = useState<'products' | 'low-stock' | 'warehouses'>('products')
  const [showForm,      setShowForm]      = useState(false)
  const [editTarget,    setEditTarget]    = useState<Product | null>(null)
  const [adjustTarget,  setAdjustTarget]  = useState<Product | null>(null)
  const [txnTarget,     setTxnTarget]     = useState<Product | null>(null)

  const load = useCallback(() => {
    const fp: Record<string, unknown> = {}
    activeFilters.conditions.forEach((c) => { if (c.value !== '' && c.value !== undefined) fp[c.field] = c.value })
    dispatch(inventoryThunks.fetchAll({ page, size: pageSize, search: search || undefined, ...fp }))
  }, [dispatch, page, pageSize, search, activeFilters])

  useEffect(() => {
    load()
    dispatch(fetchCategories())
    dispatch(fetchWarehouses())
    dispatch(fetchLowStock())
  }, [])

  useEffect(() => { load() }, [load])

  const ROW_ACTIONS: RowAction<Product>[] = [
    { label: 'Edit',          onClick: (r) => { setEditTarget(r); setShowForm(true) } },
    { label: 'Adjust Stock',  onClick: (r) => setAdjustTarget(r) },
    { label: 'Stock History', onClick: (r) => { setTxnTarget(r); dispatch(fetchTxnHistory({ productId: r.id })) } },
    { label: 'Delete', variant: 'danger', onClick: async (r) => {
      if (!confirm(`Delete "${r.name}"?`)) return
      await dispatch(inventoryThunks.delete(r.id)).unwrap()
      notify.success('Product deleted'); load()
    }},
  ]

  async function handleSave(values: Record<string, unknown>) {
    try {
      if (editTarget) {
        await dispatch(inventoryThunks.update({ id: editTarget.id, ...values })).unwrap()
        notify.success('Product updated')
      } else {
        await dispatch(inventoryThunks.create(values)).unwrap()
        notify.success('Product created')
      }
      setShowForm(false); setEditTarget(null); load()
    } catch { notify.error('Save failed') }
  }

  async function handleAdjust(values: Record<string, unknown>) {
    if (!adjustTarget) return
    try {
      await dispatch(adjustStock({
        productId: adjustTarget.id,
        data: {
          warehouse_id: Number(values.warehouse_id),
          txn_type:     values.txn_type as StockTxnType,
          qty:          Number(values.qty),
          unit_cost:    values.unit_cost ? Number(values.unit_cost) : undefined,
          notes:        values.notes as string | undefined,
          batch_no:     values.batch_no as string | undefined,
        },
      })).unwrap()
      notify.success('Stock adjusted')
      setAdjustTarget(null); load()
    } catch (e: any) {
      notify.error(e?.message ?? 'Adjustment failed')
    }
  }

  const tabLabels: Record<typeof tab, string> = {
    'products':   'Products',
    'low-stock':  `Low Stock (${lowStock.length})`,
    'warehouses': 'Warehouses',
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Inventory</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>{total} products</p>
        </div>
        <div className="flex gap-2">
          {lowStock.length > 0 && (
            <button
              onClick={() => setTab('low-stock')}
              className="px-3 py-2 text-sm font-semibold rounded-xl"
              style={{ background: 'rgba(255,193,7,0.1)', color: '#ffc107', border: '1px solid rgba(255,193,7,0.3)' }}
            >
              {lowStock.length} Low Stock
            </button>
          )}
          <button
            onClick={() => { setEditTarget(null); setShowForm(true) }}
            className="px-4 py-2 text-sm font-semibold rounded-xl transition-all"
            style={{
              background: 'linear-gradient(135deg, #0c7a82, #0e949e)',
              color: '#fff',
              boxShadow: '0 0 20px rgba(12,122,130,0.35)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 28px rgba(12,122,130,0.55)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(12,122,130,0.35)' }}
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
        {(['products', 'low-stock', 'warehouses'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={
              tab === t
                ? { borderBottom: '2px solid #0c7a82', color: '#0e949e', paddingBottom: '6px' }
                : { borderBottom: '2px solid transparent', color: 'var(--text-faint)', paddingBottom: '6px' }
            }
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <SingleSearch
                placeholder="Search by name, SKU, barcode, brand…"
                value={search}
                onChange={setSearch}
                storageKey="inventory-search"
              />
            </div>
            <AdvancedFilter fields={FILTER_FIELDS} value={activeFilters} onChange={setActiveFilters} />
          </div>
          <InventoryStats products={products} />
          <DataGrid<Product>
            columns={COLUMNS}
            data={products}
            loading={isLoading}
            rowKey="id"
            rowActions={ROW_ACTIONS}
            selectable
            exportable
            exportFilename="inventory"
            pagination={{
              page, pageSize, total,
              onPageChange:     (p) => dispatch(inventoryThunks.fetchAll({ page: p, size: pageSize })),
              onPageSizeChange: (s) => dispatch(inventoryThunks.fetchAll({ page: 1, size: s })),
            }}
            emptyMessage="No products found. Add your first product to start tracking inventory."
          />
        </>
      )}

      {tab === 'low-stock'  && <LowStockTable rows={lowStock} />}
      {tab === 'warehouses' && <WarehouseTable warehouses={warehouses} />}

      {/* Create / Edit Product Modal */}
      {showForm && (
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
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {editTarget ? 'Edit Product' : 'New Product'}
                </h2>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditTarget(null) }}
                className="text-xl w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: 'var(--text-faint)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b35'; e.currentTarget.style.background = 'rgba(255,107,53,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.background = 'transparent' }}
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <GenericForm
                sections={PRODUCT_FORM_SECTIONS}
                initialValues={editTarget ?? {}}
                onSubmit={handleSave}
                onCancel={() => { setShowForm(false); setEditTarget(null) }}
                loading={isSaving}
                submitLabel={editTarget ? 'Update' : 'Create Product'}
              />
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
              border: '1px solid rgba(12,122,130,0.3)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
                <div>
                  <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Adjust Stock</h2>
                  <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{adjustTarget.name}</p>
                </div>
              </div>
              <button
                onClick={() => setAdjustTarget(null)}
                className="text-xl w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ color: 'var(--text-faint)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b35'; e.currentTarget.style.background = 'rgba(255,107,53,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.background = 'transparent' }}
              >
                &times;
              </button>
            </div>
            <div className="px-6 py-4">
              <GenericForm
                sections={ADJUST_FORM_SECTIONS}
                initialValues={{ txn_type: 'adjustment_in' }}
                onSubmit={handleAdjust}
                onCancel={() => setAdjustTarget(null)}
                loading={isSaving}
                submitLabel="Apply Adjustment"
              />
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {txnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
              border: '1px solid rgba(12,122,130,0.3)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Stock History — {txnTarget.name}
                </h2>
              </div>
              <button
                onClick={() => setTxnTarget(null)}
                className="text-xl w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ color: 'var(--text-faint)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b35'; e.currentTarget.style.background = 'rgba(255,107,53,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.background = 'transparent' }}
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {(txnHistory as StockTransaction[]).length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-faint)' }}>No transactions recorded.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)', color: 'var(--text-faint)' }}>
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2 text-right">Qty</th>
                      <th className="pb-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(txnHistory as StockTransaction[]).map((t) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(12,122,130,0.08)' }}>
                        <td className="py-2" style={{ color: 'var(--text-muted)' }}>{t.created_at.slice(0, 10)}</td>
                        <td className="py-2" style={{ color: 'var(--text-secondary)' }}>{TXN_LABELS[t.txn_type]}</td>
                        <td className="py-2 text-right font-medium" style={{ color: t.qty >= 0 ? '#06d6a0' : '#ff6b35' }}>
                          {t.qty >= 0 ? '+' : ''}{t.qty}
                        </td>
                        <td className="py-2 truncate max-w-[160px]" style={{ color: 'var(--text-faint)' }}>{t.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InventoryStats({ products }: { products: Product[] }) {
  const active      = products.filter((p) => p.status === 'active').length
  const outOfStock  = products.filter((p) => (p.total_stock ?? 0) <= 0).length
  const lowStockCount = products.filter((p) => { const s = p.total_stock ?? 0; return s > 0 && s <= p.reorder_level }).length
  const totalValue  = products.reduce((sum, p) => sum + (p.total_stock ?? 0) * p.purchase_price, 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Active Products', value: String(active),        color: '#00d4ff' },
        { label: 'Out of Stock',    value: String(outOfStock),    color: '#ff6b35' },
        { label: 'Low Stock',       value: String(lowStockCount), color: '#ffc107' },
        { label: 'Stock Value',     value: `₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'var(--text-primary)' },
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

function LowStockTable({ rows }: { rows: any[] }) {
  if (!rows.length) return (
    <div className="text-center py-16" style={{ color: 'var(--text-faint)' }}>All products are sufficiently stocked.</div>
  )
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.2)' }}
    >
      <table className="w-full text-sm">
        <thead style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
          <tr className="text-left text-xs uppercase" style={{ color: 'var(--text-faint)' }}>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Warehouse</th>
            <th className="px-4 py-3 text-right">Available</th>
            <th className="px-4 py-3 text-right">Reorder At</th>
            <th className="px-4 py-3 text-right">Reorder Qty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(12,122,130,0.08)' }}>
              <td className="px-4 py-3">
                <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.product_name}</div>
                {r.sku && <div className="text-xs" style={{ color: 'var(--text-faint)' }}>{r.sku}</div>}
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{r.warehouse_name}</td>
              <td className="px-4 py-3 text-right font-bold" style={{ color: r.qty_available <= 0 ? '#ff6b35' : '#ffc107' }}>
                {r.qty_available}
              </td>
              <td className="px-4 py-3 text-right" style={{ color: 'var(--text-muted)' }}>{r.reorder_level}</td>
              <td className="px-4 py-3 text-right font-medium" style={{ color: '#0e949e' }}>{r.reorder_qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WarehouseTable({ warehouses }: { warehouses: any[] }) {
  if (!warehouses.length) return (
    <div className="text-center py-16" style={{ color: 'var(--text-faint)' }}>No warehouses configured.</div>
  )
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {warehouses.map((w) => (
        <div
          key={w.id}
          className="rounded-xl p-5 space-y-2"
          style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.2)' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{w.name}</p>
              {w.code && <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>Code: {w.code}</p>}
            </div>
            <div className="flex flex-col items-end gap-1">
              {w.is_default && (
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ background: 'rgba(12,122,130,0.15)', color: '#0e949e', border: '1px solid rgba(12,122,130,0.3)' }}
                >
                  Default
                </span>
              )}
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={w.is_active
                  ? { background: 'rgba(6,214,160,0.1)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)', border: '1px solid rgba(12,122,130,0.1)' }
                }
              >
                {w.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          {w.address && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{w.address}</p>}
        </div>
      ))}
    </div>
  )
}
