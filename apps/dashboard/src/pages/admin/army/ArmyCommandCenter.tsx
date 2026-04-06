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
} from '../../../hooks/useArmyData'
import {
  Wifi, WifiOff, Megaphone, MessageCircleReply, HardHat,
  Loader2, Send, Search, QrCode, Plus, X, Trash2,
  MessageCircle, Users, Power, PowerOff, Settings,
  Check, CheckCheck, Clock, ChevronDown,
  Swords, Activity, Eye,
} from 'lucide-react'

/* ── Design tokens (matching AdminInbox) ─── */
const C = {
  primary: '#DC2626',
  dark: '#1C1C1E',
  cream: '#FBFBFD',
  border: 'rgba(0,0,0,0.04)',
  gray: '#3A3A3C',
  muted: '#8E8E93',
  bg: '#FBFBFD',
  glass: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(0,0,0,0.04)',
  card: '#FFFFFF',
  panelShadow: '0 10px 40px -10px rgba(0,0,0,0.05)',
  panelRadius: '24px',
  hoverShadow: '0 8px 24px rgba(0,0,0,0.06)',
}

const ROLE_META: Record<string, { label: string; labelHe: string; color: string; icon: typeof Megaphone }> = {
  publisher: { label: 'Publisher', labelHe: 'מפרסם', color: '#2563eb', icon: Megaphone },
  responder: { label: 'Responder', labelHe: 'מגיב', color: '#f59e0b', icon: MessageCircleReply },
  contractor: { label: 'Contractor', labelHe: 'קבלן', color: '#10b981', icon: HardHat },
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

  /* ── Demo mode: show mock data when no real accounts exist ── */
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
    { id: 'da-1', wa_account_id: 'demo-1', group_wa_id: '120363001@g.us', group_name: 'Miami Renovations', role_in_group: 'publisher', is_active: true },
    { id: 'da-2', wa_account_id: 'demo-2', group_wa_id: '120363001@g.us', group_name: 'Miami Renovations', role_in_group: 'responder', is_active: true },
    { id: 'da-3', wa_account_id: 'demo-1', group_wa_id: '120363002@g.us', group_name: 'FL Plumbers Network', role_in_group: 'publisher', is_active: true },
    { id: 'da-4', wa_account_id: 'demo-3', group_wa_id: '120363002@g.us', group_name: 'FL Plumbers Network', role_in_group: 'responder', is_active: true },
    { id: 'da-5', wa_account_id: 'demo-4', group_wa_id: '120363003@g.us', group_name: 'Orlando Contractors', role_in_group: 'contractor', is_active: true },
    { id: 'da-6', wa_account_id: 'demo-1', group_wa_id: '120363004@g.us', group_name: 'South FL HVAC Jobs', role_in_group: 'publisher', is_active: true },
  ] : []

  const DEMO_CONVERSATIONS: DMConversation[] = DEMO ? [
    { sender_phone: '+1 (305) 444-1234', sender_name: 'Carlos Rivera', last_message: 'Hey I saw the plumbing job in Miami Beach, I\'m interested! I have 8 years experience', last_message_at: new Date(Date.now() - 12 * 60000).toISOString(), unread_count: 2 },
    { sender_phone: '+1 (786) 333-5678', sender_name: 'Mike Thompson', last_message: 'Is the HVAC job still available? I can start next week', last_message_at: new Date(Date.now() - 45 * 60000).toISOString(), unread_count: 1 },
    { sender_phone: '+1 (954) 222-9012', sender_name: 'David Cohen', last_message: 'Thanks for the info, I signed up on masterlead', last_message_at: new Date(Date.now() - 3 * 3600000).toISOString(), unread_count: 0 },
    { sender_phone: '+1 (407) 111-3456', sender_name: null, last_message: 'Hi, I need a painter for my house renovation. Budget around $3k', last_message_at: new Date(Date.now() - 5 * 3600000).toISOString(), unread_count: 1 },
  ] : []

  const DEMO_CHAT: ArmyDM[] = DEMO ? [
    { id: 'dm-1', wa_account_id: 'demo-1', sender_phone: '+1 (305) 444-1234', sender_name: 'Carlos Rivera', direction: 'incoming', content: 'Hey, saw your post about the plumbing job in Miami Beach. Is it still available?', wa_message_id: null, sent_at: new Date(Date.now() - 30 * 60000).toISOString(), read: true },
    { id: 'dm-2', wa_account_id: 'demo-1', sender_phone: '+1 (305) 444-1234', sender_name: 'Carlos Rivera', direction: 'outgoing', content: 'Hi Carlos! Yes it\'s available. Check out the full details here: masterlead.app/jobs/abc123', wa_message_id: null, sent_at: new Date(Date.now() - 25 * 60000).toISOString(), read: true },
    { id: 'dm-3', wa_account_id: 'demo-1', sender_phone: '+1 (305) 444-1234', sender_name: 'Carlos Rivera', direction: 'incoming', content: 'Great, I just signed up on the platform. I have 8 years experience in residential plumbing', wa_message_id: null, sent_at: new Date(Date.now() - 15 * 60000).toISOString(), read: true },
    { id: 'dm-4', wa_account_id: 'demo-1', sender_phone: '+1 (305) 444-1234', sender_name: 'Carlos Rivera', direction: 'incoming', content: 'I can start as early as next Monday. Let me know!', wa_message_id: null, sent_at: new Date(Date.now() - 12 * 60000).toISOString(), read: false },
  ] : []

  const DEMO_ACTIVITY = DEMO ? [
    { id: 'act-1', group_wa_id: '120363001@g.us', wa_account_id: 'demo-1', template_id: null, message_type: 'job_post', scheduled_at: new Date(Date.now() - 2 * 3600000).toISOString(), sent_at: new Date(Date.now() - 2 * 3600000).toISOString(), status: 'sent' as const, rendered_message: '🔨 Kitchen renovation job | Miami, FL\n💰 $3,500 - $5,000\n📍 Miami Beach area\n\nFull details: masterlead.app/jobs/abc123', error: null, created_at: new Date().toISOString() },
    { id: 'act-2', group_wa_id: '120363001@g.us', wa_account_id: 'demo-2', template_id: null, message_type: 'response', scheduled_at: new Date(Date.now() - 1.5 * 3600000).toISOString(), sent_at: new Date(Date.now() - 1.5 * 3600000).toISOString(), status: 'sent' as const, rendered_message: 'Wow just signed up through the link, amazing platform! 🔥', error: null, created_at: new Date().toISOString() },
    { id: 'act-3', group_wa_id: '120363002@g.us', wa_account_id: 'demo-1', template_id: null, message_type: 'job_post', scheduled_at: new Date(Date.now() - 1 * 3600000).toISOString(), sent_at: new Date(Date.now() - 1 * 3600000).toISOString(), status: 'sent' as const, rendered_message: '🔧 Looking for experienced plumber | Fort Lauderdale, FL\n💰 $2,000 - $4,000\n\nApply here: masterlead.app/jobs/def456', error: null, created_at: new Date().toISOString() },
    { id: 'act-4', group_wa_id: '120363003@g.us', wa_account_id: 'demo-4', template_id: null, message_type: 'contractor_promo', scheduled_at: new Date(Date.now() - 0.5 * 3600000).toISOString(), sent_at: new Date(Date.now() - 0.5 * 3600000).toISOString(), status: 'sent' as const, rendered_message: '👋 Hi, I\'m Mike - 12 years experience in general contracting\n⭐ 4.9 rating | 47 jobs completed\n\nMy profile: masterlead.app/pro/mike-r', error: null, created_at: new Date().toISOString() },
    { id: 'act-5', group_wa_id: '120363004@g.us', wa_account_id: 'demo-1', template_id: null, message_type: 'job_post', scheduled_at: new Date(Date.now() + 1 * 3600000).toISOString(), sent_at: null, status: 'pending' as const, rendered_message: '❄️ HVAC maintenance needed | Tampa, FL\n💰 $500 - $1,500\n\nDetails: masterlead.app/jobs/ghi789', error: null, created_at: new Date().toISOString() },
  ] : []

  const accounts = DEMO ? DEMO_ACCOUNTS : realAccounts
  const assignments = DEMO ? DEMO_ASSIGNMENTS : realAssignments
  const unreadCounts = DEMO ? { 'demo-1': 3, 'demo-2': 0, 'demo-4': 1 } : realUnreadCounts
  const activityEntries = DEMO ? DEMO_ACTIVITY : realActivityEntries

  /* ── Selection state ── */
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [centerTab, setCenterTab] = useState<'dms' | 'groups' | 'activity'>('dms')
  const [selectedDMPhone, setSelectedDMPhone] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  /* ── DM data ── */
  const { conversations: realConvos, loading: convoLoading, refetch: refetchConvos } = useArmyDMConversations(DEMO ? null : selectedAccountId)
  const { messages: realDmMessages, loading: chatLoading, refetch: refetchChat } = useArmyDMChat(DEMO ? null : selectedAccountId, DEMO ? null : selectedDMPhone)
  const conversations = DEMO && selectedAccountId === 'demo-1' ? DEMO_CONVERSATIONS : DEMO ? [] : realConvos
  const dmMessages = DEMO && selectedDMPhone ? DEMO_CHAT.filter(m => m.sender_phone === selectedDMPhone) : realDmMessages

  /* ── Composer ── */
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  /* ── Add slave modal ── */
  const [addOpen, setAddOpen] = useState(false)
  const [formId, setFormId] = useState('')
  const [formToken, setFormToken] = useState('')
  const [formAlias, setFormAlias] = useState('')
  const [formRole, setFormRole] = useState<'publisher' | 'responder' | 'contractor'>('publisher')
  const [formSaving, setFormSaving] = useState(false)

  /* ── Assignment modal ── */
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignGroupId, setAssignGroupId] = useState('')
  const [assignGroupName, setAssignGroupName] = useState('')
  const [assignRole, setAssignRole] = useState<'publisher' | 'responder' | 'contractor'>('publisher')

  const selectedAccount = useMemo(() => accounts.find(a => a.id === selectedAccountId) ?? null, [accounts, selectedAccountId])
  const accountAssignments = useMemo(() => assignments.filter(a => a.wa_account_id === selectedAccountId), [assignments, selectedAccountId])

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [dmMessages])

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    if (!searchQuery) return accounts
    const q = searchQuery.toLowerCase()
    return accounts.filter(a =>
      (a.army_alias ?? '').toLowerCase().includes(q) ||
      (a.phone_number ?? '').includes(q) ||
      (a.army_role ?? '').includes(q)
    )
  }, [accounts, searchQuery])

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
    setFormSaving(false)
    setAddOpen(false)
    setFormId(''); setFormToken(''); setFormAlias('')
    refetchAccounts()
  }

  async function handleDeleteSlave(id: string) {
    if (!confirm(he ? 'למחוק חשבון?' : 'Delete account?')) return
    await supabase.from('wa_accounts').delete().eq('id', id)
    if (selectedAccountId === id) setSelectedAccountId(null)
    refetchAccounts()
  }

  async function handleRoleChange(role: string) {
    if (!selectedAccountId) return
    await supabase.from('wa_accounts').update({ army_role: role }).eq('id', selectedAccountId)
    refetchAccounts()
  }

  async function fetchQr() {
    if (!selectedAccount) return
    try {
      const url = `${selectedAccount.green_api_url}/waInstance${selectedAccount.green_api_id}/qr/${selectedAccount.green_api_token}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.type === 'qrCode' && data.message) {
        await supabase.from('wa_accounts').update({ qr_code: data.message, status: 'waiting_qr' }).eq('id', selectedAccount.id)
        refetchAccounts()
      }
    } catch { /* ignore */ }
  }

  async function handleAddAssignment() {
    if (!selectedAccountId || !assignGroupId) return
    await supabase.from('army_assignments').upsert({
      wa_account_id: selectedAccountId,
      group_wa_id: assignGroupId,
      group_name: assignGroupName || assignGroupId,
      role_in_group: assignRole,
      is_active: true,
    }, { onConflict: 'wa_account_id,group_wa_id,role_in_group' })
    setAssignOpen(false)
    setAssignGroupId(''); setAssignGroupName('')
    refetchAssignments()
  }

  async function handleRemoveAssignment(id: string) {
    await supabase.from('army_assignments').delete().eq('id', id)
    refetchAssignments()
  }

  async function handleSendDM() {
    if (!newMessage.trim() || !selectedAccount || !selectedDMPhone) return
    setSending(true)
    try {
      const url = `${selectedAccount.green_api_url}/waInstance${selectedAccount.green_api_id}/sendMessage/${selectedAccount.green_api_token}`
      const chatId = selectedDMPhone.includes('@') ? selectedDMPhone : `${selectedDMPhone}@c.us`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: newMessage }),
      })
      const data = await res.json()
      if (data.idMessage) {
        await supabase.from('army_dms').insert({
          wa_account_id: selectedAccount.id,
          sender_phone: selectedDMPhone,
          direction: 'outgoing',
          content: newMessage,
          wa_message_id: data.idMessage,
          sent_at: new Date().toISOString(),
          read: true,
        })
        setNewMessage('')
        refetchChat()
      }
    } catch { /* ignore */ }
    setSending(false)
  }

  /* ══════════════════════════════════════════════════════════════ */
  if (accLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.primary }} />
      </div>
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: C.bg }}>

      {/* ═══ LEFT PANEL: Slave List ═══════════════════════════════ */}
      <div className="w-[280px] shrink-0 flex flex-col h-full border-r" style={{ borderColor: C.glassBorder, background: C.glass, backdropFilter: 'blur(24px)' }}>
        {/* Header */}
        <div className="shrink-0 px-4 pt-4 pb-2 space-y-3" style={{ borderBottom: `1px solid ${C.glassBorder}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4" style={{ color: C.primary }} />
              <span className="text-[13px] font-extrabold uppercase tracking-[0.08em]" style={{ color: C.primary }}>
                {he ? 'צבא' : 'Army'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${C.primary}15`, color: C.primary }}>
                {accounts.length}
              </span>
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="w-7 h-7 rounded-xl flex items-center justify-center transition-all hover:shadow-sm"
              style={{ background: C.primary, color: '#fff' }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E8E93]" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={he ? 'חיפוש...' : 'Search...'}
              className="w-full h-8 pl-8 pr-3 rounded-xl text-[12px] outline-none transition-all"
              style={{ background: 'rgba(0,0,0,0.03)', border: `1px solid transparent` }}
            />
          </div>

          {/* Master toggle */}
          <button
            onClick={() => updateConfig('enabled', config.enabled ? 'false' : 'true')}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-bold transition-all"
            style={{
              background: config.enabled ? '#10b98112' : '#ef444412',
              color: config.enabled ? '#10b981' : '#ef4444',
              border: `1px solid ${config.enabled ? '#10b98120' : '#ef444420'}`,
            }}
          >
            {config.enabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
            {config.enabled ? (he ? 'פעיל' : 'ACTIVE') : (he ? 'מושבת' : 'DISABLED')}
          </button>
        </div>

        {/* Account list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
          {filteredAccounts.map(acc => {
            const role = ROLE_META[acc.army_role ?? 'publisher']
            const connected = acc.status === 'connected'
            const isActive = acc.id === selectedAccountId
            const unread = unreadCounts[acc.id] || 0
            const Icon = role.icon

            return (
              <button
                key={acc.id}
                onClick={() => { setSelectedAccountId(acc.id); setSelectedDMPhone(null); setCenterTab('dms') }}
                className={`w-full flex items-center gap-3 p-3 text-left transition-all rounded-2xl relative overflow-hidden group ${
                  isActive ? 'bg-white shadow-md ring-2' : 'hover:bg-white/60 hover:shadow-sm'
                }`}
                style={isActive ? { ringColor: `${C.primary}30` } : undefined}
              >
                {isActive && <div className="absolute top-0 bottom-0 left-0 w-1.5 rounded-r" style={{ background: C.primary }} />}

                {/* Avatar */}
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-[14px]"
                    style={{ background: role.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${connected ? 'bg-green-500' : 'bg-red-400'}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold truncate" style={{ color: C.dark }}>
                      {acc.army_alias || acc.phone_number || acc.green_api_id}
                    </span>
                    {unread > 0 && (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: C.primary }}>
                        {unread}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded-md" style={{ background: `${role.color}15`, color: role.color }}>
                      {he ? role.labelHe : role.label}
                    </span>
                    {acc.phone_number && (
                      <span className="text-[10px] text-[#8E8E93] truncate">{acc.phone_number}</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}

          {filteredAccounts.length === 0 && (
            <div className="text-center py-12">
              <Swords className="w-8 h-8 mx-auto mb-3 text-[#D1D1D6]" />
              <p className="text-[13px] font-bold text-[#8E8E93]">{he ? 'אין חיילים' : 'No soldiers yet'}</p>
              <p className="text-[11px] text-[#C7C7CC] mt-1">{he ? 'הוסף חשבון WhatsApp' : 'Add a WhatsApp account'}</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ CENTER PANEL: Chat / Groups / Activity ═════════════ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedAccount ? (
          <>
            {/* Header */}
            <div className="shrink-0 flex items-center gap-4 px-6 h-[64px]" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', borderBottom: `1px solid ${C.glassBorder}` }}>
              <div className="flex items-center gap-3 flex-1">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold" style={{ background: ROLE_META[selectedAccount.army_role ?? 'publisher'].color }}>
                    {(() => { const I = ROLE_META[selectedAccount.army_role ?? 'publisher'].icon; return <I className="w-5 h-5" /> })()}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${selectedAccount.status === 'connected' ? 'bg-green-500' : 'bg-red-400'}`} />
                </div>
                <div>
                  <h2 className="text-[16px] font-bold" style={{ color: C.dark }}>
                    {selectedAccount.army_alias || selectedAccount.phone_number || selectedAccount.green_api_id}
                  </h2>
                  <span className="text-[11px] font-medium" style={{ color: C.muted }}>
                    {selectedAccount.status === 'connected' ? (he ? 'מחובר' : 'Connected') : (he ? 'לא מחובר' : 'Disconnected')}
                    {selectedAccount.phone_number && ` · ${selectedAccount.phone_number}`}
                  </span>
                </div>
              </div>

              {/* Center tabs */}
              <div className="flex items-center gap-1 bg-black/[0.03] rounded-xl p-1">
                {([
                  { key: 'dms' as const, label: he ? 'הודעות' : 'DMs', icon: MessageCircle },
                  { key: 'groups' as const, label: he ? 'קבוצות' : 'Groups', icon: Users },
                  { key: 'activity' as const, label: he ? 'פעילות' : 'Activity', icon: Activity },
                ]).map(tab => {
                  const active = centerTab === tab.key
                  const TabIcon = tab.icon
                  return (
                    <button
                      key={tab.key}
                      onClick={() => { setCenterTab(tab.key); setSelectedDMPhone(null) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                      style={{
                        background: active ? '#fff' : 'transparent',
                        color: active ? C.primary : C.muted,
                        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      <TabIcon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex">
              {centerTab === 'dms' && !selectedDMPhone && (
                /* DM Conversations List */
                <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide" style={{ background: C.cream }}>
                  {convoLoading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#8E8E93]" /></div>
                  ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-20 h-20 rounded-[32px] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.04)] flex items-center justify-center mb-6">
                        <MessageCircle className="w-8 h-8 text-[#D1D1D6]" />
                      </div>
                      <p className="text-lg font-bold" style={{ color: C.dark }}>{he ? 'אין הודעות פרטיות' : 'No private messages'}</p>
                      <p className="text-[13px] mt-1" style={{ color: C.muted }}>{he ? 'כשמישהו ישלח הודעה לחשבון הזה, היא תופיע כאן' : 'When someone DMs this account, it will appear here'}</p>
                    </div>
                  ) : conversations.map(convo => (
                    <button
                      key={convo.sender_phone}
                      onClick={() => setSelectedDMPhone(convo.sender_phone)}
                      className="w-full flex items-center gap-3 p-4 text-left rounded-2xl bg-white border transition-all hover:shadow-md active:scale-[0.99]"
                      style={{ borderColor: convo.unread_count > 0 ? `${C.primary}30` : C.glassBorder }}
                    >
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-[16px] font-bold text-gray-500">
                        {(convo.sender_name ?? convo.sender_phone).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-[14px] truncate ${convo.unread_count > 0 ? 'font-bold' : 'font-semibold'}`} style={{ color: C.dark }}>
                            {convo.sender_name ?? convo.sender_phone}
                          </span>
                          <span className="text-[10px] font-bold shrink-0 ml-2" style={{ color: convo.unread_count > 0 ? C.primary : C.muted }}>
                            {timeAgo(convo.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className={`text-[12px] truncate ${convo.unread_count > 0 ? 'font-semibold text-[#1C1C1E]' : 'text-[#8E8E93]'}`}>
                            {convo.last_message.substring(0, 60)}
                          </p>
                          {convo.unread_count > 0 && (
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 ml-2" style={{ background: C.primary }}>
                              {convo.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {centerTab === 'dms' && selectedDMPhone && (
                /* DM Chat */
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Chat header */}
                  <div className="shrink-0 flex items-center gap-3 px-6 h-[52px]" style={{ background: 'rgba(255,255,255,0.95)', borderBottom: `1px solid ${C.glassBorder}` }}>
                    <button onClick={() => setSelectedDMPhone(null)} className="text-[12px] font-semibold px-2 py-1 rounded-lg hover:bg-black/[0.04] transition-all" style={{ color: C.primary }}>
                      {he ? '← חזרה' : '← Back'}
                    </button>
                    <div className="w-px h-5 bg-black/[0.06]" />
                    <span className="text-[14px] font-bold" style={{ color: C.dark }}>{selectedDMPhone}</span>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-8 py-6 space-y-3 scrollbar-hide" style={{ background: C.cream }}>
                    {chatLoading ? (
                      <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-[#8E8E93]" /></div>
                    ) : dmMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-[13px] text-[#8E8E93]">{he ? 'אין הודעות' : 'No messages'}</div>
                    ) : dmMessages.map(msg => {
                      const out = msg.direction === 'outgoing'
                      return (
                        <div key={msg.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[70%] rounded-[20px] px-5 py-3 shadow-sm ${out ? 'text-white' : 'border'}`}
                            style={{
                              background: out ? C.dark : '#fff',
                              borderColor: out ? 'transparent' : 'rgba(0,0,0,0.02)',
                              borderBottomRightRadius: out ? 6 : 20,
                              borderBottomLeftRadius: out ? 20 : 6,
                            }}
                          >
                            <p className="text-[14px] leading-[1.55] whitespace-pre-wrap font-medium"
                              style={{ direction: /[\u0590-\u05FF\u0600-\u06FF]/.test(msg.content) ? 'rtl' : 'ltr' }}>
                              {msg.content}
                            </p>
                            <div className={`flex items-center gap-2 mt-2 ${out ? 'justify-end opacity-80' : 'justify-start opacity-40'}`}>
                              <span className="text-[10px] font-bold">{fmtTime(msg.sent_at)}</span>
                              {out && <CheckCheck className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Composer */}
                  <div className="shrink-0 px-6 py-4 flex items-end gap-3" style={{ background: 'rgba(255,255,255,0.95)', borderTop: `1px solid ${C.glassBorder}` }}>
                    <textarea
                      ref={inputRef}
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendDM() } }}
                      placeholder={he ? 'כתוב הודעה...' : 'Type a message...'}
                      rows={1}
                      className="flex-1 px-4 py-3 rounded-2xl text-[14px] outline-none resize-none"
                      style={{ background: 'rgba(0,0,0,0.03)', border: `1px solid ${C.glassBorder}`, maxHeight: 120 }}
                    />
                    <button
                      onClick={handleSendDM}
                      disabled={sending || !newMessage.trim()}
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white transition-all disabled:opacity-40"
                      style={{ background: C.primary }}
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {centerTab === 'groups' && (
                /* Groups list */
                <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide" style={{ background: C.cream }}>
                  {accountAssignments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-20 h-20 rounded-[32px] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.04)] flex items-center justify-center mb-6">
                        <Users className="w-8 h-8 text-[#D1D1D6]" />
                      </div>
                      <p className="text-lg font-bold" style={{ color: C.dark }}>{he ? 'אין קבוצות מוקצות' : 'No groups assigned'}</p>
                      <p className="text-[13px] mt-1" style={{ color: C.muted }}>{he ? 'הוסף קבוצה בפאנל הימני' : 'Add a group from the right panel'}</p>
                    </div>
                  ) : accountAssignments.map(assign => {
                    const roleColor = assign.role_in_group === 'publisher' ? '#2563eb' : assign.role_in_group === 'responder' ? '#f59e0b' : '#10b981'
                    const todayMsgs = activityEntries.filter(e => e.wa_account_id === selectedAccountId && e.group_wa_id === assign.group_wa_id && e.status === 'sent').length
                    return (
                      <div key={assign.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white border transition-all hover:shadow-sm" style={{ borderColor: C.glassBorder }}>
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${roleColor}12` }}>
                          <Users className="w-5 h-5" style={{ color: roleColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[14px] font-bold truncate block" style={{ color: C.dark }}>{assign.group_name ?? assign.group_wa_id}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{ background: `${roleColor}15`, color: roleColor }}>
                              {assign.role_in_group}
                            </span>
                            {todayMsgs > 0 && (
                              <span className="text-[10px] text-[#8E8E93]">{todayMsgs} {he ? 'נשלחו היום' : 'sent today'}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-[#C7C7CC] truncate max-w-[120px]">{assign.group_wa_id}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {centerTab === 'activity' && (
                /* Activity log */
                <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-hide" style={{ background: C.cream }}>
                  {activityEntries.filter(e => !selectedAccountId || e.wa_account_id === selectedAccountId).length === 0 ? (
                    <div className="text-center py-20 text-[13px] text-[#8E8E93]">{he ? 'אין פעילות עדיין' : 'No activity yet'}</div>
                  ) : activityEntries.filter(e => !selectedAccountId || e.wa_account_id === selectedAccountId).map(entry => {
                    const typeColor = entry.message_type === 'job_post' ? '#2563eb' : entry.message_type === 'response' ? '#f59e0b' : '#10b981'
                    const statusColor = entry.status === 'sent' ? '#10b981' : entry.status === 'failed' ? '#ef4444' : '#f59e0b'
                    return (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border text-[11px]" style={{ borderColor: C.glassBorder }}>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor }} />
                        <span className="font-bold shrink-0" style={{ color: typeColor }}>{entry.message_type.replace('_', ' ')}</span>
                        <span className="text-[#8E8E93] truncate flex-1">{entry.rendered_message?.slice(0, 50) ?? '...'}</span>
                        <span className="text-[#C7C7CC] font-mono shrink-0">{fmtTime(entry.scheduled_at)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* No selection */
          <div className="flex-1 flex flex-col items-center justify-center" style={{ background: C.cream }}>
            <div className="w-24 h-24 rounded-[40px] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.04)] flex items-center justify-center mb-8">
              <Swords className="w-10 h-10 text-[#D1D1D6]" />
            </div>
            <p className="text-xl font-bold" style={{ color: C.dark }}>{he ? 'בחר חייל' : 'Select a soldier'}</p>
            <p className="text-[15px] font-medium mt-2" style={{ color: C.muted }}>{he ? 'בחר חשבון מהרשימה כדי לנהל אותו' : 'Pick an account from the list to manage'}</p>
          </div>
        )}
      </div>

      {/* ═══ RIGHT PANEL: Slave Details ══════════════════════════ */}
      {selectedAccount && (
        <div className="w-[300px] shrink-0 flex flex-col h-full overflow-y-auto border-l scrollbar-hide" style={{ borderColor: C.glassBorder, background: C.glass, backdropFilter: 'blur(24px)' }}>
          <div className="p-5 space-y-5">

            {/* Connection */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: C.muted }}>{he ? 'חיבור' : 'Connection'}</h3>
              {selectedAccount.status === 'connected' ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#10b98112' }}>
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="text-[12px] font-bold text-green-600">{he ? 'מחובר' : 'Connected'}</span>
                  {selectedAccount.connected_since && (
                    <span className="text-[10px] text-green-500/60 ml-auto">{new Date(selectedAccount.connected_since).toLocaleDateString()}</span>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#ef444412' }}>
                    <WifiOff className="w-4 h-4 text-red-400" />
                    <span className="text-[12px] font-bold text-red-500">{he ? 'לא מחובר' : 'Disconnected'}</span>
                  </div>
                  {selectedAccount.qr_code ? (
                    <div className="flex flex-col items-center py-3">
                      <img src={`data:image/png;base64,${selectedAccount.qr_code}`} alt="QR" width={160} height={160} className="rounded-xl" />
                      <span className="text-[10px] text-[#8E8E93] mt-2">{he ? 'סרוק עם WhatsApp' : 'Scan with WhatsApp'}</span>
                    </div>
                  ) : (
                    <button onClick={fetchQr} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold border transition-all hover:shadow-sm" style={{ color: C.primary, borderColor: `${C.primary}30` }}>
                      <QrCode className="w-4 h-4" />
                      {he ? 'קבל QR' : 'Get QR Code'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Role */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: C.muted }}>{he ? 'תפקיד' : 'Role'}</h3>
              <div className="flex gap-1.5">
                {Object.entries(ROLE_META).map(([key, meta]) => {
                  const Icon = meta.icon
                  const active = selectedAccount.army_role === key
                  return (
                    <button
                      key={key}
                      onClick={() => handleRoleChange(key)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-all"
                      style={{
                        background: active ? `${meta.color}15` : 'rgba(0,0,0,0.02)',
                        color: active ? meta.color : '#8E8E93',
                        border: `1px solid ${active ? `${meta.color}25` : 'transparent'}`,
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {he ? meta.labelHe : meta.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Groups */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: C.muted }}>{he ? 'קבוצות' : 'Groups'} ({accountAssignments.length})</h3>
                <button
                  onClick={() => setAssignOpen(true)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:bg-black/[0.04]"
                  style={{ color: C.primary }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1.5">
                {accountAssignments.map(a => {
                  const color = a.role_in_group === 'publisher' ? '#2563eb' : a.role_in_group === 'responder' ? '#f59e0b' : '#10b981'
                  return (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border" style={{ borderColor: C.glassBorder }}>
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-[11px] font-semibold truncate flex-1" style={{ color: C.dark }}>{a.group_name ?? a.group_wa_id}</span>
                      <button onClick={() => handleRemoveAssignment(a.id)} className="opacity-30 hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Templates count */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: C.muted }}>{he ? 'תבניות' : 'Templates'}</h3>
              <div className="flex gap-2">
                {(['job_post', 'response', 'contractor_promo'] as const).map(cat => {
                  const count = templates.filter(t => t.category === cat && t.is_active).length
                  const color = cat === 'job_post' ? '#2563eb' : cat === 'response' ? '#f59e0b' : '#10b981'
                  return (
                    <div key={cat} className="flex-1 px-2 py-2 rounded-xl text-center" style={{ background: `${color}08` }}>
                      <span className="text-[16px] font-black block" style={{ color }}>{count}</span>
                      <span className="text-[9px] font-bold uppercase" style={{ color: `${color}80` }}>
                        {cat === 'job_post' ? 'Jobs' : cat === 'response' ? 'Replies' : 'Promos'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Config */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: C.muted }}>{he ? 'הגדרות' : 'Config'}</h3>
              <div className="flex items-center gap-2 text-[11px] text-[#8E8E93]">
                <Clock className="w-3.5 h-3.5" />
                <span>{config.activity_window_start} – {config.activity_window_end}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#8E8E93]">
                <Activity className="w-3.5 h-3.5" />
                <span>{he ? 'דיליי:' : 'Delay:'} {config.response_delay_min}-{config.response_delay_max}m</span>
              </div>
            </div>

            {/* Delete */}
            <button
              onClick={() => handleDeleteSlave(selectedAccount.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold text-red-400 border border-red-100 hover:bg-red-50 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {he ? 'מחק חשבון' : 'Delete Account'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ MODALS ═══════════════════════════════════════════════ */}

      {/* Add Slave */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold" style={{ color: C.dark }}>{he ? 'הוסף חייל חדש' : 'Add New Soldier'}</h2>
              <button onClick={() => setAddOpen(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <input value={formAlias} onChange={e => setFormAlias(e.target.value)} placeholder={he ? 'כינוי' : 'Alias (e.g. Slave-Miami-01)'} className="w-full px-4 py-2.5 rounded-xl border text-[13px] outline-none focus:border-red-300" style={{ borderColor: C.glassBorder }} />
              <input value={formId} onChange={e => setFormId(e.target.value)} placeholder="Green API Instance ID *" className="w-full px-4 py-2.5 rounded-xl border text-[13px] font-mono outline-none focus:border-red-300" style={{ borderColor: C.glassBorder }} />
              <input value={formToken} onChange={e => setFormToken(e.target.value)} placeholder="Green API Token *" className="w-full px-4 py-2.5 rounded-xl border text-[13px] font-mono outline-none focus:border-red-300" style={{ borderColor: C.glassBorder }} />
              <div className="flex gap-2">
                {Object.entries(ROLE_META).map(([key, meta]) => {
                  const Icon = meta.icon; const active = formRole === key
                  return (
                    <button key={key} onClick={() => setFormRole(key as typeof formRole)} className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-bold transition-all" style={{ background: active ? `${meta.color}15` : '#f9f9f9', color: active ? meta.color : '#8E8E93', border: `1px solid ${active ? `${meta.color}25` : '#efeff1'}` }}>
                      <Icon className="w-3.5 h-3.5" />{he ? meta.labelHe : meta.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <button onClick={handleAddSlave} disabled={formSaving || !formId || !formToken} className="w-full py-3 rounded-xl text-[13px] font-bold text-white disabled:opacity-40 transition-all" style={{ background: C.primary }}>
              {formSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (he ? 'הוסף' : 'Add Soldier')}
            </button>
          </div>
        </div>
      )}

      {/* Add Assignment */}
      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold" style={{ color: C.dark }}>{he ? 'הוסף קבוצה' : 'Add Group'}</h2>
              <button onClick={() => setAssignOpen(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <input value={assignGroupId} onChange={e => setAssignGroupId(e.target.value)} placeholder="Group ID (120363...@g.us)" className="w-full px-4 py-2.5 rounded-xl border text-[13px] font-mono outline-none focus:border-red-300" style={{ borderColor: C.glassBorder }} />
              <input value={assignGroupName} onChange={e => setAssignGroupName(e.target.value)} placeholder={he ? 'שם קבוצה' : 'Group name'} className="w-full px-4 py-2.5 rounded-xl border text-[13px] outline-none focus:border-red-300" style={{ borderColor: C.glassBorder }} />
              <div className="flex gap-2">
                {(['publisher', 'responder', 'contractor'] as const).map(r => {
                  const color = r === 'publisher' ? '#2563eb' : r === 'responder' ? '#f59e0b' : '#10b981'
                  const active = assignRole === r
                  return (
                    <button key={r} onClick={() => setAssignRole(r)} className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all" style={{ background: active ? `${color}15` : '#f9f9f9', color: active ? color : '#8E8E93', border: `1px solid ${active ? `${color}25` : '#efeff1'}` }}>
                      {r}
                    </button>
                  )
                })}
              </div>
            </div>
            <button onClick={handleAddAssignment} disabled={!assignGroupId} className="w-full py-3 rounded-xl text-[13px] font-bold text-white disabled:opacity-40 transition-all" style={{ background: C.primary }}>
              {he ? 'הוסף' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
