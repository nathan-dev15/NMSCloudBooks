import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeChange,
  type EdgeChange,
  type Connection,
  ReactFlowProvider,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
} from '@xyflow/react'
import Dagre from '@dagrejs/dagre'
import '@xyflow/react/dist/style.css'

import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchMindMap, addNode, updateNode, deleteNode,
  addEdge as addEdgeAction, updateEdge as updateEdgeAction, deleteEdge, saveLayout,
} from '@/features/mindMaps/mindMapsSlice'
import { useDebouncedCallback } from '@/hooks/useDebounce'
import type { MindMapDetail, MindMapNode as ApiNode, MindMapEdge as ApiEdge } from '@/types'

import MindMapNodeComponent from './MindMapNode'
import MindMapToolbar, { type CanvasBg } from './MindMapToolbar'
import NodeEditor from './NodeEditor'
import ContextMenu from './ContextMenu'
import ConfirmDialog from './ConfirmDialog'
import ShortcutsPanel from './ShortcutsPanel'
import Toast from './Toast'

const nodeTypes = { mindMapNode: MindMapNodeComponent }

function getDescendantIds(nodeId: number, allNodes: ApiNode[]): Set<number> {
  const descendants = new Set<number>()
  const queue = [nodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    const children = allNodes.filter((n) => n.parent_node_id === current)
    for (const child of children) {
      descendants.add(child.id)
      queue.push(child.id)
    }
  }
  return descendants
}

function getCollapsedNodeIds(allNodes: ApiNode[]): Set<number> {
  const hidden = new Set<number>()
  const collapsedNodes = allNodes.filter((n) => n.is_collapsed)
  for (const cn of collapsedNodes) {
    const desc = getDescendantIds(cn.id, allNodes)
    desc.forEach((id) => hidden.add(id))
  }
  return hidden
}

function getChildIds(allNodes: ApiNode[]): Map<number, boolean> {
  const parentMap = new Map<number, boolean>()
  for (const n of allNodes) {
    if (n.parent_node_id != null) {
      parentMap.set(n.parent_node_id, true)
    }
  }
  return parentMap
}

function toFlowNodes(
  nodes: ApiNode[],
  hiddenIds: Set<number>,
  hasChildrenMap: Map<number, boolean>,
  onLabelChange: (id: string, label: string) => void,
  onToggleCollapse: (id: string) => void,
): Node[] {
  return nodes
    .filter((n) => !hiddenIds.has(n.id))
    .map((n) => ({
      id: String(n.id),
      type: 'mindMapNode',
      position: { x: n.position_x, y: n.position_y },
      data: {
        label: n.title,
        description: n.description,
        color: n.color,
        isCollapsed: n.is_collapsed,
        hasChildren: hasChildrenMap.has(n.id),
        style_data: n.style_data,
        onLabelChange,
        onToggleCollapse,
      },
    }))
}

function toFlowEdges(edges: ApiEdge[], hiddenIds: Set<number>): Edge[] {
  return edges
    .filter((e) => !hiddenIds.has(e.source_node_id) && !hiddenIds.has(e.target_node_id))
    .map((e) => {
      const styleData = (e.style_data || {}) as Record<string, unknown>
      const edgeLabel = styleData.label as string | undefined
      return {
        id: String(e.id),
        source: String(e.source_node_id),
        target: String(e.target_node_id),
        type: 'smoothstep',
        animated: false,
        style: { stroke: 'var(--accent, #5eead4)', strokeWidth: 2 },
        label: edgeLabel || undefined,
        labelStyle: edgeLabel ? { fill: 'var(--text-2, #ccc)', fontSize: '11px', fontWeight: 500 } : undefined,
        labelBgStyle: edgeLabel ? { fill: 'var(--bg-card, #16161a)', fillOpacity: 0.85 } : undefined,
        labelBgPadding: edgeLabel ? [6, 4] as [number, number] : undefined,
        labelBgBorderRadius: edgeLabel ? 6 : undefined,
      }
    })
}

interface HistoryEntry {
  nodes: Node[]
  edges: Edge[]
}

interface ContextMenuState {
  x: number
  y: number
  nodeId?: string
}

interface MindMapCanvasInnerProps {
  mindMapId: number
  onBack: () => void
}

function MindMapCanvasInner({ mindMapId, onBack }: MindMapCanvasInnerProps) {
  const dispatch = useAppDispatch()
  const { current, isSaving } = useAppSelector((s) => s.mindMaps)
  const { getNodes, screenToFlowPosition, fitView } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [confirmDeleteEdge, setConfirmDeleteEdge] = useState<string | null>(null)

  // Edge label editing
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null)
  const [editingEdgeLabel, setEditingEdgeLabel] = useState('')

  // UI state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showHint, setShowHint] = useState(true)
  const [canvasBg, setCanvasBg] = useState<CanvasBg>('dark')
  const [showMinimap, setShowMinimap] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Undo/redo
  const historyRef = useRef<HistoryEntry[]>([])
  const historyIdxRef = useRef(-1)
  const skipHistoryRef = useRef(false)

  const pushHistory = useCallback(() => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return }
    const entry = { nodes: getNodes(), edges: [...edges] }
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1)
    historyRef.current.push(entry)
    historyIdxRef.current = historyRef.current.length - 1
  }, [getNodes, edges])

  const canUndo = historyIdxRef.current > 0
  const canRedo = historyIdxRef.current < historyRef.current.length - 1

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return
    historyIdxRef.current--
    const entry = historyRef.current[historyIdxRef.current]
    skipHistoryRef.current = true
    setNodes(entry.nodes)
    setEdges(entry.edges)
    showToast('Undone', 'info')
  }, [setNodes, setEdges])

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return
    historyIdxRef.current++
    const entry = historyRef.current[historyIdxRef.current]
    skipHistoryRef.current = true
    setNodes(entry.nodes)
    setEdges(entry.edges)
    showToast('Redone', 'info')
  }, [setNodes, setEdges])

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        const el = document.querySelector('[data-mind-map-search]') as HTMLInputElement
        el?.focus()
        return
      }
      if (e.key === 'Escape') {
        if (editingEdgeId) { setEditingEdgeId(null); return }
        if (searchQuery) { setSearchQuery(''); return }
      }

      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        debouncedSaveLayout()
        showToast('Layout saved', 'success')
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeId) {
          e.preventDefault()
          setConfirmDeleteEdge(selectedEdgeId)
        } else if (selectedNodeId) {
          e.preventDefault()
          setConfirmDelete(selectedNodeId)
        }
      }
      if (e.key === '?') {
        e.preventDefault()
        setShowShortcuts((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [undo, redo, selectedNodeId, selectedEdgeId, editingEdgeId, searchQuery, showToast])

  // Load mind map
  useEffect(() => {
    dispatch(fetchMindMap(mindMapId))
  }, [dispatch, mindMapId])

  // Dismiss hint after first node is added
  useEffect(() => {
    if (current && current.nodes.length > 1) setShowHint(false)
  }, [current])

  // Handle label changes from the node component
  const handleLabelChange = useCallback((id: string, label: string) => {
    dispatch(updateNode({ mindMapId, nodeId: Number(id), title: label }))
    showToast('Node renamed', 'success')
  }, [dispatch, mindMapId, showToast])

  // Handle collapse/expand toggle
  const handleToggleCollapse = useCallback((id: string) => {
    if (!current) return
    const node = current.nodes.find((n) => n.id === Number(id))
    if (!node) return
    dispatch(updateNode({ mindMapId, nodeId: Number(id), is_collapsed: !node.is_collapsed }))
      .then(() => dispatch(fetchMindMap(mindMapId)))
    showToast(node.is_collapsed ? 'Branch expanded' : 'Branch collapsed', 'info')
  }, [current, dispatch, mindMapId, showToast])

  // Sync from API state to React Flow state
  useEffect(() => {
    if (!current) return
    const hiddenIds = getCollapsedNodeIds(current.nodes)
    const hasChildrenMap = getChildIds(current.nodes)
    const flowNodes = toFlowNodes(current.nodes, hiddenIds, hasChildrenMap, handleLabelChange, handleToggleCollapse)
    const flowEdges = toFlowEdges(current.edges, hiddenIds)
    setNodes(flowNodes)
    setEdges(flowEdges)
    if (historyRef.current.length === 0) {
      historyRef.current = [{ nodes: flowNodes, edges: flowEdges }]
      historyIdxRef.current = 0
    }
  }, [current, setNodes, setEdges, handleLabelChange, handleToggleCollapse])

  // Auto-save layout on drag end (debounced)
  const debouncedSaveLayout = useDebouncedCallback(() => {
    if (!current) return
    const positions = getNodes().map((n) => ({
      id: Number(n.id),
      position_x: n.position.x,
      position_y: n.position.y,
    }))
    dispatch(saveLayout({ mindMapId, positions }))
  }, 800)

  const handleNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    const hasDrag = changes.some((c) => c.type === 'position' && c.dragging === false)
    if (hasDrag) {
      pushHistory()
      debouncedSaveLayout()
    }
    const selectChange = changes.find((c): c is NodeChange & { type: 'select'; id: string; selected: boolean } => c.type === 'select' && 'selected' in c && c.selected === true)
    if (selectChange) {
      setSelectedNodeId(selectChange.id)
      if (selectedEdgeId) {
        setSelectedEdgeId(null)
        setEdges((eds) => eds.map((e) => ({
          ...e,
          style: { stroke: 'var(--accent, #5eead4)', strokeWidth: 2 },
          animated: false,
        })))
      }
    }
    const deselectAll = changes.every((c) => c.type !== 'select' || ('selected' in c && !c.selected))
    if (changes.some((c) => c.type === 'select') && deselectAll) setSelectedNodeId(null)
  }, [onNodesChange, pushHistory, debouncedSaveLayout])

  const handleEdgesChange: OnEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes)
  }, [onEdgesChange])

  // Connect nodes
  const onConnect: OnConnect = useCallback((connection: Connection) => {
    if (!current || !connection.source || !connection.target) return
    setEdges((eds) => addEdge({ ...connection, type: 'smoothstep', style: { stroke: 'var(--accent, #5eead4)', strokeWidth: 2 } }, eds))
    dispatch(addEdgeAction({
      mindMapId,
      source_node_id: Number(connection.source),
      target_node_id: Number(connection.target),
    })).then(() => dispatch(fetchMindMap(mindMapId)))
    pushHistory()
    showToast('Nodes connected', 'success')
  }, [current, mindMapId, dispatch, setEdges, pushHistory, showToast])

  // Add node — smart placement near selected node or at given position
  const handleAddNode = useCallback((posX?: number, posY?: number) => {
    if (!current) return
    let x = posX ?? 0
    let y = posY ?? 0
    let parentNodeId: number | undefined
    let parentColor: string | undefined

    if (posX === undefined) {
      if (selectedNodeId) {
        const sel = getNodes().find((n) => n.id === selectedNodeId)
        if (sel) {
          x = sel.position.x + 180
          y = sel.position.y + 60
          parentNodeId = Number(selectedNodeId)
          parentColor = (sel.data as Record<string, unknown>)?.color as string | undefined
        }
      } else {
        x = Math.random() * 300 - 150
        y = Math.random() * 300 - 150
      }
    }

    dispatch(addNode({
      mindMapId,
      title: 'New Node',
      position_x: x,
      position_y: y,
      ...(parentNodeId ? { parent_node_id: parentNodeId } : {}),
      ...(parentColor ? { color: parentColor } : {}),
    })).then(() => {
      dispatch(fetchMindMap(mindMapId))
      showToast('Node added', 'success')
    })
  }, [current, mindMapId, dispatch, selectedNodeId, getNodes, showToast])

  // Double-click on canvas to add a node at that position
  const handlePaneDoubleClick = useCallback((event: React.MouseEvent) => {
    const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    handleAddNode(pos.x, pos.y)
  }, [screenToFlowPosition, handleAddNode])

  // Right-click context menu on node
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
  }, [])

  // Right-click on canvas
  const handlePaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY })
  }, [])

  // Delete selected node (via confirm dialog)
  const executeDeleteNode = useCallback(() => {
    if (!confirmDelete || !current) return
    dispatch(deleteNode({ mindMapId, nodeId: Number(confirmDelete) }))
      .then(() => {
        dispatch(fetchMindMap(mindMapId))
        showToast('Node deleted', 'success')
      })
    setSelectedNodeId(null)
    setConfirmDelete(null)
    pushHistory()
  }, [confirmDelete, current, mindMapId, dispatch, pushHistory, showToast])

  // Edge click — select edge
  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null)
    setEdges((eds) => eds.map((e) => ({
      ...e,
      style: e.id === edge.id
        ? { stroke: '#ef4444', strokeWidth: 3 }
        : { stroke: 'var(--accent, #5eead4)', strokeWidth: 2 },
      animated: e.id === edge.id,
    })))
  }, [setEdges])

  // Edge double-click — edit label
  const handleEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setEditingEdgeId(edge.id)
    setEditingEdgeLabel((edge.label as string) || '')
  }, [])

  // Save edge label
  const saveEdgeLabel = useCallback(() => {
    if (!editingEdgeId || !current) return
    const label = editingEdgeLabel.trim()
    dispatch(updateEdgeAction({
      mindMapId,
      edgeId: Number(editingEdgeId),
      style_data: { label: label || null },
    })).then(() => dispatch(fetchMindMap(mindMapId)))
    setEditingEdgeId(null)
    showToast(label ? 'Edge label updated' : 'Edge label removed', 'success')
  }, [editingEdgeId, editingEdgeLabel, current, mindMapId, dispatch, showToast])

  // Delete selected edge (via confirm dialog)
  const executeDeleteEdge = useCallback(() => {
    if (!confirmDeleteEdge || !current) return
    dispatch(deleteEdge({ mindMapId, edgeId: Number(confirmDeleteEdge) }))
      .then(() => {
        dispatch(fetchMindMap(mindMapId))
        showToast('Connection deleted', 'success')
      })
    setSelectedEdgeId(null)
    setConfirmDeleteEdge(null)
    pushHistory()
  }, [confirmDeleteEdge, current, mindMapId, dispatch, pushHistory, showToast])

  // Clear edge selection when clicking canvas
  const handlePaneClick = useCallback(() => {
    setContextMenu(null)
    if (editingEdgeId) { setEditingEdgeId(null) }
    if (selectedEdgeId) {
      setSelectedEdgeId(null)
      setEdges((eds) => eds.map((e) => ({
        ...e,
        style: { stroke: 'var(--accent, #5eead4)', strokeWidth: 2 },
        animated: false,
      })))
    }
  }, [selectedEdgeId, editingEdgeId, setEdges])

  // Toolbar delete — handles both nodes and edges
  const handleDeleteSelected = useCallback(() => {
    if (selectedEdgeId) {
      setConfirmDeleteEdge(selectedEdgeId)
    } else if (selectedNodeId) {
      setConfirmDelete(selectedNodeId)
    }
  }, [selectedNodeId, selectedEdgeId])

  // Node editor update
  const handleNodeUpdate = useCallback((nodeId: string, data: { title?: string; description?: string; color?: string; style_data?: Record<string, unknown> }) => {
    dispatch(updateNode({ mindMapId, nodeId: Number(nodeId), ...data }))
      .then(() => dispatch(fetchMindMap(mindMapId)))
  }, [dispatch, mindMapId])

  const handleNodeDelete = useCallback((nodeId: string) => {
    setConfirmDelete(nodeId)
  }, [])

  // Duplicate node
  const handleDuplicateNode = useCallback((nodeId: string) => {
    const node = current?.nodes.find((n) => n.id === Number(nodeId))
    if (!node) return
    dispatch(addNode({
      mindMapId,
      title: `${node.title} (copy)`,
      description: node.description,
      position_x: node.position_x + 40,
      position_y: node.position_y + 40,
      color: node.color,
    })).then(() => {
      dispatch(fetchMindMap(mindMapId))
      showToast('Node duplicated', 'success')
    })
  }, [current, mindMapId, dispatch, showToast])

  // Add child node to a specific parent
  const handleAddChildNode = useCallback((parentId: string) => {
    const parent = getNodes().find((n) => n.id === parentId)
    if (!parent) return
    const parentColor = (parent.data as Record<string, unknown>)?.color as string | undefined
    dispatch(addNode({
      mindMapId,
      title: 'New Node',
      position_x: parent.position.x + 180,
      position_y: parent.position.y + 60,
      parent_node_id: Number(parentId),
      ...(parentColor ? { color: parentColor } : {}),
    })).then(() => {
      dispatch(fetchMindMap(mindMapId))
      showToast('Child node added', 'success')
    })
  }, [mindMapId, dispatch, getNodes, showToast])

  // Export PNG
  const handleExportPng = useCallback(() => {
    const nodesBounds = getNodesBounds(getNodes())
    const { x, y, zoom } = getViewportForBounds(nodesBounds, 1920, 1080, 0.5, 2, 0.2)

    const el = document.querySelector('.react-flow__viewport') as HTMLElement
    if (!el) return

    import('html-to-image').then(({ toPng }) => {
      toPng(el, {
        width: 1920, height: 1080,
        style: { width: '1920px', height: '1080px', transform: `translate(${x}px, ${y}px) scale(${zoom})` },
      }).then((dataUrl) => {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `${current?.title ?? 'mindmap'}.png`
        a.click()
        showToast('PNG exported', 'success')
      })
    })
  }, [getNodes, current, showToast])

  // Export JSON
  const handleExportJson = useCallback(() => {
    if (!current) return
    const data = JSON.stringify(current, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${current.title}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('JSON exported', 'success')
  }, [current, showToast])

  // Import JSON
  const handleImportJson = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text) as MindMapDetail
        if (!data.nodes || !Array.isArray(data.nodes)) {
          showToast('Invalid mind map JSON format', 'error')
          return
        }
        for (const node of data.nodes) {
          await dispatch(addNode({
            mindMapId,
            title: node.title,
            description: node.description,
            position_x: node.position_x,
            position_y: node.position_y,
            color: node.color,
          }))
        }
        dispatch(fetchMindMap(mindMapId))
        showToast(`Imported ${data.nodes.length} nodes`, 'success')
      } catch {
        showToast('Failed to parse JSON file', 'error')
      }
    }
    input.click()
  }, [mindMapId, dispatch, showToast])

  // Auto-layout using dagre
  const handleAutoLayout = useCallback(() => {
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 })

    const currentNodes = getNodes()
    currentNodes.forEach((node) => {
      g.setNode(node.id, { width: 200, height: 80 })
    })
    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target)
    })
    Dagre.layout(g)

    const layoutedNodes = currentNodes.map((node) => {
      const pos = g.node(node.id)
      return { ...node, position: { x: pos.x - 100, y: pos.y - 40 } }
    })
    setNodes(layoutedNodes)
    pushHistory()
    debouncedSaveLayout()
    showToast('Layout organized', 'success')
    setTimeout(() => fitView({ padding: 0.3 }), 50)
  }, [getNodes, edges, setNodes, pushHistory, debouncedSaveLayout, showToast, fitView])

  // Copy share link
  const handleShareLink = useCallback(() => {
    const url = window.location.href
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard', 'success')
    }).catch(() => {
      showToast('Failed to copy link', 'error')
    })
  }, [showToast])

  // Search — highlight matching nodes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setNodes((nds) => nds.map((n) => ({ ...n, className: '' })))
      return
    }
    const q = searchQuery.toLowerCase()
    const matchId = nodes.find((n) =>
      ((n.data as Record<string, unknown>).label as string)?.toLowerCase().includes(q)
    )?.id
    setNodes((nds) => nds.map((n) => ({
      ...n,
      className: ((n.data as Record<string, unknown>).label as string)?.toLowerCase().includes(q) ? 'search-match' : 'search-dim',
    })))
    if (matchId) {
      const matchNode = nodes.find((n) => n.id === matchId)
      if (matchNode) {
        fitView({ nodes: [matchNode], padding: 1, duration: 300 })
      }
    }
  }, [searchQuery, nodes.length])

  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !current) return null
    return current.nodes.find((n) => n.id === Number(selectedNodeId)) ?? null
  }, [selectedNodeId, current])

  // Context menu items for node
  const nodeMenuItems = useMemo(() => {
    if (!contextMenu?.nodeId) return []
    const nid = contextMenu.nodeId
    return [
      {
        label: 'Add Child Node',
        shortcut: '',
        icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>,
        onClick: () => handleAddChildNode(nid),
      },
      {
        label: 'Duplicate',
        shortcut: '',
        icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>,
        onClick: () => handleDuplicateNode(nid),
      },
      {
        label: 'Edit',
        shortcut: 'Dbl-click',
        icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>,
        onClick: () => setSelectedNodeId(nid),
      },
      {
        label: 'Delete',
        shortcut: 'Del',
        danger: true,
        icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>,
        onClick: () => setConfirmDelete(nid),
      },
    ]
  }, [contextMenu, handleAddChildNode, handleDuplicateNode])

  // Context menu items for canvas (no node)
  const canvasMenuItems = useMemo(() => {
    if (contextMenu?.nodeId) return []
    return [
      {
        label: 'Add Node Here',
        icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>,
        onClick: () => {
          if (!contextMenu) return
          const pos = screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y })
          handleAddNode(pos.x, pos.y)
        },
      },
      {
        label: 'Fit View',
        icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>,
        onClick: () => fitView({ padding: 0.2 }),
      },
    ]
  }, [contextMenu, screenToFlowPosition, handleAddNode, fitView])

  if (!current) return null

  const deleteNodeTitle = confirmDelete
    ? current.nodes.find((n) => n.id === Number(confirmDelete))?.title ?? 'this node'
    : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MindMapToolbar
        title={current.title}
        isSaving={isSaving}
        onAddNode={() => handleAddNode()}
        onDeleteSelected={handleDeleteSelected}
        onExportPng={handleExportPng}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onBack={onBack}
        hasSelection={!!selectedNodeId || !!selectedEdgeId}
        selectionType={selectedEdgeId ? 'edge' : selectedNodeId ? 'node' : undefined}
        canvasBg={canvasBg}
        onCanvasBgChange={setCanvasBg}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onAutoLayout={handleAutoLayout}
        onShareLink={handleShareLink}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap((p) => !p)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{
          flex: 1, position: 'relative',
          ...(canvasBg === 'light' ? {
            '--bg-card': '#ffffff',
            '--bg-canvas': '#f5f5f5',
            '--bg-hover': 'rgba(0,0,0,0.04)',
            '--text-1': '#111111',
            '--text-2': '#333333',
            '--text-3': '#555555',
            '--text-4': '#777777',
            '--border': 'rgba(0,0,0,0.1)',
            '--border-strong': 'rgba(0,0,0,0.18)',
          } as React.CSSProperties : {}),
        }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onEdgeClick={handleEdgeClick}
            onEdgeDoubleClick={handleEdgeDoubleClick}
            onPaneClick={handlePaneClick}
            onDoubleClick={handlePaneDoubleClick}
            onNodeContextMenu={handleNodeContextMenu}
            onPaneContextMenu={handlePaneContextMenu}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.1}
            maxZoom={4}
            connectionLineStyle={{ stroke: 'var(--accent, #5eead4)', strokeWidth: 2 }}
            defaultEdgeOptions={{
              type: 'smoothstep',
              style: { stroke: 'var(--accent, #5eead4)', strokeWidth: 2 },
              interactionWidth: 20,
            }}
            style={{
              background: canvasBg === 'dark' ? '#0a0a0c'
                : canvasBg === 'light' ? '#ffffff'
                : 'transparent',
            }}
            proOptions={{ hideAttribution: true }}
          >
            {canvasBg !== 'none' && (
              <Background
                color={canvasBg === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}
                gap={24}
                size={1}
              />
            )}
            <Controls
              showInteractive={false}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
            />
            {showMinimap && (
              <MiniMap
                nodeColor={(n) => (n.data as Record<string, unknown>)?.color as string ?? '#5eead4'}
                maskColor="rgba(0,0,0,0.6)"
                style={{
                  background: 'var(--bg-card, #16161a)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              />
            )}
          </ReactFlow>

          {/* Edge label inline edit popup */}
          {editingEdgeId && (
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 100,
              background: 'var(--bg-card, #16161a)',
              border: '1px solid var(--border-strong)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              minWidth: '240px',
            }}>
              <label style={{
                display: 'block',
                fontSize: '11px', fontWeight: 600,
                color: 'var(--text-3)',
                marginBottom: '8px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                Edge Label
              </label>
              <input
                autoFocus
                value={editingEdgeLabel}
                onChange={(e) => setEditingEdgeLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdgeLabel()
                  if (e.key === 'Escape') setEditingEdgeId(null)
                }}
                placeholder="Type a label..."
                style={{
                  width: '100%',
                  fontSize: '13px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-canvas, #0a0a0c)',
                  border: '1px solid var(--accent, #5eead4)',
                  color: 'var(--text-1)',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button onClick={saveEdgeLabel} style={{
                  flex: 1, padding: '6px', borderRadius: '8px',
                  background: 'var(--accent, #5eead4)', color: '#000',
                  border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                }}>
                  Save
                </button>
                <button onClick={() => setEditingEdgeId(null)} style={{
                  flex: 1, padding: '6px', borderRadius: '8px',
                  background: 'transparent', color: 'var(--text-3)',
                  border: '1px solid var(--border)', cursor: 'pointer', fontSize: '12px',
                }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Onboarding hint for new/empty maps */}
          {showHint && current.nodes.length <= 1 && (
            <div style={{
              position: 'absolute', bottom: '60px', left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px',
              borderRadius: '10px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-strong)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              zIndex: 5,
              maxWidth: '360px',
            }}>
              <svg width="16" height="16" fill="none" stroke="var(--accent)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              <span style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.4' }}>
                <strong>Tip:</strong> Double-click the canvas to add nodes, or right-click for more options. Press <kbd style={{
                  padding: '1px 5px', borderRadius: '3px', fontSize: '10px',
                  background: 'var(--bg-canvas)', border: '1px solid var(--border)',
                  fontFamily: 'var(--font-mono)',
                }}>?</kbd> for shortcuts.
              </span>
              <button onClick={() => setShowHint(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-4)', padding: '2px', lineHeight: 0, flexShrink: 0,
              }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Help button */}
          <button
            onClick={() => setShowShortcuts((p) => !p)}
            title="Keyboard shortcuts (?)"
            style={{
              position: 'absolute', bottom: '16px', right: '16px',
              zIndex: showShortcuts ? 0 : 5,
              width: '32px', height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-card)',
              color: 'var(--text-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '14px', fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              transition: 'background 150ms, color 150ms',
              opacity: showShortcuts ? 0 : 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-card)'
              e.currentTarget.style.color = 'var(--text-3)'
            }}
          >
            ?
          </button>

          <ShortcutsPanel open={showShortcuts} onClose={() => setShowShortcuts(false)} />
        </div>

        {selectedNode && (
          <NodeEditor
            nodeId={String(selectedNode.id)}
            title={selectedNode.title}
            description={selectedNode.description}
            color={selectedNode.color}
            size={((selectedNode.style_data as Record<string, unknown> | null)?.size as string) || 'md'}
            icon={((selectedNode.style_data as Record<string, unknown> | null)?.icon as string) || null}
            onUpdate={handleNodeUpdate}
            onDelete={handleNodeDelete}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.nodeId ? nodeMenuItems : canvasMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Delete node confirmation dialog */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete Node"
        message={`Delete "${deleteNodeTitle}" and all its connections? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={executeDeleteNode}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Delete edge confirmation dialog */}
      <ConfirmDialog
        open={confirmDeleteEdge !== null}
        title="Delete Connection"
        message="Delete this connection line between the two nodes? The nodes themselves will not be affected."
        confirmLabel="Delete Connection"
        danger
        onConfirm={executeDeleteEdge}
        onCancel={() => { setConfirmDeleteEdge(null); setSelectedEdgeId(null); setEdges((eds) => eds.map((e) => ({ ...e, style: { stroke: 'var(--accent, #5eead4)', strokeWidth: 2 }, animated: false }))) }}
      />

      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

interface MindMapCanvasProps {
  mindMapId: number
  onBack: () => void
}

export default function MindMapCanvas({ mindMapId, onBack }: MindMapCanvasProps) {
  return (
    <ReactFlowProvider>
      <MindMapCanvasInner mindMapId={mindMapId} onBack={onBack} />
    </ReactFlowProvider>
  )
}
