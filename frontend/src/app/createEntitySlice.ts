/**
 * createEntitySlice — SOW §6.4.9
 * Factory that generates a standardised Redux slice for any entity type.
 * Eliminates boilerplate: every entity (users, projects, invoices…) gets
 * identical loading/error/pagination/selection patterns for free.
 *
 * Usage:
 *   const invoicesSlice = createEntitySlice<Invoice>('invoices', '/invoices')
 *   export const { fetchAll, create, update, delete: del, selectors } = invoicesSlice
 */

import {
  createSlice,
  createAsyncThunk,
  createSelector,
  type PayloadAction,
  type Draft,
} from '@reduxjs/toolkit'
import apiHandler from '@/services/apiHandler'

export interface EntityState<T> {
  items: T[]
  selectedItem: T | null
  total: number
  page: number
  pageSize: number
  pages: number

  isLoading: boolean
  isSaving: boolean
  isDeleting: boolean
  error: string | null

  selectedIds: (string | number)[]
  filters: Record<string, unknown>
  sortKey: string
  sortDir: 'asc' | 'desc' | null
}

export interface PaginatedApiResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

function initialState<T>(): EntityState<T> {
  return {
    items: [],
    selectedItem: null,
    total: 0,
    page: 1,
    pageSize: 20,
    pages: 0,
    isLoading: false,
    isSaving: false,
    isDeleting: false,
    error: null,
    selectedIds: [],
    filters: {},
    sortKey: '',
    sortDir: null,
  }
}

export function createEntitySlice<T extends { id: string | number }>(
  name: string,
  basePath: string,
  options?: {
    idKey?: keyof T
    transformResponse?: (data: unknown) => T
  }
) {
  const idKey = (options?.idKey ?? 'id') as keyof T
  const getId = (entity: T | Draft<T>) => (entity as T)[idKey]

  // ── Thunks ────────────────────────────────────────────────────────────────

  const fetchAll = createAsyncThunk(
    `${name}/fetchAll`,
    async (params: Record<string, unknown> = {}, { rejectWithValue }) => {
      try {
        const res = await apiHandler.get<PaginatedApiResponse<T>>(basePath, { params })
        return res.data
      } catch (e) {
        return rejectWithValue(apiHandler.extractError(e))
      }
    }
  )

  const fetchById = createAsyncThunk(
    `${name}/fetchById`,
    async (id: string | number, { rejectWithValue }) => {
      try {
        const res = await apiHandler.get<T>(`${basePath}/${id}`)
        return res.data
      } catch (e) {
        return rejectWithValue(apiHandler.extractError(e))
      }
    }
  )

  const create = createAsyncThunk(
    `${name}/create`,
    async (payload: Record<string, unknown>, { rejectWithValue }) => {
      try {
        const res = await apiHandler.post<T>(basePath, payload)
        return res.data
      } catch (e) {
        return rejectWithValue(apiHandler.extractError(e))
      }
    }
  )

  const update = createAsyncThunk(
    `${name}/update`,
    async ({ id, ...payload }: { id: string | number } & Record<string, unknown>, { rejectWithValue }) => {
      try {
        const res = await apiHandler.patch<T>(`${basePath}/${id}`, payload)
        return res.data
      } catch (e) {
        return rejectWithValue(apiHandler.extractError(e))
      }
    }
  )

  const remove = createAsyncThunk(
    `${name}/delete`,
    async (id: string | number, { rejectWithValue }) => {
      try {
        await apiHandler.delete(`${basePath}/${id}`)
        return id
      } catch (e) {
        return rejectWithValue(apiHandler.extractError(e))
      }
    }
  )

  // ── Slice ─────────────────────────────────────────────────────────────────

  const slice = createSlice({
    name,
    initialState: initialState<T>(),
    reducers: {
      clearError(state) { state.error = null },
      setSelectedItem(state, action: PayloadAction<T | null>) {
        ;(state as EntityState<T>).selectedItem = action.payload
      },
      setSelectedIds(state, action: PayloadAction<(string | number)[]>) {
        state.selectedIds = action.payload
      },
      toggleSelected(state, action: PayloadAction<string | number>) {
        const id = action.payload
        const idx = state.selectedIds.indexOf(id)
        idx === -1 ? state.selectedIds.push(id) : state.selectedIds.splice(idx, 1)
      },
      clearSelection(state) { state.selectedIds = [] },
      setFilters(state, action: PayloadAction<Record<string, unknown>>) {
        state.filters = action.payload
        state.page = 1
      },
      setSort(state, action: PayloadAction<{ key: string; dir: 'asc' | 'desc' | null }>) {
        state.sortKey = action.payload.key
        state.sortDir = action.payload.dir
        state.page = 1
      },
      setPage(state, action: PayloadAction<number>) { state.page = action.payload },
      setPageSize(state, action: PayloadAction<number>) { state.pageSize = action.payload; state.page = 1 },
    },
    extraReducers: (builder) => {
      // fetchAll
      builder
        .addCase(fetchAll.pending, (state) => { state.isLoading = true; state.error = null })
        .addCase(fetchAll.fulfilled, (state, { payload }) => {
          state.isLoading = false
          ;(state as EntityState<T>).items = payload.items
          state.total = payload.total
          state.page = payload.page
          state.pages = payload.pages
        })
        .addCase(fetchAll.rejected, (state, { payload }) => {
          state.isLoading = false; state.error = payload as string
        })

      // fetchById
        .addCase(fetchById.pending, (state) => { state.isLoading = true; state.error = null })
        .addCase(fetchById.fulfilled, (state, { payload }) => {
          state.isLoading = false
          ;(state as EntityState<T>).selectedItem = payload
          const idx = state.items.findIndex((i) => getId(i) === getId(payload))
          if (idx !== -1) (state as EntityState<T>).items[idx] = payload
        })
        .addCase(fetchById.rejected, (state, { payload }) => {
          state.isLoading = false; state.error = payload as string
        })

      // create
        .addCase(create.pending, (state) => { state.isSaving = true; state.error = null })
        .addCase(create.fulfilled, (state, { payload }) => {
          state.isSaving = false
          state.items.unshift(payload as Draft<T>)
          state.total += 1
        })
        .addCase(create.rejected, (state, { payload }) => {
          state.isSaving = false; state.error = payload as string
        })

      // update
        .addCase(update.pending, (state) => { state.isSaving = true; state.error = null })
        .addCase(update.fulfilled, (state, { payload }) => {
          state.isSaving = false
          const idx = state.items.findIndex((i) => getId(i) === getId(payload))
          if (idx !== -1) (state as EntityState<T>).items[idx] = payload
          if (state.selectedItem && getId(state.selectedItem) === getId(payload)) {
            ;(state as EntityState<T>).selectedItem = payload
          }
        })
        .addCase(update.rejected, (state, { payload }) => {
          state.isSaving = false; state.error = payload as string
        })

      // delete
        .addCase(remove.pending, (state) => { state.isDeleting = true; state.error = null })
        .addCase(remove.fulfilled, (state, { payload }) => {
          state.isDeleting = false
          ;(state as EntityState<T>).items = state.items.filter((i) => getId(i) !== payload) as T[]
          state.total -= 1
          state.selectedIds = state.selectedIds.filter((id) => id !== payload)
        })
        .addCase(remove.rejected, (state, { payload }) => {
          state.isDeleting = false; state.error = payload as string
        })
    },
  })

  // ── Selectors ─────────────────────────────────────────────────────────────

  type RootWithSlice = { [K in typeof name]: EntityState<T> }

  const selectSlice = (root: RootWithSlice) => root[name]
  const selectItems     = createSelector(selectSlice, (s) => s.items)
  const selectTotal     = createSelector(selectSlice, (s) => s.total)
  const selectLoading   = createSelector(selectSlice, (s) => s.isLoading)
  const selectSaving    = createSelector(selectSlice, (s) => s.isSaving)
  const selectError     = createSelector(selectSlice, (s) => s.error)
  const selectSelected  = createSelector(selectSlice, (s) => s.selectedItem)
  const selectSelectedIds = createSelector(selectSlice, (s) => s.selectedIds)
  const selectPagination = createSelector(selectSlice, (s) => ({
    page: s.page, pageSize: s.pageSize, total: s.total, pages: s.pages,
  }))

  return {
    slice,
    reducer: slice.reducer,
    actions: slice.actions,
    thunks: { fetchAll, fetchById, create, update, delete: remove },
    selectors: {
      selectSlice, selectItems, selectTotal, selectLoading, selectSaving,
      selectError, selectSelected, selectSelectedIds, selectPagination,
    },
  }
}
