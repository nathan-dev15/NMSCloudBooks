import mindMapsReducer, {
  clearError,
  clearCurrent,
  setCurrent,
  fetchMindMaps,
  fetchMindMap,
  createMindMap,
  updateMindMap,
  deleteMindMap,
  addNode,
  saveLayout,
} from '../mindMapsSlice'
import type { MindMapSummary, MindMapDetail } from '@/types'

const mockSummary: MindMapSummary = {
  id: 1,
  title: 'Test Map',
  description: 'A test mind map',
  created_at: '2026-10-28T12:00:00Z',
  updated_at: '2026-10-28T12:00:00Z',
  node_count: 1,
}

const mockDetail: MindMapDetail = {
  id: 1,
  user_id: null,
  tenant_id: null,
  title: 'Test Map',
  description: 'A test mind map',
  created_at: '2026-10-28T12:00:00Z',
  updated_at: '2026-10-28T12:00:00Z',
  nodes: [
    {
      id: 10,
      mind_map_id: 1,
      parent_node_id: null,
      title: 'Root Node',
      description: null,
      position_x: 0,
      position_y: 0,
      color: '#0c7a82',
      style_data: null,
      is_collapsed: false,
      sort_order: 0,
    },
  ],
  edges: [],
}

const initialState = {
  items: [] as MindMapSummary[],
  current: null as MindMapDetail | null,
  isLoading: false,
  isSaving: false,
  error: null as string | null,
}

describe('mindMapsSlice reducer', () => {
  it('returns initial state', () => {
    expect(mindMapsReducer(undefined, { type: '@@INIT' })).toEqual(initialState)
  })

  it('clearError resets error', () => {
    const state = { ...initialState, error: 'Some error' }
    expect(mindMapsReducer(state, clearError()).error).toBeNull()
  })

  it('clearCurrent nulls current', () => {
    const state = { ...initialState, current: mockDetail }
    expect(mindMapsReducer(state, clearCurrent()).current).toBeNull()
  })

  it('setCurrent sets current mind map', () => {
    const result = mindMapsReducer(initialState, setCurrent(mockDetail))
    expect(result.current).toEqual(mockDetail)
  })
})

describe('fetchMindMaps', () => {
  it('pending sets isLoading and clears error', () => {
    const state = { ...initialState, error: 'old' }
    const result = mindMapsReducer(state, { type: fetchMindMaps.pending.type })
    expect(result.isLoading).toBe(true)
    expect(result.error).toBeNull()
  })

  it('fulfilled sets items and clears isLoading', () => {
    const state = { ...initialState, isLoading: true }
    const result = mindMapsReducer(state, {
      type: fetchMindMaps.fulfilled.type,
      payload: [mockSummary],
    })
    expect(result.isLoading).toBe(false)
    expect(result.items).toEqual([mockSummary])
  })

  it('rejected sets error and clears isLoading', () => {
    const state = { ...initialState, isLoading: true }
    const result = mindMapsReducer(state, {
      type: fetchMindMaps.rejected.type,
      payload: 'Network error',
    })
    expect(result.isLoading).toBe(false)
    expect(result.error).toBe('Network error')
  })
})

describe('fetchMindMap', () => {
  it('pending sets isLoading', () => {
    const result = mindMapsReducer(initialState, { type: fetchMindMap.pending.type })
    expect(result.isLoading).toBe(true)
  })

  it('fulfilled sets current', () => {
    const state = { ...initialState, isLoading: true }
    const result = mindMapsReducer(state, {
      type: fetchMindMap.fulfilled.type,
      payload: mockDetail,
    })
    expect(result.isLoading).toBe(false)
    expect(result.current).toEqual(mockDetail)
  })

  it('rejected sets error', () => {
    const state = { ...initialState, isLoading: true }
    const result = mindMapsReducer(state, {
      type: fetchMindMap.rejected.type,
      payload: 'Not found',
    })
    expect(result.isLoading).toBe(false)
    expect(result.error).toBe('Not found')
  })
})

describe('createMindMap', () => {
  it('fulfilled prepends to items', () => {
    const state = { ...initialState, items: [mockSummary] }
    const newDetail: MindMapDetail = { ...mockDetail, id: 2, title: 'New Map' }
    const result = mindMapsReducer(state, {
      type: createMindMap.fulfilled.type,
      payload: newDetail,
    })
    expect(result.items.length).toBe(2)
    expect(result.items[0].id).toBe(2)
    expect(result.items[0].title).toBe('New Map')
    expect(result.items[0].node_count).toBe(1)
  })

  it('rejected sets error', () => {
    const result = mindMapsReducer(initialState, {
      type: createMindMap.rejected.type,
      payload: 'Title required',
    })
    expect(result.error).toBe('Title required')
  })
})

describe('updateMindMap', () => {
  it('fulfilled updates current and items', () => {
    const state = {
      ...initialState,
      current: mockDetail,
      items: [mockSummary],
    }
    const updated = { ...mockDetail, title: 'Updated Title', description: 'New desc' }
    const result = mindMapsReducer(state, {
      type: updateMindMap.fulfilled.type,
      payload: updated,
    })
    expect(result.current?.title).toBe('Updated Title')
    expect(result.items[0].title).toBe('Updated Title')
    expect(result.items[0].description).toBe('New desc')
  })
})

describe('deleteMindMap', () => {
  it('fulfilled removes from items', () => {
    const state = {
      ...initialState,
      items: [mockSummary, { ...mockSummary, id: 2, title: 'Other' }],
      current: mockDetail,
    }
    const result = mindMapsReducer(state, {
      type: deleteMindMap.fulfilled.type,
      payload: 1,
    })
    expect(result.items.length).toBe(1)
    expect(result.items[0].id).toBe(2)
    expect(result.current).toBeNull()
  })

  it('does not null current if different id', () => {
    const state = {
      ...initialState,
      items: [mockSummary],
      current: { ...mockDetail, id: 99 },
    }
    const result = mindMapsReducer(state, {
      type: deleteMindMap.fulfilled.type,
      payload: 1,
    })
    expect(result.current?.id).toBe(99)
  })
})

describe('addNode', () => {
  it('pending sets isSaving', () => {
    const result = mindMapsReducer(initialState, { type: addNode.pending.type })
    expect(result.isSaving).toBe(true)
  })

  it('fulfilled clears isSaving', () => {
    const state = { ...initialState, isSaving: true }
    const result = mindMapsReducer(state, { type: addNode.fulfilled.type })
    expect(result.isSaving).toBe(false)
  })

  it('rejected sets error and clears isSaving', () => {
    const state = { ...initialState, isSaving: true }
    const result = mindMapsReducer(state, {
      type: addNode.rejected.type,
      payload: 'Invalid parent',
    })
    expect(result.isSaving).toBe(false)
    expect(result.error).toBe('Invalid parent')
  })
})

describe('saveLayout', () => {
  it('pending sets isSaving', () => {
    const result = mindMapsReducer(initialState, { type: saveLayout.pending.type })
    expect(result.isSaving).toBe(true)
  })

  it('fulfilled updates current and clears isSaving', () => {
    const state = { ...initialState, isSaving: true, current: mockDetail }
    const updated = {
      ...mockDetail,
      nodes: [{ ...mockDetail.nodes[0], position_x: 300, position_y: 400 }],
    }
    const result = mindMapsReducer(state, {
      type: saveLayout.fulfilled.type,
      payload: updated,
    })
    expect(result.isSaving).toBe(false)
    expect(result.current?.nodes[0].position_x).toBe(300)
  })

  it('rejected sets error', () => {
    const state = { ...initialState, isSaving: true }
    const result = mindMapsReducer(state, {
      type: saveLayout.rejected.type,
      payload: 'Server error',
    })
    expect(result.isSaving).toBe(false)
    expect(result.error).toBe('Server error')
  })
})
