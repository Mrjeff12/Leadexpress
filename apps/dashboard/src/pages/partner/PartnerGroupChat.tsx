import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Search,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Mic,
  Sparkles,
  Send,
  Users,
  MessageCircle,
  Info,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { usePartnerGroupChat, type ChatMember, type ChatMessage, type ProspectStage } from '../../hooks/usePartnerGroupChat'
import { usePartnerProfile } from '../../hooks/usePartnerProfile'

/* ── Status badge config ─────────────────────────────────── */

const STAGE_CONFIG: Record<ProspectStage, { label: string; bg: string; text: string }> = {
  subscribed:  { label: 'Subscribed',  bg: 'bg-emerald-50',  text: 'text-emerald-600' },
  trial:       { label: 'Trial',       bg: 'bg-amber-50',    text: 'text-amber-600' },
  interested:  { label: 'Interested',  bg: 'bg-blue-50',     text: 'text-blue-600' },
  not_reached: { label: 'Not Reached', bg: 'bg-zinc-100',    text: 'text-zinc-500' },
}

function StatusBadge({ stage }: { stage: ProspectStage }) {
  const cfg = STAGE_CONFIG[stage]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

/* ── Avatar with initials ────────────────────────────────── */

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-rose-500',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const color = getAvatarColor(name || '?')
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-[10px]' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-xs'
  return (
    <div className={`${sizeClass} ${color} rounded-full flex items-center justify-center text-white font-bold shrink-0`}>
      {initials}
    </div>
  )
}

/* ── Format timestamp ────────────────────────────────────── */

function formatTime(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/* ── Mobile tab type ─────────────────────────────────────── */

type MobileTab = 'members' | 'chat' | 'info'

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════ */

export default function PartnerGroupChat() {
  const { groupId } = useParams<{ groupId: string }>()
  const [searchParams] = useSearchParams()
  const isDemo = searchParams.get('demo') === '1' || !groupId
  const navigate = useNavigate()
  const { partner: profile } = usePartnerProfile()
  const { group, members, messages, stats, isLoading, isLoadingMessages } = usePartnerGroupChat(isDemo ? 'demo' : groupId, isDemo)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Filter members by search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members
    const q = searchQuery.toLowerCase()
    return members.filter(m =>
      (m.display_name || '').toLowerCase().includes(q) ||
      m.wa_sender_id.includes(q)
    )
  }, [members, searchQuery])

  // Earnings (from partner profile stats, or demo value)
  const earnings = isDemo
    ? '$18,240'
    : profile?.balance_cache_cents
      ? `$${(profile.balance_cache_cents / 100).toLocaleString()}`
      : '$0'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-[#fe5b25] border-t-transparent" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-zinc-500">Group not found</p>
        <button onClick={() => navigate('/partner/communities')} className="text-[#fe5b25] font-medium">
          ← Back to communities
        </button>
      </div>
    )
  }

  const totalMembers = group.total_members || members.length

  /* ── Sub-components ──────────────────────────────────── */

  const TopBar = (
    <div className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center gap-4">
      {/* Back + Group avatar */}
      <button onClick={() => navigate('/partner/communities')} className="lg:hidden p-1 hover:bg-zinc-100 rounded-lg">
        <ArrowLeft className="h-5 w-5 text-zinc-600" />
      </button>
      <div className="hidden lg:flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center">
          <Users className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-zinc-900 text-sm">{group.name}</h2>
          <p className="text-[11px] text-zinc-400">{totalMembers} members</p>
        </div>
      </div>

      {/* KPI pills */}
      <div className="hidden md:flex items-center gap-3 ml-4">
        <KpiPill value={stats.subscribed} total={totalMembers} label="SUBSCRIBED" />
        <KpiPill value={stats.trial} total={totalMembers} label="IN TRIAL" />
        <KpiPill value={stats.interested + stats.subscribed + stats.trial} total={totalMembers} label="PAYING" />
      </div>

      {/* Earnings */}
      <div className="ml-auto">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2 text-center">
          <p className="text-[9px] text-emerald-600 uppercase tracking-wider font-medium">Earnings</p>
          <p className="text-lg font-bold text-emerald-700">{earnings} <span className="text-emerald-400">↗</span></p>
        </div>
      </div>
    </div>
  )

  const MemberSidebar = (
    <div className="flex flex-col h-full bg-white border-r border-zinc-200">
      {/* Search */}
      <div className="p-3 border-b border-zinc-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/20 focus:border-[#fe5b25]/40"
          />
        </div>
      </div>

      {/* Group card */}
      <div className="p-3 border-b border-zinc-100">
        <div className="bg-[#fe5b25]/5 border border-[#fe5b25]/10 rounded-2xl p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-zinc-900 text-sm truncate">{group.name}</p>
            <p className="text-[11px] text-zinc-500 truncate">
              {members.slice(0, 3).map(m => m.display_name?.split(' ')[0] || 'Member').join(', ')}...
            </p>
          </div>
          <span className="bg-[#fe5b25] text-white text-[10px] font-bold rounded-full px-2 py-0.5">
            {totalMembers}
          </span>
        </div>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto">
        {filteredMembers.map(member => (
          <MemberRow
            key={member.wa_sender_id}
            member={member}
            isSelected={selectedMemberId === member.wa_sender_id}
            onClick={() => setSelectedMemberId(member.wa_sender_id)}
          />
        ))}
        {filteredMembers.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-8">No members found</p>
        )}
      </div>
    </div>
  )

  const ChatArea = (
    <div className="flex flex-col h-full bg-[#f5f5f7]">
      {/* Chat header */}
      <div className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-sm">{group.name}</h3>
            <p className="text-[11px] text-zinc-400 truncate max-w-[300px]">
              {totalMembers} members · {members.slice(0, 4).map(m => m.display_name?.split(' ')[0] || 'Member').join(', ')}...
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"><Phone className="h-4 w-4 text-zinc-400" /></button>
          <button className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"><Video className="h-4 w-4 text-zinc-400" /></button>
          <button className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"><MoreVertical className="h-4 w-4 text-zinc-400" /></button>
        </div>
      </div>

      {/* AI notification bar */}
      {stats.notReached > 0 && (
        <div className="mx-4 mt-3 bg-white border border-zinc-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#fe5b25]" />
            <span className="text-sm text-zinc-600">
              <span className="font-medium text-zinc-800">AI:</span> {stats.notReached} members haven't been reached yet
            </span>
          </div>
          <button className="bg-[#fe5b25] text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-[#e04d1c] transition-colors">
            Send Message
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-6 w-6 rounded-full border-2 border-[#fe5b25] border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <MessageCircle className="h-10 w-10 text-zinc-300" />
            <p className="text-zinc-400 text-sm">No messages yet</p>
            <p className="text-zinc-300 text-xs">Connect your WhatsApp to see group messages</p>
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input bar (disabled — read-only) */}
      <div className="bg-white border-t border-zinc-200 px-4 py-3 flex items-center gap-3">
        <button className="p-2 text-zinc-400 hover:text-zinc-500"><Smile className="h-5 w-5" /></button>
        <button className="p-2 text-zinc-400 hover:text-zinc-500"><Paperclip className="h-5 w-5" /></button>
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Write a message..."
            disabled
            className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-400 cursor-not-allowed"
          />
        </div>
        <button className="h-10 w-10 rounded-full bg-[#fe5b25] flex items-center justify-center text-white opacity-50 cursor-not-allowed">
          <Mic className="h-5 w-5" />
        </button>
      </div>
    </div>
  )

  const GroupInfoPanel = (
    <div className="flex flex-col h-full bg-white border-l border-zinc-200 p-6">
      {/* Group icon */}
      <div className="flex flex-col items-center gap-3 pb-6 border-b border-zinc-100">
        <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center">
          <Users className="h-10 w-10 text-zinc-400" />
        </div>
        <div className="text-center">
          <h3 className="font-bold text-zinc-900">{group.name}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">WhatsApp Group</p>
        </div>
        <span className="bg-emerald-500 text-white text-[11px] font-bold rounded-full px-3 py-1">
          {totalMembers} members
        </span>
      </div>

      {/* Stats */}
      <div className="py-6 space-y-4">
        <StatRow label="SUBSCRIBED" value={stats.subscribed} color="text-emerald-600" />
        <StatRow label="IN TRIAL" value={stats.trial} color="text-amber-600" />
        <StatRow label="INTERESTED" value={stats.interested} color="text-blue-600" />
        <StatRow label="NOT REACHED" value={stats.notReached} color="text-zinc-500" />
        <div className="pt-2 border-t border-zinc-100">
          <StatRow label="CREATED" value={formatDate(group.created_at)} color="text-zinc-700" />
        </div>
      </div>
    </div>
  )

  const BottomBar = (
    <div className="bg-white border-t border-zinc-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {members.slice(0, 4).map((m, i) => (
            <div key={i} className="h-7 w-7 rounded-full border-2 border-white overflow-hidden">
              <Avatar name={m.display_name || '?'} size="sm" />
            </div>
          ))}
          {members.length > 4 && (
            <div className="h-7 w-7 rounded-full border-2 border-white bg-zinc-200 flex items-center justify-center text-[9px] font-bold text-zinc-600">
              +{totalMembers - 4}
            </div>
          )}
        </div>
        <span className="text-xs text-zinc-500 ml-1">
          {totalMembers} members · {stats.subscribed} subscribed · {stats.trial} on trial
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button className="text-xs text-zinc-500 hover:text-zinc-700 px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors">
          Reminders
        </button>
        <button
          onClick={() => navigate('/partner/communities')}
          className="flex items-center gap-2 bg-[#fe5b25] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#e04d1c] transition-colors"
        >
          <Zap className="h-4 w-4" />
          Connect My WhatsApp
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )

  /* ── Mobile tab bar ──────────────────────────────────── */

  const MobileTabBar = (
    <div className="lg:hidden flex bg-white border-b border-zinc-200">
      {(['members', 'chat', 'info'] as MobileTab[]).map(tab => (
        <button
          key={tab}
          onClick={() => setMobileTab(tab)}
          className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
            mobileTab === tab
              ? 'text-[#fe5b25] border-b-2 border-[#fe5b25]'
              : 'text-zinc-400'
          }`}
        >
          {tab === 'members' ? 'Members' : tab === 'chat' ? 'Chat' : 'Info'}
        </button>
      ))}
    </div>
  )

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-zinc-50 animate-fade-in">
      {TopBar}
      {MobileTabBar}

      {/* 3-column layout (desktop) / single panel (mobile) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Member sidebar */}
        <div className={`w-[340px] shrink-0 ${mobileTab === 'members' ? 'flex' : 'hidden'} lg:flex flex-col`}>
          {MemberSidebar}
        </div>

        {/* Center: Chat area */}
        <div className={`flex-1 min-w-0 ${mobileTab === 'chat' ? 'flex' : 'hidden'} lg:flex flex-col`}>
          {ChatArea}
        </div>

        {/* Right: Group info panel */}
        <div className={`w-[320px] shrink-0 ${mobileTab === 'info' ? 'flex' : 'hidden'} lg:flex flex-col`}>
          {GroupInfoPanel}
        </div>
      </div>

      {BottomBar}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════ */

/* ── Member row ──────────────────────────────────────────── */

function MemberRow({
  member,
  isSelected,
  onClick,
}: {
  member: ChatMember
  isSelected: boolean
  onClick: () => void
}) {
  const name = member.display_name || member.wa_sender_id.split('@')[0]
  const preview = member.lastMessagePreview || ''

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 flex items-center gap-3 border-b border-zinc-50 hover:bg-zinc-50/80 transition-colors ${
        isSelected ? 'bg-[#fe5b25]/5 border-l-2 border-l-[#fe5b25]' : ''
      }`}
    >
      <Avatar name={name} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-zinc-900 truncate">{name}</span>
          <StatusBadge stage={member.prospectStage} />
        </div>
        {preview && (
          <p className="text-xs text-zinc-400 truncate mt-0.5">
            {member.prospectStage === 'subscribed' && <span className="text-emerald-500">✓ </span>}
            {preview}
          </p>
        )}
      </div>
      {member.last_seen_at && (
        <span className="text-[10px] text-zinc-300 shrink-0">
          {new Date(member.last_seen_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </span>
      )}
      {member.total_messages > 0 && member.prospectStage !== 'subscribed' && (
        <span className="h-5 w-5 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
          {member.total_messages > 9 ? '9+' : member.total_messages}
        </span>
      )}
    </button>
  )
}

/* ── Message bubble ──────────────────────────────────────── */

function MessageBubble({ message }: { message: ChatMessage }) {
  const name = message.senderName || 'Unknown'
  const stage = classificationToStage(message.senderClassification)

  return (
    <div className="flex items-start gap-2.5 py-1">
      <Avatar name={name} size="sm" />
      <div className="max-w-[75%]">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-xs text-zinc-800">{name}</span>
          <StatusBadge stage={stage} />
        </div>
        <div className="bg-white rounded-2xl rounded-tl-sm px-3.5 py-2 shadow-xs border border-zinc-100">
          <p className="text-sm text-zinc-700 leading-relaxed">{message.text}</p>
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[10px] text-zinc-300">{formatTime(message.timestamp)}</span>
            {message.isLead && (
              <span className="text-[9px] font-bold text-[#fe5b25] ml-1">🔥 LEAD</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Stat row ────────────────────────────────────────────── */

function StatRow({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">{label}</span>
      <span className={`text-lg font-bold ${color}`}>{value}</span>
    </div>
  )
}

/* ── KPI pill ────────────────────────────────────────────── */

function KpiPill({ value, total, label }: { value: number; total: number; label: string }) {
  return (
    <div className="text-center">
      <span className="text-lg font-bold text-zinc-900">{value}</span>
      <span className="text-xs text-zinc-300">/{total}</span>
      <p className="text-[9px] text-zinc-400 uppercase tracking-wider">{label}</p>
    </div>
  )
}

/* ── Helper ──────────────────────────────────────────────── */

function classificationToStage(cls?: string): ProspectStage {
  switch (cls) {
    case 'buyer': return 'interested'
    case 'seller': return 'not_reached'
    case 'admin': return 'subscribed'
    default: return 'not_reached'
  }
}
