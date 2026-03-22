import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Radio, Search, RefreshCw, MessageCircle,
  User, Bot, Phone, Loader2,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════
   Design Tokens — dark space "war room" theme
   ═══════════════════════════════════════════════════════════════════ */

const BG = '#060612'
const BG_CARD = '#0c0c20'
const BORDER = '#1a1a3a'
const GREEN = '#22c55e'
const RED = '#ef4444'
const PURPLE = '#8b5cf6'
const CYAN = '#06b6d4'
const ORANGE = '#f59e0b'

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface TwilioMessage {
  sid: string
  from: string
  to: string
  body: string
  date_sent: string
  direction: string
  status: string
  num_media?: string
}

interface Conversation {
  phone: string
  displayName: string
  lastMessage: string
  lastTime: string
  messageCount: number
  messages: TwilioMessage[]
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

const BOT_NUMBER = 'whatsapp:+18623582898'

const fmtPhone = (p: string) => p.replace('whatsapp:', '').replace('+', '')
const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const fmtDate = (d: string) => {
  const now = new Date()
  const msg = new Date(d)
  const diff = Math.floor((now.getTime() - msg.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return msg.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const phoneHue = (phone: string) => {
  let h = 0
  for (let i = 0; i < phone.length; i++) h = phone.charCodeAt(i) + ((h << 5) - h)
  return ((h % 360) + 360) % 360
}

/* ═══════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════ */

export default function ChatWarRoom() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [profiles, setProfiles] = useState<Record<string, string>>({})
  const chatEndRef = useRef<HTMLDivElement>(null)

  /* ── Fetch Twilio messages via Edge Function ─────────────────── */
  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const { data, error } = await supabase.functions.invoke('chat-warroom', {
        body: { pageSize: 200 },
      })

      if (error) {
        console.error('War room fetch error:', error)
        return
      }

      const msgs: TwilioMessage[] = data?.messages || []

      // Group by conversation partner
      const convMap = new Map<string, TwilioMessage[]>()
      for (const m of msgs) {
        const partner = m.from === BOT_NUMBER ? m.to : m.from
        if (!convMap.has(partner)) convMap.set(partner, [])
        convMap.get(partner)!.push(m)
      }

      // Build conversations sorted by most recent
      const convs: Conversation[] = Array.from(convMap.entries())
        .map(([phone, messages]) => {
          messages.sort((a, b) => new Date(a.date_sent).getTime() - new Date(b.date_sent).getTime())
          const last = messages[messages.length - 1]
          return {
            phone,
            displayName: fmtPhone(phone),
            lastMessage: last.body || (last.num_media !== '0' ? '📎 Media' : ''),
            lastTime: last.date_sent,
            messageCount: messages.length,
            messages,
          }
        })
        .sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime())

      setConversations(convs)

      // Fetch profile names for known phones
      const phones = convs.map(c => fmtPhone(c.phone)).filter(p => p.length > 8)
      if (phones.length > 0) {
        const orFilter = phones.map(p => `whatsapp_phone.eq.+${p},whatsapp_phone.eq.${p},phone.eq.+${p},phone.eq.${p}`).join(',')
        const { data: profs } = await supabase
          .from('profiles')
          .select('full_name, whatsapp_phone, phone')
          .or(orFilter)
        if (profs) {
          const map: Record<string, string> = {}
          for (const p of profs) {
            const wp = p.whatsapp_phone || p.phone || ''
            const clean = wp.replace('+', '')
            map[clean] = p.full_name || ''
            map['+' + clean] = p.full_name || ''
          }
          setProfiles(map)
        }
      }
    } catch (e) {
      console.error('Fetch error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedPhone])

  /* ── Filter conversations ─────────────────────────────────────── */
  const filtered = conversations.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = profiles[fmtPhone(c.phone)] || ''
    return c.phone.includes(q) || name.toLowerCase().includes(q)
      || c.messages.some(m => m.body?.toLowerCase().includes(q))
  })

  const selected = conversations.find(c => c.phone === selectedPhone)

  const getName = (phone: string) => {
    const clean = fmtPhone(phone)
    return profiles[clean] || profiles['+' + clean] || ''
  }

  /* ── Loading state ────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4" style={{ background: BG }}>
        <div className="relative">
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: RED }} />
          <div className="absolute inset-0 w-10 h-10 rounded-full animate-ping opacity-20" style={{ background: RED }} />
        </div>
        <p className="text-sm text-slate-500 font-mono tracking-widest uppercase">
          Initializing War Room...
        </p>
      </div>
    )
  }

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen" style={{ background: BG }}>

      {/* ── Top Bar ── */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ background: BG_CARD, borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Radio className="w-5 h-5" style={{ color: RED }} />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse" style={{ background: RED }} />
          </div>
          <h1 className="text-base font-bold text-white tracking-tight">Chat War Room</h1>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: `${RED}20`, color: RED }}>
            LIVE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono">
            {conversations.length} conversations · {conversations.reduce((s, c) => s + c.messageCount, 0)} messages
          </span>
          <button
            onClick={() => fetchMessages(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110"
            style={{ background: `${PURPLE}30`, border: `1px solid ${PURPLE}40` }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} style={{ color: PURPLE }} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Conversation List ── */}
        <div
          className="w-[340px] shrink-0 flex flex-col border-r overflow-hidden"
          style={{ background: BG_CARD, borderColor: BORDER }}
        >
          {/* Search */}
          <div className="p-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                style={{ background: BG, border: `1px solid ${BORDER}` }}
                placeholder="Search by name, phone, or message..."
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map(conv => {
              const name = getName(conv.phone)
              const isActive = conv.phone === selectedPhone
              const isBot = conv.phone === BOT_NUMBER
              if (isBot) return null

              return (
                <button
                  key={conv.phone}
                  onClick={() => setSelectedPhone(conv.phone)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                  style={{
                    background: isActive ? `${PURPLE}15` : 'transparent',
                    borderBottom: `1px solid ${BORDER}`,
                    borderLeft: isActive ? `3px solid ${PURPLE}` : '3px solid transparent',
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{
                      background: `hsl(${phoneHue(conv.phone)}, 60%, 20%)`,
                      border: `2px solid hsl(${phoneHue(conv.phone)}, 60%, 40%)`,
                      color: `hsl(${phoneHue(conv.phone)}, 60%, 70%)`,
                    }}
                  >
                    {name ? name[0].toUpperCase() : <User className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white truncate">
                        {name || fmtPhone(conv.phone)}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {fmtDate(conv.lastTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-slate-400 truncate max-w-[180px]">
                        {conv.lastMessage || '...'}
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-mono shrink-0"
                        style={{ background: `${CYAN}15`, color: CYAN }}
                      >
                        {conv.messageCount}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                <MessageCircle className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No conversations found</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Chat View ── */}
        <div className="flex-1 flex flex-col" style={{ background: BG }}>
          {!selected ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
              <div className="relative mb-4">
                <Radio className="w-16 h-16 opacity-10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 opacity-30" />
                </div>
              </div>
              <p className="text-sm font-mono">Select a conversation to monitor</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div
                className="flex items-center gap-3 px-5 py-3 shrink-0"
                style={{ background: BG_CARD, borderBottom: `1px solid ${BORDER}` }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    background: `hsl(${phoneHue(selected.phone)}, 60%, 20%)`,
                    border: `2px solid hsl(${phoneHue(selected.phone)}, 60%, 40%)`,
                    color: `hsl(${phoneHue(selected.phone)}, 60%, 70%)`,
                  }}
                >
                  {getName(selected.phone)?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <h2 className="text-white font-semibold text-sm">
                    {getName(selected.phone) || fmtPhone(selected.phone)}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Phone className="w-3 h-3" />
                    {fmtPhone(selected.phone)}
                    <span>·</span>
                    <span>{selected.messageCount} messages</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
                {selected.messages.map((msg, i) => {
                  const isOutgoing = msg.from === BOT_NUMBER
                  const showDate = i === 0 || fmtDate(msg.date_sent) !== fmtDate(selected.messages[i - 1].date_sent)

                  return (
                    <div key={msg.sid}>
                      {/* Date divider */}
                      {showDate && (
                        <div className="flex items-center justify-center py-3">
                          <span
                            className="text-[10px] font-mono px-3 py-1 rounded-full"
                            style={{ background: BG_CARD, color: '#64748b', border: `1px solid ${BORDER}` }}
                          >
                            {fmtDate(msg.date_sent)}
                          </span>
                        </div>
                      )}

                      {/* Message bubble */}
                      <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-1`}>
                        <div
                          className="max-w-[70%] px-3.5 py-2 rounded-2xl relative group"
                          style={{
                            background: isOutgoing
                              ? 'linear-gradient(135deg, #1a1044, #12122a)'
                              : BG_CARD,
                            border: `1px solid ${isOutgoing ? PURPLE + '30' : BORDER}`,
                            borderBottomRightRadius: isOutgoing ? 4 : 16,
                            borderBottomLeftRadius: isOutgoing ? 16 : 4,
                          }}
                        >
                          {/* Direction indicator */}
                          <div className="flex items-center gap-1 mb-0.5">
                            {isOutgoing ? (
                              <Bot className="w-3 h-3" style={{ color: PURPLE }} />
                            ) : (
                              <User className="w-3 h-3" style={{ color: CYAN }} />
                            )}
                            <span className="text-[9px] font-mono" style={{ color: isOutgoing ? PURPLE : CYAN }}>
                              {isOutgoing ? 'Rebeca' : getName(selected.phone) || fmtPhone(selected.phone)}
                            </span>
                          </div>

                          {/* Message body */}
                          <p className="text-[13px] text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
                            {msg.body || (msg.num_media !== '0' ? '📎 Media attachment' : '(empty)')}
                          </p>

                          {/* Time + status */}
                          <div className="flex items-center justify-end gap-1.5 mt-1">
                            <span className="text-[9px] text-slate-600">{fmtTime(msg.date_sent)}</span>
                            {isOutgoing && (
                              <span
                                className="text-[8px] px-1 py-0.5 rounded font-mono"
                                style={{
                                  color: msg.status === 'read' ? GREEN
                                    : msg.status === 'delivered' ? CYAN
                                    : msg.status === 'failed' ? RED
                                    : ORANGE,
                                  background: msg.status === 'read' ? GREEN + '15'
                                    : msg.status === 'delivered' ? CYAN + '15'
                                    : msg.status === 'failed' ? RED + '15'
                                    : ORANGE + '15',
                                }}
                              >
                                {msg.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
