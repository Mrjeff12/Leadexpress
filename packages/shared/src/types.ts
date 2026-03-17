// ============================================================
// Core Types for Lead Express
// ============================================================

// --- User & Auth ---

export type UserRole = 'contractor' | 'admin'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  phone: string | null
  telegram_chat_id: number | null
  whatsapp_phone: string | null
  preferred_locale: 'en' | 'he'
  timezone: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// --- Plans & Subscriptions ---

export type PlanSlug = 'starter' | 'pro' | 'unlimited'

export interface Plan {
  id: string
  slug: PlanSlug
  name: string
  price_cents: number
  max_groups: number      // -1 = unlimited
  max_professions: number // -1 = unlimited
  max_zip_codes: number   // -1 = unlimited
  stripe_price_id: string | null
  is_active: boolean
  created_at: string
}

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'paused' | 'trialing'

export interface Subscription {
  id: string
  user_id: string
  plan_id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string
  status: SubscriptionStatus
  current_period_end: string
  created_at: string
  updated_at: string
}

// --- Contractors ---

export type Profession =
  | 'hvac' | 'air_duct' | 'chimney' | 'dryer_vent'
  | 'garage_door' | 'locksmith' | 'roofing'
  | 'plumbing' | 'electrical' | 'painting'
  | 'cleaning' | 'carpet_cleaning'
  | 'renovation' | 'fencing' | 'landscaping'
  | 'tiling' | 'kitchen' | 'bathroom' | 'pool'
  | 'moving' | 'other'

export interface Contractor {
  user_id: string
  professions: Profession[]
  zip_codes: string[]
  is_active: boolean
  wa_notify: boolean
  available_today: boolean
  wa_window_until: string | null
  created_at: string
  updated_at: string
}

export interface ContractorWithProfile extends Contractor {
  profile: Profile
  subscription: Subscription | null
  plan: Plan | null
}

// --- WhatsApp Groups ---

export type GroupStatus = 'active' | 'paused' | 'disconnected' | 'banned'

export interface Group {
  id: string
  wa_group_id: string
  name: string
  category: Profession | null
  status: GroupStatus
  message_count: number
  last_message_at: string | null
  created_at: string
}

// --- Leads ---

export type LeadUrgency = 'hot' | 'warm' | 'cold'
export type LeadStatus = 'new' | 'parsed' | 'sent' | 'claimed' | 'expired'

export interface Lead {
  id: string
  group_id: string
  wa_message_id: string | null
  content_hash: string | null
  raw_message: string
  profession: Profession | null
  zip_code: string | null
  city: string | null
  budget_range: string | null
  urgency: LeadUrgency
  parsed_summary: string | null
  status: LeadStatus
  sent_to_count: number
  created_at: string
}

export interface LeadWithGroup extends Lead {
  group: Group
}

// --- OpenAI Parsed Output ---

export interface ParsedLead {
  is_lead: boolean
  profession: Profession | 'other' | 'not_a_lead'
  zip_code: string | null
  city: string | null
  budget_min: number | null
  budget_max: number | null
  urgency: LeadUrgency
  summary: string
}

// --- Queue Job Types ---

export interface RawMessageJob {
  messageId: string
  groupId: string
  body: string
  sender: string | null
  timestamp: number
  accountId: string
}

export interface ParsedLeadJob {
  leadId: string
}

export interface NotificationJob {
  leadId: string
  contractorId: string
  telegramChatId: number
  message: string
}

export interface WaNotificationJob {
  leadId: string
  contractorId: string
  whatsappPhone: string
  contractorName: string
  message: string
}

// --- Telegram Bot ---

export interface TelegramLeadMessage {
  profession: string
  professionEmoji: string
  location: string
  budget: string
  urgency: string
  summary: string
  source: string
}

// --- Prospects CRM ---

export type ProspectStage = 'prospect' | 'reached_out' | 'in_conversation' | 'demo_trial' | 'paying' | 'churned'

export interface Prospect {
  id: string
  wa_id: string
  phone: string
  display_name: string | null
  profile_pic_url: string | null
  wa_sender_id: string | null
  profession_tags: string[]
  group_ids: string[]
  stage: ProspectStage
  assigned_wa_account_id: string | null
  notes: string
  last_contact_at: string | null
  next_followup_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  // from view
  group_names?: string[]
}

export type MessageDirection = 'outgoing' | 'incoming'
export type MessageType = 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'contact'

export interface ProspectMessage {
  id: string
  prospect_id: string
  wa_account_id: string | null
  direction: MessageDirection
  message_type: MessageType
  content: string
  media_url: string | null
  wa_message_id: string | null
  content_hash: string | null
  sent_at: string
  delivered_at: string | null
  read_at: string | null
  created_at: string
}

export type ProspectEventType =
  | 'stage_change' | 'note_added' | 'call_logged'
  | 'message_sent' | 'message_received' | 'payment'
  | 'imported' | 'profile_updated' | 'assigned'
  | 'archived' | 'restored'

export interface ProspectEvent {
  id: string
  prospect_id: string
  event_type: ProspectEventType
  old_value: string | null
  new_value: string | null
  detail: Record<string, unknown>
  changed_by: string | null
  created_at: string
}

// --- Admin Dashboard ---

export interface AdminKPIs {
  mrr: number
  activeContractors: number
  leadsToday: number
  leadsThisWeek: number
  leadsThisMonth: number
  activeGroups: number
  waSessionsHealthy: number
  waSessionsTotal: number
}

export interface ContractorRow {
  id: string
  name: string
  email: string
  plan: PlanSlug | null
  leadsReceived: number
  status: 'active' | 'inactive'
  joinedAt: string
}

export interface LeadRow {
  id: string
  summary: string
  group: string
  profession: Profession | null
  zip: string | null
  urgency: LeadUrgency
  status: LeadStatus
  sentTo: number
  createdAt: string
}
