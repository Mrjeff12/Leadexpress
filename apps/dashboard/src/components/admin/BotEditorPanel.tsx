import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import {
  X,
  Save,
  Plus,
  Trash2,
  Settings,
  Cpu,
  Shield,
  ArrowRight,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

export interface BotAgent {
  id: string
  slug: string
  name: string
  description: string
  instructions: string
  model: string
  temperature: number
  handoff_targets: string[]
  guardrails: {
    max_tokens?: number
    pii_filter?: boolean
    blocked_words?: string[]
    language_lock?: string
  }
  color: string
  icon: string
  is_active: boolean
  is_entry_point: boolean
  position_x: number
  position_y: number
}

export interface BotTool {
  id: string
  slug: string
  name: string
  description: string
  parameters: any
  handler_type: string
  is_active: boolean
  assigned?: boolean
}

interface BotEditorPanelProps {
  agent: BotAgent | null
  tools: BotTool[]
  agents: BotAgent[]
  onSave: (agent: Partial<BotAgent>) => void
  onClose: () => void
}

/* ═══════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════ */

const TABS = [
  { key: 'instructions', label: 'Instructions', icon: Settings },
  { key: 'tools', label: 'Tools', icon: Cpu },
  { key: 'handoffs', label: 'Handoffs', icon: ArrowRight },
  { key: 'guardrails', label: 'Guardrails', icon: Shield },
] as const

type TabKey = (typeof TABS)[number]['key']

const MODEL_OPTIONS = ['gpt-4o-mini', 'gpt-4o']
const LANGUAGE_OPTIONS = ['Auto-detect', 'English', 'Hebrew']

/* ═══════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════ */

export default function BotEditorPanel({
  agent,
  tools,
  agents,
  onSave,
  onClose,
}: BotEditorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('instructions')
  const [visible, setVisible] = useState(false)

  /* ── Local form state ── */
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [temperature, setTemperature] = useState(0.7)
  const [instructions, setInstructions] = useState('')
  const [toolAssignments, setToolAssignments] = useState<Record<string, boolean>>({})
  const [handoffTargets, setHandoffTargets] = useState<string[]>([])
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined)
  const [piiFilter, setPiiFilter] = useState(false)
  const [blockedWords, setBlockedWords] = useState<string[]>([])
  const [languageLock, setLanguageLock] = useState('Auto-detect')
  const [blockedWordInput, setBlockedWordInput] = useState('')

  const blockedInputRef = useRef<HTMLInputElement>(null)

  /* ── Sync form state when agent changes ── */
  useEffect(() => {
    if (agent) {
      setName(agent.name)
      setDescription(agent.description)
      setModel(agent.model)
      setTemperature(agent.temperature)
      setInstructions(agent.instructions)
      setHandoffTargets([...agent.handoff_targets])
      setMaxTokens(agent.guardrails.max_tokens)
      setPiiFilter(agent.guardrails.pii_filter ?? false)
      setBlockedWords(agent.guardrails.blocked_words ?? [])
      setLanguageLock(agent.guardrails.language_lock ?? 'Auto-detect')

      const assignments: Record<string, boolean> = {}
      tools.forEach((t) => {
        assignments[t.id] = t.assigned ?? false
      })
      setToolAssignments(assignments)

      setActiveTab('instructions')
      // trigger slide-in
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [agent, tools])

  /* ── Close with animation ── */
  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  /* ── Save handler ── */
  const handleSave = () => {
    if (!agent) return
    onSave({
      id: agent.id,
      name,
      description,
      model,
      temperature,
      instructions,
      handoff_targets: handoffTargets,
      guardrails: {
        max_tokens: maxTokens,
        pii_filter: piiFilter,
        blocked_words: blockedWords,
        language_lock: languageLock,
      },
    })
  }

  /* ── Blocked word tag input ── */
  const handleBlockedWordKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && blockedWordInput.trim()) {
      e.preventDefault()
      const word = blockedWordInput.trim().toLowerCase()
      if (!blockedWords.includes(word)) {
        setBlockedWords([...blockedWords, word])
      }
      setBlockedWordInput('')
    }
  }

  const removeBlockedWord = (word: string) => {
    setBlockedWords(blockedWords.filter((w) => w !== word))
  }

  /* ── Handoff helpers ── */
  const availableHandoffAgents = agents.filter(
    (a) => a.id !== agent?.id && !handoffTargets.includes(a.id)
  )

  const addHandoff = (targetId: string) => {
    if (!handoffTargets.includes(targetId)) {
      setHandoffTargets([...handoffTargets, targetId])
    }
  }

  const removeHandoff = (targetId: string) => {
    setHandoffTargets(handoffTargets.filter((id) => id !== targetId))
  }

  /* ── Tool toggle ── */
  const toggleTool = (toolId: string) => {
    setToolAssignments((prev) => ({ ...prev, [toolId]: !prev[toolId] }))
  }

  if (!agent) return null

  const agentColor = agent.color || '#6366f1'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 z-50 h-full w-[480px] flex flex-col transition-transform duration-300 ease-out"
        style={{
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          background: '#0f0f23',
          borderLeft: `2px solid ${agentColor}40`,
          boxShadow: `-4px 0 40px ${agentColor}15`,
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b"
          style={{ borderColor: `${agentColor}20` }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ background: `${agentColor}18`, border: `1px solid ${agentColor}30` }}
          >
            {agent.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-base truncate">{agent.name}</h2>
            <p className="text-xs text-gray-500 truncate">{agent.slug}</p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b" style={{ borderColor: '#1a1a3a' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all relative"
              style={{
                color: activeTab === key ? agentColor : '#6b7280',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {activeTab === key && (
                <span
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                  style={{ background: agentColor }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          {/* ════ Instructions Tab ════ */}
          {activeTab === 'instructions' && (
            <>
              {/* Name */}
              <FieldLabel label="Name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-600 outline-none focus:ring-1 transition-all"
                  style={{
                    background: '#161630',
                    border: '1px solid #252550',
                    focusRingColor: agentColor,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = agentColor)}
                  onBlur={(e) => (e.target.style.borderColor = '#252550')}
                  placeholder="Agent name"
                />
              </FieldLabel>

              {/* Description */}
              <FieldLabel label="Description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-600 outline-none resize-none transition-all"
                  style={{ background: '#161630', border: '1px solid #252550' }}
                  onFocus={(e) => (e.target.style.borderColor = agentColor)}
                  onBlur={(e) => (e.target.style.borderColor = '#252550')}
                  placeholder="What does this agent do?"
                />
              </FieldLabel>

              {/* Model */}
              <FieldLabel label="Model">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none appearance-none cursor-pointer transition-all"
                  style={{ background: '#161630', border: '1px solid #252550' }}
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              {/* Temperature */}
              <FieldLabel label={`Temperature: ${temperature.toFixed(1)}`}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${agentColor} ${temperature * 100}%, #252550 ${temperature * 100}%)`,
                  }}
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </FieldLabel>

              {/* System prompt */}
              <FieldLabel label="System Prompt">
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3 py-3 rounded-lg text-sm text-gray-300 placeholder-gray-600 outline-none resize-y font-mono leading-relaxed transition-all min-h-[300px]"
                  style={{ background: '#161630', border: '1px solid #252550' }}
                  onFocus={(e) => (e.target.style.borderColor = agentColor)}
                  onBlur={(e) => (e.target.style.borderColor = '#252550')}
                  placeholder="You are a helpful assistant..."
                />
              </FieldLabel>
            </>
          )}

          {/* ════ Tools Tab ════ */}
          {activeTab === 'tools' && (
            <>
              {tools.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-8">No tools available</p>
              )}
              <div className="space-y-2">
                {tools.map((tool) => (
                  <div
                    key={tool.id}
                    className="flex items-start gap-3 p-3 rounded-lg transition-colors"
                    style={{
                      background: toolAssignments[tool.id] ? `${agentColor}08` : '#161630',
                      border: `1px solid ${toolAssignments[tool.id] ? agentColor + '25' : '#252550'}`,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {tool.name}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
                          style={{
                            background: '#252550',
                            color: agentColor,
                          }}
                        >
                          {tool.handler_type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {tool.description}
                      </p>
                    </div>
                    <ToggleSwitch
                      checked={toolAssignments[tool.id] ?? false}
                      onChange={() => toggleTool(tool.id)}
                      color={agentColor}
                    />
                  </div>
                ))}
              </div>

              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  border: `1px dashed ${agentColor}40`,
                  color: agentColor,
                }}
              >
                <Plus className="w-4 h-4" />
                Add Tool
              </button>
            </>
          )}

          {/* ════ Handoffs Tab ════ */}
          {activeTab === 'handoffs' && (
            <>
              {handoffTargets.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-4">No handoff targets configured</p>
              )}
              <div className="space-y-2">
                {handoffTargets.map((targetId) => {
                  const target = agents.find((a) => a.id === targetId)
                  if (!target) return null
                  return (
                    <div
                      key={targetId}
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ background: '#161630', border: '1px solid #252550' }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{
                          background: `${target.color || '#6366f1'}18`,
                          border: `1px solid ${target.color || '#6366f1'}30`,
                        }}
                      >
                        {target.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{target.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{target.slug}</p>
                      </div>
                      <button
                        onClick={() => removeHandoff(targetId)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Add Handoff dropdown */}
              {availableHandoffAgents.length > 0 && (
                <div>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) addHandoff(e.target.value)
                      e.target.value = ''
                    }}
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 outline-none appearance-none cursor-pointer transition-all"
                    style={{
                      background: '#161630',
                      border: `1px dashed ${agentColor}40`,
                    }}
                  >
                    <option value="" disabled>
                      + Add Handoff...
                    </option>
                    {availableHandoffAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.icon} {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* ════ Guardrails Tab ════ */}
          {activeTab === 'guardrails' && (
            <>
              {/* Max tokens */}
              <FieldLabel label="Max Tokens">
                <input
                  type="number"
                  value={maxTokens ?? ''}
                  onChange={(e) =>
                    setMaxTokens(e.target.value ? parseInt(e.target.value, 10) : undefined)
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all"
                  style={{ background: '#161630', border: '1px solid #252550' }}
                  onFocus={(e) => (e.target.style.borderColor = agentColor)}
                  onBlur={(e) => (e.target.style.borderColor = '#252550')}
                  placeholder="4096"
                />
              </FieldLabel>

              {/* PII Filter */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm text-gray-300 font-medium">PII Filter</p>
                  <p className="text-xs text-gray-600">Strip personal info from responses</p>
                </div>
                <ToggleSwitch
                  checked={piiFilter}
                  onChange={() => setPiiFilter(!piiFilter)}
                  color={agentColor}
                />
              </div>

              {/* Blocked words */}
              <FieldLabel label="Blocked Words">
                <div
                  className="flex flex-wrap gap-1.5 p-2 rounded-lg min-h-[42px]"
                  style={{ background: '#161630', border: '1px solid #252550' }}
                  onClick={() => blockedInputRef.current?.focus()}
                >
                  {blockedWords.map((word) => (
                    <span
                      key={word}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: `${agentColor}15`, color: agentColor }}
                    >
                      {word}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeBlockedWord(word)
                        }}
                        className="hover:opacity-70"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    ref={blockedInputRef}
                    type="text"
                    value={blockedWordInput}
                    onChange={(e) => setBlockedWordInput(e.target.value)}
                    onKeyDown={handleBlockedWordKey}
                    className="flex-1 min-w-[80px] bg-transparent text-sm text-white outline-none placeholder-gray-600"
                    placeholder={blockedWords.length === 0 ? 'Type + Enter to add...' : ''}
                  />
                </div>
              </FieldLabel>

              {/* Language lock */}
              <FieldLabel label="Language Lock">
                <select
                  value={languageLock}
                  onChange={(e) => setLanguageLock(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none appearance-none cursor-pointer transition-all"
                  style={{ background: '#161630', border: '1px solid #252550' }}
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </>
          )}
        </div>

        {/* ── Bottom bar ── */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4 border-t"
          style={{ borderColor: '#1a1a3a' }}
        >
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, ${agentColor}, ${agentColor}cc)`,
              boxShadow: `0 0 20px ${agentColor}30`,
            }}
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════ */

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-400 mb-1.5 block">{label}</span>
      {children}
    </label>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  color,
}: {
  checked: boolean
  onChange: () => void
  color: string
}) {
  return (
    <button
      onClick={onChange}
      className="relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0"
      style={{ background: checked ? color : '#252550' }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  )
}
