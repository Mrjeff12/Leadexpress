import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnNodesChange,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, Rocket, Loader2, Bot, Wrench, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import BotAgentNode, { type BotAgentNodeData } from '../../components/admin/BotAgentNode'
import BotEditorPanel from '../../components/admin/BotEditorPanel'

/* ─── Types ─────────────────────────────────────────────────────── */

interface BotTool {
  id: string
  slug: string
  name: string
  description: string
}

interface BotAgentTool {
  bot_tools: BotTool
}

interface BotAgent {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  color: string
  model: string
  system_prompt: string
  is_active: boolean
  is_entry_point: boolean
  handoff_targets: string[]
  position_x: number
  position_y: number
  created_at: string
  updated_at: string
  bot_agent_tools: BotAgentTool[]
}

/* ─── Constants ─────────────────────────────────────────────────── */

const BG_PAGE = '#060612'
const BG_BAR = '#0a0a1a'
const BORDER_SUBTLE = '#1a1a3a'

const nodeTypes = { botAgent: BotAgentNode }

/* ─── Debounced position saver ──────────────────────────────────── */

function useDebouncedPositionSave(delay = 800) {
  const pending = useRef<Map<string, { x: number; y: number }>>(new Map())
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const flush = useCallback(async () => {
    if (pending.current.size === 0) return
    const batch = Array.from(pending.current.entries())
    pending.current.clear()

    await Promise.all(
      batch.map(([id, pos]) =>
        supabase
          .from('bot_agents')
          .update({ position_x: pos.x, position_y: pos.y })
          .eq('id', id)
      )
    )
  }, [])

  const save = useCallback(
    (id: string, x: number, y: number) => {
      pending.current.set(id, { x, y })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, delay)
    },
    [delay, flush]
  )

  return save
}

/* ─── New Agent Modal ───────────────────────────────────────────── */

interface NewAgentModalProps {
  onClose: () => void
  onCreate: (agent: { name: string; slug: string; icon: string; color: string }) => void
}

function NewAgentModal({ onClose, onCreate }: NewAgentModalProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [icon, setIcon] = useState('🤖')
  const [color, setColor] = useState('#8b5cf6')

  const handleNameChange = (v: string) => {
    setName(v)
    setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="rounded-xl p-6 w-full max-w-md"
        style={{ background: '#12122a', border: `1px solid ${BORDER_SUBTLE}` }}
      >
        <h3 className="text-lg font-bold text-white mb-4">New Agent</h3>

        <label className="block text-xs text-slate-400 mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full mb-3 px-3 py-2 rounded-lg text-sm text-white"
          style={{ background: BG_PAGE, border: `1px solid ${BORDER_SUBTLE}` }}
          placeholder="e.g. Lead Qualifier"
          autoFocus
        />

        <label className="block text-xs text-slate-400 mb-1">Slug</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full mb-3 px-3 py-2 rounded-lg text-sm text-white font-mono"
          style={{ background: BG_PAGE, border: `1px solid ${BORDER_SUBTLE}` }}
          placeholder="lead-qualifier"
        />

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Icon (emoji)</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm text-white text-center"
              style={{ background: BG_PAGE, border: `1px solid ${BORDER_SUBTLE}` }}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-0"
                style={{ background: 'transparent' }}
              />
              <span className="text-xs font-mono text-slate-400">{color}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
            style={{ background: BG_PAGE }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!name.trim() || !slug.trim()) return
              onCreate({ name: name.trim(), slug: slug.trim(), icon, color })
            }}
            disabled={!name.trim() || !slug.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: color }}
          >
            Create Agent
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Component ────────────────────────────────────────────── */

function BotMissionControlInner() {
  const [agents, setAgents] = useState<BotAgent[]>([])
  const [tools, setTools] = useState<BotTool[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<BotAgentNodeData | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [lastEdit, setLastEdit] = useState<Date | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges] = useEdgesState<Edge>([])

  const savePosition = useDebouncedPositionSave()

  /* ── Fetch data ──────────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    const [agentsRes, toolsRes] = await Promise.all([
      supabase
        .from('bot_agents')
        .select('*, bot_agent_tools(bot_tools(*))')
        .order('created_at'),
      supabase.from('bot_tools').select('*').order('name'),
    ])

    if (agentsRes.error) {
      console.error('Failed to load bot agents:', agentsRes.error)
    }
    if (toolsRes.error) {
      console.error('Failed to load bot tools:', toolsRes.error)
    }

    const loadedAgents = (agentsRes.data || []) as unknown as BotAgent[]
    const loadedTools = (toolsRes.data || []) as unknown as BotTool[]

    setAgents(loadedAgents)
    setTools(loadedTools)
    setLoading(false)

    // Compute most recent update
    if (loadedAgents.length > 0) {
      const latest = loadedAgents.reduce((max, a) => {
        const d = new Date(a.updated_at || a.created_at)
        return d > max ? d : max
      }, new Date(0))
      setLastEdit(latest)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /* ── Build nodes & edges from agents ─────────────────────────── */

  useEffect(() => {
    if (agents.length === 0) return

    const newNodes: Node[] = agents.map((agent) => ({
      id: agent.id,
      type: 'botAgent',
      position: { x: agent.position_x ?? 0, y: agent.position_y ?? 0 },
      data: {
        ...agent,
        tool_count: agent.bot_agent_tools?.length || 0,
        onSelect: setSelectedAgent,
      },
    }))

    const newEdges: Edge[] = agents.flatMap((agent) =>
      (agent.handoff_targets || [])
        .map((target) => {
          const targetAgent = agents.find((a) => a.slug === target)
          if (!targetAgent) return null
          return {
            id: `${agent.id}-${targetAgent.id}`,
            source: agent.id,
            target: targetAgent.id,
            animated: true,
            style: {
              stroke: agent.color || '#8b5cf6',
              strokeDasharray: '5,5',
              strokeWidth: 1.5,
            },
          }
        })
        .filter(Boolean) as Edge[]
    )

    setNodes(newNodes)
    setEdges(newEdges)
  }, [agents, setNodes, setEdges])

  /* ── Handle node position changes (drag) ─────────────────────── */

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)

      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          savePosition(change.id, change.position.x, change.position.y)
        }
      }
    },
    [onNodesChange, savePosition]
  )

  /* ── Create new agent ────────────────────────────────────────── */

  const handleCreateAgent = useCallback(
    async (input: { name: string; slug: string; icon: string; color: string }) => {
      // Place new agent to the right of existing nodes
      const maxX = agents.reduce((max, a) => Math.max(max, a.position_x ?? 0), 0)

      const { data, error } = await supabase
        .from('bot_agents')
        .insert({
          name: input.name,
          slug: input.slug,
          icon: input.icon,
          color: input.color,
          model: 'gpt-4o-mini',
          system_prompt: '',
          is_active: false,
          is_entry_point: false,
          handoff_targets: [],
          position_x: maxX + 200,
          position_y: 100,
        })
        .select('*, bot_agent_tools(bot_tools(*))')
        .single()

      if (error) {
        console.error('Failed to create agent:', error)
        return
      }

      const newAgent = data as unknown as BotAgent
      setAgents((prev) => [...prev, newAgent])
      setShowNewModal(false)
      setLastEdit(new Date())
    },
    [agents]
  )

  /* ── Save from editor panel ──────────────────────────────────── */

  const handleSaveAgent = useCallback(
    async (updated: Partial<BotAgent> & { id: string }) => {
      const { id, bot_agent_tools: _tools, ...fields } = updated as any

      const { error } = await supabase.from('bot_agents').update(fields).eq('id', id)

      if (error) {
        console.error('Failed to save agent:', error)
        return
      }

      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...fields } : a)))
      setLastEdit(new Date())
    },
    []
  )

  /* ── Time ago helper ─────────────────────────────────────────── */

  const timeAgo = useMemo(() => {
    if (!lastEdit) return '--'
    const diffMs = Date.now() - lastEdit.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }, [lastEdit])

  const totalTools = useMemo(
    () => agents.reduce((sum, a) => sum + (a.bot_agent_tools?.length || 0), 0),
    [agents]
  )

  /* ── Loading state ───────────────────────────────────────────── */

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen gap-4"
        style={{ background: BG_PAGE }}
      >
        <div className="relative">
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#8b5cf6' }} />
          <div
            className="absolute inset-0 w-10 h-10 rounded-full animate-ping opacity-20"
            style={{ background: '#8b5cf6' }}
          />
        </div>
        <p className="text-sm text-slate-500 font-mono tracking-wide">
          Initializing mission control...
        </p>
      </div>
    )
  }

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-screen" style={{ background: BG_PAGE }}>
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ background: BG_BAR, borderBottom: `1px solid ${BORDER_SUBTLE}` }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🛸</span>
          <h1 className="text-base font-bold text-white tracking-tight">Bot Mission Control</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              boxShadow: '0 0 12px #8b5cf630',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Agent
          </button>

          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: '#12122a',
              color: '#22c55e',
              border: `1px solid #22c55e40`,
              boxShadow: '0 0 8px #22c55e15',
            }}
          >
            <Rocket className="w-3.5 h-3.5" />
            Deploy
          </button>
        </div>
      </div>

      {/* ── Canvas + Panel ───────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* React Flow canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
            maxZoom={2}
            defaultEdgeOptions={{ animated: true }}
            style={{ background: BG_PAGE }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="#1a1a3a"
            />
            <Controls
              className="!bg-[#12122a] !border-[#1a1a3a] !rounded-lg !shadow-xl"
              style={{
                button: { background: '#12122a', color: '#8b5cf6', borderColor: '#1a1a3a' },
              } as any}
            />
            <MiniMap
              nodeColor={(n) => {
                const data = n.data as any
                return data?.color || '#8b5cf6'
              }}
              maskColor="rgba(6, 6, 18, 0.85)"
              style={{
                background: '#0a0a1a',
                border: `1px solid ${BORDER_SUBTLE}`,
                borderRadius: 8,
              }}
            />
          </ReactFlow>
        </div>

        {/* Editor panel (conditional) */}
        {selectedAgent && (
          <div
            className="w-[380px] shrink-0 overflow-y-auto border-l"
            style={{ background: BG_BAR, borderColor: BORDER_SUBTLE }}
          >
            <BotEditorPanel
              agent={selectedAgent}
              agents={agents}
              tools={tools}
              onSave={handleSaveAgent}
              onClose={() => setSelectedAgent(null)}
            />
          </div>
        )}
      </div>

      {/* ── Status bar ───────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-5 py-2 text-[11px] shrink-0"
        style={{
          background: BG_BAR,
          borderTop: `1px solid ${BORDER_SUBTLE}`,
          color: '#64748b',
        }}
      >
        <span className="flex items-center gap-1.5">
          <Bot className="w-3 h-3" />
          {agents.length} agent{agents.length !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <Wrench className="w-3 h-3" />
          {totalTools} tool{totalTools !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Last edit: {timeAgo}
        </span>
      </div>

      {/* ── New Agent Modal ──────────────────────────────────── */}
      {showNewModal && (
        <NewAgentModal onClose={() => setShowNewModal(false)} onCreate={handleCreateAgent} />
      )}
    </div>
  )
}

/* ─── Wrapper with ReactFlowProvider ────────────────────────────── */

export default function BotMissionControl() {
  return (
    <ReactFlowProvider>
      <BotMissionControlInner />
    </ReactFlowProvider>
  )
}
