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
  useArmyScenarios,
  type ArmyAccount,
  type ArmyAssignment,
  type ArmyDM,
  type DMConversation,
  type ArmyScheduleEntry,
  type ArmyScenario,
  type ScenarioLine,
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

  /* ── Scenarios ── */
  const { scenarios: realScenarios, refetch: refetchScenarios } = useArmyScenarios()

  const DEMO_SCENARIOS: ArmyScenario[] = DEMO ? [
    { id: 'sc-1', name: 'מחפש עבודה', description: 'חייל שואל איפה למצוא עבודות, חבר ממליץ על masterlead דרך אגב', category: 'job_inquiry', cooldown_days: 3, placeholders: ['{city}', '{profession}'], lines: [
      { role: 'A', delay_min: 0, delay_max: 0, text: 'אחי מישהו יודע איפה למצוא עבודות {profession} באזור {city}?', variations: ['חבר׳ה מישהו מכיר עבודות {profession} ב{city}?', 'יש פה מישהו שיודע על עבודות {profession} באזור {city}?'] },
      { role: 'B', delay_min: 3, delay_max: 8, text: 'יש אפליקציה חדשה masterlead תיכנס שם, אני נרשמתי שבוע שעבר', variations: ['תנסה masterlead, אני מוצא שם עבודות כל הזמן', 'אני נרשמתי ל-masterlead לפני שבועיים, יש שם הכל'] },
      { role: 'A', delay_min: 1, delay_max: 3, text: 'מה זה? טוב?', variations: ['מה זה בדיוק?', 'לא שמעתי על זה, מה זה?'] },
      { role: 'B', delay_min: 2, delay_max: 5, text: 'כן אחי שם אתה רואה עבודות לפי אזור ומקצוע, תנסה', variations: ['אתר שמחבר קבלנים לעבודות, הכל לפי אזור ומקצוע', 'זה כמו מאגר עבודות, אתה בוחר אזור ומקצוע וזה מראה לך'] },
      { role: 'C', delay_min: 5, delay_max: 15, text: 'גם אני נכנסתי לשם לאחרונה, יש שם המון', variations: ['אני גם שם, שווה להירשם', 'כן מכיר, נרשמתי ומצאתי כמה דברים'] },
    ], is_active: true, times_used: 12, last_used_at: new Date(Date.now() - 2 * 3600000).toISOString(), created_at: '2026-03-20T10:00:00Z' },
    { id: 'sc-2', name: 'מה זה masterlead?', description: 'מישהו רואה את השם ושואל, שניים מסבירים בטבעיות', category: 'curiosity', cooldown_days: 5, placeholders: [], lines: [
      { role: 'A', delay_min: 0, delay_max: 0, text: 'חבר׳ה מישהו מכיר את masterlead? ראיתי את זה כמה פעמים', variations: ['מה זה masterlead? מישהו שמע על זה?', 'ראיתי כמה אנשים מדברים על masterlead, מה זה?'] },
      { role: 'B', delay_min: 2, delay_max: 6, text: 'כן אחי זה אפליקציה שמחברת בין קבלנים לעבודות, אני שם כבר חודש', variations: ['זה אתר שקבלנים מוצאים שם עבודות, אני רשום', 'כן מכיר, זה פלטפורמה לעבודות שיפוצים, אני שם'] },
      { role: 'C', delay_min: 3, delay_max: 8, text: 'גם אני, יש שם עבודות שלא רואים במקומות אחרים', variations: ['אני גם נרשמתי, יש שם דברים שלא מוצאים בפייסבוק', 'כן שווה, מצאתי שם עבודות שלא ראיתי בשום מקום אחר'] },
      { role: 'A', delay_min: 1, delay_max: 3, text: 'אה סבבה ואיך נרשמים?', variations: ['נשמע טוב, איך נכנסים?', 'מעניין, איך מוצאים את זה?'] },
      { role: 'B', delay_min: 2, delay_max: 4, text: 'תחפש masterlead באינטרנט, יש להם אתר. לוקח דקה', variations: ['תכתוב בגוגל masterlead, תגיע לאתר ותירשם', 'תיכנס לmasterlead.app, הרשמה לוקחת שתי דקות'] },
    ], is_active: true, times_used: 8, last_used_at: new Date(Date.now() - 5 * 3600000).toISOString(), created_at: '2026-03-21T10:00:00Z' },
    { id: 'sc-3', name: 'המלצה לחבר', description: 'חייל מתלונן שאין עבודה, חבר מספר על masterlead בלי שיווק ישיר', category: 'recommendation', cooldown_days: 4, placeholders: ['{city}'], lines: [
      { role: 'A', delay_min: 0, delay_max: 0, text: 'אין עבודה בכלל השבוע הזה, מישהו עוד ככה?', variations: ['שקט מת השבוע, אין כלום', 'מישהו מצליח למצוא עבודה? אצלי מת'] },
      { role: 'B', delay_min: 4, delay_max: 10, text: 'אחי תיכנס ל-masterlead, אני מצאתי שם שתי עבודות השבוע', variations: ['אני מוצא דברים ב-masterlead, תנסה', 'תבדוק את masterlead, לי זה עוזר'] },
      { role: 'A', delay_min: 1, delay_max: 3, text: 'מה זה בדיוק?', variations: ['לא מכיר, מה זה?', 'מה זה הדבר הזה?'] },
      { role: 'B', delay_min: 2, delay_max: 5, text: 'אתר שבו בעלי בתים מפרסמים עבודות ואתה רואה לפי האזור שלך', variations: ['פלטפורמה שמחברת בעלי בתים לקבלנים, הכל לפי אזור', 'מאגר עבודות, אתה בוחר איפה אתה ומה המקצוע שלך'] },
      { role: 'A', delay_min: 1, delay_max: 2, text: 'ויש עבודות באזור {city}?', variations: ['עובד גם ב{city}?', 'יש שם משהו באזור {city}?'] },
      { role: 'B', delay_min: 2, delay_max: 4, text: 'בטח יש שם פול של עבודות בדרום פלורידה, תבדוק', variations: ['כן יש, תיכנס ותראה בעצמך', 'בטח, יש שם עבודות בכל פלורידה'] },
    ], is_active: true, times_used: 15, last_used_at: new Date(Date.now() - 1 * 3600000).toISOString(), created_at: '2026-03-22T10:00:00Z' },
    { id: 'sc-4', name: 'שיחה על אפליקציות', description: 'דיון טבעי על כלים, masterlead עולה כאחד מכמה אפשרויות', category: 'general', cooldown_days: 5, placeholders: [], lines: [
      { role: 'A', delay_min: 0, delay_max: 0, text: 'באיזה אפליקציות אתם משתמשים למצוא עבודות?', variations: ['מה אתם משתמשים למצוא פרויקטים?', 'איך אתם מוצאים עבודות חוץ מקבוצות ווצאפ?'] },
      { role: 'B', delay_min: 3, delay_max: 7, text: 'אני משתמש ב-masterlead, הכי נוח בשבילי', variations: ['אני נרשמתי לmasterlead לאחרונה, מרוצה', 'אני מוצא ב-masterlead, עובד טוב'] },
      { role: 'C', delay_min: 2, delay_max: 6, text: 'גם אני, שם הכל מסודר לפי מקצוע ואזור', variations: ['גם אני שם, מסודר ונוח', 'כן גם אני, אפשר לסנן לפי מה שאתה עושה'] },
      { role: 'A', delay_min: 1, delay_max: 3, text: 'יש מצב שזה עובד גם לאזור אורלנדו?', variations: ['עובד בכל פלורידה?', 'זה רק מיאמי או גם מקומות אחרים?'] },
      { role: 'B', delay_min: 2, delay_max: 5, text: 'כן אחי יש שם עבודות בכל פלורידה', variations: ['כן, מכסה את כל פלורידה', 'יש שם בכל מקום, לא רק מיאמי'] },
    ], is_active: true, times_used: 6, last_used_at: new Date(Date.now() - 8 * 3600000).toISOString(), created_at: '2026-03-23T10:00:00Z' },
    { id: 'sc-5', name: 'מישהו ניסה?', description: 'שאלה תמימה לגבי masterlead, תשובות חיוביות מנוסים', category: 'curiosity', cooldown_days: 5, placeholders: [], lines: [
      { role: 'A', delay_min: 0, delay_max: 0, text: 'מישהו פה ניסה את masterlead? שווה?', variations: ['שמעתי על masterlead, מישהו יכול לספר?', 'מה דעתכם על masterlead? ניסיתם?'] },
      { role: 'B', delay_min: 5, delay_max: 12, text: 'אני שם כבר חודשיים, מצאתי כמה עבודות טובות', variations: ['כן אני רשום, עובד סבבה', 'אני משתמש, מצאתי כמה דברים נחמדים'] },
      { role: 'C', delay_min: 3, delay_max: 8, text: 'אני נרשמתי שבוע שעבר, נראה סבבה בינתיים', variations: ['גם אני חדש שם, בינתיים נראה טוב', 'נרשמתי לאחרונה, מתרשם לטובה'] },
      { role: 'A', delay_min: 1, delay_max: 3, text: 'וזה בחינם?', variations: ['כמה זה עולה?', 'צריך לשלם על זה?'] },
      { role: 'B', delay_min: 2, delay_max: 4, text: 'יש גרסה בחינם כן, תנסה ותראה אם מתאים לך', variations: ['יש חינמי, תתחיל עם זה', 'בחינם אפשר להירשם, תנסה'] },
    ], is_active: true, times_used: 3, last_used_at: null, created_at: '2026-03-24T10:00:00Z' },
  ] : []

  const DEMO_RUNS: ArmyScenarioRun[] = DEMO ? [
    { id: 'run-1', scenario_id: 'sc-3', group_wa_id: '120363001@g.us', group_name: 'Miami Renovations 🏠', status: 'completed', role_assignments: { A: 'demo-1', B: 'demo-2', C: 'demo-3' }, current_line: 5, scheduled_at: new Date(Date.now() - 3 * 3600000).toISOString(), started_at: new Date(Date.now() - 3 * 3600000).toISOString(), completed_at: new Date(Date.now() - 2.5 * 3600000).toISOString(), error: null, lines_used: null },
    { id: 'run-2', scenario_id: 'sc-1', group_wa_id: '120363002@g.us', group_name: 'FL Plumbers Network 🔧', status: 'completed', role_assignments: { A: 'demo-2', B: 'demo-1' }, current_line: 4, scheduled_at: new Date(Date.now() - 6 * 3600000).toISOString(), started_at: new Date(Date.now() - 6 * 3600000).toISOString(), completed_at: new Date(Date.now() - 5.5 * 3600000).toISOString(), error: null, lines_used: null },
    { id: 'run-3', scenario_id: 'sc-2', group_wa_id: '120363001@g.us', group_name: 'Miami Renovations 🏠', status: 'running', role_assignments: { A: 'demo-3', B: 'demo-1', C: 'demo-2' }, current_line: 2, scheduled_at: new Date(Date.now() - 20 * 60000).toISOString(), started_at: new Date(Date.now() - 20 * 60000).toISOString(), completed_at: null, error: null, lines_used: null },
    { id: 'run-4', scenario_id: 'sc-4', group_wa_id: '120363004@g.us', group_name: 'South FL HVAC Jobs ❄️', status: 'pending', role_assignments: { A: 'demo-1', B: 'demo-6', C: 'demo-3' }, current_line: 0, scheduled_at: new Date(Date.now() + 2 * 3600000).toISOString(), started_at: null, completed_at: null, error: null, lines_used: null },
    { id: 'run-5', scenario_id: 'sc-1', group_wa_id: '120363003@g.us', group_name: 'Orlando Contractors 🏗️', status: 'failed', role_assignments: { A: 'demo-4', B: 'demo-5' }, current_line: 1, scheduled_at: new Date(Date.now() - 12 * 3600000).toISOString(), started_at: new Date(Date.now() - 12 * 3600000).toISOString(), completed_at: null, error: 'Slave-Tampa-05 disconnected', lines_used: null },
  ] : []

  const scenarios = DEMO ? DEMO_SCENARIOS : realScenarios
  const scenarioRuns = DEMO ? DEMO_RUNS : [] as ArmyScenarioRun[]

  /* ── Selection state ── */
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null) // phone or groupId
  const [selectedChatType, setSelectedChatType] = useState<'dm' | 'group' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [allDMsMode, setAllDMsMode] = useState(false)
  const [dmTags, setDmTags] = useState<Record<string, string>>({})
  const [scenariosMode, setScenariosMode] = useState(false)
  const [scenarioListTab, setScenarioListTab] = useState<'bank' | 'runs'>('bank')
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [scenarioEditing, setScenarioEditing] = useState(false)
  const [editLines, setEditLines] = useState<ScenarioLine[]>([])
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCategory, setEditCategory] = useState('general')

  const selectedScenario = useMemo(() => scenarios.find(s => s.id === selectedScenarioId) ?? null, [scenarios, selectedScenarioId])

  const SCENARIO_CATEGORIES = [
    { key: 'all', label: he ? 'הכל' : 'All', color: C.waGray },
    { key: 'job_inquiry', label: he ? 'חיפוש עבודה' : 'Job Inquiry', color: '#2563eb' },
    { key: 'curiosity', label: he ? 'סקרנות' : 'Curiosity', color: '#f59e0b' },
    { key: 'recommendation', label: he ? 'המלצה' : 'Recommendation', color: '#16a34a' },
    { key: 'general', label: he ? 'כללי' : 'General', color: '#8b5cf6' },
  ]
  const [scenarioFilter, setScenarioFilter] = useState('all')
  const filteredScenarios = useMemo(() => {
    if (scenarioFilter === 'all') return scenarios
    return scenarios.filter(s => s.category === scenarioFilter)
  }, [scenarios, scenarioFilter])

  const ROLE_COLORS_CHAT: Record<string, string> = { A: '#25d366', B: '#34b7f1', C: '#ff6b6b', D: '#ffd93d' }

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

        {/* Scenarios + Add + Master toggle */}
        <button
          onClick={() => { setScenariosMode(!scenariosMode); if (!scenariosMode) { setSelectedChatId(null); setSelectedChatType(null); setAllDMsMode(false) } }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 transition-all"
          style={{
            background: scenariosMode ? '#8b5cf615' : 'transparent',
            color: scenariosMode ? '#8b5cf6' : C.waGray,
            border: scenariosMode ? '1px solid #8b5cf630' : '1px solid transparent',
          }}
        >
          <FileText className="w-3.5 h-3.5" />
          {he ? 'סצנות' : 'Scenarios'}
          <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: '#8b5cf615', color: '#8b5cf6' }}>{scenarios.length}</span>
        </button>
        <div className="w-px h-5" style={{ background: C.waBorder }} />
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
                  {/* Avatar with health indicator */}
                  <div className="w-[49px] h-[49px] rounded-full shrink-0 flex items-center justify-center text-[18px] relative" style={{ background: isGroup ? '#00a884' : '#dfe5e7' }}>
                    {isGroup ? <Users className="w-6 h-6 text-white" /> : (
                      <span className="font-bold" style={{ color: '#8696a0' }}>
                        {(item.type === 'dm' && item.name) ? item.name.charAt(0).toUpperCase() : '?'}
                      </span>
                    )}
                    {isGroup && (() => {
                      const gid = (item as ChatItem & { type: 'group' }).groupId
                      const hasSent = activityEntries.some(e => e.group_wa_id === gid && e.status === 'sent')
                      return (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white border-2 border-white" style={{ background: hasSent ? '#16a34a' : '#d97706' }}>
                          {hasSent ? '✓' : '!'}
                        </div>
                      )
                    })()}
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

        {/* ─── CENTER: Chat OR Scenarios ─── */}
        {scenariosMode ? (
          /* ═══ SCENARIOS VIEW ═══ */
          <div className="flex-1 flex h-full overflow-hidden">
            {/* Scenario Bank (left side) */}
            <div className="w-[340px] shrink-0 flex flex-col h-full" style={{ background: '#fff', borderRight: `1px solid ${C.waBorder}` }}>
              {/* Header with explanation */}
              <div className="px-3 py-3 space-y-2" style={{ borderBottom: `1px solid ${C.waBorder}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold" style={{ color: C.waDark }}>{he ? 'בנק סצנות' : 'Scenario Bank'}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (selectedScenario) {
                          setSelectedScenarioId(null)
                          setScenarioEditing(true)
                          setEditName(selectedScenario.name + ' (copy)')
                          setEditDesc(selectedScenario.description ?? '')
                          setEditCategory(selectedScenario.category)
                          setEditLines([...selectedScenario.lines])
                        }
                      }}
                      disabled={!selectedScenario}
                      className="px-2 py-1 rounded-md text-[10px] font-bold transition-all hover:bg-blue-50 disabled:opacity-30"
                      style={{ color: '#2563eb' }}
                      title={he ? 'שכפל סצנה' : 'Duplicate'}
                    >
                      {he ? 'שכפל' : 'Dup'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedScenarioId(null)
                        setScenarioEditing(true)
                        setEditName('')
                        setEditDesc('')
                        setEditCategory('general')
                        setEditLines([{ role: 'A', delay_min: 0, delay_max: 0, text: '' }, { role: 'B', delay_min: 3, delay_max: 8, text: '' }])
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all hover:bg-[#8b5cf610]"
                      style={{ color: '#8b5cf6' }}
                    >
                      <Plus className="w-3 h-3" />{he ? 'חדש' : 'New'}
                    </button>
                  </div>
                </div>

                {/* Explanation box */}
                <div className="px-2.5 py-2 rounded-lg text-[10px] leading-[15px]" style={{ background: '#f8f4ff', color: '#7c3aed', border: '1px solid #ede9fe' }}>
                  {he
                    ? '💡 סצנה = שיחה מתוסרטת בין חיילים בקבוצה. המערכת מגרילה וריאציה, מקצה חיילים ל-roles, ושולחת עם דילייים טבעיים. כך masterlead מופיע בטבעיות.'
                    : '💡 A scenario is a scripted conversation between soldiers in a group. The system picks random variations, assigns soldiers to roles, and sends with natural delays. This makes masterlead appear organically.'}
                </div>

                {/* Category filter */}
                <div className="flex gap-1 flex-wrap">
                  {SCENARIO_CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setScenarioFilter(cat.key)}
                      className="px-2 py-1 rounded-md text-[10px] font-bold transition-all"
                      style={{
                        background: scenarioFilter === cat.key ? `${cat.color}15` : 'transparent',
                        color: scenarioFilter === cat.key ? cat.color : C.waGray,
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Scenarios / Runs toggle */}
                <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: '#f0f2f5' }}>
                  {([
                    { key: 'bank' as const, label: he ? 'סצנות' : 'Scenarios' },
                    { key: 'runs' as const, label: he ? 'היסטוריה' : 'Run History' },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setScenarioListTab(tab.key)}
                      className="flex-1 py-1 rounded-md text-[10px] font-bold transition-all"
                      style={{ background: scenarioListTab === tab.key ? '#fff' : 'transparent', color: scenarioListTab === tab.key ? C.waDark : C.waGray, boxShadow: scenarioListTab === tab.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {scenarioListTab === 'bank' ? (
                  /* Scenario bank */
                  filteredScenarios.map(sc => {
                    const active = sc.id === selectedScenarioId
                    const catColor = SCENARIO_CATEGORIES.find(c => c.key === sc.category)?.color ?? C.waGray
                    const roles = [...new Set(sc.lines.map(l => l.role))]
                    const hasVariations = sc.lines.some(l => l.variations && l.variations.length > 0)
                    const hasPlaceholders = sc.placeholders && sc.placeholders.length > 0
                    return (
                      <button
                        key={sc.id}
                        onClick={() => { setSelectedScenarioId(sc.id); setScenarioEditing(false) }}
                        className="w-full text-left px-3 py-3 transition-colors"
                        style={{ background: active ? '#f0f2f5' : 'transparent', borderBottom: `1px solid ${C.waBorder}` }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] font-medium truncate" style={{ color: C.waDark, direction: 'rtl' }}>{sc.name}</span>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {roles.map(r => (
                              <div key={r} className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white" style={{ background: ROLE_COLORS_CHAT[r] ?? '#999' }}>{r}</div>
                            ))}
                          </div>
                        </div>
                        <p className="text-[12px] mt-0.5 truncate" style={{ color: C.waGray, direction: 'rtl' }}>{sc.description}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${catColor}15`, color: catColor }}>
                            {SCENARIO_CATEGORIES.find(c => c.key === sc.category)?.label}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#f0f2f5', color: C.waGray }}>
                            {sc.lines.length} {he ? 'שורות' : 'lines'}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#f0f2f5', color: C.waGray }}>
                            x{sc.times_used}
                          </span>
                          {hasVariations && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#dcfce7', color: '#16a34a' }}>
                              🔀 {he ? 'וריאציות' : 'variations'}
                            </span>
                          )}
                          {hasPlaceholders && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#d97706' }}>
                              📌 {sc.placeholders.join(' ')}
                            </span>
                          )}
                          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#f0f2f5', color: C.waGray }}>
                            ⏸ {sc.cooldown_days}d cooldown
                          </span>
                        </div>
                        {sc.last_used_at && (
                          <span className="text-[9px] mt-1 block" style={{ color: C.waGray }}>
                            {he ? 'שימוש אחרון:' : 'Last used:'} {timeAgo(sc.last_used_at)}
                          </span>
                        )}
                      </button>
                    )
                  })
                ) : (
                  /* Run history */
                  scenarioRuns.length === 0 ? (
                    <div className="text-center py-12 text-[12px]" style={{ color: C.waGray }}>{he ? 'אין ריצות' : 'No runs yet'}</div>
                  ) : scenarioRuns.map(run => {
                    const sc = scenarios.find(s => s.id === run.scenario_id)
                    const statusColor = run.status === 'completed' ? '#16a34a' : run.status === 'running' ? '#2563eb' : run.status === 'failed' ? '#dc2626' : '#d97706'
                    const statusLabel = run.status === 'completed' ? (he ? '✅ הושלם' : '✅ Done') : run.status === 'running' ? (he ? '🔄 רץ' : '🔄 Running') : run.status === 'failed' ? (he ? '❌ נכשל' : '❌ Failed') : (he ? '⏳ ממתין' : '⏳ Pending')
                    return (
                      <div key={run.id} className="px-3 py-3" style={{ borderBottom: `1px solid ${C.waBorder}` }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-medium" style={{ color: C.waDark }}>{sc?.name ?? '?'}</span>
                          <span className="text-[10px] font-bold" style={{ color: statusColor }}>{statusLabel}</span>
                        </div>
                        <span className="text-[11px] block mt-0.5" style={{ color: C.waGray }}>{run.group_name ?? run.group_wa_id}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px]" style={{ color: C.waGray }}>{he ? 'שורה' : 'Line'} {run.current_line}/{sc?.lines.length ?? '?'}</span>
                          <span className="text-[10px]" style={{ color: C.waGray }}>{fmtTime(run.scheduled_at)}</span>
                          {run.error && <span className="text-[10px] text-red-500 truncate">{run.error}</span>}
                        </div>
                        {/* Role assignments visual */}
                        <div className="flex items-center gap-1 mt-1.5">
                          {Object.entries(run.role_assignments).map(([role, accId]) => {
                            const acc = accounts.find(a => a.id === accId)
                            return (
                              <div key={role} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px]" style={{ background: `${ROLE_COLORS_CHAT[role] ?? '#999'}15`, color: ROLE_COLORS_CHAT[role] ?? '#999' }}>
                                <span className="font-black">{role}</span>
                                <span className="font-medium">{acc?.army_alias?.split('-').pop() ?? '?'}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Scenario Preview / Editor (right side) */}
            <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: C.waChatBg }}>
              {selectedScenario && !scenarioEditing ? (
                /* Preview mode */
                <>
                  <div className="shrink-0 flex items-center gap-3 px-4 h-[59px]" style={{ background: C.waHeader, borderBottom: `1px solid ${C.waBorder}` }}>
                    <FileText className="w-5 h-5" style={{ color: '#8b5cf6' }} />
                    <div className="flex-1">
                      <span className="text-[15px] font-medium" style={{ color: C.waDark, direction: 'rtl' }}>{selectedScenario.name}</span>
                      <span className="text-[12px] block" style={{ color: C.waGray, direction: 'rtl' }}>{selectedScenario.description}</span>
                    </div>
                    <button
                      onClick={() => { if (DEMO) alert(he ? 'במצב דמו - ישגר סצנה בפרודקשן' : 'Demo - would run scenario in production'); }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:bg-green-50"
                      style={{ color: '#16a34a' }}
                    >
                      ▶ {he ? 'הפעל עכשיו' : 'Run Now'}
                    </button>
                    <button
                      onClick={() => {
                        setScenarioEditing(true)
                        setEditName(selectedScenario.name)
                        setEditDesc(selectedScenario.description ?? '')
                        setEditCategory(selectedScenario.category)
                        setEditLines([...selectedScenario.lines])
                      }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:bg-black/[0.05]"
                      style={{ color: '#8b5cf6' }}
                    >
                      {he ? 'ערוך' : 'Edit'}
                    </button>
                  </div>

                  {/* Info bar */}
                  <div className="shrink-0 flex items-center gap-3 px-4 py-2 text-[10px] flex-wrap" style={{ background: '#faf9f6', borderBottom: `1px solid ${C.waBorder}` }}>
                    <span style={{ color: C.waGray }}>⏸ Cooldown: <b>{selectedScenario.cooldown_days} {he ? 'ימים' : 'days'}</b></span>
                    <span style={{ color: C.waGray }}>👥 Roles: <b>{[...new Set(selectedScenario.lines.map(l => l.role))].join(', ')}</b></span>
                    <span style={{ color: C.waGray }}>📝 {selectedScenario.lines.length} {he ? 'שורות' : 'lines'}</span>
                    {selectedScenario.lines.some(l => l.variations?.length) && (
                      <span style={{ color: '#16a34a' }}>🔀 {selectedScenario.lines.filter(l => l.variations?.length).length} {he ? 'שורות עם וריאציות' : 'lines with variations'}</span>
                    )}
                    {selectedScenario.placeholders?.length > 0 && (
                      <span style={{ color: '#d97706' }}>📌 {selectedScenario.placeholders.join(', ')}</span>
                    )}
                    <span style={{ color: C.waGray }}>🔁 x{selectedScenario.times_used}</span>
                  </div>

                  {/* WhatsApp-style preview */}
                  <div className="flex-1 overflow-y-auto px-[60px] py-6 space-y-2 scrollbar-hide">
                    {/* Role legend */}
                    <div className="flex items-center justify-center gap-3 mb-2">
                      {[...new Set(selectedScenario.lines.map(l => l.role))].map(role => (
                        <div key={role} className="flex items-center gap-1">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white" style={{ background: ROLE_COLORS_CHAT[role] ?? '#999' }}>{role}</div>
                          <span className="text-[11px] font-medium" style={{ color: C.waGray }}>{he ? `חייל ${role}` : `Soldier ${role}`}</span>
                        </div>
                      ))}
                    </div>

                    {/* Explanation */}
                    <div className="flex justify-center mb-4">
                      <span className="text-[10px] px-3 py-1 rounded-full" style={{ background: '#fff8e1', color: '#b45309' }}>
                        {he ? '👇 ככה זה ייראה בקבוצה. כל שורה עם וריאציות מסומנת ב-🔀' : '👇 This is how it will look in the group. Lines with variations marked with 🔀'}
                      </span>
                    </div>

                    {selectedScenario.lines.map((line, i) => (
                      <div key={i}>
                        {/* Delay indicator */}
                        {i > 0 && (
                          <div className="flex justify-center my-2">
                            <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.04)', color: C.waGray }}>
                              ⏱ {he ? `ימתין ${line.delay_min}-${line.delay_max} דקות` : `waits ${line.delay_min}-${line.delay_max} min`}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-start">
                          <div className="max-w-[75%] rounded-lg px-[9px] py-[6px] shadow-sm" style={{ background: C.incoming, borderTopLeftRadius: 0 }}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white" style={{ background: ROLE_COLORS_CHAT[line.role] ?? '#999' }}>{line.role}</div>
                              <span className="text-[11px] font-bold" style={{ color: ROLE_COLORS_CHAT[line.role] ?? '#999' }}>{he ? `חייל ${line.role}` : `Soldier ${line.role}`}</span>
                              {line.variations && line.variations.length > 0 && (
                                <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: '#dcfce7', color: '#16a34a' }}>🔀 +{line.variations.length}</span>
                              )}
                            </div>
                            <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap" style={{ color: C.waDark, direction: 'rtl' }}>{line.text}</p>
                            {/* Show variations */}
                            {line.variations && line.variations.length > 0 && (
                              <div className="mt-2 pt-2 space-y-1" style={{ borderTop: `1px dashed ${C.waBorder}` }}>
                                <span className="text-[9px] font-bold" style={{ color: '#16a34a' }}>{he ? 'וריאציות (המערכת תגריל):' : 'Variations (system picks randomly):'}</span>
                                {line.variations.map((v, vi) => (
                                  <p key={vi} className="text-[12px] leading-[16px] pl-2" style={{ color: C.waGray, direction: 'rtl', borderLeft: `2px solid ${ROLE_COLORS_CHAT[line.role] ?? '#999'}30` }}>{v}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : scenarioEditing ? (
                /* Editor mode */
                <>
                  <div className="shrink-0 flex items-center gap-3 px-4 h-[59px]" style={{ background: C.waHeader, borderBottom: `1px solid ${C.waBorder}` }}>
                    <span className="text-[15px] font-medium" style={{ color: C.waDark }}>{selectedScenarioId ? (he ? 'עריכת סצנה' : 'Edit Scenario') : (he ? 'סצנה חדשה' : 'New Scenario')}</span>
                    <div className="flex-1" />
                    <button onClick={() => setScenarioEditing(false)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-black/[0.05]" style={{ color: C.waGray }}>{he ? 'ביטול' : 'Cancel'}</button>
                    <button
                      onClick={async () => {
                        if (!editName || editLines.length < 2) return
                        const row = { name: editName, description: editDesc, category: editCategory, lines: editLines, is_active: true }
                        if (DEMO) { setScenarioEditing(false); return }
                        if (selectedScenarioId) {
                          await supabase.from('army_scenarios').update(row).eq('id', selectedScenarioId)
                        } else {
                          await supabase.from('army_scenarios').insert(row)
                        }
                        refetchScenarios()
                        setScenarioEditing(false)
                      }}
                      disabled={!editName || editLines.length < 2}
                      className="px-4 py-1.5 rounded-lg text-[11px] font-bold text-white disabled:opacity-40 transition-all"
                      style={{ background: '#8b5cf6' }}
                    >
                      {he ? 'שמור' : 'Save'}
                    </button>
                  </div>

                  {/* Editor explanation */}
                  <div className="shrink-0 px-4 py-2" style={{ background: '#faf9f6', borderBottom: `1px solid ${C.waBorder}` }}>
                    <p className="text-[10px] leading-[14px]" style={{ color: '#7c3aed' }}>
                      {he
                        ? '📝 כל שורה = הודעה שחייל שולח בקבוצה. בחר role (A/B/C/D) = חייל שונה. הגדר דיליי = כמה דקות לחכות בין הודעות. הוסף וריאציות = טקסטים חלופיים שהמערכת מגרילה כדי שלא יחזור אותו דבר.'
                        : '📝 Each line = a message a soldier sends in the group. Pick a role (A/B/C/D) = different soldier. Set delay = minutes to wait between messages. Add variations = alternative texts the system randomly picks so it never repeats.'}
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
                    {/* Name + Description */}
                    <div className="space-y-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)} placeholder={he ? 'שם הסצנה' : 'Scenario name'} className="w-full px-3 py-2.5 rounded-lg text-[14px] font-bold outline-none" style={{ background: '#fff', direction: 'rtl' }} />
                      <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder={he ? 'תיאור קצר - מה קורה בסצנה?' : 'Short description - what happens in the scene?'} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: '#fff', direction: 'rtl' }} />
                      <div className="flex gap-1.5">
                        {SCENARIO_CATEGORIES.filter(c => c.key !== 'all').map(cat => (
                          <button key={cat.key} onClick={() => setEditCategory(cat.key)} className="px-2.5 py-1 rounded-md text-[10px] font-bold transition-all" style={{ background: editCategory === cat.key ? `${cat.color}15` : '#f0f2f5', color: editCategory === cat.key ? cat.color : C.waGray }}>
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Lines editor */}
                    <div className="space-y-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.waGray }}>{he ? 'תסריט הסצנה' : 'Scene Script'}</span>
                      {editLines.map((line, i) => (
                        <div key={i} className="rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${ROLE_COLORS_CHAT[line.role] ?? '#999'}25` }}>
                          {/* Line header */}
                          <div className="flex items-center gap-2 px-3 py-2" style={{ background: `${ROLE_COLORS_CHAT[line.role] ?? '#999'}08`, borderBottom: `1px solid ${ROLE_COLORS_CHAT[line.role] ?? '#999'}15` }}>
                            <span className="text-[10px] font-bold" style={{ color: C.waGray }}>{he ? `שורה ${i + 1}` : `Line ${i + 1}`}</span>
                            {/* Role pills */}
                            <div className="flex gap-1">
                              {['A', 'B', 'C', 'D'].map(r => (
                                <button
                                  key={r}
                                  onClick={() => { const nl = [...editLines]; nl[i] = { ...nl[i], role: r }; setEditLines(nl) }}
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white transition-all"
                                  style={{ background: line.role === r ? (ROLE_COLORS_CHAT[r] ?? '#999') : '#e5e7eb', color: line.role === r ? '#fff' : '#9ca3af' }}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                            <div className="flex-1" />
                            {i > 0 && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" style={{ color: C.waGray }} />
                                <input type="number" value={line.delay_min} onChange={e => { const nl = [...editLines]; nl[i] = { ...nl[i], delay_min: +e.target.value }; setEditLines(nl) }} className="w-10 px-1 py-0.5 rounded text-[10px] text-center outline-none" style={{ background: C.waLightGray }} />
                                <span className="text-[10px]" style={{ color: C.waGray }}>-</span>
                                <input type="number" value={line.delay_max} onChange={e => { const nl = [...editLines]; nl[i] = { ...nl[i], delay_max: +e.target.value }; setEditLines(nl) }} className="w-10 px-1 py-0.5 rounded text-[10px] text-center outline-none" style={{ background: C.waLightGray }} />
                                <span className="text-[9px]" style={{ color: C.waGray }}>{he ? 'דק׳' : 'min'}</span>
                              </div>
                            )}
                            {editLines.length > 2 && (
                              <button onClick={() => setEditLines(editLines.filter((_, j) => j !== i))} className="p-0.5 rounded hover:bg-red-50 transition-colors">
                                <X className="w-3 h-3 text-red-400" />
                              </button>
                            )}
                          </div>

                          {/* Main text */}
                          <div className="px-3 py-2">
                            <textarea
                              value={line.text}
                              onChange={e => { const nl = [...editLines]; nl[i] = { ...nl[i], text: e.target.value }; setEditLines(nl) }}
                              placeholder={he ? `מה חייל ${line.role} אומר...` : `What soldier ${line.role} says...`}
                              rows={2}
                              className="w-full px-2 py-1.5 rounded-lg text-[13px] outline-none resize-none"
                              style={{ background: C.waLightGray, direction: 'rtl' }}
                            />
                          </div>

                          {/* Variations */}
                          <div className="px-3 pb-2">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-[9px] font-bold" style={{ color: '#16a34a' }}>🔀 {he ? 'וריאציות' : 'Variations'}</span>
                              <span className="text-[9px]" style={{ color: C.waGray }}>({he ? 'המערכת מגרילה טקסט אחר כל פעם' : 'system picks different text each time'})</span>
                            </div>
                            {(line.variations ?? []).map((v, vi) => (
                              <div key={vi} className="flex items-center gap-1 mb-1">
                                <span className="text-[9px] shrink-0" style={{ color: '#16a34a' }}>#{vi + 1}</span>
                                <input
                                  value={v}
                                  onChange={e => {
                                    const nl = [...editLines]
                                    const vars = [...(nl[i].variations ?? [])]
                                    vars[vi] = e.target.value
                                    nl[i] = { ...nl[i], variations: vars }
                                    setEditLines(nl)
                                  }}
                                  className="flex-1 px-2 py-1 rounded text-[11px] outline-none"
                                  style={{ background: '#f0fdf4', direction: 'rtl' }}
                                />
                                <button onClick={() => {
                                  const nl = [...editLines]
                                  const vars = [...(nl[i].variations ?? [])].filter((_, j) => j !== vi)
                                  nl[i] = { ...nl[i], variations: vars }
                                  setEditLines(nl)
                                }} className="text-red-300 hover:text-red-500">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const nl = [...editLines]
                                nl[i] = { ...nl[i], variations: [...(nl[i].variations ?? []), ''] }
                                setEditLines(nl)
                              }}
                              className="text-[10px] font-bold mt-0.5 transition-all hover:underline"
                              style={{ color: '#16a34a' }}
                            >
                              + {he ? 'הוסף וריאציה' : 'Add variation'}
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={() => setEditLines([...editLines, { role: editLines.length % 2 === 0 ? 'A' : 'B', delay_min: 2, delay_max: 5, text: '', variations: [] }])}
                        className="w-full py-2.5 rounded-lg text-[12px] font-bold transition-all hover:bg-[#8b5cf610]"
                        style={{ color: '#8b5cf6', border: `1px dashed #8b5cf630` }}
                      >
                        + {he ? 'הוסף שורה לתסריט' : 'Add Script Line'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* No scenario selected */
                <div className="flex-1 flex flex-col items-center justify-center" style={{ background: C.waLightGray }}>
                  <FileText className="w-16 h-16 mb-4" style={{ color: '#d1d5db' }} />
                  <p className="text-[18px] font-light" style={{ color: '#41525d' }}>{he ? 'בחר סצנה' : 'Select a Scenario'}</p>
                  <p className="text-[13px] mt-1 max-w-[300px] text-center" style={{ color: '#8696a0' }}>
                    {he ? 'בחר סצנה מהרשימה כדי לראות preview, או צור סצנה חדשה. כל סצנה = שיחה מתוסרטת בין חיילים שמופיעה בקבוצה באופן טבעי.' : 'Pick a scenario to preview, or create a new one. Each scenario = a scripted conversation between soldiers that appears naturally in groups.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
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
            /* ═══ MISSION CONTROL (default view) ═══ */
            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide" style={{ background: C.waLightGray }}>
              {/* Title */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `${C.primary}12` }}>
                  <Swords className="w-5 h-5" style={{ color: C.primary }} />
                </div>
                <div>
                  <h2 className="text-[20px] font-bold" style={{ color: C.waDark }}>{he ? 'מרכז שליטה' : 'Mission Control'}</h2>
                  <p className="text-[12px]" style={{ color: C.waGray }}>{he ? 'סקירה כללית של הצבא שלך' : 'Overview of your army operations'}</p>
                </div>
              </div>

              {/* Slaves Health */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: '#fff', border: `1px solid ${C.waBorder}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold" style={{ color: C.waGreen }}>{he ? '🤖 חיילים' : '🤖 Soldiers'}</span>
                  <span className="text-[11px] font-bold" style={{ color: stats.connectedSlaves === stats.totalSlaves ? '#16a34a' : '#d97706' }}>
                    {stats.connectedSlaves}/{stats.totalSlaves} {he ? 'מחוברים' : 'connected'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {accounts.map(acc => {
                    const role = ROLE_META[acc.army_role ?? 'publisher']
                    const connected = acc.status === 'connected'
                    const todayMsgs = activityEntries.filter(e => e.wa_account_id === acc.id && e.status === 'sent').length
                    return (
                      <button
                        key={acc.id}
                        onClick={() => { setSelectedAccountId(acc.id); setSelectedChatId(null); setSelectedChatType(null) }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:shadow-sm"
                        style={{ background: connected ? '#f0fdf4' : '#fef2f2', border: `1px solid ${connected ? '#bbf7d0' : '#fecaca'}` }}
                      >
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: connected ? '#16a34a' : '#dc2626' }} />
                        <div className="flex-1 min-w-0 text-left">
                          <span className="text-[11px] font-bold truncate block" style={{ color: C.waDark }}>{acc.army_alias?.split('-').pop()}</span>
                          <span className="text-[9px]" style={{ color: C.waGray }}>{role.emoji} {todayMsgs > 0 ? `${todayMsgs} ${he ? 'נשלחו' : 'sent'}` : (he ? 'לא שלח' : 'idle')}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Groups Health */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: '#fff', border: `1px solid ${C.waBorder}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold" style={{ color: C.waGreen }}>{he ? '👥 בריאות קבוצות' : '👥 Group Health'}</span>
                  <span className="text-[11px]" style={{ color: C.waGray }}>
                    {he ? 'האם כל קבוצה קיבלה פעילות היום?' : 'Did every group get activity today?'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {(() => {
                    const groupIds = [...new Set(assignments.map(a => a.group_wa_id))]
                    return groupIds.map(gid => {
                      const groupName = assignments.find(a => a.group_wa_id === gid)?.group_name ?? gid
                      const todayActivity = activityEntries.filter(e => e.group_wa_id === gid)
                      const sentCount = todayActivity.filter(e => e.status === 'sent').length
                      const pendingCount = todayActivity.filter(e => e.status === 'pending').length
                      const failedCount = todayActivity.filter(e => e.status === 'failed').length
                      const lastSent = todayActivity.find(e => e.status === 'sent')
                      const healthy = sentCount > 0
                      const hasIssue = failedCount > 0

                      return (
                        <div
                          key={gid}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                          style={{ background: hasIssue ? '#fef2f2' : healthy ? '#f0fdf4' : '#fffbeb', border: `1px solid ${hasIssue ? '#fecaca' : healthy ? '#bbf7d0' : '#fde68a'}` }}
                        >
                          <span className="text-[16px]">{hasIssue ? '❌' : healthy ? '✅' : '⚠️'}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-medium truncate block" style={{ color: C.waDark, direction: 'rtl' }}>{groupName}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {sentCount > 0 && <span className="text-[10px]" style={{ color: '#16a34a' }}>📨 {sentCount} {he ? 'נשלחו' : 'sent'}</span>}
                              {pendingCount > 0 && <span className="text-[10px]" style={{ color: '#d97706' }}>⏳ {pendingCount} {he ? 'ממתינות' : 'pending'}</span>}
                              {failedCount > 0 && <span className="text-[10px]" style={{ color: '#dc2626' }}>❌ {failedCount} {he ? 'נכשלו' : 'failed'}</span>}
                              {sentCount === 0 && pendingCount === 0 && <span className="text-[10px]" style={{ color: '#d97706' }}>{he ? 'אין פעילות היום' : 'No activity today'}</span>}
                            </div>
                          </div>
                          {lastSent && (
                            <span className="text-[10px] shrink-0" style={{ color: C.waGray }}>{he ? 'אחרון:' : 'Last:'} {timeAgo(lastSent.scheduled_at)}</span>
                          )}
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>

              {/* Scheduler Timeline */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: '#fff', border: `1px solid ${C.waBorder}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold" style={{ color: C.waGreen }}>{he ? '⏰ לוח זמנים היום' : '⏰ Today\'s Schedule'}</span>
                  <span className="text-[11px]" style={{ color: C.waGray }}>
                    {he ? 'מה מתוזמן ומה כבר רץ' : 'What\'s scheduled and what already ran'}
                  </span>
                </div>
                <div className="space-y-1">
                  {[...activityEntries].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()).map(entry => {
                    const typeEmoji = entry.message_type === 'job_post' ? '📢' : entry.message_type === 'response' ? '💬' : entry.message_type === 'contractor_promo' ? '👷' : '📋'
                    const statusColor = entry.status === 'sent' ? '#16a34a' : entry.status === 'failed' ? '#dc2626' : '#d97706'
                    const statusIcon = entry.status === 'sent' ? '✅' : entry.status === 'failed' ? '❌' : '⏳'
                    const groupName = assignments.find(a => a.group_wa_id === entry.group_wa_id)?.group_name ?? entry.group_wa_id
                    const slave = accounts.find(a => a.id === entry.wa_account_id)
                    const isPast = new Date(entry.scheduled_at) < new Date()

                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all"
                        style={{ background: isPast ? 'transparent' : '#fffbeb', opacity: entry.status === 'sent' ? 0.6 : 1 }}
                      >
                        <span className="text-[12px] font-mono font-bold shrink-0 w-[44px]" style={{ color: entry.status === 'pending' ? '#d97706' : C.waGray }}>
                          {fmtTime(entry.scheduled_at)}
                        </span>
                        <span className="text-[14px] shrink-0">{statusIcon}</span>
                        <span className="text-[14px] shrink-0">{typeEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[12px] font-medium truncate block" style={{ color: C.waDark }}>
                            {entry.message_type.replace('_', ' ')} → {groupName}
                          </span>
                          <span className="text-[10px] truncate block" style={{ color: C.waGray }}>
                            {slave?.army_alias} · {entry.rendered_message?.slice(0, 40)}...
                          </span>
                        </div>
                        {entry.status === 'pending' && (
                          <button
                            onClick={() => { if (DEMO) alert(he ? 'דמו - ישלח בפרודקשן' : 'Demo - would send in production') }}
                            className="text-[10px] font-bold px-2 py-1 rounded-md transition-all hover:bg-green-50"
                            style={{ color: '#16a34a' }}
                          >
                            ▶ {he ? 'שלח' : 'Send'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {/* Scenario runs in timeline */}
                  {scenarioRuns.filter(r => r.status === 'pending' || r.status === 'running').map(run => {
                    const sc = scenarios.find(s => s.id === run.scenario_id)
                    return (
                      <div key={run.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: run.status === 'running' ? '#eff6ff' : '#fffbeb' }}>
                        <span className="text-[12px] font-mono font-bold shrink-0 w-[44px]" style={{ color: run.status === 'running' ? '#2563eb' : '#d97706' }}>
                          {fmtTime(run.scheduled_at)}
                        </span>
                        <span className="text-[14px] shrink-0">{run.status === 'running' ? '🔄' : '⏳'}</span>
                        <span className="text-[14px] shrink-0">📋</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[12px] font-medium truncate block" style={{ color: C.waDark }}>
                            {he ? 'סצנה' : 'Scenario'}: {sc?.name ?? '?'} → {run.group_name}
                          </span>
                          <span className="text-[10px]" style={{ color: C.waGray }}>
                            {he ? 'שורה' : 'Line'} {run.current_line}/{sc?.lines.length ?? '?'} · {Object.keys(run.role_assignments).length} {he ? 'חיילים' : 'soldiers'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Alerts */}
              {(() => {
                const alerts: { type: 'error' | 'warning'; icon: string; text: string; time?: string }[] = []
                // Disconnected slaves
                accounts.filter(a => a.status !== 'connected').forEach(a => {
                  alerts.push({ type: 'error', icon: '🔌', text: `${a.army_alias} ${he ? 'מנותק' : 'disconnected'}` })
                })
                // Failed sends
                activityEntries.filter(e => e.status === 'failed').forEach(e => {
                  const slave = accounts.find(a => a.id === e.wa_account_id)
                  alerts.push({ type: 'error', icon: '❌', text: `${he ? 'שליחה נכשלה:' : 'Failed send:'} ${slave?.army_alias} → ${e.error?.slice(0, 30) ?? '?'}`, time: timeAgo(e.scheduled_at) })
                })
                // Quiet groups
                const groupIds = [...new Set(assignments.map(a => a.group_wa_id))]
                groupIds.forEach(gid => {
                  const hasSent = activityEntries.some(e => e.group_wa_id === gid && e.status === 'sent')
                  if (!hasSent) {
                    const name = assignments.find(a => a.group_wa_id === gid)?.group_name ?? gid
                    alerts.push({ type: 'warning', icon: '⚠️', text: `${name} - ${he ? 'אין פעילות היום' : 'no activity today'}` })
                  }
                })
                // Failed scenario runs
                scenarioRuns.filter(r => r.status === 'failed').forEach(r => {
                  alerts.push({ type: 'error', icon: '📋', text: `${he ? 'סצנה נכשלה:' : 'Scenario failed:'} ${r.group_name} - ${r.error?.slice(0, 30) ?? '?'}`, time: timeAgo(r.scheduled_at) })
                })

                if (alerts.length === 0) return (
                  <div className="rounded-2xl p-4 text-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <span className="text-[14px]">✅</span>
                    <span className="text-[13px] font-medium ml-2" style={{ color: '#16a34a' }}>
                      {he ? 'הכל עובד תקין, אין התראות' : 'All systems operational, no alerts'}
                    </span>
                  </div>
                )

                return (
                  <div className="rounded-2xl p-4 space-y-3" style={{ background: '#fff', border: `1px solid ${C.waBorder}` }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold" style={{ color: '#dc2626' }}>🚨 {he ? 'התראות' : 'Alerts'} ({alerts.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {alerts.map((alert, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg"
                          style={{ background: alert.type === 'error' ? '#fef2f2' : '#fffbeb', border: `1px solid ${alert.type === 'error' ? '#fecaca' : '#fde68a'}` }}
                        >
                          <span className="text-[14px] shrink-0">{alert.icon}</span>
                          <span className="text-[12px] font-medium flex-1" style={{ color: alert.type === 'error' ? '#dc2626' : '#d97706' }}>{alert.text}</span>
                          {alert.time && <span className="text-[10px] shrink-0" style={{ color: C.waGray }}>{alert.time}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

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

