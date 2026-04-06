# WhatsApp Army Dashboard - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an "Army" admin department to manage 20-50 WhatsApp slave accounts that automate job posts, engagement responses, and contractor promos in WhatsApp groups - all linking to MasterLead.

**Architecture:** New admin department with 4 tabs (Accounts, Assignments, Templates, Activity). Data stored in 4 new Supabase tables + extended `wa_accounts`. A Supabase edge function (`army-scheduler`) plans and executes daily message schedules via Green API `sendMessage`.

**Tech Stack:** React (lazy-loaded pages), Supabase (Postgres + Edge Functions), Green API (send/read), Tailwind CSS, Lucide icons. Follows existing `DepartmentLayout` pattern.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/097_army_tables.sql` | DB schema: army_assignments, army_templates, army_schedule, army_config + wa_accounts extensions |
| `apps/dashboard/src/pages/admin/army/ArmyAccounts.tsx` | Slave account list, QR connection, role assignment |
| `apps/dashboard/src/pages/admin/army/ArmyAssignments.tsx` | Group ↔ account assignment matrix |
| `apps/dashboard/src/pages/admin/army/ArmyTemplates.tsx` | Template CRUD (job_post, response, contractor_promo) |
| `apps/dashboard/src/pages/admin/army/ArmyActivity.tsx` | Live log, daily stats, master on/off |
| `apps/dashboard/src/hooks/useArmyData.ts` | Data fetching hooks for all army tables |
| `supabase/functions/army-scheduler/index.ts` | Cron-triggered scheduler: plans daily messages, sends via Green API |

### Modified Files
| File | Change |
|------|--------|
| `apps/dashboard/src/config/departmentConfig.ts` | Add "Army" department definition |
| `apps/dashboard/src/components/admin/DepartmentLayout.tsx` | Add lazy imports + TAB_COMPONENTS entries for army tabs |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/097_army_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ══════════════════════════════════════════════════
-- 097 — Army (WhatsApp slave management)
-- ══════════════════════════════════════════════════

-- Extend wa_accounts for army usage
ALTER TABLE wa_accounts
  ADD COLUMN IF NOT EXISTS is_army boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS army_role text CHECK (army_role IN ('publisher','responder','contractor')),
  ADD COLUMN IF NOT EXISTS army_alias text;

-- Army assignments: which account operates in which group
CREATE TABLE IF NOT EXISTS army_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_account_id uuid NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
  group_wa_id text NOT NULL,
  group_name text,
  role_in_group text NOT NULL CHECK (role_in_group IN ('publisher','responder','contractor')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wa_account_id, group_wa_id, role_in_group)
);

-- Army templates: message templates by category
CREATE TABLE IF NOT EXISTS army_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('job_post','response','contractor_promo')),
  name text NOT NULL,
  body text NOT NULL,
  placeholders jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Army schedule: planned + sent messages
CREATE TABLE IF NOT EXISTS army_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_wa_id text NOT NULL,
  wa_account_id uuid NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
  template_id uuid REFERENCES army_templates(id) ON DELETE SET NULL,
  message_type text NOT NULL CHECK (message_type IN ('job_post','response','contractor_promo')),
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  rendered_message text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Army config: key-value settings
CREATE TABLE IF NOT EXISTS army_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL
);

-- Seed default config
INSERT INTO army_config (key, value) VALUES
  ('enabled', 'true'),
  ('activity_window_start', '07:00'),
  ('activity_window_end', '21:00'),
  ('response_delay_min', '5'),
  ('response_delay_max', '30')
ON CONFLICT (key) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_army_assignments_group ON army_assignments(group_wa_id);
CREATE INDEX IF NOT EXISTS idx_army_assignments_account ON army_assignments(wa_account_id);
CREATE INDEX IF NOT EXISTS idx_army_schedule_status ON army_schedule(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_army_schedule_group_date ON army_schedule(group_wa_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_wa_accounts_army ON wa_accounts(is_army) WHERE is_army = true;

-- RLS (admin only — service_role bypasses, anon blocked)
ALTER TABLE army_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE army_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE army_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE army_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_army_assignments" ON army_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_army_templates" ON army_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_army_schedule" ON army_schedule FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_army_config" ON army_config FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

- [ ] **Step 2: Apply the migration**

Run against the Supabase project (use MCP apply_migration tool or `supabase db push`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/097_army_tables.sql
git commit -m "feat(army): add army tables migration (097)"
```

---

## Task 2: Data Hooks

**Files:**
- Create: `apps/dashboard/src/hooks/useArmyData.ts`

- [ ] **Step 1: Create the hooks file**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/* ─── Types ─── */

export interface ArmyAccount {
  id: string
  green_api_id: string
  green_api_token: string
  green_api_url: string
  phone_number: string | null
  status: string
  qr_code: string | null
  is_army: boolean
  army_role: 'publisher' | 'responder' | 'contractor' | null
  army_alias: string | null
  connected_since: string | null
}

export interface ArmyAssignment {
  id: string
  wa_account_id: string
  group_wa_id: string
  group_name: string | null
  role_in_group: 'publisher' | 'responder' | 'contractor'
  is_active: boolean
}

export interface ArmyTemplate {
  id: string
  category: 'job_post' | 'response' | 'contractor_promo'
  name: string
  body: string
  placeholders: string[]
  is_active: boolean
  created_at: string
}

export interface ArmyScheduleEntry {
  id: string
  group_wa_id: string
  wa_account_id: string
  template_id: string | null
  message_type: string
  scheduled_at: string
  sent_at: string | null
  status: 'pending' | 'sent' | 'failed'
  rendered_message: string | null
  error: string | null
  created_at: string
}

export interface ArmyConfig {
  enabled: boolean
  activity_window_start: string
  activity_window_end: string
  response_delay_min: number
  response_delay_max: number
}

/* ─── useArmyAccounts ─── */

export function useArmyAccounts() {
  const [accounts, setAccounts] = useState<ArmyAccount[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('wa_accounts')
      .select('*')
      .eq('is_army', true)
      .order('created_at', { ascending: true })
    setAccounts((data as ArmyAccount[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { accounts, loading, refetch: fetch }
}

/* ─── useArmyAssignments ─── */

export function useArmyAssignments() {
  const [assignments, setAssignments] = useState<ArmyAssignment[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('army_assignments')
      .select('*')
      .order('group_name', { ascending: true })
    setAssignments((data as ArmyAssignment[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { assignments, loading, refetch: fetch }
}

/* ─── useArmyTemplates ─── */

export function useArmyTemplates(category?: string) {
  const [templates, setTemplates] = useState<ArmyTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('army_templates').select('*').order('created_at', { ascending: false })
    if (category) q = q.eq('category', category)
    const { data } = await q
    setTemplates((data as ArmyTemplate[]) ?? [])
    setLoading(false)
  }, [category])

  useEffect(() => { fetch() }, [fetch])

  return { templates, loading, refetch: fetch }
}

/* ─── useArmyActivity ─── */

export function useArmyActivity(limit = 50) {
  const [entries, setEntries] = useState<ArmyScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('army_schedule')
      .select('*')
      .order('scheduled_at', { ascending: false })
      .limit(limit)
    setEntries((data as ArmyScheduleEntry[]) ?? [])
    setLoading(false)
  }, [limit])

  useEffect(() => { fetch() }, [fetch])

  return { entries, loading, refetch: fetch }
}

/* ─── useArmyConfig ─── */

export function useArmyConfig() {
  const [config, setConfig] = useState<ArmyConfig>({
    enabled: true,
    activity_window_start: '07:00',
    activity_window_end: '21:00',
    response_delay_min: 5,
    response_delay_max: 30,
  })
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('army_config').select('key, value')
    if (data) {
      const map = Object.fromEntries(data.map(r => [r.key, r.value]))
      setConfig({
        enabled: map.enabled !== 'false',
        activity_window_start: map.activity_window_start ?? '07:00',
        activity_window_end: map.activity_window_end ?? '21:00',
        response_delay_min: parseInt(map.response_delay_min ?? '5', 10),
        response_delay_max: parseInt(map.response_delay_max ?? '30', 10),
      })
    }
    setLoading(false)
  }, [])

  const update = useCallback(async (key: string, value: string) => {
    await supabase.from('army_config').upsert({ key, value }, { onConflict: 'key' })
    await fetch()
  }, [fetch])

  useEffect(() => { fetch() }, [fetch])

  return { config, loading, update, refetch: fetch }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/hooks/useArmyData.ts
git commit -m "feat(army): add data hooks for army tables"
```

---

## Task 3: Department Config + Routing

**Files:**
- Modify: `apps/dashboard/src/config/departmentConfig.ts`
- Modify: `apps/dashboard/src/components/admin/DepartmentLayout.tsx`

- [ ] **Step 1: Add Army department to departmentConfig.ts**

Add import at top of file:
```typescript
import {
  HardHat,
  Radio,
  Settings,
  Handshake,
  Bot,
  DollarSign,
  TrendingUp,
  Swords,
  type LucideIcon,
} from 'lucide-react'
```

Add the army department to the `departments` array, before `settings`:

```typescript
  {
    id: 'army',
    nameEn: 'Army',
    nameHe: 'צבא',
    color: '#DC2626',
    icon: Swords,
    basePath: 'army',
    tabs: [
      { key: 'accounts', labelEn: 'Accounts', labelHe: 'חשבונות', path: '' },
      { key: 'assignments', labelEn: 'Assignments', labelHe: 'הקצאות', path: 'assignments' },
      { key: 'templates', labelEn: 'Templates', labelHe: 'תבניות', path: 'templates' },
      { key: 'activity', labelEn: 'Activity', labelHe: 'פעילות', path: 'activity' },
    ],
    kpis: [
      { key: 'armyAccounts', labelEn: 'Accounts', labelHe: 'חשבונות' },
      { key: 'armyGroups', labelEn: 'Groups Covered', labelHe: 'קבוצות מכוסות' },
      { key: 'messagesToday', labelEn: 'Sent Today', labelHe: 'נשלחו היום' },
    ],
  },
```

- [ ] **Step 2: Add lazy imports and TAB_COMPONENTS in DepartmentLayout.tsx**

Add at top with other lazy imports:

```typescript
// Army
const ArmyAccounts = lazy(() => import('../../pages/admin/army/ArmyAccounts'))
const ArmyAssignments = lazy(() => import('../../pages/admin/army/ArmyAssignments'))
const ArmyTemplates = lazy(() => import('../../pages/admin/army/ArmyTemplates'))
const ArmyActivity = lazy(() => import('../../pages/admin/army/ArmyActivity'))
```

Add to `TAB_COMPONENTS`:

```typescript
  // Army
  'army/accounts': ArmyAccounts,
  'army/assignments': ArmyAssignments,
  'army/templates': ArmyTemplates,
  'army/activity': ArmyActivity,
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/config/departmentConfig.ts apps/dashboard/src/components/admin/DepartmentLayout.tsx
git commit -m "feat(army): add Army department config and routing"
```

---

## Task 4: ArmyAccounts Page

**Files:**
- Create: `apps/dashboard/src/pages/admin/army/ArmyAccounts.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { useState } from 'react'
import { useI18n } from '../../../lib/i18n'
import { supabase } from '../../../lib/supabase'
import { useArmyAccounts, type ArmyAccount } from '../../../hooks/useArmyData'
import {
  Plus, Loader2, Wifi, WifiOff, QrCode, Trash2, X,
  Megaphone, MessageCircleReply, HardHat,
} from 'lucide-react'

const ROLE_META: Record<string, { label: string; labelHe: string; color: string; icon: typeof Megaphone }> = {
  publisher: { label: 'Publisher', labelHe: 'מפרסם', color: '#2563eb', icon: Megaphone },
  responder: { label: 'Responder', labelHe: 'מגיב', color: '#f59e0b', icon: MessageCircleReply },
  contractor: { label: 'Contractor', labelHe: 'קבלן', color: '#10b981', icon: HardHat },
}

export default function ArmyAccounts() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { accounts, loading, refetch } = useArmyAccounts()

  const [addOpen, setAddOpen] = useState(false)
  const [formId, setFormId] = useState('')
  const [formToken, setFormToken] = useState('')
  const [formUrl, setFormUrl] = useState('https://api.green-api.com')
  const [formAlias, setFormAlias] = useState('')
  const [formRole, setFormRole] = useState<'publisher' | 'responder' | 'contractor'>('publisher')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!formId || !formToken) return
    setSaving(true)
    await supabase.from('wa_accounts').insert({
      green_api_id: formId,
      green_api_token: formToken,
      green_api_url: formUrl,
      is_army: true,
      army_role: formRole,
      army_alias: formAlias || `Slave-${accounts.length + 1}`,
      status: 'disconnected',
    })
    setSaving(false)
    setAddOpen(false)
    setFormId(''); setFormToken(''); setFormAlias('')
    refetch()
  }

  async function handleDelete(id: string) {
    if (!confirm(he ? 'למחוק חשבון?' : 'Delete account?')) return
    await supabase.from('wa_accounts').delete().eq('id', id)
    refetch()
  }

  async function handleRoleChange(id: string, role: string) {
    await supabase.from('wa_accounts').update({ army_role: role }).eq('id', id)
    refetch()
  }

  async function fetchQr(account: ArmyAccount) {
    try {
      const url = `${account.green_api_url}/waInstance${account.green_api_id}/qr/${account.green_api_token}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.type === 'qrCode' && data.message) {
        await supabase.from('wa_accounts').update({ qr_code: data.message, status: 'waiting_qr' }).eq('id', account.id)
        refetch()
      }
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0b0707]">
            {he ? 'חשבונות צבא' : 'Army Accounts'}
          </h1>
          <p className="text-xs text-[#3b3b3b]/50 mt-0.5">
            {he ? `${accounts.length} חשבונות מחוברים` : `${accounts.length} accounts connected`}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          {he ? 'הוסף Slave' : 'Add Slave'}
        </button>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          const role = ROLE_META[acc.army_role ?? 'publisher']
          const connected = acc.status === 'connected'
          return (
            <div
              key={acc.id}
              className="rounded-2xl border p-4 space-y-3 transition-all hover:shadow-md"
              style={{
                background: '#fff',
                borderColor: connected ? `${role.color}30` : '#efeff1',
              }}
            >
              {/* Top row: alias + status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {connected ? (
                    <Wifi className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span className="text-sm font-bold text-[#0b0707]">
                    {acc.army_alias || acc.phone_number || acc.green_api_id}
                  </span>
                </div>
                <button onClick={() => handleDelete(acc.id)} className="p-1 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Phone */}
              {acc.phone_number && (
                <p className="text-[11px] text-[#3b3b3b]/50 font-mono">{acc.phone_number}</p>
              )}

              {/* Role selector */}
              <div className="flex gap-1">
                {Object.entries(ROLE_META).map(([key, meta]) => {
                  const Icon = meta.icon
                  const active = acc.army_role === key
                  return (
                    <button
                      key={key}
                      onClick={() => handleRoleChange(acc.id, key)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                      style={{
                        background: active ? `${meta.color}15` : 'transparent',
                        color: active ? meta.color : '#3b3b3b60',
                        border: `1px solid ${active ? `${meta.color}30` : 'transparent'}`,
                      }}
                    >
                      <Icon className="w-3 h-3" />
                      {he ? meta.labelHe : meta.label}
                    </button>
                  )
                })}
              </div>

              {/* QR Code area */}
              {!connected && (
                <div className="flex flex-col items-center gap-2 py-2">
                  {acc.qr_code ? (
                    <img
                      src={`data:image/png;base64,${acc.qr_code}`}
                      alt="QR"
                      width={140}
                      height={140}
                      className="rounded-xl"
                    />
                  ) : (
                    <button
                      onClick={() => fetchQr(acc)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-all"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      {he ? 'סרוק QR' : 'Get QR Code'}
                    </button>
                  )}
                  <span className="text-[10px] text-[#3b3b3b]/40">
                    {acc.status === 'waiting_qr'
                      ? (he ? 'ממתין לסריקה...' : 'Waiting for scan...')
                      : (he ? 'לא מחובר' : 'Disconnected')}
                  </span>
                </div>
              )}

              {/* Connected since */}
              {connected && acc.connected_since && (
                <p className="text-[10px] text-green-600/60">
                  {he ? 'מחובר מאז' : 'Connected since'}{' '}
                  {new Date(acc.connected_since).toLocaleDateString()}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">{he ? 'הוסף חשבון חדש' : 'Add New Slave'}</h2>
              <button onClick={() => setAddOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  {he ? 'כינוי' : 'Alias'}
                </label>
                <input
                  value={formAlias}
                  onChange={(e) => setFormAlias(e.target.value)}
                  placeholder="e.g. Slave-Miami-01"
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm focus:outline-none focus:border-red-300"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  Green API Instance ID *
                </label>
                <input
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  placeholder="1101234567"
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm font-mono focus:outline-none focus:border-red-300"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  Green API Token *
                </label>
                <input
                  value={formToken}
                  onChange={(e) => setFormToken(e.target.value)}
                  placeholder="abc123..."
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm font-mono focus:outline-none focus:border-red-300"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  {he ? 'תפקיד' : 'Role'}
                </label>
                <div className="flex gap-2">
                  {Object.entries(ROLE_META).map(([key, meta]) => {
                    const Icon = meta.icon
                    const active = formRole === key
                    return (
                      <button
                        key={key}
                        onClick={() => setFormRole(key as typeof formRole)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-[11px] font-semibold transition-all"
                        style={{
                          background: active ? `${meta.color}15` : '#f9f9f9',
                          color: active ? meta.color : '#3b3b3b80',
                          border: `1px solid ${active ? `${meta.color}30` : '#efeff1'}`,
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {he ? meta.labelHe : meta.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={saving || !formId || !formToken}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (he ? 'הוסף' : 'Add Account')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p apps/dashboard/src/pages/admin/army
git add apps/dashboard/src/pages/admin/army/ArmyAccounts.tsx
git commit -m "feat(army): add ArmyAccounts page with QR connection"
```

---

## Task 5: ArmyAssignments Page

**Files:**
- Create: `apps/dashboard/src/pages/admin/army/ArmyAssignments.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { useState, useMemo } from 'react'
import { useI18n } from '../../../lib/i18n'
import { supabase } from '../../../lib/supabase'
import {
  useArmyAccounts,
  useArmyAssignments,
  type ArmyAccount,
  type ArmyAssignment,
} from '../../../hooks/useArmyData'
import {
  Loader2, Plus, X, Users, Megaphone, MessageCircleReply, HardHat, Trash2,
} from 'lucide-react'

const ROLE_ICONS: Record<string, typeof Megaphone> = {
  publisher: Megaphone,
  responder: MessageCircleReply,
  contractor: HardHat,
}
const ROLE_COLORS: Record<string, string> = {
  publisher: '#2563eb',
  responder: '#f59e0b',
  contractor: '#10b981',
}

export default function ArmyAssignments() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { accounts, loading: accLoading } = useArmyAccounts()
  const { assignments, loading: assLoading, refetch } = useArmyAssignments()

  const [addOpen, setAddOpen] = useState(false)
  const [formGroupId, setFormGroupId] = useState('')
  const [formGroupName, setFormGroupName] = useState('')
  const [formAccountId, setFormAccountId] = useState('')
  const [formRole, setFormRole] = useState<'publisher' | 'responder' | 'contractor'>('publisher')
  const [saving, setSaving] = useState(false)

  // Group assignments by group
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: ArmyAssignment[] }>()
    for (const a of assignments) {
      if (!map.has(a.group_wa_id)) map.set(a.group_wa_id, { name: a.group_name ?? a.group_wa_id, items: [] })
      map.get(a.group_wa_id)!.items.push(a)
    }
    return [...map.entries()]
  }, [assignments])

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])

  async function handleAdd() {
    if (!formGroupId || !formAccountId) return
    setSaving(true)
    await supabase.from('army_assignments').upsert({
      wa_account_id: formAccountId,
      group_wa_id: formGroupId,
      group_name: formGroupName || formGroupId,
      role_in_group: formRole,
      is_active: true,
    }, { onConflict: 'wa_account_id,group_wa_id,role_in_group' })
    setSaving(false)
    setAddOpen(false)
    setFormGroupId(''); setFormGroupName('')
    refetch()
  }

  async function handleRemove(id: string) {
    await supabase.from('army_assignments').delete().eq('id', id)
    refetch()
  }

  if (accLoading || assLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0b0707]">
            {he ? 'הקצאות לקבוצות' : 'Group Assignments'}
          </h1>
          <p className="text-xs text-[#3b3b3b]/50 mt-0.5">
            {he ? `${grouped.length} קבוצות מכוסות` : `${grouped.length} groups covered`}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          {he ? 'הוסף הקצאה' : 'Add Assignment'}
        </button>
      </div>

      {/* Groups list */}
      <div className="space-y-4">
        {grouped.map(([groupId, { name, items }]) => (
          <div key={groupId} className="rounded-2xl border border-[#efeff1] bg-white p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#3b3b3b]/40" />
              <span className="text-sm font-bold text-[#0b0707]">{name}</span>
              <span className="text-[10px] text-[#3b3b3b]/30 font-mono">{groupId}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {items.map((item) => {
                const acc = accountMap.get(item.wa_account_id)
                const Icon = ROLE_ICONS[item.role_in_group] ?? Megaphone
                const color = ROLE_COLORS[item.role_in_group] ?? '#666'
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold"
                    style={{
                      background: `${color}10`,
                      color,
                      border: `1px solid ${color}25`,
                    }}
                  >
                    <Icon className="w-3 h-3" />
                    {acc?.army_alias ?? acc?.phone_number ?? 'Unknown'}
                    <button onClick={() => handleRemove(item.id)} className="ml-1 opacity-40 hover:opacity-100">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {grouped.length === 0 && (
          <div className="text-center py-12 text-sm text-[#3b3b3b]/30">
            {he ? 'אין הקצאות עדיין' : 'No assignments yet'}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">{he ? 'הקצאה חדשה' : 'New Assignment'}</h2>
              <button onClick={() => setAddOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  {he ? 'מזהה קבוצה (Group JID)' : 'Group WhatsApp ID'}
                </label>
                <input
                  value={formGroupId}
                  onChange={(e) => setFormGroupId(e.target.value)}
                  placeholder="120363012345@g.us"
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm font-mono focus:outline-none focus:border-red-300"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  {he ? 'שם קבוצה' : 'Group Name'}
                </label>
                <input
                  value={formGroupName}
                  onChange={(e) => setFormGroupName(e.target.value)}
                  placeholder="Miami Renovations"
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm focus:outline-none focus:border-red-300"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  {he ? 'חשבון' : 'Account'}
                </label>
                <select
                  value={formAccountId}
                  onChange={(e) => setFormAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm focus:outline-none focus:border-red-300"
                >
                  <option value="">{he ? 'בחר חשבון...' : 'Select account...'}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.army_alias ?? a.phone_number ?? a.green_api_id} ({a.army_role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  {he ? 'תפקיד בקבוצה' : 'Role in Group'}
                </label>
                <div className="flex gap-2">
                  {(['publisher', 'responder', 'contractor'] as const).map((r) => {
                    const Icon = ROLE_ICONS[r]
                    const color = ROLE_COLORS[r]
                    const active = formRole === r
                    return (
                      <button
                        key={r}
                        onClick={() => setFormRole(r)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-[11px] font-semibold transition-all"
                        style={{
                          background: active ? `${color}15` : '#f9f9f9',
                          color: active ? color : '#3b3b3b80',
                          border: `1px solid ${active ? `${color}30` : '#efeff1'}`,
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {r}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={saving || !formGroupId || !formAccountId}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (he ? 'הוסף' : 'Add Assignment')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/pages/admin/army/ArmyAssignments.tsx
git commit -m "feat(army): add ArmyAssignments page"
```

---

## Task 6: ArmyTemplates Page

**Files:**
- Create: `apps/dashboard/src/pages/admin/army/ArmyTemplates.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { useState } from 'react'
import { useI18n } from '../../../lib/i18n'
import { supabase } from '../../../lib/supabase'
import { useArmyTemplates, type ArmyTemplate } from '../../../hooks/useArmyData'
import {
  Plus, Loader2, Trash2, X, Eye, Megaphone, MessageCircleReply, HardHat, Pencil,
} from 'lucide-react'

const CATEGORIES = [
  { key: 'job_post', label: 'Job Posts', labelHe: 'פרסומי עבודה', color: '#2563eb', icon: Megaphone },
  { key: 'response', label: 'Responses', labelHe: 'תגובות', color: '#f59e0b', icon: MessageCircleReply },
  { key: 'contractor_promo', label: 'Contractor Promos', labelHe: 'פרסומי קבלנים', color: '#10b981', icon: HardHat },
] as const

const PLACEHOLDER_HINTS: Record<string, string[]> = {
  job_post: ['{profession}', '{city}', '{state}', '{price_range}', '{job_link}'],
  response: [],
  contractor_promo: ['{name}', '{experience_years}', '{rating}', '{completed_jobs}', '{city}', '{profile_link}'],
}

export default function ArmyTemplates() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [activeCategory, setActiveCategory] = useState<string>('job_post')
  const { templates, loading, refetch } = useArmyTemplates(activeCategory)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formBody, setFormBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  function openEditor(tpl?: ArmyTemplate) {
    if (tpl) {
      setEditingId(tpl.id)
      setFormName(tpl.name)
      setFormBody(tpl.body)
    } else {
      setEditingId(null)
      setFormName('')
      setFormBody('')
    }
    setPreviewMode(false)
    setEditorOpen(true)
  }

  async function handleSave() {
    if (!formName || !formBody) return
    setSaving(true)
    const placeholders = (formBody.match(/\{[^}]+\}/g) ?? [])
    const row = {
      category: activeCategory,
      name: formName,
      body: formBody,
      placeholders,
      is_active: true,
    }
    if (editingId) {
      await supabase.from('army_templates').update(row).eq('id', editingId)
    } else {
      await supabase.from('army_templates').insert(row)
    }
    setSaving(false)
    setEditorOpen(false)
    refetch()
  }

  async function handleDelete(id: string) {
    if (!confirm(he ? 'למחוק תבנית?' : 'Delete template?')) return
    await supabase.from('army_templates').delete().eq('id', id)
    refetch()
  }

  async function handleToggle(id: string, current: boolean) {
    await supabase.from('army_templates').update({ is_active: !current }).eq('id', id)
    refetch()
  }

  const activeCat = CATEGORIES.find(c => c.key === activeCategory)!

  function renderPreview(body: string) {
    const examples: Record<string, string> = {
      '{profession}': 'Plumber', '{city}': 'Miami', '{state}': 'FL',
      '{price_range}': '$2,500 - $4,000', '{job_link}': 'masterlead.app/jobs/abc123',
      '{name}': 'Mike Johnson', '{experience_years}': '12', '{rating}': '4.9',
      '{completed_jobs}': '47', '{profile_link}': 'masterlead.app/pro/mike-johnson',
    }
    let result = body
    for (const [k, v] of Object.entries(examples)) result = result.replaceAll(k, v)
    return result
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Category tabs */}
      <div className="flex items-center gap-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const active = activeCategory === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: active ? `${cat.color}12` : 'transparent',
                color: active ? cat.color : '#3b3b3b60',
                border: `1px solid ${active ? `${cat.color}25` : 'transparent'}`,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {he ? cat.labelHe : cat.label}
            </button>
          )
        })}

        <div className="flex-1" />

        <button
          onClick={() => openEditor()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all"
          style={{ background: activeCat.color }}
        >
          <Plus className="w-3.5 h-3.5" />
          {he ? 'תבנית חדשה' : 'New Template'}
        </button>
      </div>

      {/* Placeholder hints */}
      {PLACEHOLDER_HINTS[activeCategory]?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-[#3b3b3b]/40 self-center">Placeholders:</span>
          {PLACEHOLDER_HINTS[activeCategory].map((p) => (
            <span key={p} className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#f5f2ed] text-[#3b3b3b]/60">
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Templates list */}
      <div className="space-y-3">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="rounded-2xl border border-[#efeff1] bg-white p-4 space-y-2"
            style={{ opacity: tpl.is_active ? 1 : 0.5 }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#0b0707]">{tpl.name}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => openEditor(tpl)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-all">
                  <Pencil className="w-3.5 h-3.5 text-[#3b3b3b]/40" />
                </button>
                <button onClick={() => handleToggle(tpl.id, tpl.is_active)} className="px-2 py-1 rounded-lg text-[10px] font-semibold hover:bg-gray-100 transition-all" style={{ color: tpl.is_active ? '#10b981' : '#ef4444' }}>
                  {tpl.is_active ? 'ON' : 'OFF'}
                </button>
                <button onClick={() => handleDelete(tpl.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <pre className="text-[12px] text-[#3b3b3b]/70 whitespace-pre-wrap font-sans leading-relaxed">
              {tpl.body}
            </pre>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="text-center py-12 text-sm text-[#3b3b3b]/30">
            {he ? 'אין תבניות עדיין' : 'No templates yet'}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">
                {editingId ? (he ? 'ערוך תבנית' : 'Edit Template') : (he ? 'תבנית חדשה' : 'New Template')}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold hover:bg-gray-100 transition-all"
                  style={{ color: previewMode ? activeCat.color : '#3b3b3b80' }}
                >
                  <Eye className="w-3 h-3" />
                  Preview
                </button>
                <button onClick={() => setEditorOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={he ? 'שם התבנית' : 'Template name'}
                className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm focus:outline-none focus:border-red-300"
              />

              {previewMode ? (
                <div className="rounded-xl bg-[#dcf8c6] p-3 text-sm whitespace-pre-wrap min-h-[120px]">
                  {renderPreview(formBody)}
                </div>
              ) : (
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  rows={6}
                  placeholder={he ? 'תוכן ההודעה...' : 'Message body...'}
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm font-mono focus:outline-none focus:border-red-300 resize-none"
                />
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !formName || !formBody}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (he ? 'שמור' : 'Save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/pages/admin/army/ArmyTemplates.tsx
git commit -m "feat(army): add ArmyTemplates page with preview"
```

---

## Task 7: ArmyActivity Page

**Files:**
- Create: `apps/dashboard/src/pages/admin/army/ArmyActivity.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { useMemo } from 'react'
import { useI18n } from '../../../lib/i18n'
import { useArmyActivity, useArmyConfig } from '../../../hooks/useArmyData'
import {
  Loader2, Power, PowerOff, CheckCircle2, XCircle, Clock,
  Megaphone, MessageCircleReply, HardHat, Activity, Send,
} from 'lucide-react'

const TYPE_META: Record<string, { icon: typeof Megaphone; color: string; label: string; labelHe: string }> = {
  job_post: { icon: Megaphone, color: '#2563eb', label: 'Job Post', labelHe: 'פרסום עבודה' },
  response: { icon: MessageCircleReply, color: '#f59e0b', label: 'Response', labelHe: 'תגובה' },
  contractor_promo: { icon: HardHat, color: '#10b981', label: 'Contractor Promo', labelHe: 'פרסום קבלן' },
}

const STATUS_META: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  sent: { icon: CheckCircle2, color: '#10b981' },
  failed: { icon: XCircle, color: '#ef4444' },
  pending: { icon: Clock, color: '#f59e0b' },
}

export default function ArmyActivity() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { entries, loading } = useArmyActivity(100)
  const { config, loading: configLoading, update } = useArmyConfig()

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const todayEntries = entries.filter(e => e.scheduled_at.startsWith(today))
    return {
      total: todayEntries.length,
      sent: todayEntries.filter(e => e.status === 'sent').length,
      failed: todayEntries.filter(e => e.status === 'failed').length,
      pending: todayEntries.filter(e => e.status === 'pending').length,
    }
  }, [entries])

  if (loading || configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Master Toggle + Stats */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => update('enabled', config.enabled ? 'false' : 'true')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all"
          style={{
            background: config.enabled ? '#10b98115' : '#ef444415',
            color: config.enabled ? '#10b981' : '#ef4444',
            border: `1px solid ${config.enabled ? '#10b98130' : '#ef444430'}`,
          }}
        >
          {config.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
          {config.enabled ? (he ? 'פעיל' : 'ACTIVE') : (he ? 'מושבת' : 'DISABLED')}
        </button>

        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f5f2ed]">
            <Send className="w-3 h-3 text-[#3b3b3b]/40" />
            <span className="font-bold text-[#0b0707]">{stats.sent}</span>
            <span className="text-[#3b3b3b]/40">{he ? 'נשלחו' : 'sent'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f5f2ed]">
            <Clock className="w-3 h-3 text-amber-500/60" />
            <span className="font-bold text-[#0b0707]">{stats.pending}</span>
            <span className="text-[#3b3b3b]/40">{he ? 'ממתינות' : 'pending'}</span>
          </div>
          {stats.failed > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50">
              <XCircle className="w-3 h-3 text-red-400" />
              <span className="font-bold text-red-600">{stats.failed}</span>
              <span className="text-red-400">{he ? 'נכשלו' : 'failed'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Activity window config */}
      <div className="flex items-center gap-3 text-xs text-[#3b3b3b]/50">
        <Activity className="w-3.5 h-3.5" />
        <span>{he ? 'חלון פעילות:' : 'Activity window:'}</span>
        <span className="font-mono font-bold text-[#0b0707]">
          {config.activity_window_start} – {config.activity_window_end}
        </span>
        <span>|</span>
        <span>{he ? 'דיליי תגובה:' : 'Response delay:'}</span>
        <span className="font-mono font-bold text-[#0b0707]">
          {config.response_delay_min}-{config.response_delay_max} min
        </span>
      </div>

      {/* Log */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-[#3b3b3b]/40 uppercase tracking-wider">
          {he ? 'לוג פעילות' : 'Activity Log'}
        </h2>

        <div className="space-y-1.5">
          {entries.map((entry) => {
            const type = TYPE_META[entry.message_type] ?? TYPE_META.job_post
            const status = STATUS_META[entry.status] ?? STATUS_META.pending
            const TypeIcon = type.icon
            const StatusIcon = status.icon
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-3 py-2 rounded-xl border border-[#efeff1] bg-white text-[11px]"
              >
                <StatusIcon className="w-3.5 h-3.5 shrink-0" style={{ color: status.color }} />
                <TypeIcon className="w-3.5 h-3.5 shrink-0" style={{ color: type.color }} />
                <span className="font-semibold text-[#0b0707] shrink-0">
                  {he ? type.labelHe : type.label}
                </span>
                <span className="text-[#3b3b3b]/40 truncate flex-1">
                  {entry.rendered_message?.slice(0, 60) ?? '...'}
                </span>
                <span className="text-[#3b3b3b]/30 font-mono shrink-0">
                  {new Date(entry.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {entry.error && (
                  <span className="text-red-400 truncate max-w-[120px]" title={entry.error}>
                    {entry.error}
                  </span>
                )}
              </div>
            )
          })}

          {entries.length === 0 && (
            <div className="text-center py-12 text-sm text-[#3b3b3b]/30">
              {he ? 'אין פעילות עדיין' : 'No activity yet'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/pages/admin/army/ArmyActivity.tsx
git commit -m "feat(army): add ArmyActivity page with stats and log"
```

---

## Task 8: Army Scheduler Edge Function

**Files:**
- Create: `supabase/functions/army-scheduler/index.ts`

- [ ] **Step 1: Create the edge function**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

interface Assignment {
  id: string
  wa_account_id: string
  group_wa_id: string
  group_name: string | null
  role_in_group: string
}

interface Template {
  id: string
  body: string
  placeholders: string[]
}

interface WaAccount {
  id: string
  green_api_id: string
  green_api_token: string
  green_api_url: string
}

Deno.serve(async (_req: Request) => {
  try {
    // 1. Check if enabled
    const { data: configRows } = await supabase.from("army_config").select("key, value")
    const config = Object.fromEntries((configRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))

    if (config.enabled === "false") {
      return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    // 2. Check activity window
    const now = new Date()
    const currentHHMM = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`
    const windowStart = config.activity_window_start ?? "07:00"
    const windowEnd = config.activity_window_end ?? "21:00"

    if (currentHHMM < windowStart || currentHHMM > windowEnd) {
      return new Response(JSON.stringify({ ok: true, skipped: "outside_window" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    // 3. Get active assignments
    const { data: assignments } = await supabase
      .from("army_assignments")
      .select("*")
      .eq("is_active", true)

    if (!assignments?.length) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_assignments" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    // 4. Get today's already-scheduled entries to avoid duplicates
    const todayStart = new Date(now)
    todayStart.setUTCHours(0, 0, 0, 0)
    const { data: todaySchedule } = await supabase
      .from("army_schedule")
      .select("group_wa_id, wa_account_id, message_type")
      .gte("scheduled_at", todayStart.toISOString())

    const alreadySent = new Set(
      (todaySchedule ?? []).map((s: { group_wa_id: string; wa_account_id: string; message_type: string }) =>
        `${s.group_wa_id}::${s.wa_account_id}::${s.message_type}`
      )
    )

    // 5. Get templates by category
    const { data: allTemplates } = await supabase
      .from("army_templates")
      .select("*")
      .eq("is_active", true)

    const templatesByCategory: Record<string, Template[]> = {}
    for (const t of allTemplates ?? []) {
      const cat = (t as { category: string }).category
      if (!templatesByCategory[cat]) templatesByCategory[cat] = []
      templatesByCategory[cat].push(t as Template)
    }

    // 6. Get wa_accounts for sending
    const accountIds = [...new Set(assignments.map((a: Assignment) => a.wa_account_id))]
    const { data: accountRows } = await supabase
      .from("wa_accounts")
      .select("id, green_api_id, green_api_token, green_api_url")
      .in("id", accountIds)
      .eq("status", "connected")

    const accountMap = new Map((accountRows ?? []).map((a: WaAccount) => [a.id, a]))

    // 7. Group assignments by group
    const byGroup = new Map<string, Assignment[]>()
    for (const a of assignments as Assignment[]) {
      if (!byGroup.has(a.group_wa_id)) byGroup.set(a.group_wa_id, [])
      byGroup.get(a.group_wa_id)!.push(a)
    }

    const delayMin = parseInt(config.response_delay_min ?? "5", 10)
    const delayMax = parseInt(config.response_delay_max ?? "30", 10)
    let sentCount = 0
    let errorCount = 0

    // 8. Process each group
    for (const [groupId, groupAssignments] of byGroup) {
      const publishers = groupAssignments.filter(a => a.role_in_group === "publisher")
      const responders = groupAssignments.filter(a => a.role_in_group === "responder")
      const contractors = groupAssignments.filter(a => a.role_in_group === "contractor")

      // Send job post
      for (const pub of publishers) {
        const key = `${groupId}::${pub.wa_account_id}::job_post`
        if (alreadySent.has(key)) continue

        const templates = templatesByCategory["job_post"] ?? []
        if (!templates.length) continue
        const tpl = templates[Math.floor(Math.random() * templates.length)]
        const account = accountMap.get(pub.wa_account_id)
        if (!account) continue

        const message = fillPlaceholders(tpl.body)
        const result = await sendMessage(account, groupId, message)

        await supabase.from("army_schedule").insert({
          group_wa_id: groupId,
          wa_account_id: pub.wa_account_id,
          template_id: tpl.id,
          message_type: "job_post",
          scheduled_at: now.toISOString(),
          sent_at: result.ok ? now.toISOString() : null,
          status: result.ok ? "sent" : "failed",
          rendered_message: message,
          error: result.error ?? null,
        })

        if (result.ok) sentCount++
        else errorCount++
        alreadySent.add(key)
      }

      // Send responses (with delay simulated by scheduling later — for now send immediately)
      for (const resp of responders) {
        const key = `${groupId}::${resp.wa_account_id}::response`
        if (alreadySent.has(key)) continue

        const templates = templatesByCategory["response"] ?? []
        if (!templates.length) continue
        const tpl = templates[Math.floor(Math.random() * templates.length)]
        const account = accountMap.get(resp.wa_account_id)
        if (!account) continue

        // Random delay (5-30 min) before responding
        const delayMs = (delayMin + Math.random() * (delayMax - delayMin)) * 60 * 1000
        await sleep(Math.min(delayMs, 5000)) // cap at 5s in edge function context

        const message = tpl.body // responses don't have placeholders
        const result = await sendMessage(account, groupId, message)

        await supabase.from("army_schedule").insert({
          group_wa_id: groupId,
          wa_account_id: resp.wa_account_id,
          template_id: tpl.id,
          message_type: "response",
          scheduled_at: now.toISOString(),
          sent_at: result.ok ? now.toISOString() : null,
          status: result.ok ? "sent" : "failed",
          rendered_message: message,
          error: result.error ?? null,
        })

        if (result.ok) sentCount++
        else errorCount++
        alreadySent.add(key)
      }

      // Send contractor promos
      for (const con of contractors) {
        const key = `${groupId}::${con.wa_account_id}::contractor_promo`
        if (alreadySent.has(key)) continue

        const templates = templatesByCategory["contractor_promo"] ?? []
        if (!templates.length) continue
        const tpl = templates[Math.floor(Math.random() * templates.length)]
        const account = accountMap.get(con.wa_account_id)
        if (!account) continue

        const message = fillPlaceholders(tpl.body)
        const result = await sendMessage(account, groupId, message)

        await supabase.from("army_schedule").insert({
          group_wa_id: groupId,
          wa_account_id: con.wa_account_id,
          template_id: tpl.id,
          message_type: "contractor_promo",
          scheduled_at: now.toISOString(),
          sent_at: result.ok ? now.toISOString() : null,
          status: result.ok ? "sent" : "failed",
          rendered_message: message,
          error: result.error ?? null,
        })

        if (result.ok) sentCount++
        else errorCount++
        alreadySent.add(key)
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent: sentCount, errors: errorCount }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

/* ─── Helpers ─── */

function fillPlaceholders(body: string): string {
  // Basic placeholder fill with sample data — in production, pull from real jobs/contractors
  const replacements: Record<string, string[]> = {
    "{profession}": ["Plumber", "Electrician", "HVAC Tech", "Painter", "Roofer", "General Contractor"],
    "{city}": ["Miami", "Fort Lauderdale", "Orlando", "Tampa", "Jacksonville"],
    "{state}": ["FL"],
    "{price_range}": ["$1,500 - $3,000", "$2,000 - $5,000", "$3,000 - $7,000", "$500 - $1,500"],
    "{job_link}": ["masterlead.app/jobs"],
    "{name}": ["Mike R.", "David S.", "Carlos M.", "James T.", "Robert H."],
    "{experience_years}": ["5", "8", "12", "15", "20"],
    "{rating}": ["4.7", "4.8", "4.9", "5.0"],
    "{completed_jobs}": ["23", "35", "47", "62", "89"],
    "{profile_link}": ["masterlead.app/pro"],
  }

  let result = body
  for (const [key, options] of Object.entries(replacements)) {
    result = result.replaceAll(key, options[Math.floor(Math.random() * options.length)])
  }
  return result
}

async function sendMessage(
  account: WaAccount,
  groupId: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `${account.green_api_url}/waInstance${account.green_api_id}/sendMessage/${account.green_api_token}`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: groupId.includes("@") ? groupId : `${groupId}@g.us`,
        message,
      }),
    })
    const data = await res.json()
    if (data.idMessage) return { ok: true }
    return { ok: false, error: JSON.stringify(data) }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/army-scheduler/index.ts
git commit -m "feat(army): add army-scheduler edge function"
```

---

## Task 9: Integration - Wire Everything Together

**Files:**
- Verify all pages load correctly through the department routing

- [ ] **Step 1: Verify the directory structure exists**

```bash
ls apps/dashboard/src/pages/admin/army/
```

Expected: `ArmyAccounts.tsx`, `ArmyAssignments.tsx`, `ArmyTemplates.tsx`, `ArmyActivity.tsx`

- [ ] **Step 2: Run the dev server and verify Army department appears**

Navigate to `/admin` and confirm Army appears in the department grid. Click into it and verify all 4 tabs load without errors.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(army): complete WhatsApp Army dashboard v1"
```
