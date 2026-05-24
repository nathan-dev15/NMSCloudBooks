import { createEntitySlice } from '@/app/createEntitySlice'
import apiHandler from '@/services/apiHandler'
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

export type ProductStatus = 'active' | 'inactive' | 'discontinued'
export type ProductType   = 'goods' | 'service' | 'digital'
export type StockTxnType  =
  | 'purchase_receipt' | 'sale_issue'
  | 'adjustment_in'   | 'adjustment_out'
  | 'transfer_in'     | 'transfer_out'
  | 'return_in'       | 'opening_stock'

export interface InventoryLevel {
  id:            number
  product_id:    number
  warehouse_id:  number
  qty_on_hand:   number
  qty_reserved:  number
  qty_available: number
}

export interface Product {
  id:              number
  tenant_id:       number
  category_id:     number | null
  name:            string
  sku:             string | null
  barcode:         string | null
  hsn_sac:         string | null
  description:     string | null
  product_type:    ProductType
  status:          ProductStatus
  unit:            string
  purchase_price:  number
  selling_price:   number
  mrp:             number
  tax_rate:        number
  reorder_level:   number
  reorder_qty:     number
  max_stock_level: number
  track_inventory: boolean
  allow_negative:  boolean
  brand:           string | null
  tags:            string[]
  attributes:      Record<string, unknown>
  stock_levels:    InventoryLevel[]
  total_stock?:    number
}

export interface Category {
  id:          number
  tenant_id:   number
  parent_id:   number | null
  name:        string
  slug:        string
  description: string | null
  is_active:   boolean
}

export interface Warehouse {
  id:         number
  tenant_id:  number
  name:       string
  code:       string | null
  address:    string | null
  is_active:  boolean
  is_default: boolean
  manager_id: number | null
}

export interface StockTransaction {
  id:             number
  product_id:     number
  warehouse_id:   number
  created_by_id:  number | null
  txn_type:       StockTxnType
  qty:            number
  unit_cost:      number
  ref_type:       string | null
  ref_id:         number | null
  notes:          string | null
  batch_no:       string | null
  expiry_date:    string | null
  created_at:     string
}

// ── Product entity slice ──────────────────────────────────────────────────────

const entity = createEntitySlice<Product>('inventory', '/inventory/products')

export const {
  slice:     inventorySlice,
  reducer:   inventoryReducer,
  thunks:    inventoryThunks,
  selectors: inventorySelectors,
} = entity

// ── Auxiliary state for categories, warehouses, low-stock ─────────────────────

interface InventoryAuxState {
  categories:  Category[]
  warehouses:  Warehouse[]
  lowStock:    any[]
  txnHistory:  StockTransaction[]
  auxLoading:  boolean
}

const auxInitial: InventoryAuxState = {
  categories: [],
  warehouses: [],
  lowStock:   [],
  txnHistory: [],
  auxLoading: false,
}

export const fetchCategories = createAsyncThunk('inventoryAux/fetchCategories', async () => {
  const res = await apiHandler.get<Category[]>('/inventory/categories')
  return res.data!
})

export const fetchWarehouses = createAsyncThunk('inventoryAux/fetchWarehouses', async () => {
  const res = await apiHandler.get<Warehouse[]>('/inventory/warehouses')
  return res.data!
})

export const fetchLowStock = createAsyncThunk('inventoryAux/fetchLowStock', async () => {
  const res = await apiHandler.get<any[]>('/inventory/reports/low-stock')
  return res.data!
})

export const adjustStock = createAsyncThunk(
  'inventoryAux/adjustStock',
  async ({
    productId,
    data,
  }: {
    productId: number
    data: {
      warehouse_id: number
      txn_type: StockTxnType
      qty: number
      unit_cost?: number
      notes?: string
      batch_no?: string
    }
  }) => {
    const res = await apiHandler.post<{ transaction_id: number; qty_on_hand: number; qty_available: number }>(
      `/inventory/products/${productId}/stock/adjust`,
      data,
    )
    return res.data!
  }
)

export const fetchTxnHistory = createAsyncThunk(
  'inventoryAux/fetchTxnHistory',
  async ({ productId, page = 1 }: { productId: number; page?: number }) => {
    const res = await apiHandler.get<{ items: StockTransaction[]; total: number; page: number; size: number }>(
      `/inventory/products/${productId}/stock/transactions`,
      { params: { page } },
    )
    return res.data!
  }
)

const inventoryAuxSlice = createSlice({
  name: 'inventoryAux',
  initialState: auxInitial,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchCategories.pending,   (s)    => { s.auxLoading = true })
    b.addCase(fetchCategories.fulfilled, (s, a) => { s.categories = a.payload; s.auxLoading = false })
    b.addCase(fetchCategories.rejected,  (s)    => { s.auxLoading = false })
    b.addCase(fetchWarehouses.fulfilled, (s, a) => { s.warehouses = a.payload })
    b.addCase(fetchLowStock.fulfilled,   (s, a) => { s.lowStock   = a.payload })
    b.addCase(fetchTxnHistory.fulfilled, (s, a) => { s.txnHistory = a.payload.items })
  },
})

export const inventoryAuxReducer = inventoryAuxSlice.reducer
export const inventoryAuxSelectors = {
  categories: (state: any) => state.inventoryAux.categories as Category[],
  warehouses:  (state: any) => state.inventoryAux.warehouses as Warehouse[],
  lowStock:    (state: any) => state.inventoryAux.lowStock   as any[],
  txnHistory:  (state: any) => state.inventoryAux.txnHistory as StockTransaction[],
}

export default inventorySlice.reducer
