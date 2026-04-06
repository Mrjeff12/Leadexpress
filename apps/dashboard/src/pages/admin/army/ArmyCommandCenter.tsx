import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useI18n } from '../../../lib/i18n'
import { supabase } from '../../../lib/supabase'
import {
  useArmyAccounts,
  useArmyAssignments,
  useArmyConfig,
  useArmyActivity,
  useArmyTemplates,
  useArmyDMConversations,
  useArmyDMChat,
  useArmyUnreadCounts,
  type ArmyAccount,
  type ArmyAssignment,
  type ArmyDM,
  type DMConversation,
  type ArmyScheduleEntry,
} from '../../../hooks/useArmyData'
import {
  Wifi, WifiOff, Megaphone, MessageCircleReply, HardHat,
  Loader2, Send, Search, QrCode, Plus, X, Trash2,
  MessageCircle, Users, Power, PowerOff,
  Check, CheckCheck, Clock, Image, Mic, FileText,
  Swords, Activity, ChevronRight, Calendar,
  AlertTriangle, Inbox, Tag, UserPlus, Flame, HelpCircle, Ban,
  BarChart3, Zap,
} from 'lucide-react'

/* ── Design tokens (WhatsApp-inspired) ─── */
const C = {
  waBg: '#eae6df',
  waSidebar: '#ffffff',
  waHeader: '#f0f2f5',
  waChatBg: '#efeae2',
  waGreen: '#00a884',
  waGreenLight: '#d9fdd3',
  waGreenDark: '#008069',
  waDark: '#111b21',
  waGray: '#667781',
  waLightGray: '#f0f2f5',
  waBorder: '#e9edef',
  waBlue: '#53bdeb',
  waUnread: '#25d366',
  outgoing: '#d9fdd3',
  incoming: '#ffffff',
  primary: '#DC2626',
}

const ROLE_META: Record<string, { label: string; labelHe: string; color: string; icon: typeof Megaphone; emoji: string }> = {
  publisher: { label: 'Publisher', labelHe: 'מפרסם', color: '#2563eb', icon: Megaphone, emoji: '📢' },
  responder: { label: 'Responder', labelHe: 'מגיב', color: '#f59e0b', icon: MessageCircleReply, emoji: '💬' },
  contractor: { label: 'Contractor', labelHe: 'קבלן', color: '#10b981', icon: HardHat, emoji: '👷' },
}

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/* ══════════════════════════════════════════════════════════════════ */
export default function ArmyCommandCenter() {
  const { locale } = useI18n()
  const he = locale === 'he'

  /* ── Data ── */
  const { accounts: realAccounts, loading: accLoading, refetch: refetchAccounts } = useArmyAccounts()
  const { assignments: realAssignments, refetch: refetchAssignments } = useArmyAssignments()
  const { config, update: updateConfig } = useArmyConfig()
  const { entries: realActivityEntries } = useArmyActivity(20)
  const { templates } = useArmyTemplates()
  const { counts: realUnreadCounts, refetch: refetchUnread } = useArmyUnreadCounts()

  /* ── Demo mode ── */
  const DEMO = realAccounts.length === 0 && !accLoading

  const DEMO_ACCOUNTS: ArmyAccount[] = DEMO ? [
    { id: 'demo-1', green_api_id: '1101000001', green_api_token: 'demo', green_api_url: 'https://api.green-api.com', phone_number: '+1 (305) 555-0101', status: 'connected', qr_code: null, is_army: true, army_role: 'publisher', army_alias: 'Slave-Miami-01', connected_since: '2026-03-20T10:00:00Z' },
    { id: 'demo-2', green_api_id: '1101000002', green_api_token: 'demo', green_api_url: 'https://api.green-api.com', phone_number: '+1 (305) 555-0102', status: 'connected', qr_code: null, is_army: true, army_role: 'responder', army_alias: 'Slave-Miami-02', connected_since: '2026-03-21T10:00:00Z' },
    { id: 'demo-3', green_api_id: '1101000003', green_api_token: 'demo', green_api_url: 'https://api.green-api.com', phone_number: '+1 (786) 555-0103', status: 'connected', qr_code: null, is_army: true, army_role: 'responder', army_alias: 'Slave-FTL-03', connected_since: '2026-03-22T10:00:00Z' },
    { id: 'demo-4', green_api_id: '1101000004', green_api_token: 'demo', green_api_url: 'https://api.green-api.com', phone_number: '+1 (954) 555-0104', status: 'connected', qr_code: null, is_army: true, army_role: 'contractor', army_alias: 'Slave-Orlando-04', connected_since: '2026-03-23T10:00:00Z' },
    { id: 'demo-5', green_api_id: '1101000005', green_api_token: 'demo', green_api_url: 'https://api.green-api.com', phone_number: '+1 (407) 555-0105', status: 'disconnected', qr_code: null, is_army: true, army_role: 'publisher', army_alias: 'Slave-Tampa-05', connected_since: null },
    { id: 'demo-6', green_api_id: '1101000006', green_api_token: 'demo', green_api_url: 'https://api.green-api.com', phone_number: '+1 (813) 555-0106', status: 'connected', qr_code: null, is_army: true, army_role: 'responder', army_alias: 'Slave-Jax-06', connected_since: '2026-03-25T10:00:00Z' },
  ] : []

  const DEMO_ASSIGNMENTS: ArmyAssignment[] = DEMO ? [
    { id: 'da-1', wa_account_id: 'demo-1', group_wa_id: '120363001@g.us', group_name: 'Miami Renovations 🏠', role_in_group: 'publisher', is_active: true },
    { id: 'da-2', wa_account_id: 'demo-1', group_wa_id: '120363002@g.us', group_name: 'FL Plumbers Network 🔧', role_in_group: 'publisher', is_active: true },
    { id: 'da-3', wa_account_id: 'demo-1', group_wa_id: '120363004@g.us', group_name: 'South FL HVAC Jobs ❄️', role_in_group: 'publisher', is_active: true },
    { id: 'da-4', wa_account_id: 'demo-2', group_wa_id: '120363001@g.us', group_name: 'Miami Renovations 🏠', role_in_group: 'responder', is_active: true },
    { id: 'da-5', wa_account_id: 'demo-3', group_wa_id: '120363002@g.us', group_name: 'FL Plumbers Network 🔧', role_in_group: 'responder', is_active: true },
    { id: 'da-6', wa_account_id: 'demo-4', group_wa_id: '120363003@g.us', group_name: 'Orlando Contractors 🏗️', role_in_group: 'contractor', is_active: true },
  ] : []

  // Unified chat list: DMs + groups mixed, sorted by last activity
  type ChatItem = { type: 'dm'; phone: string; name: string | null; lastMsg: string; lastAt: string; unread: number } | { type: 'group'; groupId: string; name: string; role: string; lastMsg: string; lastAt: string }

  const DEMO_CHATLIST: ChatItem[] = DEMO ? [
    { type: 'dm', phone: '+1 (305) 444-1234', name: 'Carlos Rivera', lastMsg: 'I can start as early as next Monday!', lastAt: new Date(Date.now() - 12 * 60000).toISOString(), unread: 2 },
    { type: 'group', groupId: '120363001@g.us', name: 'Miami Renovations 🏠', role: 'publisher', lastMsg: '🔨 Kitchen renovation job | Miami, FL...', lastAt: new Date(Date.now() - 30 * 60000).toISOString() },
    { type: 'dm', phone: '+1 (786) 333-5678', name: 'Mike Thompson', lastMsg: 'Is the HVAC job still available?', lastAt: new Date(Date.now() - 45 * 60000).toISOString(), unread: 1 },
    { type: 'group', groupId: '120363002@g.us', name: 'FL Plumbers Network 🔧', role: 'publisher', lastMsg: '🔧 Looking for experienced plumber...', lastAt: new Date(Date.now() - 60 * 60000).toISOString() },
    { type: 'dm', phone: '+1 (954) 222-9012', name: 'David Cohen', lastMsg: 'Thanks, I signed up on masterlead', lastAt: new Date(Date.now() - 3 * 3600000).toISOString(), unread: 0 },
    { type: 'group', groupId: '120363004@g.us', name: 'South FL HVAC Jobs ❄️', role: 'publisher', lastMsg: '❄️ HVAC maintenance needed | Tampa...', lastAt: new Date(Date.now() - 4 * 3600000).toISOString() },
    { type: 'dm', phone: '+1 (407) 111-3456', name: null, lastMsg: 'Hi, I need a painter for my house...', lastAt: new Date(Date.now() - 5 * 3600000).toISOString(), unread: 1 },
  ] : []

  const DEMO_CHAT: ArmyDM[] = DEMO ? [
    { id: 'dm-1', wa_account_id: 'demo-1', sender_phone: '+1 (305) 444-1234', sender_name: 'Carlos Rivera', direction: 'incoming', content: 'Hey, saw your post about the plumbing job in Miami Beach. Is it still available?', wa_message_id: null, sent_at: new Date(Date.now() - 30 * 60000).toISOString(), read: true },
    { id: 'dm-2', wa_account_id: 'demo-1', sender_phone: '+1 (305) 444-1234', sender_name: 'Carlos Rivera', direction: 'outgoing', content: 'Hi Carlos! Yes it\'s available. Check out the full details here: masterlead.app/jobs/abc123', wa_message_id: null, sent_at: new Date(Date.now() - 25 * 60000).toISOString(), read: true },
    { id: 'dm-3', wa_account_id: 'demo-1', sender_phone: '+1 (305) 444-1234', sender_name: 'Carlos Rivera', direction: 'incoming', content: 'Great, I just signed up on the platform. I have 8 years experience in residential plumbing 💪', wa_message_id: null, sent_at: new Date(Date.now() - 15 * 60000).toISOString(), read: true },
    { id: 'dm-4', wa_account_id: 'demo-1', sender_phone: '+1 (305) 444-1234', sender_name: 'Carlos Rivera', direction: 'incoming', content: 'I can start as early as next Monday. Let me know!', wa_message_id: null, sent_at: new Date(Date.now() - 12 * 60000).toISOString(), read: false },
  ] : []

  const DEMO_ACTIVITY: ArmyScheduleEntry[] = DEMO ? [
    { id: 'act-1', group_wa_id: '120363001@g.us', wa_account_id: 'demo-1', template_id: null, message_type: 'job_post', scheduled_at: new Date(Date.now() - 2 * 3600000).toISOString(), sent_at: new Date(Date.now() - 2 * 3600000).toISOString(), status: 'sent', rendered_message: '🔨 Kitchen renovation job | Miami, FL\n💰 $3,500 - $5,000\nmasterlead.app/jobs/abc123', error: null, created_at: new Date().toISOString() },
    { id: 'act-2', group_wa_id: '120363001@g.us', wa_account_id: 'demo-2', template_id: null, message_type: 'response', scheduled_at: new Date(Date.now() - 1.5 * 3600000).toISOString(), sent_at: new Date(Date.now() - 1.5 * 3600000).toISOString(), status: 'sent', rendered_message: 'Wow just signed up through the link 🔥', error: null, created_at: new Date().toISOString() },
    { id: 'act-3', group_wa_id: '120363002@g.us', wa_account_id: 'demo-1', template_id: null, message_type: 'job_post', scheduled_at: new Date(Date.now() - 1 * 3600000).toISOString(), sent_at: new Date(Date.now() - 1 * 3600000).toISOString(), status: 'sent', rendered_message: '🔧 Experienced plumber needed | Fort Lauderdale\nmasterlead.app/jobs/def456', error: null, created_at: new Date().toISOString() },
    { id: 'act-4', group_wa_id: '120363003@g.us', wa_account_id: 'demo-4', template_id: null, message_type: 'contractor_promo', scheduled_at: new Date(Date.now() - 30 * 60000).toISOString(), sent_at: new Date(Date.now() - 30 * 60000).toISOString(), status: 'sent', rendered_message: '👋 I\'m Mike - 12 yrs experience\n⭐ 4.9 rating\nmasterlead.app/pro/mike-r', error: null, created_at: new Date().toISOString() },
    { id: 'act-5', group_wa_id: '120363004@g.us', wa_account_id: 'demo-1', template_id: null, message_type: 'job_post', scheduled_at: new Date(Date.now() + 1 * 3600000).toISOString(), sent_at: null, status: 'pending', rendered_message: '❄️ HVAC maintenance | Tampa, FL\nmasterlead.app/jobs/ghi789', error: null, created_at: new Date().toISOString() },
  ] : []

  const accounts = DEMO ? DEMO_ACCOUNTS : realAccounts
  const assignments = DEMO ? DEMO_ASSIGNMENTS : realAssignments
  const unreadCounts = DEMO ? { 'demo-1': 3, 'demo-2': 0, 'demo-4': 1 } as Record<string, number> : realUnreadCounts
  const activityEntries = DEMO ? DEMO_ACTIVITY : realActivityEntries

  /* ── Selection state ── */
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null) // phone or groupId
  const [selectedChatType, setSelectedChatType] = useState<'dm' | 'group' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [allDMsMode, setAllDMsMode] = useState(false) // show DMs from ALL slaves
  const [dmTags, setDmTags] = useState<Record<string, string>>({}) // phone → tag

  /* ── DM data ── */
  const { conversations: realConvos, loading: convoLoading } = useArmyDMConversations(DEMO ? null : selectedAccountId)
  const { messages: realDmMessages, loading: chatLoading, refetch: refetchChat } = useArmyDMChat(DEMO ? null : selectedAccountId, DEMO ? null : (selectedChatType === 'dm' ? selectedChatId : null))
  const dmMessages = DEMO && selectedChatId ? DEMO_CHAT.filter(m => m.sender_phone === selectedChatId) : realDmMessages

  /* ── Composer ── */
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  /* ── Modals ── */
  const [addOpen, setAddOpen] = useState(false)
  const [formId, setFormId] = useState('')
  const [formToken, setFormToken] = useState('')
  const [formAlias, setFormAlias] = useState('')
  const [formRole, setFormRole] = useState<'publisher' | 'responder' | 'contractor'>('publisher')
  const [formSaving, setFormSaving] = useState(false)

  const selectedAccount = useMemo(() => accounts.find(a => a.id === selectedAccountId) ?? null, [accounts, selectedAccountId])
  const accountAssignments = useMemo(() => assignments.filter(a => a.wa_account_id === selectedAccountId), [assignments, selectedAccountId])

  // Build unified chat list for selected account
  const chatList = useMemo<ChatItem[]>(() => {
    if (DEMO && selectedAccountId === 'demo-1') return DEMO_CHATLIST
    if (DEMO) return []
    // Real data: combine DM conversations + assigned groups
    const items: ChatItem[] = []
    for (const c of realConvos) {
      items.push({ type: 'dm', phone: c.sender_phone, name: c.sender_name, lastMsg: c.last_message, lastAt: c.last_message_at, unread: c.unread_count })
    }
    for (const a of accountAssignments) {
      const lastAct = activityEntries.find(e => e.group_wa_id === a.group_wa_id && e.wa_account_id === selectedAccountId)
      items.push({ type: 'group', groupId: a.group_wa_id, name: a.group_name ?? a.group_wa_id, role: a.role_in_group, lastMsg: lastAct?.rendered_message?.slice(0, 50) ?? '', lastAt: lastAct?.scheduled_at ?? '' })
    }
    items.sort((a, b) => new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime())
    return items
  }, [DEMO, selectedAccountId, realConvos, accountAssignments, activityEntries, DEMO_CHATLIST])

  // All DMs across all slaves (for All DMs mode)
  const DEMO_ALL_DMS: (DMConversation & { slaveAlias: string; slaveId: string })[] = DEMO ? [
    { sender_phone: '+1 (305) 444-1234', sender_name: 'Carlos Rivera', last_message: 'I can start as early as next Monday!', last_message_at: new Date(Date.now() - 12 * 60000).toISOString(), unread_count: 2, slaveAlias: 'Slave-Miami-01', slaveId: 'demo-1' },
    { sender_phone: '+1 (786) 333-5678', sender_name: 'Mike Thompson', last_message: 'Is the HVAC job still available?', last_message_at: new Date(Date.now() - 45 * 60000).toISOString(), unread_count: 1, slaveAlias: 'Slave-Miami-01', slaveId: 'demo-1' },
    { sender_phone: '+1 (954) 222-9012', sender_name: 'David Cohen', last_message: 'Thanks, I signed up on masterlead', last_message_at: new Date(Date.now() - 3 * 3600000).toISOString(), unread_count: 0, slaveAlias: 'Slave-Miami-01', slaveId: 'demo-1' },
    { sender_phone: '+1 (407) 111-3456', sender_name: null, last_message: 'Hi, I need a painter for my house...', last_message_at: new Date(Date.now() - 5 * 3600000).toISOString(), unread_count: 1, slaveAlias: 'Slave-Orlando-04', slaveId: 'demo-4' },
  ] : []

  // Stats
  const stats = useMemo(() => {
    const sentToday = activityEntries.filter(e => e.status === 'sent').length
    const pendingToday = activityEntries.filter(e => e.status === 'pending').length
    const failedToday = activityEntries.filter(e => e.status === 'failed').length
    const connectedSlaves = accounts.filter(a => a.status === 'connected').length
    const totalDMs = DEMO ? 4 : Object.values(unreadCounts).reduce((s, n) => s + n, 0)
    const totalGroups = [...new Set(assignments.map(a => a.group_wa_id))].length
    return { sentToday, pendingToday, failedToday, connectedSlaves, totalSlaves: accounts.length, totalDMs, totalGroups }
  }, [activityEntries, accounts, unreadCounts, assignments, DEMO])

  const DM_TAGS = [
    { key: 'hot', label: '🔥 Hot Lead', labelHe: '🔥 ליד חם', color: '#dc2626' },
    { key: 'interested', label: '👀 Interested', labelHe: '👀 מתעניין', color: '#f59e0b' },
    { key: 'signed_up', label: '✅ Signed Up', labelHe: '✅ נרשם', color: '#16a34a' },
    { key: 'spam', label: '🚫 Spam', labelHe: '🚫 ספאם', color: '#6b7280' },
  ]

  // Next scheduled action for selected account
  const nextAction = useMemo(() => {
    return activityEntries.find(e => e.wa_account_id === selectedAccountId && e.status === 'pending')
  }, [activityEntries, selectedAccountId])

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [dmMessages])

  // Auto-select first account
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) setSelectedAccountId(accounts[0].id)
  }, [accounts, selectedAccountId])

  /* ── Handlers ── */
  async function handleAddSlave() {
    if (!formId || !formToken) return
    setFormSaving(true)
    await supabase.from('wa_accounts').insert({
      green_api_id: formId, green_api_token: formToken,
      green_api_url: 'https://api.green-api.com',
      is_army: true, army_role: formRole,
      army_alias: formAlias || `Slave-${accounts.length + 1}`,
      status: 'disconnected',
    })
    setFormSaving(false); setAddOpen(false)
    setFormId(''); setFormToken(''); setFormAlias('')
    refetchAccounts()
  }

  async function handleSendDM() {
    if (!newMessage.trim() || !selectedAccount || !selectedChatId || selectedChatType !== 'dm') return
    if (DEMO) { setNewMessage(''); return } // demo mode - just clear
    setSending(true)
    try {
      const url = `${selectedAccount.green_api_url}/waInstance${selectedAccount.green_api_id}/sendMessage/${selectedAccount.green_api_token}`
      const chatId = selectedChatId.includes('@') ? selectedChatId : `${selectedChatId}@c.us`
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, message: newMessage }) })
      setNewMessage('')
      refetchChat()
    } catch { /* */ }
    setSending(false)
  }

  async function handleRoleChange(role: string) {
    if (!selectedAccountId || DEMO) return
    await supabase.from('wa_accounts').update({ army_role: role }).eq('id', selectedAccountId)
    refetchAccounts()
  }

  async function fetchQr() {
    if (!selectedAccount || DEMO) return
    try {
      const url = `${selectedAccount.green_api_url}/waInstance${selectedAccount.green_api_id}/qr/${selectedAccount.green_api_token}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.type === 'qrCode' && data.message) {
        await supabase.from('wa_accounts').update({ qr_code: data.message, status: 'waiting_qr' }).eq('id', selectedAccount.id)
        refetchAccounts()
      }
    } catch { /* */ }
  }

  /* ══════════════════════════════════════════════════════════════ */
  if (accLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: C.waBg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.waGreen }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ background: C.waBg }}>

      {/* ═══ TOP BAR: Slave Tabs ═══════════════════════════════ */}
      <div className="shrink-0 flex items-center gap-1 px-3 h-[56px] overflow-x-auto scrollbar-hide" style={{ background: C.waHeader, borderBottom: `1px solid ${C.waBorder}` }}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 shrink-0">
          <Swords className="w-5 h-5" style={{ color: C.primary }} />
          <span className="text-[13px] font-extrabold uppercase tracking-[0.08em]" style={{ color: C.primary }}>Army</span>
        </div>
        <div className="w-px h-7 mx-1" style={{ background: C.waBorder }} />

        {/* Account tabs */}
        {accounts.map(acc => {
          const role = ROLE_META[acc.army_role ?? 'publisher']
          const active = acc.id === selectedAccountId
          const connected = acc.status === 'connected'
          const unread = unreadCounts[acc.id] || 0
          return (
            <button
              key={acc.id}
              onClick={() => { setSelectedAccountId(acc.id); setSelectedChatId(null); setSelectedChatType(null) }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg shrink-0 transition-all"
              style={{
                background: active ? '#fff' : 'transparent',
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: connected ? role.color : '#8E8E93' }}>
                  {role.emoji}
                </div>
                {!connected && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-400 border-2 border-white" />}
                {unread > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white" style={{ background: C.waUnread }}>
                    {unread}
                  </div>
                )}
              </div>
              <div className="text-left">
                <span className={`text-[11px] block truncate max-w-[100px] ${active ? 'font-bold text-[#111b21]' : 'font-medium text-[#667781]'}`}>
                  {acc.army_alias || acc.phone_number}
                </span>
                <span className="text-[9px] font-bold uppercase" style={{ color: role.color }}>{he ? role.labelHe : role.label}</span>
              </div>
            </button>
          )
        })}

        <div className="flex-1" />

        {/* Add + Master toggle */}
        <button
          onClick={() => updateConfig('enabled', config.enabled ? 'false' : 'true')}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold shrink-0 transition-all"
          style={{ background: config.enabled ? '#dcfce7' : '#fee2e2', color: config.enabled ? '#16a34a' : '#dc2626' }}
        >
          {config.enabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
          {config.enabled ? 'ON' : 'OFF'}
        </button>
        <button onClick={() => setAddOpen(true)} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all hover:bg-black/[0.05]" style={{ color: C.waGray }}>
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* ═══ STATS BAR ═══════════════════════════════════════════ */}
      <div className="shrink-0 flex items-center gap-4 px-4 h-[38px]" style={{ background: '#fff', borderBottom: `1px solid ${C.waBorder}` }}>
        {[
          { icon: Send, label: he ? 'נשלחו' : 'Sent', value: stats.sentToday, color: '#16a34a' },
          { icon: Clock, label: he ? 'ממתינות' : 'Pending', value: stats.pendingToday, color: '#d97706' },
          { icon: AlertTriangle, label: he ? 'נכשלו' : 'Failed', value: stats.failedToday, color: stats.failedToday > 0 ? '#dc2626' : '#d1d5db' },
          { icon: MessageCircle, label: he ? 'DMs חדשים' : 'New DMs', value: stats.totalDMs, color: stats.totalDMs > 0 ? '#2563eb' : '#d1d5db' },
          { icon: Wifi, label: he ? 'מחוברים' : 'Connected', value: `${stats.connectedSlaves}/${stats.totalSlaves}`, color: stats.connectedSlaves === stats.totalSlaves ? '#16a34a' : '#d97706' },
          { icon: Users, label: he ? 'קבוצות' : 'Groups', value: stats.totalGroups, color: '#8b5cf6' },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="flex items-center gap-1.5">
              <Icon className="w-3 h-3" style={{ color: s.color }} />
              <span className="text-[11px] font-bold" style={{ color: s.color }}>{s.value}</span>
              <span className="text-[10px]" style={{ color: C.waGray }}>{s.label}</span>
            </div>
          )
        })}
        <div className="flex-1" />
        {/* All DMs toggle */}
        <button
          onClick={() => { setAllDMsMode(!allDMsMode); setSelectedChatId(null); setSelectedChatType(null) }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all"
          style={{
            background: allDMsMode ? '#2563eb15' : 'transparent',
            color: allDMsMode ? '#2563eb' : C.waGray,
            border: allDMsMode ? '1px solid #2563eb30' : '1px solid transparent',
          }}
        >
          <Inbox className="w-3 h-3" />
          {he ? 'כל ההודעות' : 'All DMs'}
        </button>
      </div>

      {/* ═══ MAIN CONTENT: 3 columns ════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT: Chat List (WhatsApp style) ─── */}
        <div className="w-[320px] shrink-0 flex flex-col h-full" style={{ background: C.waSidebar, borderRight: `1px solid ${C.waBorder}` }}>
          {/* Search */}
          <div className="px-3 py-2" style={{ background: C.waHeader }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.waGray }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={he ? 'חיפוש או התחלת צ\'אט חדש' : 'Search or start a new chat'}
                className="w-full h-9 pl-10 pr-3 rounded-lg text-[13px] outline-none"
                style={{ background: C.waLightGray }}
              />
            </div>
          </div>

          {/* Chat items */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {/* All DMs mode */}
            {allDMsMode ? (
              <>
                <div className="px-3 py-2" style={{ borderBottom: `1px solid ${C.waBorder}` }}>
                  <span className="text-[12px] font-bold" style={{ color: C.waGreen }}>{he ? 'כל ההודעות הפרטיות' : 'All Private Messages'}</span>
                </div>
                {DEMO_ALL_DMS.map(dm => {
                  const tag = dmTags[dm.sender_phone]
                  const tagDef = DM_TAGS.find(t => t.key === tag)
                  return (
                    <button
                      key={dm.sender_phone}
                      onClick={() => {
                        setSelectedAccountId(dm.slaveId)
                        setSelectedChatId(dm.sender_phone)
                        setSelectedChatType('dm')
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors"
                      style={{ background: selectedChatId === dm.sender_phone ? '#f0f2f5' : 'transparent', borderBottom: `1px solid ${C.waBorder}` }}
                    >
                      <div className="w-[49px] h-[49px] rounded-full shrink-0 flex items-center justify-center" style={{ background: '#dfe5e7' }}>
                        <span className="font-bold text-[18px]" style={{ color: '#8696a0' }}>{(dm.sender_name ?? '?').charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-[15px] truncate ${dm.unread_count > 0 ? 'font-bold' : 'font-normal'}`} style={{ color: C.waDark }}>
                            {dm.sender_name ?? dm.sender_phone}
                          </span>
                          <span className="text-[11px] shrink-0 ml-2" style={{ color: dm.unread_count > 0 ? C.waUnread : C.waGray }}>
                            {timeAgo(dm.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold px-1 py-0.5 rounded" style={{ background: '#f0f2f5', color: C.waGray }}>{dm.slaveAlias}</span>
                          {tagDef && <span className="text-[10px] font-bold px-1 py-0.5 rounded" style={{ background: `${tagDef.color}15`, color: tagDef.color }}>{he ? tagDef.labelHe : tagDef.label}</span>}
                        </div>
                        <p className={`text-[13px] truncate mt-0.5 ${dm.unread_count > 0 ? 'font-medium' : ''}`} style={{ color: C.waGray }}>
                          {dm.last_message.substring(0, 45)}
                        </p>
                      </div>
                      {dm.unread_count > 0 && (
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: C.waUnread }}>
                          {dm.unread_count}
                        </span>
                      )}
                    </button>
                  )
                })}
                {DEMO_ALL_DMS.length === 0 && (
                  <div className="text-center py-16 text-[13px]" style={{ color: C.waGray }}>{he ? 'אין הודעות' : 'No DMs yet'}</div>
                )}
              </>
            ) : chatList.length === 0 ? (
              <div className="text-center py-16 text-[13px]" style={{ color: C.waGray }}>
                {he ? 'אין צ\'אטים' : 'No chats yet'}
              </div>
            ) : chatList.map((item, i) => {
              const id = item.type === 'dm' ? item.phone : item.groupId
              const isActive = selectedChatId === id
              const isGroup = item.type === 'group'
              const unread = item.type === 'dm' ? item.unread : 0

              return (
                <button
                  key={`${item.type}-${id}`}
                  onClick={() => { setSelectedChatId(id); setSelectedChatType(item.type) }}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors"
                  style={{ background: isActive ? '#f0f2f5' : 'transparent', borderBottom: `1px solid ${C.waBorder}` }}
                >
                  {/* Avatar */}
                  <div className="w-[49px] h-[49px] rounded-full shrink-0 flex items-center justify-center text-[18px]" style={{ background: isGroup ? '#00a884' : '#dfe5e7' }}>
                    {isGroup ? <Users className="w-6 h-6 text-white" /> : (
                      <span className="font-bold" style={{ color: '#8696a0' }}>
                        {(item.type === 'dm' && item.name) ? item.name.charAt(0).toUpperCase() : '?'}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-[15px] truncate ${unread > 0 ? 'font-bold' : 'font-normal'}`} style={{ color: C.waDark }}>
                        {item.type === 'dm' ? (item.name ?? item.phone) : item.name}
                      </span>
                      <span className="text-[11px] shrink-0 ml-2" style={{ color: unread > 0 ? C.waUnread : C.waGray }}>
                        {item.lastAt ? timeAgo(item.lastAt) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-[13px] truncate ${unread > 0 ? 'font-medium' : 'font-normal'}`} style={{ color: C.waGray }}>
                        {isGroup && <span className="text-[11px] font-bold mr-1" style={{ color: ROLE_META[item.type === 'group' ? item.role : '']?.color }}>
                          {item.type === 'group' ? ROLE_META[item.role]?.emoji : ''}{' '}
                        </span>}
                        {item.lastMsg.substring(0, 45)}{item.lastMsg.length > 45 ? '...' : ''}
                      </p>
                      {unread > 0 && (
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ml-1" style={{ background: C.waUnread }}>
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── CENTER: Chat ─── */}
        <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: C.waChatBg, backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'400\' height=\'400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'p\' width=\'80\' height=\'80\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M0 0h80v80H0z\' fill=\'none\'/%3E%3Ccircle cx=\'40\' cy=\'40\' r=\'1\' fill=\'rgba(0,0,0,0.03)\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect fill=\'url(%23p)\' width=\'100%25\' height=\'100%25\'/%3E%3C/svg%3E")' }}>
          {selectedChatId && selectedChatType === 'dm' ? (
            <>
              {/* Chat header */}
              <div className="shrink-0 flex items-center gap-3 px-4 h-[59px]" style={{ background: C.waHeader, borderBottom: `1px solid ${C.waBorder}` }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#dfe5e7' }}>
                  <span className="text-[16px] font-bold" style={{ color: '#8696a0' }}>
                    {(() => {
                      const chat = chatList.find(c => c.type === 'dm' && c.phone === selectedChatId) as (ChatItem & { type: 'dm' }) | undefined
                      return chat?.name?.charAt(0).toUpperCase() ?? '?'
                    })()}
                  </span>
                </div>
                <div className="flex-1">
                  <span className="text-[15px] font-medium" style={{ color: C.waDark }}>
                    {(() => { const c = chatList.find(x => x.type === 'dm' && x.phone === selectedChatId) as (ChatItem & { type: 'dm' }) | undefined; return c?.name ?? selectedChatId })()}
                  </span>
                  <span className="text-[12px] block" style={{ color: C.waGray }}>{selectedChatId}</span>
                </div>

                {/* Tag + CRM buttons */}
                <div className="flex items-center gap-1.5">
                  {DM_TAGS.map(tag => {
                    const active = selectedChatId && dmTags[selectedChatId] === tag.key
                    return (
                      <button
                        key={tag.key}
                        onClick={() => setDmTags(prev => ({ ...prev, [selectedChatId!]: active ? '' : tag.key }))}
                        className="px-2 py-1 rounded-md text-[10px] font-bold transition-all"
                        style={{
                          background: active ? `${tag.color}20` : 'transparent',
                          color: active ? tag.color : C.waGray,
                          border: `1px solid ${active ? `${tag.color}40` : 'transparent'}`,
                        }}
                      >
                        {he ? tag.labelHe : tag.label}
                      </button>
                    )
                  })}
                  <div className="w-px h-5 mx-1" style={{ background: C.waBorder }} />
                  <button
                    onClick={() => {
                      if (DEMO) { alert(he ? 'במצב דמו - יעביר ל-CRM בפרודקשן' : 'Demo mode - would push to CRM in production'); return }
                      // TODO: push to prospects table
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all hover:bg-[#16a34a15]"
                    style={{ color: '#16a34a' }}
                  >
                    <UserPlus className="w-3 h-3" />
                    {he ? 'העבר ל-CRM' : 'Push to CRM'}
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-[60px] py-4 space-y-1 scrollbar-hide">
                {chatLoading && !DEMO ? (
                  <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.waGray }} /></div>
                ) : dmMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-[13px]" style={{ color: C.waGray }}>{he ? 'אין הודעות' : 'No messages yet'}</div>
                ) : dmMessages.map(msg => {
                  const out = msg.direction === 'outgoing'
                  return (
                    <div key={msg.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="max-w-[65%] rounded-lg px-[9px] py-[6px] shadow-sm relative"
                        style={{
                          background: out ? C.outgoing : C.incoming,
                          borderTopLeftRadius: out ? 8 : 0,
                          borderTopRightRadius: out ? 0 : 8,
                        }}
                      >
                        <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap" style={{ color: C.waDark, direction: /[\u0590-\u05FF\u0600-\u06FF]/.test(msg.content) ? 'rtl' : 'ltr' }}>
                          {msg.content}
                        </p>
                        <div className={`flex items-center gap-1 justify-end mt-0.5 -mb-0.5`}>
                          <span className="text-[11px]" style={{ color: C.waGray }}>{fmtTime(msg.sent_at)}</span>
                          {out && <CheckCheck className="w-4 h-4" style={{ color: msg.read ? C.waBlue : C.waGray }} />}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Composer */}
              <div className="shrink-0 flex items-center gap-2 px-4 py-2" style={{ background: C.waHeader }}>
                {/* Template button */}
                <button onClick={() => setShowTemplates(!showTemplates)} className="w-[42px] h-[42px] rounded-full flex items-center justify-center transition-colors hover:bg-black/[0.05]" style={{ color: C.waGray }}>
                  <FileText className="w-[22px] h-[22px]" />
                </button>
                <button className="w-[42px] h-[42px] rounded-full flex items-center justify-center transition-colors hover:bg-black/[0.05]" style={{ color: C.waGray }}>
                  <Image className="w-[22px] h-[22px]" />
                </button>

                {/* Input */}
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendDM() } }}
                    placeholder={he ? 'הקלד הודעה' : 'Type a message'}
                    rows={1}
                    className="w-full px-3 py-2.5 rounded-lg text-[14px] outline-none resize-none"
                    style={{ background: '#fff', maxHeight: 100 }}
                  />
                </div>

                {/* Send / Mic */}
                {newMessage.trim() ? (
                  <button onClick={handleSendDM} disabled={sending} className="w-[42px] h-[42px] rounded-full flex items-center justify-center transition-colors" style={{ color: C.waGray }}>
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-[22px] h-[22px]" />}
                  </button>
                ) : (
                  <button className="w-[42px] h-[42px] rounded-full flex items-center justify-center transition-colors hover:bg-black/[0.05]" style={{ color: C.waGray }}>
                    <Mic className="w-[22px] h-[22px]" />
                  </button>
                )}
              </div>

              {/* Templates overlay */}
              {showTemplates && (
                <div className="absolute bottom-[60px] left-[320px] right-[300px] mx-4 rounded-xl shadow-xl border p-4 space-y-2 z-30" style={{ background: '#fff', borderColor: C.waBorder }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: C.waGray }}>Templates</span>
                    <button onClick={() => setShowTemplates(false)}><X className="w-4 h-4" style={{ color: C.waGray }} /></button>
                  </div>
                  {(templates.length > 0 ? templates : [
                    { id: 't1', name: 'Job Available', body: 'Hi! Yes the job is still available. Check details here: {job_link}', category: 'job_post' as const, placeholders: [], is_active: true, created_at: '' },
                    { id: 't2', name: 'Send Profile', body: 'Thanks for your interest! Create your profile here: masterlead.app/signup', category: 'response' as const, placeholders: [], is_active: true, created_at: '' },
                    { id: 't3', name: 'Get Details', body: 'Great! What\'s your experience and which area are you based in?', category: 'response' as const, placeholders: [], is_active: true, created_at: '' },
                  ]).slice(0, 6).map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => { setNewMessage(tpl.body); setShowTemplates(false); inputRef.current?.focus() }}
                      className="w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-[#f0f2f5]"
                    >
                      <span className="text-[13px] font-semibold block" style={{ color: C.waDark }}>{tpl.name}</span>
                      <span className="text-[12px] line-clamp-1" style={{ color: C.waGray }}>{tpl.body}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : selectedChatId && selectedChatType === 'group' ? (
            /* Group view */
            <>
              <div className="shrink-0 flex items-center gap-3 px-4 h-[59px]" style={{ background: C.waHeader, borderBottom: `1px solid ${C.waBorder}` }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: C.waGreen }}>
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="text-[15px] font-medium" style={{ color: C.waDark }}>
                    {chatList.find(c => c.type === 'group' && c.groupId === selectedChatId)?.name ?? selectedChatId}
                  </span>
                  <span className="text-[12px] block" style={{ color: C.waGray }}>{selectedChatId}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-[60px] py-6 space-y-3">
                {activityEntries.filter(e => e.group_wa_id === selectedChatId).map(entry => (
                  <div key={entry.id} className="flex justify-end">
                    <div className="max-w-[65%] rounded-lg px-[9px] py-[6px] shadow-sm" style={{ background: C.outgoing, borderTopRightRadius: 0 }}>
                      <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap" style={{ color: C.waDark }}>{entry.rendered_message}</p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <span className="text-[11px]" style={{ color: C.waGray }}>{fmtTime(entry.scheduled_at)}</span>
                        {entry.status === 'sent' && <CheckCheck className="w-4 h-4" style={{ color: C.waBlue }} />}
                        {entry.status === 'pending' && <Clock className="w-4 h-4" style={{ color: C.waGray }} />}
                      </div>
                    </div>
                  </div>
                ))}
                {activityEntries.filter(e => e.group_wa_id === selectedChatId).length === 0 && (
                  <div className="text-center py-16 text-[13px]" style={{ color: C.waGray }}>{he ? 'אין הודעות בקבוצה הזו' : 'No messages in this group yet'}</div>
                )}
              </div>
            </>
          ) : (
            /* No chat selected */
            <div className="flex-1 flex flex-col items-center justify-center" style={{ background: C.waLightGray }}>
              <div className="w-[320px] text-center">
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 303 172'%3E%3Cpath fill='%2300a884' d='M151.5 0C68 0 0 38.6 0 86.2c0 28 18.4 52.8 46.6 69.2L42 172l24-12.4c25.8 8.2 55.2 12.8 85.5 12.8 83.5 0 151.5-38.6 151.5-86.2C303 38.6 235 0 151.5 0z'/%3E%3Cpath fill='white' d='M212 65c-3.2-3.2-7.5-5-12-5h-97c-9.4 0-17 7.6-17 17v60c0 4.5 1.8 8.8 5 12 3.2 3.2 7.5 5 12 5h97c9.4 0 17-7.6 17-17V77c0-4.5-1.8-8.8-5-12z' opacity='.15'/%3E%3C/svg%3E" alt="" className="w-[260px] mx-auto mb-6 opacity-30" />
                <h2 className="text-[28px] font-light mb-2" style={{ color: '#41525d' }}>{he ? 'מרכז שליטה צבאי' : 'Army Command Center'}</h2>
                <p className="text-[14px] leading-[20px]" style={{ color: '#8696a0' }}>
                  {he ? 'בחר צ\'אט משמאל כדי לראות הודעות, או בחר חייל מלמעלה' : 'Select a chat from the left to view messages, or pick a soldier from the top bar'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Slave Profile ─── */}
        {selectedAccount && (
          <div className="w-[300px] shrink-0 flex flex-col h-full overflow-y-auto scrollbar-hide" style={{ background: C.waLightGray, borderLeft: `1px solid ${C.waBorder}` }}>
            {/* Profile header */}
            <div className="px-5 py-6 text-center" style={{ background: '#fff', borderBottom: `1px solid ${C.waBorder}` }}>
              <div className="w-[80px] h-[80px] rounded-full mx-auto mb-3 flex items-center justify-center text-white text-[28px]" style={{ background: ROLE_META[selectedAccount.army_role ?? 'publisher'].color }}>
                {ROLE_META[selectedAccount.army_role ?? 'publisher'].emoji}
              </div>
              <h3 className="text-[17px] font-medium" style={{ color: C.waDark }}>
                {selectedAccount.army_alias || selectedAccount.phone_number}
              </h3>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                {selectedAccount.status === 'connected' ? (
                  <><Wifi className="w-3.5 h-3.5 text-green-500" /><span className="text-[13px] text-green-600">{he ? 'מחובר' : 'Connected'}</span></>
                ) : (
                  <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span className="text-[13px] text-red-500">{he ? 'לא מחובר' : 'Disconnected'}</span></>
                )}
              </div>
              {selectedAccount.phone_number && (
                <p className="text-[13px] mt-1" style={{ color: C.waGray }}>{selectedAccount.phone_number}</p>
              )}
            </div>

            {/* QR if disconnected */}
            {selectedAccount.status !== 'connected' && (
              <div className="px-5 py-4 text-center" style={{ background: '#fff', borderBottom: `1px solid ${C.waBorder}` }}>
                {selectedAccount.qr_code ? (
                  <img src={`data:image/png;base64,${selectedAccount.qr_code}`} alt="QR" width={140} height={140} className="rounded-lg mx-auto" />
                ) : (
                  <button onClick={fetchQr} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg mx-auto text-[13px] font-medium" style={{ color: C.waGreen, background: '#e7fcf0' }}>
                    <QrCode className="w-4 h-4" />{he ? 'קבל QR' : 'Get QR Code'}
                  </button>
                )}
              </div>
            )}

            {/* Role */}
            <div className="px-5 py-4" style={{ background: '#fff', borderBottom: `1px solid ${C.waBorder}` }}>
              <span className="text-[12px] font-medium block mb-2" style={{ color: C.waGreen }}>{he ? 'תפקיד' : 'Role'}</span>
              <div className="flex gap-1.5">
                {Object.entries(ROLE_META).map(([key, meta]) => {
                  const active = selectedAccount.army_role === key
                  return (
                    <button key={key} onClick={() => handleRoleChange(key)} className="flex-1 py-2 rounded-lg text-[11px] font-medium text-center transition-all" style={{ background: active ? `${meta.color}15` : C.waLightGray, color: active ? meta.color : C.waGray, border: active ? `1px solid ${meta.color}30` : '1px solid transparent' }}>
                      {meta.emoji} {he ? meta.labelHe : meta.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Next Action */}
            {nextAction && (
              <div className="px-5 py-3" style={{ background: '#fff', borderBottom: `1px solid ${C.waBorder}` }}>
                <span className="text-[12px] font-medium block mb-1.5" style={{ color: C.waGreen }}>{he ? 'פעולה הבאה' : 'Next Action'}</span>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#fff8e1' }}>
                  <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold block text-amber-700">{nextAction.message_type.replace('_', ' ')}</span>
                    <span className="text-[10px] text-amber-600/70">{fmtTime(nextAction.scheduled_at)} · {nextAction.rendered_message?.slice(0, 30)}...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Groups */}
            <div className="px-5 py-4" style={{ background: '#fff', borderBottom: `1px solid ${C.waBorder}` }}>
              <span className="text-[12px] font-medium block mb-2" style={{ color: C.waGreen }}>{he ? 'קבוצות' : 'Groups'} · {accountAssignments.length}</span>
              <div className="space-y-1.5">
                {accountAssignments.map(a => (
                  <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#f0f2f5] transition-colors cursor-pointer"
                    onClick={() => { setSelectedChatId(a.group_wa_id); setSelectedChatType('group') }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: C.waGreen }}>
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] truncate block" style={{ color: C.waDark }}>{a.group_name ?? a.group_wa_id}</span>
                      <span className="text-[11px]" style={{ color: ROLE_META[a.role_in_group]?.color }}>{ROLE_META[a.role_in_group]?.emoji} {a.role_in_group}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: C.waGray }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Log */}
            <div className="px-5 py-4" style={{ background: '#fff', borderBottom: `1px solid ${C.waBorder}` }}>
              <span className="text-[12px] font-medium block mb-2" style={{ color: C.waGreen }}>{he ? 'לוג פעילות' : 'Activity Log'}</span>
              <div className="space-y-1">
                {activityEntries.filter(e => e.wa_account_id === selectedAccountId).slice(0, 5).map(entry => {
                  const typeEmoji = entry.message_type === 'job_post' ? '📢' : entry.message_type === 'response' ? '💬' : '👷'
                  const statusColor = entry.status === 'sent' ? '#16a34a' : entry.status === 'failed' ? '#dc2626' : '#d97706'
                  return (
                    <div key={entry.id} className="flex items-center gap-2 py-1.5 text-[11px]">
                      <span>{typeEmoji}</span>
                      <span className="flex-1 truncate" style={{ color: C.waGray }}>{entry.rendered_message?.slice(0, 35)}...</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                        <span style={{ color: C.waGray }}>{fmtTime(entry.scheduled_at)}</span>
                      </div>
                    </div>
                  )
                })}
                {activityEntries.filter(e => e.wa_account_id === selectedAccountId).length === 0 && (
                  <span className="text-[11px]" style={{ color: C.waGray }}>{he ? 'אין פעילות' : 'No activity'}</span>
                )}
              </div>
            </div>

            {/* Config */}
            <div className="px-5 py-4" style={{ background: '#fff' }}>
              <span className="text-[12px] font-medium block mb-2" style={{ color: C.waGreen }}>{he ? 'הגדרות' : 'Settings'}</span>
              <div className="space-y-1.5 text-[12px]" style={{ color: C.waGray }}>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{he ? 'חלון:' : 'Window:'} {config.activity_window_start} – {config.activity_window_end}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" />
                  <span>{he ? 'דיליי:' : 'Delay:'} {config.response_delay_min}-{config.response_delay_max}m</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ ADD SLAVE MODAL ═══ */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-medium" style={{ color: C.waDark }}>{he ? 'הוסף חייל חדש' : 'Add New Soldier'}</h2>
              <button onClick={() => setAddOpen(false)} className="p-1 rounded-lg hover:bg-[#f0f2f5]"><X className="w-4 h-4" style={{ color: C.waGray }} /></button>
            </div>
            <div className="space-y-3">
              <input value={formAlias} onChange={e => setFormAlias(e.target.value)} placeholder={he ? 'כינוי' : 'Alias'} className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={{ background: C.waLightGray }} />
              <input value={formId} onChange={e => setFormId(e.target.value)} placeholder="Green API Instance ID *" className="w-full px-3 py-2.5 rounded-lg text-[13px] font-mono outline-none" style={{ background: C.waLightGray }} />
              <input value={formToken} onChange={e => setFormToken(e.target.value)} placeholder="Green API Token *" className="w-full px-3 py-2.5 rounded-lg text-[13px] font-mono outline-none" style={{ background: C.waLightGray }} />
              <div className="flex gap-2">
                {Object.entries(ROLE_META).map(([key, meta]) => {
                  const active = formRole === key
                  return (
                    <button key={key} onClick={() => setFormRole(key as typeof formRole)} className="flex-1 py-2.5 rounded-lg text-[12px] font-medium transition-all" style={{ background: active ? `${meta.color}15` : C.waLightGray, color: active ? meta.color : C.waGray }}>
                      {meta.emoji} {he ? meta.labelHe : meta.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <button onClick={handleAddSlave} disabled={formSaving || !formId || !formToken} className="w-full py-3 rounded-lg text-[14px] font-medium text-white disabled:opacity-40 transition-all" style={{ background: C.waGreen }}>
              {formSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (he ? 'הוסף' : 'Add Soldier')}
            </button>
          </div>
        </div>
      )}

      {/* Demo badge */}
      {DEMO && (
        <div className="absolute top-[62px] right-4 px-3 py-1 rounded-full text-[10px] font-bold text-amber-700" style={{ background: '#fef3c7' }}>
          DEMO MODE
        </div>
      )}
    </div>
  )
}
