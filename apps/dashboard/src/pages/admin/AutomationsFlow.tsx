import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { supabase } from '../../lib/supabase'
import {
  Zap, Phone, MessageCircle, Sparkles, Clock,
  DollarSign, XCircle, RefreshCw,
  Send, Eye, AlertTriangle, CreditCard, Target,
  ArrowRight, Settings, FileText, BarChart3, Megaphone, Users,
  ChevronUp, ChevronDown,
} from 'lucide-react'

import StageNode from '../../components/admin/automations/StageNode'
import SubStatusesNode from '../../components/admin/automations/SubStatusesNode'
import AutomationsListNode from '../../components/admin/automations/AutomationsListNode'
import TemplatesNode from '../../components/admin/automations/TemplatesNode'
import TemplateChainNode from '../../components/admin/automations/TemplateChainNode'
import TransitionRulesNode from '../../components/admin/automations/TransitionRulesNode'
import FlowStepNode from '../../components/admin/automations/FlowStepNode'
import AutomationToggles from '../../components/admin/automations/AutomationToggles'
import NudgeTemplateEditor from '../../components/admin/automations/NudgeTemplateEditor'
import NudgeAnalytics from '../../components/admin/automations/NudgeAnalytics'
import CampaignManager from '../../components/admin/automations/CampaignManager'
import GroupManager from '../../components/admin/automations/GroupManager'

/* ═══════════════════════════════════════════════════════════
   Data definitions (same as before)
   ═══════════════════════════════════════════════════════════ */

interface HubDef {
  id: string
  x: number
  y: number
  color: string
  gradient: [string, string]
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  automation?: string
}

const PIPELINE_HUBS: HubDef[] = [
  { id: 'prospect', x: 80, y: 200, color: '#8E8E93', gradient: ['#B0B0B5', '#8E8E93'], icon: Target, label: 'PROSPECT', automation: 'Scoring every 6h' },
  { id: 'reached_out', x: 380, y: 200, color: '#007AFF', gradient: ['#4DA3FF', '#007AFF'], icon: Send, label: 'REACHED OUT', automation: 'Auto follow-up 3-touch' },
  { id: 'in_conversation', x: 680, y: 200, color: '#5856D6', gradient: ['#7A78E8', '#5856D6'], icon: MessageCircle, label: 'IN CONVERSATION', automation: 'Waiting-on-us every 5m' },
  { id: 'onboarding', x: 980, y: 200, color: '#FF9500', gradient: ['#FFB347', '#FF9500'], icon: Sparkles, label: 'ONBOARDING', automation: 'Step tracking' },
  { id: 'demo_trial', x: 980, y: 500, color: '#AF52DE', gradient: ['#C77DEB', '#AF52DE'], icon: Zap, label: 'IN TRIAL', automation: 'Activity detection hourly' },
  { id: 'trial_expired', x: 680, y: 500, color: '#FF3B30', gradient: ['#FF6B63', '#FF3B30'], icon: Clock, label: 'TRIAL EXPIRED' },
  { id: 'paying', x: 380, y: 500, color: '#34C759', gradient: ['#5ED87B', '#34C759'], icon: DollarSign, label: 'PAYING', automation: 'Stripe webhooks' },
  { id: 'churned', x: 80, y: 500, color: '#FF3B30', gradient: ['#FF6B63', '#FF3B30'], icon: XCircle, label: 'CHURNED', automation: 'Stripe webhooks' },
]

const CONNECTIONS: { from: string; to: string; animated?: boolean }[] = [
  { from: 'prospect', to: 'reached_out', animated: true },
  { from: 'reached_out', to: 'in_conversation', animated: true },
  { from: 'in_conversation', to: 'onboarding', animated: true },
  { from: 'onboarding', to: 'demo_trial', animated: true },
  { from: 'demo_trial', to: 'trial_expired' },
  { from: 'demo_trial', to: 'paying', animated: true },
  { from: 'trial_expired', to: 'churned' },
  { from: 'paying', to: 'churned' },
]

const SUB_STATUSES: Record<string, { key: string; label: string; color: string }[]> = {
  prospect: [
    { key: 'hot', label: 'Hot', color: '#FF3B30' },
    { key: 'warm', label: 'Warm', color: '#FF9500' },
    { key: 'cold', label: 'Cold', color: '#007AFF' },
    { key: 'stale', label: 'Stale', color: '#8E8E93' },
    { key: 'invalid', label: 'Invalid', color: '#C7C7CC' },
    { key: 'do_not_contact', label: 'DNC', color: '#FF3B30' },
  ],
  reached_out: [
    { key: 'not_sent', label: 'Not Sent', color: '#C7C7CC' },
    { key: 'unread', label: 'Unread', color: '#FF9500' },
    { key: 'read_no_reply', label: 'Read', color: '#FF9500' },
    { key: 'followup_1', label: 'Follow-up 1', color: '#007AFF' },
    { key: 'followup_2', label: 'Follow-up 2', color: '#007AFF' },
    { key: 'no_response', label: 'No Response', color: '#8E8E93' },
    { key: 'not_interested', label: 'Not Interested', color: '#FF3B30' },
  ],
  in_conversation: [
    { key: 'active', label: 'Active', color: '#34C759' },
    { key: 'asking_price', label: 'Asking Price', color: '#FF9500' },
    { key: 'interested', label: 'Wants to Try', color: '#34C759' },
    { key: 'hesitating', label: 'Hesitating', color: '#FF9500' },
    { key: 'waiting_on_us', label: 'Waiting on Us!', color: '#FF3B30' },
    { key: 'waiting_on_them', label: 'Waiting', color: '#8E8E93' },
    { key: 'gone_quiet', label: 'Gone Quiet', color: '#8E8E93' },
    { key: 'scheduled', label: 'Scheduled', color: '#5856D6' },
    { key: 'not_interested', label: 'Not Interested', color: '#FF3B30' },
  ],
  onboarding: [
    { key: 'first_name', label: 'Name', color: '#34C759' },
    { key: 'profession', label: 'Trades', color: '#34C759' },
    { key: 'city_state', label: 'State', color: '#007AFF' },
    { key: 'city', label: 'Cities', color: '#007AFF' },
    { key: 'working_days', label: 'Schedule', color: '#5856D6' },
    { key: 'confirm', label: 'Confirm', color: '#FF9500' },
    { key: 'groups', label: 'Groups', color: '#FF9500' },
  ],
  demo_trial: [
    { key: 'just_started', label: 'Just Started', color: '#007AFF' },
    { key: 'receiving_leads', label: 'Getting Leads', color: '#34C759' },
    { key: 'engaged', label: 'Engaged', color: '#34C759' },
    { key: 'no_leads', label: 'No Leads!', color: '#FF3B30' },
    { key: 'inactive', label: 'Inactive', color: '#FF9500' },
    { key: 'expiring', label: 'Expiring', color: '#FF9500' },
    { key: 'wants_to_pay', label: 'Wants to Pay', color: '#34C759' },
  ],
  trial_expired: [
    { key: 'was_active', label: 'Was Active', color: '#FF9500' },
    { key: 'barely_used', label: 'Barely Used', color: '#8E8E93' },
    { key: 'never_used', label: 'Never Used', color: '#C7C7CC' },
    { key: 'payment_failed', label: 'Payment Failed', color: '#FF3B30' },
    { key: 'got_offer', label: 'Got Offer', color: '#5856D6' },
    { key: 'declined', label: 'Declined', color: '#FF3B30' },
  ],
  paying: [
    { key: 'healthy', label: 'Healthy', color: '#34C759' },
    { key: 'power_user', label: 'Power User', color: '#34C759' },
    { key: 'low_usage', label: 'Low Usage', color: '#FF9500' },
    { key: 'low_leads', label: 'Low Leads', color: '#FF3B30' },
    { key: 'support_issue', label: 'Support', color: '#FF3B30' },
    { key: 'payment_failing', label: 'Payment Issue', color: '#FF3B30' },
    { key: 'upgrade_candidate', label: 'Upgrade', color: '#5856D6' },
  ],
  churned: [
    { key: 'recent', label: 'Recent', color: '#FF9500' },
    { key: 'old', label: 'Old', color: '#8E8E93' },
    { key: 'payment_failed', label: 'Payment Failed', color: '#FF3B30' },
    { key: 'no_value', label: 'No Value', color: '#FF9500' },
    { key: 'seasonal', label: 'Seasonal', color: '#007AFF' },
    { key: 'competitor', label: 'Competitor', color: '#FF3B30' },
    { key: 'closed', label: 'Closed', color: '#8E8E93' },
  ],
}

const AUTOMATIONS = [
  { id: 'scoring', name: 'Prospect Scoring', icon: Target, interval: 'Every 6h', stageId: 'prospect', color: '#FF9500' },
  { id: 'callbacks', name: 'Twilio Callbacks', icon: Eye, interval: 'Real-time', stageId: 'reached_out', color: '#007AFF' },
  { id: 'waiting', name: 'Waiting on Us', icon: AlertTriangle, interval: 'Every 5m', stageId: 'in_conversation', color: '#FF3B30' },
  { id: 'followup', name: 'Auto Follow-Up', icon: Send, interval: 'Every hour', stageId: 'reached_out', color: '#5856D6' },
  { id: 'trial', name: 'Trial Activity', icon: Zap, interval: 'Every hour', stageId: 'demo_trial', color: '#AF52DE' },
  { id: 'stripe', name: 'Stripe Webhooks', icon: CreditCard, interval: 'Real-time', stageId: 'paying', color: '#34C759' },
]

const TRANSITION_RULES: Record<string, { from: string; to: string; trigger: string; color: string }[]> = {
  prospect: [
    { from: 'cold', to: 'warm', trigger: 'Active in 2+ groups last 7d', color: '#FF9500' },
    { from: 'warm', to: 'hot', trigger: 'Replied to any message', color: '#FF3B30' },
    { from: 'cold', to: 'stale', trigger: 'No group activity 30d', color: '#8E8E93' },
    { from: 'stale', to: 'invalid', trigger: 'Left all groups', color: '#C7C7CC' },
  ],
  reached_out: [
    { from: 'not_sent', to: 'unread', trigger: 'Message delivered (Twilio)', color: '#FF9500' },
    { from: 'unread', to: 'read_no_reply', trigger: 'Read, no reply 24h', color: '#FF9500' },
    { from: 'read_no_reply', to: 'followup_1', trigger: 'Follow-up sent (day 3)', color: '#007AFF' },
    { from: 'followup_1', to: 'followup_2', trigger: 'Second follow-up (day 7)', color: '#007AFF' },
    { from: 'followup_2', to: 'no_response', trigger: 'No reply after 3 touches', color: '#8E8E93' },
  ],
  in_conversation: [
    { from: 'active', to: 'asking_price', trigger: 'Mentions price/cost', color: '#FF9500' },
    { from: 'active', to: 'interested', trigger: 'Says YES / wants to try', color: '#34C759' },
    { from: 'active', to: 'not_interested', trigger: 'Says NO / not interested', color: '#FF3B30' },
    { from: 'active', to: 'waiting_on_us', trigger: 'No agent reply 5m+', color: '#FF3B30' },
    { from: 'active', to: 'waiting_on_them', trigger: 'Bot replied, no response 24h', color: '#8E8E93' },
    { from: 'asking_price', to: 'interested', trigger: 'Convinced after price info', color: '#34C759' },
    { from: 'asking_price', to: 'hesitating', trigger: 'Still unsure after price', color: '#FF9500' },
    { from: 'hesitating', to: 'interested', trigger: 'Finally says YES', color: '#34C759' },
    { from: 'hesitating', to: 'not_interested', trigger: 'Says NO', color: '#FF3B30' },
    { from: 'hesitating', to: 'gone_quiet', trigger: 'No response 72h', color: '#8E8E93' },
    { from: 'waiting_on_them', to: 'gone_quiet', trigger: 'No response 72h', color: '#8E8E93' },
    { from: 'gone_quiet', to: 'not_interested', trigger: 'No response after 3 nudges', color: '#FF3B30' },
  ],
  onboarding: [
    { from: 'first_name', to: 'profession', trigger: 'Name confirmed', color: '#34C759' },
    { from: 'profession', to: 'city_state', trigger: 'Trades selected', color: '#007AFF' },
    { from: 'city_state', to: 'city', trigger: 'State selected', color: '#007AFF' },
    { from: 'city', to: 'working_days', trigger: 'Cities confirmed', color: '#5856D6' },
    { from: 'working_days', to: 'confirm', trigger: 'Schedule set', color: '#FF9500' },
  ],
  demo_trial: [
    { from: 'just_started', to: 'receiving_leads', trigger: 'First lead delivered', color: '#34C759' },
    { from: 'receiving_leads', to: 'engaged', trigger: 'Opened 3+ leads', color: '#34C759' },
    { from: 'just_started', to: 'no_leads', trigger: 'No leads after 48h', color: '#FF3B30' },
    { from: 'engaged', to: 'expiring', trigger: 'Trial ends in 2 days', color: '#FF9500' },
  ],
  trial_expired: [
    { from: 'was_active', to: 'got_offer', trigger: 'Discount offer sent', color: '#5856D6' },
    { from: 'got_offer', to: 'declined', trigger: 'No action on offer 7d', color: '#FF3B30' },
  ],
  paying: [
    { from: 'healthy', to: 'power_user', trigger: '50+ leads claimed/month', color: '#34C759' },
    { from: 'healthy', to: 'low_usage', trigger: '<5 leads claimed last 14d', color: '#FF9500' },
    { from: 'low_usage', to: 'low_leads', trigger: 'No leads available', color: '#FF3B30' },
    { from: 'healthy', to: 'payment_failing', trigger: 'Stripe payment failed', color: '#FF3B30' },
  ],
  churned: [
    { from: 'recent', to: 'old', trigger: 'Churned 30+ days ago', color: '#8E8E93' },
  ],
}

/* ═══════════════════════════════════════════════════════════
   Node type registry
   ═══════════════════════════════════════════════════════════ */

const nodeTypes = {
  stage: StageNode,
  subStatuses: SubStatusesNode,
  automationsList: AutomationsListNode,
  templates: TemplatesNode,
  templateChain: TemplateChainNode,
  transitionRules: TransitionRulesNode,
  flowStep: FlowStepNode,
}

/* ─── Trial nudges per sub-status ─── */
const TRIAL_NUDGES: Record<string, { wave: number; delay: string; message: string }[]> = {
  just_started: [
    { wave: 1, delay: '6 שעות', message: 'היי {name}! הרגע התחלנו 🚀\nאנחנו סורקים {group_count} קבוצות שלך עכשיו.\nתקבל הודעה ברגע שיש עבודה באזור שלך!' },
    { wave: 2, delay: '1 יום', message: '{name}, סרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך.\nמצאנו {lead_count} עבודות עד עכשיו — ברגע שיש משהו באזור שלך נשלח ישר 👍' },
  ],
  no_leads: [
    { wave: 1, delay: 'מיידי', message: '{name}, סרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך — עדיין לא מצאנו עבודות באזור שלך 😕\nכדי להגדיל סיכוי — תשלח עוד לינקים לקבוצות WhatsApp.\nיותר קבוצות = יותר עבודות!' },
    { wave: 2, delay: '2 ימים', message: '{name}, טיפ — הקבוצות הכי טובות הן קבוצות מקומיות של קבלנים באזור שלך.\nעכשיו אתה עם {group_count} קבוצות. תשלח עוד לינק ונתחיל לסרוק 🔍' },
    { wave: 3, delay: '4 ימים', message: '{name}, איך מוצאים לינק לקבוצה? 📲\n1. פתח WhatsApp\n2. היכנס לקבוצה של קבלנים\n3. לחץ על שם הקבוצה למעלה ☝️\n4. גלול למטה → "Invite via link"\n5. לחץ "Copy link" 📋\n6. חזור לפה והדבק!\nלוקח 10 שניות 💪' },
  ],
  inactive: [
    { wave: 1, delay: '2 ימים', message: 'היי {name}, מאז שלא נכנסת סרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך ומצאנו {lead_count} עבודות באזור שלך 👀' },
    { wave: 2, delay: '4 ימים', message: '{name}, תקופת הניסיון שלך נגמרת בקרוב ⏰\nסרקנו כבר {messages_scanned} הודעות ומצאנו לך {lead_count} עבודות.\nכדאי להיכנס ולבדוק!' },
  ],
  expiring: [
    { wave: 1, delay: 'מיידי', message: '{name}, תקופת הניסיון שלך נגמרת בעוד יומיים! ⏰\nסרקנו {messages_scanned} הודעות מ-{group_count} קבוצות ומצאנו לך {lead_count} עבודות.\nרוצה להמשיך? תשלח "כן" ונשלח לינק תשלום 💳' },
    { wave: 2, delay: '1 יום', message: '{name}, יום אחרון לניסיון! 🔔\n{lead_count} עבודות מחכות. אחרי היום לא תקבל יותר.\nתשלח "כן" להמשיך — $79/חודש, ביטול בכל זמן' },
  ],
  wants_to_pay: [
    { wave: 1, delay: '5 דק', message: '🎉 מעולה {name}! הנה הלינק לתשלום:\n{payment_link}\n$79/חודש, ביטול בכל זמן.\nאחרי תשלום תתחיל לקבל עבודות מיד!' },
    { wave: 2, delay: '1 שעה', message: '{name}, ראיתי שעוד לא סיימת תשלום.\nאם יש בעיה — תשלח הודעה ונעזור 👍' },
    { wave: 3, delay: '1 יום', message: '{name}, הלינק עדיין פעיל — {payment_link}\nאנחנו סורקים {group_count} קבוצות שלך כל יום.\nתשלם ותתחיל לקבל עבודות מחר בבוקר 🚀' },
  ],
}

/* ─── Win-back nudges for churned prospects ─── */
const CHURNED_NUDGES: Record<string, { wave: number; delay: string; message: string }[]> = {
  payment_failed: [
    { wave: 1, delay: 'אוטומטי', message: 'Stripe retry — ניסיון חיוב חוזר אוטומטי (3 ניסיונות)' },
    { wave: 2, delay: 'אחרי 3 ניסיונות', message: 'התראה לאדמין — לטפל ידנית' },
  ],
  recent: [
    { wave: 1, delay: '1 יום', message: 'היי {name}, חסר לנו אותך! 👋\nמאז שעזבת סרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך ומצאנו {lead_count} עבודות חדשות.\nרוצה לחזור? תשלח הודעה' },
    { wave: 2, delay: '7 ימים', message: '{name}, השבוע סרקנו {messages_scanned} הודעות מהקבוצות שלך — {lead_count} עבודות חדשות באזור שלך 🔥\nרוצה לחזור? תשלח "כן"' },
    { wave: 3, delay: '14 ימים', message: '{name}, הצעה מיוחדת — חודש ראשון ב-50% הנחה 🎁\nאנחנו עדיין סורקים {group_count} קבוצות שלך.\nרוצה לחזור ולקבל עבודות? תשלח הודעה\nלא שולחים יותר אחרי זה ✌️' },
  ],
  no_value: [
    { wave: 1, delay: '14 ימים', message: 'היי {name}, שיפרנו את המערכת! 🚀\nסרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך ומצאנו {lead_count} עבודות.\nרוצה לנסות שוב? שבוע ניסיון חינם 🎁' },
    { wave: 2, delay: '30 ימים', message: '{name}, מאז שעזבת סרקנו {messages_scanned} הודעות ומצאנו {lead_count} עבודות חדשות באזור שלך 📈\nרוצה לבדוק? תשלח הודעה\nלא שולחים יותר ✌️' },
  ],
  seasonal: [
    { wave: 1, delay: 'תחילת עונה', message: 'היי {name}, העונה חוזרת! 🔨☀️\nסרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך — כבר {lead_count} עבודות חדשות!\nרוצה להפעיל מחדש? תשלח "כן"' },
  ],
}

/* ─── In Conversation nudges — when prospect goes quiet mid-conversation ─── */
const CONVERSATION_NUDGES: Record<string, { wave: number; delay: string; message: string }[]> = {
  active: [],
  asking_price: [],
  interested: [
    { wave: 1, delay: '5 דק', message: 'מעולה {name}! 🎉 בוא נעשה רישום מהיר — לוקח דקה.\nמה השם המלא שלך?' },
  ],
  hesitating: [
    { wave: 1, delay: '4 שעות', message: '{name}, אין לחץ 👍\n7 ימים ניסיון בחינם — בלי כרטיס אשראי, בלי התחייבות.\nאם לא מתאים פשוט לא ממשיכים.\nרוצה לנסות? תשלח "כן"' },
    { wave: 2, delay: '1 יום', message: '{name}, סרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך.\nקבלנים אחרים כבר מקבלים עבודות דרכנו.\nתנסה שבוע בחינם — תשלח "כן" 💪' },
    { wave: 3, delay: '3 ימים', message: '{name}, עדיין פה אם תרצה 👍\nתשלח הודעה בכל זמן.\nלא שולחים יותר ✌️' },
  ],
  waiting_on_us: [],
  waiting_on_them: [
    { wave: 1, delay: '4 שעות', message: '{name}, ראית את מה ששלחנו? 👀\nאם צריך עזרה — תשלח הודעה' },
    { wave: 2, delay: '1 יום', message: '{name}, אנחנו סורקים {group_count} קבוצות שלך כל יום 🔍\nכשתהיה מוכן — תשלח הודעה 👍' },
  ],
  gone_quiet: [
    { wave: 1, delay: '1 יום', message: '{name}, שמנו לב שהפסקת לכתוב 😕\nאנחנו סורקים {group_count} קבוצות שלך כל יום.\nרוצה לנסות שבוע חינם? תשלח "כן"' },
    { wave: 2, delay: '3 ימים', message: '{name}, סרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך 🔍\nרוצה לקבל עבודות? תשלח "כן" — 7 ימים חינם!' },
    { wave: 3, delay: '7 ימים', message: '{name}, עדיין פה אם תרצה 👍\nתשלח הודעה בכל זמן.\nלא שולחים יותר ✌️' },
  ],
  scheduled: [
    { wave: 1, delay: '1 שעה לפני', message: '{name}, תזכורת — יש לך שיחה מתוכננת בקרוב 📞\nנדבר!' },
  ],
  not_interested: [],
}

/* ─── First Touch — initial outreach to new prospect ─── */
const FIRST_TOUCH_MSG = 'היי {name}, ראיתי שאתה ב-{group_name} 👋\nאנחנו מחפשים {trade} באזור {city}.\nיש עבודות חדשות כל יום — רוצה לקבל ישר לוואטסאפ?\nתשלח "כן" ונתחיל!'

/* ─── Trial Expired nudges ─── */
const TRIAL_EXPIRED_NUDGES: Record<string, { wave: number; delay: string; message: string }[]> = {
  had_leads: [
    { wave: 1, delay: 'מיידי', message: '{name}, תקופת הניסיון נגמרה 😕\nסרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך ומצאנו לך {lead_count} עבודות!\nרוצה להמשיך? $79/חודש — תשלח "כן"' },
    { wave: 2, delay: '7 ימים', message: '{name}, מאז שהניסיון נגמר סרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך — {lead_count} עבודות חדשות 🔥\nרוצה לחזור? תשלח "כן"' },
    { wave: 3, delay: '14 ימים', message: '{name}, הצעה אחרונה — שבוע ניסיון נוסף בחינם 🎁\nתשלח "כן" ונפעיל מחדש.\nלא שולחים יותר ✌️' },
  ],
  no_leads: [
    { wave: 1, delay: 'מיידי', message: '{name}, תקופת הניסיון נגמרה.\nלא מצאנו מספיק עבודות באזור שלך 😕\nתשלח עוד לינקים לקבוצות ונאריך את הניסיון בחינם! 🎁' },
    { wave: 2, delay: '7 ימים', message: '{name}, טיפ — ככל שיש יותר קבוצות, יותר עבודות נמצאות.\nעכשיו יש לך {group_count} קבוצות. תשלח עוד לינק ונאריך ניסיון בחינם 🔍' },
    { wave: 3, delay: '14 ימים', message: '{name}, עדיין פה אם תרצה 👍\nתשלח לינק לקבוצה בכל זמן ונפעיל ניסיון מחדש.\nלא שולחים יותר ✌️' },
  ],
  was_active: [
    { wave: 1, delay: 'מיידי', message: '{name}, תקופת הניסיון נגמרה.\nסרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך — השירות עובד!\nרוצה להמשיך לקבל עבודות? $79/חודש — תשלח "כן"' },
    { wave: 2, delay: '7 ימים', message: '{name}, סרקנו עוד {messages_scanned} הודעות מהקבוצות שלך השבוע 🔍\nעבודות ממשיכות להגיע — רוצה לחזור? תשלח "כן"' },
    { wave: 3, delay: '14 ימים', message: '{name}, הצעה אחרונה — שבוע ניסיון נוסף בחינם 🎁\nתשלח "כן" ונפעיל מחדש.\nלא שולחים יותר ✌️' },
  ],
  barely_used: [
    { wave: 1, delay: 'מיידי', message: '{name}, תקופת הניסיון נגמרה.\nנראה שלא הספקת לנסות כמו שצריך 😕\nרוצה עוד שבוע חינם? תשלח "כן" ונפעיל מחדש 🎁' },
    { wave: 2, delay: '7 ימים', message: '{name}, אנחנו סורקים {group_count} קבוצות שלך כל יום.\nאם צריך עזרה — תשלח הודעה ונסביר הכל 👍' },
    { wave: 3, delay: '14 ימים', message: '{name}, עדיין פה אם תרצה 👍\nתשלח הודעה בכל זמן ונפעיל ניסיון מחדש.\nלא שולחים יותר ✌️' },
  ],
  never_used: [
    { wave: 1, delay: '1 יום', message: '{name}, נרשמת אבל לא הספקת להשתמש.\nרוצה שנתחיל מחדש? תשלח "כן" ונפעיל שבוע חינם 🎁' },
    { wave: 2, delay: '7 ימים', message: '{name}, רוב הקבלנים מתחילים לקבל עבודות ביום הראשון.\nתשלח "כן" ונתחיל מחדש — לוקח דקה ⚡' },
    { wave: 3, delay: '14 ימים', message: '{name}, עדיין פה אם תרצה 👍\nתשלח הודעה בכל זמן.\nלא שולחים יותר ✌️' },
  ],
  payment_failed: [
    { wave: 1, delay: 'מיידי', message: '{name}, ניסינו לחייב אבל יש בעיה בכרטיס 😕\nתשלח "כן" ונשלח לינק תשלום חדש — לוקח דקה לסדר 👍' },
    { wave: 2, delay: '1 יום', message: '{name}, עדיין יש בעיה בתשלום.\nאנחנו ממשיכים לסרוק {group_count} קבוצות שלך — תסדר תשלום ותמשיך לקבל עבודות 💳' },
    { wave: 3, delay: '3 ימים', message: '{name}, בלי תשלום לא נוכל להמשיך לשלוח עבודות 😕\nתשלח הודעה ונעזור לסדר.\nלא שולחים יותר ✌️' },
  ],
  got_offer: [
    { wave: 1, delay: '1 יום', message: '{name}, ההצעה עדיין בתוקף 🎁\nרוצה לחזור? תשלח "כן"' },
    { wave: 2, delay: '3 ימים', message: '{name}, יום אחרון להצעה.\nתשלח "כן" ונפעיל מחדש.\nלא שולחים יותר ✌️' },
  ],
  declined: [],
}

/* ─── Paying customer nudges ─── */
const PAYING_NUDGES: Record<string, { wave: number; delay: string; message: string }[]> = {
  welcome: [
    { wave: 1, delay: 'מיידי', message: '🎉 {name}, ברוך הבא!\nאנחנו סורקים {group_count} קבוצות שלך עכשיו.\nתקבל עבודות חדשות ישר לפה. בהצלחה! 💪' },
  ],
  healthy: [
    { wave: 1, delay: 'שבועי', message: '{name}, סיכום שבועי 📊\nסרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך ושלחנו לך {lead_count} עבודות.\nרוצה להוסיף עוד קבוצות? תשלח לינק!' },
  ],
  getting_leads: [
    { wave: 1, delay: 'שבועי', message: '{name}, סיכום שבועי 📊\nסרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך ושלחנו לך {lead_count} עבודות.\nרוצה להוסיף עוד קבוצות? תשלח לינק!' },
  ],
  no_leads_week: [
    { wave: 1, delay: '7 ימים', message: '{name}, השבוע לא מצאנו עבודות חדשות באזור שלך 😕\nסרקנו {messages_scanned} הודעות מ-{group_count} קבוצות.\nטיפ — תשלח עוד לינקים לקבוצות. יותר קבוצות = יותר עבודות!' },
  ],
  low_leads: [
    { wave: 1, delay: 'שבועי', message: '{name}, השבוע שלחנו לך {lead_count} עבודות — פחות מהרגיל.\nסרקנו {messages_scanned} הודעות מ-{group_count} קבוצות.\nרוצה לקבל יותר? תשלח עוד לינקים לקבוצות 📲' },
  ],
  payment_failing: [
    { wave: 1, delay: 'מיידי', message: '{name}, יש בעיה בתשלום 😕\nבלי תשלום לא נוכל להמשיך לשלוח עבודות.\nתשלח הודעה ונעזור לסדר 👍' },
    { wave: 2, delay: '2 ימים', message: '{name}, עדיין יש בעיה בתשלום.\nאנחנו ממשיכים לסרוק {group_count} קבוצות שלך — תסדר תשלום כדי להמשיך לקבל עבודות 💳' },
    { wave: 3, delay: '5 ימים', message: '{name}, לא הצלחנו לגבות תשלום.\nנצטרך להשהות את השירות אם לא מסתדר.\nתשלח הודעה ונעזור 👍' },
  ],
  support_issue: [
    { wave: 1, delay: '1 שעה', message: '{name}, קיבלנו את הפנייה שלך 👍\nנחזור אליך בהקדם!' },
  ],
}

/* ─── Template-to-substatus mapping ─── */
const TEMPLATE_MAP: Record<string, Record<string, number>> = {
  reached_out: { unread: 1, followup_1: 2, followup_2: 3 },
}

/* ─── Onboarding nudge schedule ─── */
const ONBOARD_NUDGES: Record<string, { wave: number; delay: string; message: string }[]> = {
  first_name: [
    { wave: 1, delay: '30 דק', message: 'היי! 👋 התחלנו רישום אבל נתקענו.\nמה השם שלך? לוקח דקה לסיים ⚡' },
    { wave: 2, delay: '1 שעה', message: 'עדיין פה אם צריך 👋\nאם משהו לא ברור — תשאל.\nכדי להתחיל פשוט תכתוב את השם שלך ✏️' },
    { wave: 3, delay: '1 יום', message: 'סרקנו {messages_scanned} הודעות מהקבוצות שלך 🔍\nקבלנים אחרים כבר מקבלים עבודות. תסיים רישום — לוקח דקה.' },
    { wave: 4, delay: '2 ימים', message: 'עדיין פה אם תרצה 👍\nלא שולחים יותר הודעות אחרי זה ✌️' },
  ],
  profession: [
    { wave: 1, delay: '30 דק', message: '{name}, חסר לנו רק מה המקצוע שלך ונסיים 🔧' },
    { wave: 2, delay: '1 שעה', message: 'המקצועות הפופולריים:\n🔧 Plumbing ⚡ Electrical ❄️ HVAC\nתכתוב מה שמתאים לך' },
    { wave: 3, delay: '1 יום', message: 'סרקנו {messages_scanned} הודעות מהקבוצות שלך 🔍\nתסיים רישום ונתחיל לשלוח לך עבודות!' },
    { wave: 4, delay: '2 ימים', message: 'עדיין פה אם תרצה 👍 לא שולחים יותר ✌️' },
  ],
  city_state: [
    { wave: 1, delay: '30 דק', message: '{name}, כמעט סיימנו!\nבאיזה מדינה? 🌴 FL 🗽 NY 🤠 TX' },
    { wave: 2, delay: '1 שעה', message: 'רוב הקבלנים שלנו ב-Florida.\nתכתוב את שם המדינה ונמשיך' },
    { wave: 3, delay: '1 יום', message: 'סרקנו {messages_scanned} הודעות מהקבוצות שלך 🔍\nתסיים רישום ונתחיל לשלוח לך עבודות!' },
    { wave: 4, delay: '2 ימים', message: 'עדיין פה אם תרצה 👍 לא שולחים יותר ✌️' },
  ],
  city: [
    { wave: 1, delay: '30 דק', message: '{name}, חסר רק לבחור אזורים ואתה בפנים! 📍' },
    { wave: 2, delay: '1 שעה', message: 'תכתוב "all" ואני אוסיף את כל האזורים 📍' },
    { wave: 3, delay: '1 יום', message: 'סרקנו {messages_scanned} הודעות מהקבוצות שלך 🔍\nתסיים רישום ונתחיל לשלוח לך עבודות!' },
    { wave: 4, delay: '2 ימים', message: 'עדיין פה אם תרצה 👍 לא שולחים יותר ✌️' },
  ],
  working_days: [
    { wave: 1, delay: '30 דק', message: '{name}, שלב אחרון! מתי אתה עובד?\n1. ראשון-חמישי  2. כל יום' },
    { wave: 2, delay: '1 שעה', message: 'רוב הקבלנים בוחרים "כל יום".\nתכתוב 1 או 2 ונסיים 👍' },
    { wave: 3, delay: '1 יום', message: 'סרקנו {messages_scanned} הודעות מהקבוצות שלך 🔍\nתסיים רישום ונתחיל לשלוח לך עבודות!' },
    { wave: 4, delay: '2 ימים', message: 'עדיין פה אם תרצה 👍 לא שולחים יותר ✌️' },
  ],
  confirm: [
    { wave: 1, delay: '30 דק', message: '{name}, הפרופיל מוכן! ✅ תשלח YES ותתחיל לקבל עבודות 🚀' },
    { wave: 2, delay: '1 שעה', message: 'רק מילה אחת — YES ואתה מתחיל לקבל עבודות 📱' },
    { wave: 3, delay: '1 יום', message: 'סרקנו {messages_scanned} הודעות מ-{group_count} קבוצות שלך 🔍\nעבודות מחכות — תשלח YES ותתחיל לקבל!' },
    { wave: 4, delay: '2 ימים', message: 'עדיין פה אם תרצה 👍 לא שולחים יותר ✌️' },
  ],
  groups: [
    { wave: 1, delay: '30 דק', message: '{name}, נשאר רק לשלוח לינק לקבוצת WhatsApp שאתה חבר בה 📲\nאנחנו נסרוק הודעות ונמצא לך עבודות!' },
    { wave: 2, delay: '1 שעה', message: '{name}, ככה זה עובד — תשלח לינק לקבוצה של קבלנים ואנחנו נסרוק הודעות ונמצא עבודות בשבילך 🔍\nלא יודע איך? תכתוב "עזרה"' },
    { wave: 3, delay: '1 יום', message: '{name}, קבלנים אחרים כבר מקבלים עבודות מהקבוצות שלהם 🔥\nתשלח לינק לקבוצה ותתחיל גם — לוקח 10 שניות' },
    { wave: 4, delay: '2 ימים', message: '{name}, עדיין פה אם תרצה 👍\nתשלח לינק לקבוצה בכל זמן ונתחיל לסרוק עבודות.\nלא שולחים יותר הודעות ✌️' },
  ],
}

/* ─── BFS layout for transition graph ─── */
function layoutTransitionGraph(
  rules: { from: string; to: string; trigger: string; color: string }[],
  subs: { key: string; label: string; color: string }[],
) {
  // Build adjacency: from → [to, to, ...]
  const adj: Record<string, string[]> = {}
  const incoming: Record<string, number> = {}
  const subMap = new Map(subs.map(s => [s.key, s]))

  for (const r of rules) {
    if (!adj[r.from]) adj[r.from] = []
    adj[r.from].push(r.to)
    incoming[r.to] = (incoming[r.to] || 0) + 1
    if (!(r.from in incoming)) incoming[r.from] = incoming[r.from] || 0
  }

  // Find roots (no incoming edges from rules)
  const allKeys = new Set([...rules.map(r => r.from), ...rules.map(r => r.to)])
  const roots = [...allKeys].filter(k => !incoming[k] || incoming[k] === 0)

  // BFS to assign columns
  const col: Record<string, number> = {}
  const row: Record<string, number> = {}
  const queue = roots.map((r, i) => ({ key: r, c: 0, r: i }))
  const colCounts: Record<number, number> = {}

  while (queue.length > 0) {
    const { key, c, r: suggestedRow } = queue.shift()!
    if (key in col) continue
    col[key] = c
    if (!colCounts[c]) colCounts[c] = 0
    row[key] = colCounts[c]++
    for (const next of (adj[key] || [])) {
      if (!(next in col)) {
        queue.push({ key: next, c: c + 1, r: 0 })
      }
    }
  }

  // Add sub-statuses not in any rule (orphans) at the end
  const maxCol = Math.max(0, ...Object.values(col))
  for (const s of subs) {
    if (!(s.key in col)) {
      col[s.key] = maxCol + 1
      if (!colCounts[maxCol + 1]) colCounts[maxCol + 1] = 0
      row[s.key] = colCounts[maxCol + 1]++
    }
  }

  return { col, row, roots }
}

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

interface ProspectEvent {
  id: string
  event_type: string
  old_value: string | null
  new_value: string | null
  created_at: string
  prospect_id: string
}

function EventBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    stage_change: { label: 'Stage', color: '#FF9500' },
    sub_status_change: { label: 'Status', color: '#007AFF' },
    auto_followup: { label: 'Bot', color: '#5856D6' },
  }
  const def = map[type] || { label: type, color: '#8E8E93' }
  return (
    <span
      className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
      style={{ background: `${def.color}15`, color: def.color }}
    >
      {def.label}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════ */

function AutomationsFlowInner() {
  const { fitView } = useReactFlow()
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [subStatusCounts, setSubStatusCounts] = useState<Record<string, Record<string, number>>>({})
  const [recentEvents, setRecentEvents] = useState<ProspectEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  // Auto-fit view when selection changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.2, duration: 400, maxZoom: 0.7 })
    }, 80)
    return () => clearTimeout(timer)
  }, [selectedStage, fitView])

  async function fetchData() {
    const { data: rows } = await supabase.rpc('get_pipeline_counts')
    if (rows) {
      const sc: Record<string, number> = {}
      const ssc: Record<string, Record<string, number>> = {}
      for (const r of rows as { stage: string; sub_status: string | null; count: number }[]) {
        sc[r.stage] = (sc[r.stage] || 0) + r.count
        if (r.sub_status) {
          if (!ssc[r.stage]) ssc[r.stage] = {}
          ssc[r.stage][r.sub_status] = r.count
        }
      }
      setStageCounts(sc)
      setSubStatusCounts(ssc)
    }

    const { data: tplData } = await supabase
      .from('message_templates').select('*').eq('is_active', true).order('touch_number')
    if (tplData) setTemplates(tplData)

    const { data: events } = await supabase
      .from('prospect_events')
      .select('id, event_type, old_value, new_value, created_at, prospect_id')
      .in('event_type', ['stage_change', 'sub_status_change', 'auto_followup'])
      .order('created_at', { ascending: false })
      .limit(20)
    if (events) setRecentEvents(events as ProspectEvent[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const handleToggleStage = useCallback((stageId: string) => {
    setSelectedStage(prev => prev === stageId ? null : stageId)
  }, [])

  /* ─── Build React Flow nodes + edges ─── */
  const { nodes, edges } = useMemo(() => {
    const n: Node[] = []
    const e: Edge[] = []

    // Calculate how much space the expanded chain needs
    let expandedCols = 0
    let selectedHub: HubDef | undefined
    let selectedIdx = -1

    if (selectedStage) {
      selectedHub = PIPELINE_HUBS.find(h => h.id === selectedStage)
      selectedIdx = PIPELINE_HUBS.indexOf(selectedHub!)
      const rules = TRANSITION_RULES[selectedStage] || []
      const subs = SUB_STATUSES[selectedStage] || []
      const { col } = layoutTransitionGraph(rules, subs)
      expandedCols = Math.max(0, ...Object.values(col)) + 1
    }

    const colSpacing = 300
    const rowSpacing = 200
    const expandWidth = expandedCols * colSpacing + 100 // extra space for the chain

    // Stage nodes — push stages after selected one to the right
    for (let i = 0; i < PIPELINE_HUBS.length; i++) {
      const hub = PIPELINE_HUBS[i]
      let xOffset = 0
      if (selectedIdx >= 0 && i > selectedIdx) {
        // Same row as selected? Push right
        const sameRow = (hub.y < 350) === (selectedHub!.y < 350)
        if (sameRow) xOffset = expandWidth
      }

      n.push({
        id: hub.id,
        type: 'stage',
        position: { x: hub.x + xOffset, y: hub.y },
        data: {
          id: hub.id,
          label: hub.label,
          count: stageCounts[hub.id] || 0,
          color: hub.color,
          gradient: hub.gradient,
          icon: hub.icon,
          automation: hub.automation,
          isSelected: selectedStage === hub.id,
          onToggle: handleToggleStage,
        },
      })
    }

    // Pipeline edges (skip the edge FROM selected stage — chain replaces it)
    for (const conn of CONNECTIONS) {
      if (selectedStage && conn.from === selectedStage) continue // chain replaces this edge
      e.push({
        id: `pipe-${conn.from}-${conn.to}`,
        source: conn.from,
        target: conn.to,
        type: 'default',
        animated: conn.animated,
        style: {
          stroke: PIPELINE_HUBS.find(h => h.id === conn.from)?.color || '#8E8E93',
          strokeWidth: 2,
          opacity: 0.25,
        },
      })
    }

    // Expanded chain — inserted between selected stage and next stage
    if (selectedStage && selectedHub) {
      const hub = selectedHub
      const subs = SUB_STATUSES[hub.id] || []
      const rules = TRANSITION_RULES[hub.id] || []
      const stageAutos = AUTOMATIONS.filter(a => a.stageId === hub.id)
      const stageTemplates = templates.filter((t: any) => {
        if (hub.id === 'reached_out') return t.category === 'follow_up' || t.category === 'first_touch'
        if (hub.id === 'prospect') return t.category === 'first_touch'
        if (hub.id === 'trial_expired' || hub.id === 'churned') return t.category === 'reactivation'
        return false
      })
      const tplMap = TEMPLATE_MAP[hub.id] || {}

      const { col, row } = layoutTransitionGraph(rules, subs)
      const chainStartX = hub.x + 200

      const ruleLookup: Record<string, { to: string; trigger: string; color: string }[]> = {}
      for (const r of rules) {
        if (!ruleLookup[r.from]) ruleLookup[r.from] = []
        ruleLookup[r.from].push(r)
      }

      // Track first and last nodes for connecting to pipeline
      const sourceNodes: string[] = []
      const sinkNodes: string[] = []

      for (const sub of subs) {
        if (!(sub.key in col)) continue
        const nodeId = `${hub.id}-step-${sub.key}`
        const count = subStatusCounts[hub.id]?.[sub.key] || 0
        const outRules = ruleLookup[sub.key] || []
        const isSource = !rules.some(r => r.to === sub.key)
        const isSink = outRules.length === 0

        if (isSource) sourceNodes.push(nodeId)
        if (isSink) sinkNodes.push(nodeId)

        const touchNum = tplMap[sub.key]
        const tpl = touchNum ? stageTemplates.find((t: any) => t.touch_number === touchNum) : undefined

        const auto = stageAutos.find(a => {
          if (sub.key === 'unread' || sub.key === 'read_no_reply') return a.id === 'callbacks'
          if (sub.key === 'waiting_on_us') return a.id === 'waiting'
          if (sub.key === 'followup_1' || sub.key === 'followup_2') return a.id === 'followup'
          return false
        })

        n.push({
          id: nodeId,
          type: 'flowStep',
          position: {
            x: chainStartX + col[sub.key] * colSpacing,
            y: hub.y - 40 + row[sub.key] * rowSpacing,
          },
          data: {
            stepLabel: sub.label,
            subStatusKey: sub.key,
            count,
            color: sub.color,
            stageColor: hub.color,
            trigger: outRules.length > 0 ? outRules[0].trigger : undefined,
            template: tpl,
            automation: auto ? { name: auto.name, interval: auto.interval, icon: auto.icon, color: auto.color } : undefined,
            nudges: hub.id === 'onboarding' ? ONBOARD_NUDGES[sub.key]
              : hub.id === 'churned' ? CHURNED_NUDGES[sub.key]
              : hub.id === 'demo_trial' ? TRIAL_NUDGES[sub.key]
              : hub.id === 'trial_expired' ? TRIAL_EXPIRED_NUDGES[sub.key]
              : hub.id === 'paying' ? PAYING_NUDGES[sub.key]
              : hub.id === 'in_conversation' ? CONVERSATION_NUDGES[sub.key]
              : undefined,
            isFirst: isSource,
            isLast: isSink,
            onSave: async (id: string, body: string) => {
              await supabase.from('message_templates').update({ body_template: body }).eq('id', id)
              fetchData()
            },
          },
        })
      }

      // Edges: stage hub → source nodes (start of chain)
      for (const srcId of sourceNodes) {
        e.push({
          id: `flow-start-${srcId}`,
          source: hub.id,
          target: srcId,
          type: 'default',
          animated: true,
          style: { stroke: hub.color, strokeWidth: 2, opacity: 0.3 },
        })
      }

      // Edges: transition rules (chain connections with branches)
      for (const rule of rules) {
        e.push({
          id: `flow-${rule.from}-${rule.to}`,
          source: `${hub.id}-step-${rule.from}`,
          target: `${hub.id}-step-${rule.to}`,
          type: 'default',
          animated: true,
          label: rule.trigger,
          labelStyle: { fontSize: 8, fill: '#8E8E93' },
          labelBgStyle: { fill: '#faf9f6', fillOpacity: 0.9 },
          labelBgPadding: [4, 2] as [number, number],
          style: { stroke: rule.color, strokeWidth: 2, opacity: 0.3 },
        })
      }

      // Edges: sink nodes → next pipeline stage(s)
      const nextConns = CONNECTIONS.filter(c => c.from === hub.id)
      for (const conn of nextConns) {
        for (const sinkId of sinkNodes) {
          e.push({
            id: `flow-end-${sinkId}-${conn.to}`,
            source: sinkId,
            target: conn.to,
            type: 'default',
            animated: conn.animated,
            style: { stroke: hub.color, strokeWidth: 2, opacity: 0.2 },
          })
        }
      }
    }

    return { nodes: n, edges: e }
  }, [stageCounts, subStatusCounts, selectedStage, templates, handleToggleStage])

  const totalProspects = Object.values(stageCounts).reduce((a, b) => a + b, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#faf9f6' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 border-2 border-[#5856D6]/20 rounded-full" />
            <div className="absolute inset-0 border-2 border-[#5856D6] border-t-transparent rounded-full animate-spin" />
          </div>
          <span className="text-[#3b3b3b]/40 text-[10px] uppercase tracking-[0.2em] font-medium">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full flex flex-col" style={{ background: '#faf9f6' }}>
      {/* ═══════════════ TOP BAR ═══════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-4 h-[52px] z-10 relative"
        style={{ background: '#ffffff', borderBottom: '1px solid #efeff1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#5856D6]" />
            <div className="flex flex-col leading-none">
              <span className="text-[#0b0707]/80 font-extrabold text-[12px] tracking-[0.05em]">AUTOMATIONS FLOW</span>
              <span className="text-[7px] text-[#3b3b3b]/30 uppercase tracking-[0.25em]">pipeline network</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#5856D6]/10 border border-[#5856D6]/20 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#5856D6] animate-pulse shadow-[0_0_6px_rgba(88,86,214,0.8)]" />
            <span className="text-[9px] font-bold text-[#5856D6] uppercase tracking-[0.12em]">Live</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f5f2ed] border border-[#efeff1]">
            <span className="text-[8px] text-[#3b3b3b]/40 uppercase tracking-[0.15em] font-medium">Total</span>
            <span className="text-[15px] font-black tabular-nums text-[#0b0707]/80">{totalProspects.toLocaleString()}</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all
              bg-[#f5f2ed] hover:bg-[#efece7] border border-[#efeff1] text-[#3b3b3b]/60 hover:text-[#3b3b3b]/90"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ═══════════════ REACT FLOW CANVAS ═══════════════ */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnScroll
          zoomOnScroll
          style={{ background: '#faf9f6' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#e0ddd8" />
          <Controls
            position="bottom-left"
            showInteractive={false}
            style={{ borderRadius: 10, border: '1px solid #efeff1', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          />
          <MiniMap
            position="bottom-right"
            nodeColor={(node) => {
              const hub = PIPELINE_HUBS.find(h => h.id === node.id)
              return hub?.color || '#e0ddd8'
            }}
            maskColor="rgba(250,249,246,0.85)"
            style={{ borderRadius: 10, border: '1px solid #efeff1', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          />
        </ReactFlow>
        <style>{`
          .react-flow__node { pointer-events: all !important; cursor: pointer; }
          .react-flow__node.selected { box-shadow: none !important; }
        `}</style>
      </div>

      {/* ═══════════════ BOTTOM — Tabbed Management Panel ═══════════════ */}
      <div
        className="shrink-0 z-10 flex flex-col"
        style={{ background: '#ffffff', borderTop: '1px solid #efeff1', boxShadow: '0 -1px 3px rgba(0,0,0,0.05)' }}
      >
        {/* Tab bar */}
        <div className="flex items-center justify-between px-2 border-b border-gray-50">
          <div className="flex items-center">
            {[
              { key: 'toggles', label: 'Automations', icon: Settings },
              { key: 'templates', label: 'Templates', icon: FileText },
              { key: 'analytics', label: 'Analytics', icon: BarChart3 },
              { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
              { key: 'groups', label: 'Groups', icon: Users },
            ].map(tab => {
              const isActive = activeTab === tab.key
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    if (activeTab === tab.key) {
                      setActiveTab(null)
                      setPanelCollapsed(true)
                    } else {
                      setActiveTab(tab.key)
                      setPanelCollapsed(false)
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold transition-all border-b-2 ${
                    isActive
                      ? 'border-[#5856D6] text-[#5856D6]'
                      : 'border-transparent text-[#3b3b3b]/40 hover:text-[#3b3b3b]/70 hover:border-[#3b3b3b]/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 pr-2">
            {/* Recent events mini ticker */}
            <div className="flex items-center gap-1 overflow-hidden max-w-[300px]">
              {recentEvents.slice(0, 3).map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: '#f5f2ed', border: '1px solid #efeff1' }}
                >
                  <span className="text-[7px] text-[#3b3b3b]/25 font-mono">{fmtTime(ev.created_at)}</span>
                  <EventBadge type={ev.event_type} />
                </div>
              ))}
            </div>
            {activeTab && (
              <button
                onClick={() => setPanelCollapsed(!panelCollapsed)}
                className="p-1 rounded hover:bg-[#f5f2ed] transition-colors"
              >
                {panelCollapsed
                  ? <ChevronUp className="w-3.5 h-3.5 text-[#3b3b3b]/30" />
                  : <ChevronDown className="w-3.5 h-3.5 text-[#3b3b3b]/30" />
                }
              </button>
            )}
          </div>
        </div>

        {/* Panel content */}
        {activeTab && !panelCollapsed && (
          <div className="overflow-y-auto p-4" style={{ maxHeight: '45vh', background: '#faf9f6' }}>
            {activeTab === 'toggles' && <AutomationToggles />}
            {activeTab === 'templates' && <NudgeTemplateEditor />}
            {activeTab === 'analytics' && <NudgeAnalytics />}
            {activeTab === 'campaigns' && <CampaignManager />}
            {activeTab === 'groups' && <GroupManager />}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AutomationsFlow() {
  return (
    <ReactFlowProvider>
      <AutomationsFlowInner />
    </ReactFlowProvider>
  )
}
