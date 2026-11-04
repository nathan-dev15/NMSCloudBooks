import { ApiService } from '@/services/core/apiService'
import type {
  Product, Category, Warehouse, StockTransaction,
  ProductStatus,
} from '@/features/inventory/inventorySlice'
import type { QueryParams } from '@/services/core/apiService'

export interface ProductQueryParams extends QueryParams {
  category_id?: number
  status?: ProductStatus
  track_inventory?: boolean
}

export interface StockAdjustPayload {
  warehouse_id: number
  qty: number
  reason: string
  notes?: string
}

// ── Products ──────────────────────────────────────────────────────────────────

class ProductService extends ApiService<Product> {
  constructor() { super('/inventory/products') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  /** POST /inventory/products/:id/adjust — stock adjustment */
  adjust(id: number, payload: StockAdjustPayload) {
    return this.createRelated<StockTransaction>(id, 'adjust', payload)
  }

  /** GET /inventory/products/:id/transactions */
  transactions(id: number, params?: QueryParams) {
    return this.getRelated<StockTransaction[]>(id, 'transactions', params)
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

class CategoryService extends ApiService<Category> {
  constructor() { super('/inventory/categories') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }
}

// ── Warehouses ────────────────────────────────────────────────────────────────

class WarehouseService extends ApiService<Warehouse> {
  constructor() { super('/inventory/warehouses') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }
}

// ── Singleton exports ─────────────────────────────────────────────────────────

export const productService   = new ProductService()
export const categoryService  = new CategoryService()
export const warehouseService = new WarehouseService()

const inventoryService = { products: productService, categories: categoryService, warehouses: warehouseService }
export default inventoryService
