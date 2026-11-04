import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import { mindMapService } from '@/services/modules/mindMapService'
import type {
  CreateMindMapPayload, UpdateMindMapPayload,
  CreateNodePayload, UpdateNodePayload, CreateEdgePayload, UpdateEdgePayload, NodePosition,
} from '@/services/modules/mindMapService'
import type { MindMapSummary, MindMapDetail } from '@/types'

interface MindMapsState {
  items: MindMapSummary[]
  current: MindMapDetail | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
}

const initialState: MindMapsState = {
  items: [],
  current: null,
  isLoading: false,
  isSaving: false,
  error: null,
}

const extractError = (e: unknown): string => {
  if (e && typeof e === 'object' && 'response' in e) {
    const r = (e as { response?: { data?: { detail?: string } } }).response
    return r?.data?.detail ?? 'An error occurred'
  }
  return 'An error occurred'
}

export const fetchMindMaps = createAsyncThunk(
  'mindMaps/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const res = await mindMapService.listMindMaps()
      return res.data
    } catch (e) { return rejectWithValue(extractError(e)) }
  },
)

export const fetchMindMap = createAsyncThunk(
  'mindMaps/fetchOne',
  async (id: number, { rejectWithValue }) => {
    try {
      const res = await mindMapService.getMindMap(id)
      return res.data
    } catch (e) { return rejectWithValue(extractError(e)) }
  },
)

export const createMindMap = createAsyncThunk(
  'mindMaps/create',
  async (payload: CreateMindMapPayload, { rejectWithValue }) => {
    try {
      const res = await mindMapService.createMindMap(payload)
      return res.data
    } catch (e) { return rejectWithValue(extractError(e)) }
  },
)

export const updateMindMap = createAsyncThunk(
  'mindMaps/update',
  async ({ id, ...payload }: { id: number } & UpdateMindMapPayload, { rejectWithValue }) => {
    try {
      const res = await mindMapService.updateMindMap(id, payload)
      return res.data
    } catch (e) { return rejectWithValue(extractError(e)) }
  },
)

export const deleteMindMap = createAsyncThunk(
  'mindMaps/delete',
  async (id: number, { rejectWithValue }) => {
    try {
      await mindMapService.deleteMindMap(id)
      return id
    } catch (e) { return rejectWithValue(extractError(e)) }
  },
)

export const addNode = createAsyncThunk(
  'mindMaps/addNode',
  async ({ mindMapId, ...payload }: { mindMapId: number } & CreateNodePayload, { rejectWithValue }) => {
    try {
      const res = await mindMapService.addNode(mindMapId, payload)
      return res.data
    } catch (e) { return rejectWithValue(extractError(e)) }
  },
)

export const updateNode = createAsyncThunk(
  'mindMaps/updateNode',
  async ({ mindMapId, nodeId, ...payload }: { mindMapId: number; nodeId: number } & UpdateNodePayload, { rejectWithValue }) => {
    try {
      const res = await mindMapService.updateNode(mindMapId, nodeId, payload)
      return res.data
    } catch (e) { return rejectWithValue(extractError(e)) }
  },
)

export const deleteNode = createAsyncThunk(
  'mindMaps/deleteNode',
  async ({ mindMapId, nodeId }: { mindMapId: number; nodeId: number }, { rejectWithValue }) => {
    try {
      await mindMapService.deleteNode(mindMapId, nodeId)
      return { mindMapId, nodeId }
    } catch (e) { return rejectWithValue(extractError(e)) }
  },
)

export const addEdge = createAsyncThunk(
  'mindMaps/addEdge',
  async ({ mindMapId, ...payload }: { mindMapId: number } & CreateEdgePayload, { rejectWithValue }) => {
    try {
      const res = await mindMapService.addEdge(mindMapId, payload)
      return res.data
    } catch (e) { return rejectWithValue(extractError(e)) }
  },
)

export const updateEdge = createAsyncThunk(
  'mindMaps/updateEdge',
  async ({ mindMapId, edgeId, ...payload }: { mindMapId: number; edgeId: number } & UpdateEdgePayload, { rejectWithValue }) => {
    try {
      const res = await mindMapService.updateEdge(mindMapId, edgeId, payload)
      return res.data
    } catch (e) { return rejectWithValue(extractError(e)) }
  },
)

export const deleteEdge = createAsyncThunk(
  'mindMaps/deleteEdge',
  async ({ mindMapId, edgeId }: { mindMapId: number; edgeId: number }, { rejectWithValue }) => {
    try {
      await mindMapService.deleteEdge(mindMapId, edgeId)
      return { mindMapId, edgeId }
    } catch (e) { return rejectWithValue(extractError(e)) }
  },
)

export const saveLayout = createAsyncThunk(
  'mindMaps/saveLayout',
  async ({ mindMapId, positions }: { mindMapId: number; positions: NodePosition[] }, { rejectWithValue }) => {
    try {
      const res = await mindMapService.saveLayout(mindMapId, positions)
      return res.data
    } catch (e) { return rejectWithValue(extractError(e)) }
  },
)

const mindMapsSlice = createSlice({
  name: 'mindMaps',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null },
    clearCurrent: (state) => { state.current = null },
    setCurrent: (state, action: PayloadAction<MindMapDetail>) => { state.current = action.payload },
  },
  extraReducers: (builder) => {
    builder
      // List
      .addCase(fetchMindMaps.pending, (s) => { s.isLoading = true; s.error = null })
      .addCase(fetchMindMaps.fulfilled, (s, { payload }) => { s.isLoading = false; s.items = payload })
      .addCase(fetchMindMaps.rejected, (s, { payload }) => { s.isLoading = false; s.error = payload as string })
      // Fetch one
      .addCase(fetchMindMap.pending, (s) => { s.isLoading = true; s.error = null })
      .addCase(fetchMindMap.fulfilled, (s, { payload }) => { s.isLoading = false; s.current = payload })
      .addCase(fetchMindMap.rejected, (s, { payload }) => { s.isLoading = false; s.error = payload as string })
      // Create
      .addCase(createMindMap.fulfilled, (s, { payload }) => {
        s.items.unshift({ id: payload.id, title: payload.title, description: payload.description, created_at: payload.created_at, updated_at: payload.updated_at, node_count: payload.nodes.length })
      })
      .addCase(createMindMap.rejected, (s, { payload }) => { s.error = payload as string })
      // Update
      .addCase(updateMindMap.fulfilled, (s, { payload }) => {
        s.current = payload
        const idx = s.items.findIndex((m) => m.id === payload.id)
        if (idx !== -1) { s.items[idx].title = payload.title; s.items[idx].description = payload.description }
      })
      // Delete
      .addCase(deleteMindMap.fulfilled, (s, { payload }) => {
        s.items = s.items.filter((m) => m.id !== payload)
        if (s.current?.id === payload) s.current = null
      })
      // Node ops — refetch full map
      .addCase(addNode.pending, (s) => { s.isSaving = true })
      .addCase(addNode.fulfilled, (s) => { s.isSaving = false })
      .addCase(addNode.rejected, (s, { payload }) => { s.isSaving = false; s.error = payload as string })
      .addCase(deleteNode.fulfilled, (s) => { s.isSaving = false })
      // Layout
      .addCase(saveLayout.pending, (s) => { s.isSaving = true })
      .addCase(saveLayout.fulfilled, (s, { payload }) => { s.isSaving = false; s.current = payload })
      .addCase(saveLayout.rejected, (s, { payload }) => { s.isSaving = false; s.error = payload as string })
  },
})

export const { clearError, clearCurrent, setCurrent } = mindMapsSlice.actions
export default mindMapsSlice.reducer
