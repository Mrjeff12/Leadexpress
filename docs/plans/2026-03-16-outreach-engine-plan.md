# Outreach Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-channel outreach system with visual Space Flow Canvas that manages the full prospect lifecycle: WhatsApp outreach → follow-ups → voice bot → trial → conversion.

**Architecture:** New `outreach-engine` service (BullMQ + Green API sender + number rotation) + new Supabase tables for flows/enrollments/sends + new React Flow-based Space Canvas page in dashboard. Reuses existing Green API integration patterns from wa-listener and BullMQ patterns from whatsapp-notify.

**Tech Stack:** React Flow + tsparticles (canvas), BullMQ + Redis (job queue), Green API (WhatsApp sending), Supabase (DB + realtime), Hono (HTTP), Pino (logging)

---

## Task 1: Database Migration — Flow Tables

**Files:**
- Create: `supabase/migrations/006_outreach_flows.sql`

**Step 1: Write the migration**

```sql
-- ============================================================
-- 006: Outreach Engine — Campaign Flow System
-- ============================================================

-- 1. Flow status enum
CREATE TYPE flow_status AS ENUM ('draft', 'active', 'paused', 'archived');

-- 2. Flow step types
CREATE TYPE flow_step_type AS ENUM ('send_whatsapp', 'send_voice', 'wait', 'condition', 'exit');

-- 3. Flow channel types
CREATE TYPE flow_channel AS ENUM ('whatsapp_personal', 'whatsapp_business', 'voice');

-- 4. Enrollment status
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'replied', 'opted_out', 'paused');

-- 5. Send status
CREATE TYPE send_status AS ENUM ('queued', 'sending', 'sent', 'delivered', 'read', 'replied', 'failed');

-- 6. WA account purpose
CREATE TYPE wa_account_purpose AS ENUM ('listener', 'outreach', 'both');

-- ============================================================
-- TABLES
-- ============================================================

-- 7. Flows
CREATE TABLE flows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT DEFAULT '',
  status          flow_status NOT NULL DEFAULT 'draft',
  target_filter   JSONB DEFAULT '{}',
  entry_rules     TEXT NOT NULL DEFAULT 'manual',
  exit_rules      JSONB DEFAULT '["replied", "trial_started", "opted_out"]',
  throttle_config JSONB DEFAULT '{"per_number_daily": 50, "delay_min_sec": 45, "delay_max_sec": 120}',
  stats_cache     JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_flows_updated_at
  BEFORE UPDATE ON flows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8. Flow Steps
CREATE TABLE flow_steps (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id                 UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  position                INTEGER NOT NULL DEFAULT 0,
  step_type               flow_step_type NOT NULL,
  channel                 flow_channel,
  delay_hours             INTEGER DEFAULT 0,
  condition_field         TEXT,
  condition_true_step_id  UUID,
  condition_false_step_id UUID,
  canvas_x                FLOAT DEFAULT 0,
  canvas_y                FLOAT DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flow_steps_flow ON flow_steps(flow_id, position);

-- Self-referencing FKs (added after table exists)
ALTER TABLE flow_steps
  ADD CONSTRAINT fk_condition_true FOREIGN KEY (condition_true_step_id) REFERENCES flow_steps(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_condition_false FOREIGN KEY (condition_false_step_id) REFERENCES flow_steps(id) ON DELETE SET NULL;

-- 9. Flow Variants (A/B message variants per step)
CREATE TABLE flow_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id         UUID NOT NULL REFERENCES flow_steps(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  voice_script    TEXT DEFAULT '',
  weight          INTEGER NOT NULL DEFAULT 50,
  stats_sent      INTEGER DEFAULT 0,
  stats_delivered INTEGER DEFAULT 0,
  stats_read      INTEGER DEFAULT 0,
  stats_replied   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flow_variants_step ON flow_variants(step_id);

-- 10. Flow Enrollments
CREATE TABLE flow_enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id         UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  prospect_id     UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES flow_steps(id) ON DELETE SET NULL,
  status          enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_step_at    TIMESTAMPTZ,
  next_step_at    TIMESTAMPTZ,
  exited_at       TIMESTAMPTZ,
  exit_reason     TEXT,

  UNIQUE(flow_id, prospect_id)
);

CREATE INDEX idx_enrollments_flow ON flow_enrollments(flow_id, status);
CREATE INDEX idx_enrollments_next_step ON flow_enrollments(next_step_at) WHERE status = 'active';
CREATE INDEX idx_enrollments_prospect ON flow_enrollments(prospect_id);

-- 11. Flow Sends
CREATE TABLE flow_sends (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     UUID NOT NULL REFERENCES flow_enrollments(id) ON DELETE CASCADE,
  step_id           UUID NOT NULL REFERENCES flow_steps(id),
  variant_id        UUID REFERENCES flow_variants(id),
  wa_account_id     UUID REFERENCES wa_accounts(id),
  channel           flow_channel NOT NULL,
  status            send_status NOT NULL DEFAULT 'queued',
  content_rendered  TEXT DEFAULT '',
  wa_message_id     TEXT,
  error_message     TEXT,
  queued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,
  replied_at        TIMESTAMPTZ
);

CREATE INDEX idx_flow_sends_enrollment ON flow_sends(enrollment_id);
CREATE INDEX idx_flow_sends_status ON flow_sends(status) WHERE status IN ('queued', 'sending');
CREATE INDEX idx_flow_sends_wa_message ON flow_sends(wa_message_id) WHERE wa_message_id IS NOT NULL;

-- 12. Flow Daily Stats (materialized for fast analytics)
CREATE TABLE flow_daily_stats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id     UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  step_id     UUID REFERENCES flow_steps(id) ON DELETE CASCADE,
  variant_id  UUID REFERENCES flow_variants(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  sent        INTEGER DEFAULT 0,
  delivered   INTEGER DEFAULT 0,
  read        INTEGER DEFAULT 0,
  replied     INTEGER DEFAULT 0,
  converted   INTEGER DEFAULT 0,
  failed      INTEGER DEFAULT 0,

  UNIQUE(flow_id, step_id, variant_id, date)
);

CREATE INDEX idx_flow_daily_stats_flow ON flow_daily_stats(flow_id, date DESC);

-- ============================================================
-- ALTER EXISTING TABLES
-- ============================================================

-- 13. Extend wa_accounts for outreach
ALTER TABLE wa_accounts
  ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS warmup_day INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS last_warning_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_paused BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS purpose wa_account_purpose DEFAULT 'both';

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_daily_stats ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY admin_all_flows ON flows
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY admin_all_flow_steps ON flow_steps
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY admin_all_flow_variants ON flow_variants
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY admin_all_flow_enrollments ON flow_enrollments
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY admin_all_flow_sends ON flow_sends
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY admin_all_flow_daily_stats ON flow_daily_stats
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- 14. Aggregate stats for a flow (called periodically or on demand)
CREATE OR REPLACE FUNCTION refresh_flow_stats(p_flow_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE flows SET stats_cache = (
    SELECT jsonb_build_object(
      'total_enrolled', COUNT(*),
      'active', COUNT(*) FILTER (WHERE status = 'active'),
      'replied', COUNT(*) FILTER (WHERE status = 'replied'),
      'completed', COUNT(*) FILTER (WHERE status = 'completed'),
      'opted_out', COUNT(*) FILTER (WHERE status = 'opted_out')
    )
    FROM flow_enrollments WHERE flow_id = p_flow_id
  )
  WHERE id = p_flow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Get next available wa_account for sending (round-robin respecting limits)
CREATE OR REPLACE FUNCTION get_next_outreach_account()
RETURNS TABLE(account_id UUID, green_api_url TEXT, green_api_id TEXT, green_api_token TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wa.id,
    wa.green_api_url,
    wa.green_api_id,
    wa.green_api_token
  FROM wa_accounts wa
  WHERE wa.is_active = true
    AND wa.auto_paused = false
    AND wa.purpose IN ('outreach', 'both')
    AND wa.health_score >= 40
    AND (
      SELECT COUNT(*)
      FROM flow_sends fs
      WHERE fs.wa_account_id = wa.id
        AND fs.sent_at >= CURRENT_DATE
        AND fs.status NOT IN ('failed')
    ) < wa.daily_limit
  ORDER BY (
    SELECT COUNT(*)
    FROM flow_sends fs
    WHERE fs.wa_account_id = wa.id
      AND fs.sent_at >= CURRENT_DATE
  ) ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Apply the migration**

Run: `npx supabase db push` or apply via Supabase MCP tool.

**Step 3: Commit**

```bash
git add supabase/migrations/006_outreach_flows.sql
git commit -m "feat: add outreach engine database schema — flows, steps, variants, enrollments, sends"
```

---

## Task 2: Shared Types — Outreach Engine Types

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Add outreach types to shared package**

Add the following types at the end of `packages/shared/src/types.ts`:

```typescript
// ============================================================
// Outreach Engine Types
// ============================================================

export type FlowStatus = 'draft' | 'active' | 'paused' | 'archived'
export type FlowStepType = 'send_whatsapp' | 'send_voice' | 'wait' | 'condition' | 'exit'
export type FlowChannel = 'whatsapp_personal' | 'whatsapp_business' | 'voice'
export type EnrollmentStatus = 'active' | 'completed' | 'replied' | 'opted_out' | 'paused'
export type SendStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed'
export type WaAccountPurpose = 'listener' | 'outreach' | 'both'

export interface Flow {
  id: string
  name: string
  description: string
  status: FlowStatus
  target_filter: {
    stages?: ProspectStage[]
    groups?: string[]
    professions?: string[]
    areas?: string[]
  }
  entry_rules: string
  exit_rules: string[]
  throttle_config: {
    per_number_daily: number
    delay_min_sec: number
    delay_max_sec: number
  }
  stats_cache: {
    total_enrolled?: number
    active?: number
    replied?: number
    completed?: number
    opted_out?: number
  }
  created_at: string
  updated_at: string
}

export interface FlowStep {
  id: string
  flow_id: string
  position: number
  step_type: FlowStepType
  channel: FlowChannel | null
  delay_hours: number
  condition_field: string | null
  condition_true_step_id: string | null
  condition_false_step_id: string | null
  canvas_x: number
  canvas_y: number
  created_at: string
  // Joined data
  variants?: FlowVariant[]
}

export interface FlowVariant {
  id: string
  step_id: string
  name: string
  content: string
  voice_script: string
  weight: number
  stats_sent: number
  stats_delivered: number
  stats_read: number
  stats_replied: number
  created_at: string
}

export interface FlowEnrollment {
  id: string
  flow_id: string
  prospect_id: string
  current_step_id: string | null
  status: EnrollmentStatus
  enrolled_at: string
  last_step_at: string | null
  next_step_at: string | null
  exited_at: string | null
  exit_reason: string | null
  // Joined data
  prospect?: Prospect
}

export interface FlowSend {
  id: string
  enrollment_id: string
  step_id: string
  variant_id: string | null
  wa_account_id: string | null
  channel: FlowChannel
  status: SendStatus
  content_rendered: string
  wa_message_id: string | null
  error_message: string | null
  queued_at: string
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  replied_at: string | null
}

export interface FlowDailyStats {
  id: string
  flow_id: string
  step_id: string | null
  variant_id: string | null
  date: string
  sent: number
  delivered: number
  read: number
  replied: number
  converted: number
  failed: number
}

// Extended wa_account with outreach fields
export interface WaAccountOutreach {
  id: string
  label: string
  region: string
  green_api_url: string
  green_api_id: string
  green_api_token: string
  phone_number: string | null
  status: string
  is_active: boolean
  daily_limit: number
  warmup_day: number
  health_score: number
  last_warning_at: string | null
  auto_paused: boolean
  purpose: WaAccountPurpose
  // Computed
  sends_today?: number
}
```

**Step 2: Build shared package**

Run: `pnpm --filter @leadexpress/shared build`

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add outreach engine shared types — flows, steps, variants, enrollments, sends"
```

---

## Task 3: Outreach Engine Service — Scaffold + Config

**Files:**
- Create: `services/outreach-engine/package.json`
- Create: `services/outreach-engine/tsconfig.json`
- Create: `services/outreach-engine/Dockerfile`
- Create: `services/outreach-engine/src/config.ts`
- Create: `services/outreach-engine/src/logger.ts`
- Create: `services/outreach-engine/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@leadexpress/outreach-engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@leadexpress/shared": "workspace:*",
    "@supabase/supabase-js": "^2.45.0",
    "bullmq": "^5.12.0",
    "dotenv": "^16.4.5",
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0",
    "ioredis": "^5.4.1",
    "pino": "^9.3.2"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod
COPY dist/ dist/
CMD ["node", "dist/index.js"]
```

**Step 4: Create src/logger.ts**

```typescript
import pino from 'pino';

export const logger = pino({
  name: 'outreach-engine',
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

**Step 5: Create src/config.ts**

```typescript
import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function parseRedis() {
  const url = process.env.REDIS_URL;
  if (url && !process.env.REDIS_HOST) {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname || 'localhost',
        port: Number(parsed.port || 6379),
        password: parsed.password || undefined,
      };
    } catch { /* fall through */ }
  }
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  };
}

export const config = {
  redis: {
    ...parseRedis(),
    maxRetriesPerRequest: null as null,
  },

  supabase: {
    url: required('SUPABASE_URL'),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? required('SUPABASE_SERVICE_KEY'),
  },

  queue: {
    name: 'outreach-sends',
  },

  scheduler: {
    intervalMs: 60_000, // check for due enrollments every 60s
  },

  sender: {
    defaultDelayMin: 45,
    defaultDelayMax: 120,
    businessHoursStart: 9,  // 9 AM target timezone
    businessHoursEnd: 20,   // 8 PM target timezone
  },

  warmup: {
    // day ranges → max sends per day
    schedule: [
      { maxDay: 3, limit: 10 },
      { maxDay: 7, limit: 25 },
      { maxDay: 14, limit: 50 },
      { maxDay: 21, limit: 80 },
      { maxDay: Infinity, limit: 120 },
    ],
  },

  api: {
    port: parseInt(process.env.OUTREACH_API_PORT ?? '3005', 10),
  },
} as const;
```

**Step 6: Create src/index.ts (skeleton)**

```typescript
import { logger } from './logger.js';
import { config } from './config.js';

async function main(): Promise<void> {
  logger.info('Starting outreach engine');
  logger.info({ port: config.api.port }, 'Service started');
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start outreach engine');
  process.exit(1);
});
```

**Step 7: Install dependencies**

Run: `cd services/outreach-engine && pnpm install`

**Step 8: Verify it starts**

Run: `cd services/outreach-engine && pnpm dev`
Expected: Logs "Starting outreach engine" then "Service started"

**Step 9: Commit**

```bash
git add services/outreach-engine/
git commit -m "feat: scaffold outreach-engine service with config, logger, and entry point"
```

---

## Task 4: Outreach Engine — Number Manager

**Files:**
- Create: `services/outreach-engine/src/number-manager.ts`

**Step 1: Implement number manager**

```typescript
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logger } from './logger.js';
import type { WaAccountOutreach } from '@leadexpress/shared';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

export interface OutreachAccount {
  id: string;
  green_api_url: string;
  green_api_id: string;
  green_api_token: string;
  daily_limit: number;
  warmup_day: number;
  health_score: number;
  sends_today: number;
}

/**
 * Get the next available wa_account for sending.
 * Picks the account with fewest sends today that hasn't hit its limit.
 * Respects warmup schedule, health score, and daily limits.
 */
export async function getNextAccount(): Promise<OutreachAccount | null> {
  const { data, error } = await supabase.rpc('get_next_outreach_account');

  if (error || !data || data.length === 0) {
    logger.warn({ error }, 'No available outreach accounts');
    return null;
  }

  const row = data[0];

  // Get full account details
  const { data: account } = await supabase
    .from('wa_accounts')
    .select('id, green_api_url, green_api_id, green_api_token, daily_limit, warmup_day, health_score')
    .eq('id', row.account_id)
    .single();

  if (!account) return null;

  // Calculate effective limit based on warmup
  const effectiveLimit = getWarmupLimit(account.warmup_day, account.daily_limit);

  return {
    ...account,
    daily_limit: effectiveLimit,
    sends_today: 0, // already filtered by DB function
  };
}

/**
 * Get the daily limit based on warmup day.
 */
function getWarmupLimit(warmupDay: number, configuredLimit: number): number {
  for (const tier of config.warmup.schedule) {
    if (warmupDay <= tier.maxDay) {
      return Math.min(tier.limit, configuredLimit);
    }
  }
  return configuredLimit;
}

/**
 * Decrease health score for an account (e.g., on send failure or warning).
 */
export async function decreaseHealth(accountId: string, amount: number): Promise<void> {
  const { data } = await supabase
    .from('wa_accounts')
    .select('health_score')
    .eq('id', accountId)
    .single();

  if (!data) return;

  const newScore = Math.max(0, data.health_score - amount);
  const autoPaused = newScore < 40;

  await supabase
    .from('wa_accounts')
    .update({
      health_score: newScore,
      auto_paused: autoPaused,
      last_warning_at: new Date().toISOString(),
    })
    .eq('id', accountId);

  if (autoPaused) {
    logger.warn({ accountId, health_score: newScore }, 'Account auto-paused due to low health');
  }
}

/**
 * Increment warmup day for all outreach accounts (call daily).
 */
export async function incrementWarmupDays(): Promise<void> {
  await supabase.rpc('increment_warmup_days'); // We'll create this DB function too
  logger.info('Warmup days incremented for all outreach accounts');
}

/**
 * Get random delay between messages (in milliseconds).
 */
export function getRandomDelay(minSec?: number, maxSec?: number): number {
  const min = (minSec ?? config.sender.defaultDelayMin) * 1000;
  const max = (maxSec ?? config.sender.defaultDelayMax) * 1000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

**Step 2: Commit**

```bash
git add services/outreach-engine/src/number-manager.ts
git commit -m "feat: add number manager with rotation, warmup, and health tracking"
```

---

## Task 5: Outreach Engine — Green API Sender

**Files:**
- Create: `services/outreach-engine/src/sender/whatsapp.ts`

**Step 1: Implement WhatsApp sender via Green API**

```typescript
import { logger } from '../logger.js';
import type { OutreachAccount } from '../number-manager.js';

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  shouldRetry?: boolean;
  healthPenalty?: number;
}

/**
 * Send a WhatsApp message via Green API using a specific account.
 */
export async function sendWhatsAppMessage(
  account: OutreachAccount,
  chatId: string,
  message: string,
): Promise<SendResult> {
  const url = `${account.green_api_url}/waInstance${account.green_api_id}/sendMessage/${account.green_api_token}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error({ status: res.status, errorText, accountId: account.id }, 'Green API send failed');

      // Check for ban/block indicators
      if (res.status === 466 || errorText.includes('banned') || errorText.includes('blocked')) {
        return { success: false, error: errorText, shouldRetry: false, healthPenalty: 50 };
      }

      // Rate limit
      if (res.status === 429) {
        return { success: false, error: 'Rate limited', shouldRetry: true, healthPenalty: 5 };
      }

      return { success: false, error: errorText, shouldRetry: true, healthPenalty: 10 };
    }

    const data = (await res.json()) as { idMessage?: string };
    logger.info({ messageId: data.idMessage, accountId: account.id, chatId }, 'Message sent');

    return { success: true, messageId: data.idMessage };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Network error';
    logger.error({ err: errMsg, accountId: account.id }, 'Green API network error');
    return { success: false, error: errMsg, shouldRetry: true, healthPenalty: 0 };
  }
}
```

**Step 2: Commit**

```bash
git add services/outreach-engine/src/sender/whatsapp.ts
git commit -m "feat: add Green API WhatsApp sender with error classification and health penalties"
```

---

## Task 6: Outreach Engine — Template Variable Resolver

**Files:**
- Create: `services/outreach-engine/src/template-resolver.ts`

**Step 1: Implement variable resolution**

```typescript
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import type { Prospect } from '@leadexpress/shared';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

/**
 * Resolve template variables for a specific prospect.
 * Variables: {{name}}, {{group_name}}, {{profession}}, {{area}},
 *            {{lead_count}}, {{recent_lead_count}}, {{group_count}}
 */
export async function resolveTemplate(
  template: string,
  prospect: Prospect,
): Promise<string> {
  let result = template;

  // Basic prospect fields
  result = result.replaceAll('{{name}}', prospect.display_name ?? 'there');
  result = result.replaceAll('{{group_count}}', String(prospect.group_ids?.length ?? 0));

  // Profession (first tag)
  const profession = prospect.profession_tags?.[0] ?? 'contractor';
  result = result.replaceAll('{{profession}}', profession);

  // Group name (first group)
  if (result.includes('{{group_name}}') && prospect.group_ids?.length) {
    const { data: group } = await supabase
      .from('groups')
      .select('name')
      .eq('id', prospect.group_ids[0])
      .single();
    result = result.replaceAll('{{group_name}}', group?.name ?? 'our group');
  }

  // Area — from prospect's groups or default
  if (result.includes('{{area}}')) {
    const { data: groups } = await supabase
      .from('groups')
      .select('region')
      .in('id', prospect.group_ids ?? [])
      .limit(1);
    const area = groups?.[0]?.region ?? 'your area';
    result = result.replaceAll('{{area}}', area);
  }

  // Lead count (last 7 days from their groups)
  if (result.includes('{{lead_count}}') || result.includes('{{recent_lead_count}}')) {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .in('group_id', prospect.group_ids ?? [])
      .gte('created_at', weekAgo);
    const leadCount = String(count ?? 0);
    result = result.replaceAll('{{lead_count}}', leadCount);
    result = result.replaceAll('{{recent_lead_count}}', leadCount);
  }

  return result;
}
```

**Step 2: Commit**

```bash
git add services/outreach-engine/src/template-resolver.ts
git commit -m "feat: add template variable resolver with live lead counts from DB"
```

---

## Task 7: Outreach Engine — Flow Engine (Core Logic)

**Files:**
- Create: `services/outreach-engine/src/flow-engine.ts`

**Step 1: Implement the flow engine**

```typescript
import { createClient } from '@supabase/supabase-js';
import { Queue } from 'bullmq';
import { config } from './config.js';
import { logger } from './logger.js';
import type { FlowEnrollment, FlowStep, FlowVariant, Prospect } from '@leadexpress/shared';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

export interface OutreachJob {
  enrollmentId: string;
  stepId: string;
  variantId: string;
  prospectId: string;
  channel: string;
  contentTemplate: string;
  flowId: string;
}

let sendQueue: Queue<OutreachJob> | null = null;

export function initFlowEngine(queue: Queue<OutreachJob>): void {
  sendQueue = queue;
}

/**
 * Enroll prospects into a flow based on its target_filter.
 */
export async function enrollProspects(flowId: string): Promise<number> {
  const { data: flow } = await supabase
    .from('flows')
    .select('*')
    .eq('id', flowId)
    .single();

  if (!flow || flow.status !== 'active') {
    logger.warn({ flowId }, 'Cannot enroll — flow not active');
    return 0;
  }

  // Build prospect query from target_filter
  let query = supabase.from('prospects').select('id').is('archived_at', null);

  const filter = flow.target_filter as Record<string, unknown>;
  if (filter.stages && Array.isArray(filter.stages)) {
    query = query.in('stage', filter.stages);
  }
  if (filter.professions && Array.isArray(filter.professions)) {
    query = query.overlaps('profession_tags', filter.professions);
  }

  const { data: prospects } = await query;
  if (!prospects?.length) return 0;

  // Get first step
  const { data: firstStep } = await supabase
    .from('flow_steps')
    .select('id')
    .eq('flow_id', flowId)
    .order('position', { ascending: true })
    .limit(1)
    .single();

  if (!firstStep) return 0;

  // Bulk insert enrollments (skip already enrolled)
  const enrollments = prospects.map((p) => ({
    flow_id: flowId,
    prospect_id: p.id,
    current_step_id: firstStep.id,
    status: 'active' as const,
    next_step_at: new Date().toISOString(),
  }));

  const { data: inserted, error } = await supabase
    .from('flow_enrollments')
    .upsert(enrollments, { onConflict: 'flow_id,prospect_id', ignoreDuplicates: true })
    .select('id');

  const count = inserted?.length ?? 0;
  logger.info({ flowId, enrolled: count }, 'Prospects enrolled');
  return count;
}

/**
 * Process due enrollments — called by scheduler every 60s.
 * Finds enrollments where next_step_at <= now() and enqueues sends.
 */
export async function processDueEnrollments(): Promise<number> {
  if (!sendQueue) throw new Error('Flow engine not initialized');

  const now = new Date().toISOString();

  const { data: dueEnrollments } = await supabase
    .from('flow_enrollments')
    .select(`
      id, flow_id, prospect_id, current_step_id,
      flow_steps!inner(id, step_type, channel, delay_hours, condition_field,
        condition_true_step_id, condition_false_step_id,
        flow_variants(id, name, content, voice_script, weight))
    `)
    .eq('status', 'active')
    .lte('next_step_at', now)
    .limit(100);

  if (!dueEnrollments?.length) return 0;

  let enqueued = 0;

  for (const enrollment of dueEnrollments) {
    const step = (enrollment as any).flow_steps as FlowStep & { flow_variants: FlowVariant[] };
    if (!step) continue;

    if (step.step_type === 'wait') {
      // Advance to next step after delay
      await advanceToNextStep(enrollment.id, enrollment.flow_id, step);
      continue;
    }

    if (step.step_type === 'condition') {
      await evaluateCondition(enrollment, step);
      continue;
    }

    if (step.step_type === 'exit') {
      await exitEnrollment(enrollment.id, 'flow_completed');
      continue;
    }

    // send_whatsapp or send_voice
    const variants = step.flow_variants ?? [];
    if (variants.length === 0) {
      logger.warn({ stepId: step.id }, 'Step has no variants, skipping');
      continue;
    }

    // Pick variant by weighted random
    const variant = pickWeightedVariant(variants);

    await sendQueue.add('outreach-send', {
      enrollmentId: enrollment.id,
      stepId: step.id,
      variantId: variant.id,
      prospectId: enrollment.prospect_id,
      channel: step.channel ?? 'whatsapp_personal',
      contentTemplate: variant.content,
      flowId: enrollment.flow_id,
    });

    enqueued++;
  }

  logger.info({ due: dueEnrollments.length, enqueued }, 'Processed due enrollments');
  return enqueued;
}

/**
 * After a send completes successfully, advance enrollment to next step.
 */
export async function advanceToNextStep(
  enrollmentId: string,
  flowId: string,
  currentStep: FlowStep,
): Promise<void> {
  // Get next step by position
  const { data: nextStep } = await supabase
    .from('flow_steps')
    .select('id, delay_hours')
    .eq('flow_id', flowId)
    .gt('position', currentStep.position)
    .order('position', { ascending: true })
    .limit(1)
    .single();

  if (!nextStep) {
    // No more steps
    await exitEnrollment(enrollmentId, 'flow_completed');
    return;
  }

  const nextStepAt = new Date(Date.now() + (nextStep.delay_hours ?? 0) * 3600000).toISOString();

  await supabase
    .from('flow_enrollments')
    .update({
      current_step_id: nextStep.id,
      last_step_at: new Date().toISOString(),
      next_step_at: nextStepAt,
    })
    .eq('id', enrollmentId);
}

/**
 * Evaluate a condition node and branch accordingly.
 */
async function evaluateCondition(
  enrollment: any,
  step: FlowStep,
): Promise<void> {
  const field = step.condition_field; // e.g. "replied"

  let conditionMet = false;

  if (field === 'replied') {
    // Check if any previous send in this enrollment got a reply
    const { count } = await supabase
      .from('flow_sends')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollment.id)
      .eq('status', 'replied');
    conditionMet = (count ?? 0) > 0;
  } else if (field === 'delivered') {
    const { count } = await supabase
      .from('flow_sends')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollment.id)
      .not('delivered_at', 'is', null);
    conditionMet = (count ?? 0) > 0;
  } else if (field === 'read') {
    const { count } = await supabase
      .from('flow_sends')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollment.id)
      .not('read_at', 'is', null);
    conditionMet = (count ?? 0) > 0;
  }

  const nextStepId = conditionMet
    ? step.condition_true_step_id
    : step.condition_false_step_id;

  if (!nextStepId) {
    await exitEnrollment(enrollment.id, conditionMet ? 'condition_true_no_step' : 'condition_false_no_step');
    return;
  }

  const { data: nextStep } = await supabase
    .from('flow_steps')
    .select('id, delay_hours')
    .eq('id', nextStepId)
    .single();

  if (!nextStep) {
    await exitEnrollment(enrollment.id, 'next_step_not_found');
    return;
  }

  const nextStepAt = new Date(Date.now() + (nextStep.delay_hours ?? 0) * 3600000).toISOString();

  await supabase
    .from('flow_enrollments')
    .update({
      current_step_id: nextStepId,
      last_step_at: new Date().toISOString(),
      next_step_at: nextStepAt,
    })
    .eq('id', enrollment.id);
}

/**
 * Exit an enrollment.
 */
export async function exitEnrollment(enrollmentId: string, reason: string): Promise<void> {
  await supabase
    .from('flow_enrollments')
    .update({
      status: reason === 'replied' ? 'replied' : reason === 'opted_out' ? 'opted_out' : 'completed',
      exited_at: new Date().toISOString(),
      exit_reason: reason,
    })
    .eq('id', enrollmentId);

  logger.info({ enrollmentId, reason }, 'Enrollment exited');
}

/**
 * Pick a variant based on weight (weighted random selection).
 */
function pickWeightedVariant(variants: FlowVariant[]): FlowVariant {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;

  for (const variant of variants) {
    random -= variant.weight;
    if (random <= 0) return variant;
  }

  return variants[0];
}
```

**Step 2: Commit**

```bash
git add services/outreach-engine/src/flow-engine.ts
git commit -m "feat: add flow engine — enrollment, scheduling, conditions, and step advancement"
```

---

## Task 8: Outreach Engine — Worker + Scheduler

**Files:**
- Create: `services/outreach-engine/src/worker.ts`
- Create: `services/outreach-engine/src/scheduler.ts`
- Modify: `services/outreach-engine/src/index.ts`

**Step 1: Create worker.ts**

```typescript
import { Worker, UnrecoverableError } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logger } from './logger.js';
import { getNextAccount, decreaseHealth, getRandomDelay } from './number-manager.js';
import { sendWhatsAppMessage } from './sender/whatsapp.js';
import { resolveTemplate } from './template-resolver.js';
import { advanceToNextStep } from './flow-engine.js';
import type { OutreachJob } from './flow-engine.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

export function createOutreachWorker(): { worker: Worker<OutreachJob>; cleanup: () => Promise<void> } {
  const worker = new Worker<OutreachJob>(
    config.queue.name,
    async (job) => {
      const { enrollmentId, stepId, variantId, prospectId, channel, contentTemplate, flowId } = job.data;
      const log = logger.child({ jobId: job.id, enrollmentId, prospectId });

      // 1. Get prospect data
      const { data: prospect } = await supabase
        .from('prospects')
        .select('*')
        .eq('id', prospectId)
        .single();

      if (!prospect) {
        throw new UnrecoverableError(`Prospect ${prospectId} not found`);
      }

      // 2. Resolve template variables
      const renderedContent = await resolveTemplate(contentTemplate, prospect);

      // 3. Get an available sending account
      const account = await getNextAccount();
      if (!account) {
        // No accounts available — retry later
        throw new Error('No available outreach accounts — all at limit or paused');
      }

      // 4. Create flow_sends record
      const { data: send } = await supabase
        .from('flow_sends')
        .insert({
          enrollment_id: enrollmentId,
          step_id: stepId,
          variant_id: variantId,
          wa_account_id: account.id,
          channel,
          status: 'sending',
          content_rendered: renderedContent,
        })
        .select('id')
        .single();

      // 5. Send via Green API
      const chatId = prospect.wa_id;
      const result = await sendWhatsAppMessage(account, chatId, renderedContent);

      if (result.success) {
        // Update send record
        await supabase
          .from('flow_sends')
          .update({
            status: 'sent',
            wa_message_id: result.messageId,
            sent_at: new Date().toISOString(),
          })
          .eq('id', send!.id);

        // Update variant stats
        await supabase.rpc('increment_variant_stat', {
          p_variant_id: variantId,
          p_field: 'stats_sent',
        });

        // Log to prospect_messages
        await supabase.from('prospect_messages').insert({
          prospect_id: prospectId,
          wa_account_id: account.id,
          direction: 'outgoing',
          message_type: 'text',
          content: renderedContent,
          wa_message_id: result.messageId,
          sent_at: new Date().toISOString(),
        });

        // Update prospect
        await supabase.from('prospects').update({
          last_contact_at: new Date().toISOString(),
          stage: prospect.stage === 'prospect' ? 'reached_out' : prospect.stage,
        }).eq('id', prospectId);

        // Log event
        await supabase.from('prospect_events').insert({
          prospect_id: prospectId,
          event_type: 'message_sent',
          new_value: renderedContent.substring(0, 100),
          detail: { wa_message_id: result.messageId, flow_id: flowId, step_id: stepId },
        });

        // Advance to next step
        const { data: currentStep } = await supabase
          .from('flow_steps')
          .select('*')
          .eq('id', stepId)
          .single();
        if (currentStep) {
          await advanceToNextStep(enrollmentId, flowId, currentStep);
        }

        log.info({ messageId: result.messageId }, 'Outreach message sent successfully');
        return { sent: true, messageId: result.messageId };
      }

      // Handle failure
      await supabase
        .from('flow_sends')
        .update({ status: 'failed', error_message: result.error })
        .eq('id', send!.id);

      if (result.healthPenalty) {
        await decreaseHealth(account.id, result.healthPenalty);
      }

      if (!result.shouldRetry) {
        throw new UnrecoverableError(result.error ?? 'Send failed permanently');
      }

      throw new Error(result.error ?? 'Send failed — will retry');
    },
    {
      connection: config.redis,
      concurrency: 1, // One at a time for rate control
      removeOnComplete: { count: 5000 },
      removeOnFail: { count: 10000 },
      limiter: {
        max: 1,
        duration: config.sender.defaultDelayMin * 1000, // Min delay between jobs
      },
    },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job?.id }, 'Outreach job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message, attempts: job?.attemptsMade }, 'Outreach job failed');
  });

  const cleanup = async () => {
    await worker.close();
  };

  return { worker, cleanup };
}
```

**Step 2: Create scheduler.ts**

```typescript
import { config } from './config.js';
import { logger } from './logger.js';
import { processDueEnrollments } from './flow-engine.js';

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  logger.info({ intervalMs: config.scheduler.intervalMs }, 'Starting outreach scheduler');

  // Run immediately once
  tick();

  // Then every intervalMs
  intervalHandle = setInterval(tick, config.scheduler.intervalMs);
}

async function tick(): Promise<void> {
  try {
    const count = await processDueEnrollments();
    if (count > 0) {
      logger.info({ enqueued: count }, 'Scheduler tick — enqueued sends');
    }
  } catch (err) {
    logger.error({ err }, 'Scheduler tick failed');
  }
}

export function stopScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('Scheduler stopped');
  }
}
```

**Step 3: Update index.ts to wire everything together**

Replace `services/outreach-engine/src/index.ts` with:

```typescript
import { Queue } from 'bullmq';
import { logger } from './logger.js';
import { config } from './config.js';
import { initFlowEngine } from './flow-engine.js';
import { createOutreachWorker } from './worker.js';
import { startScheduler, stopScheduler } from './scheduler.js';
import type { OutreachJob } from './flow-engine.js';

let sendQueue: Queue<OutreachJob> | null = null;
let workerCleanup: (() => Promise<void>) | null = null;

async function main(): Promise<void> {
  logger.info('Starting outreach engine');

  // 1. Create BullMQ queue
  sendQueue = new Queue<OutreachJob>(config.queue.name, {
    connection: config.redis,
    defaultJobOptions: {
      removeOnComplete: { count: 5000 },
      removeOnFail: { count: 10000 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 30000 },
    },
  });

  // 2. Init flow engine with queue reference
  initFlowEngine(sendQueue);

  // 3. Start worker
  const { cleanup } = createOutreachWorker();
  workerCleanup = cleanup;

  // 4. Start scheduler
  startScheduler();

  logger.info('Outreach engine started');
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down outreach engine');
  stopScheduler();
  if (workerCleanup) await workerCleanup();
  if (sendQueue) await sendQueue.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start outreach engine');
  process.exit(1);
});
```

**Step 4: Commit**

```bash
git add services/outreach-engine/src/worker.ts services/outreach-engine/src/scheduler.ts services/outreach-engine/src/index.ts
git commit -m "feat: add outreach worker, scheduler, and wire up full service lifecycle"
```

---

## Task 9: Outreach Engine — API Endpoints

**Files:**
- Create: `services/outreach-engine/src/api.ts`
- Modify: `services/outreach-engine/src/index.ts` (add API start)

**Step 1: Create API with Hono**

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logger } from './logger.js';
import { enrollProspects } from './flow-engine.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);
const app = new Hono();

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'outreach-engine' }));

// Get all flows
app.get('/api/flows', async (c) => {
  const { data, error } = await supabase
    .from('flows')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Get flow with steps and variants
app.get('/api/flows/:id', async (c) => {
  const id = c.req.param('id');
  const { data: flow } = await supabase.from('flows').select('*').eq('id', id).single();
  if (!flow) return c.json({ error: 'Not found' }, 404);

  const { data: steps } = await supabase
    .from('flow_steps')
    .select('*, flow_variants(*)')
    .eq('flow_id', id)
    .order('position', { ascending: true });

  return c.json({ ...flow, steps: steps ?? [] });
});

// Create flow
app.post('/api/flows', async (c) => {
  const body = await c.req.json();
  const { data, error } = await supabase.from('flows').insert(body).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

// Update flow
app.patch('/api/flows/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { data, error } = await supabase.from('flows').update(body).eq('id', id).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Activate flow (start sending)
app.post('/api/flows/:id/activate', async (c) => {
  const id = c.req.param('id');
  await supabase.from('flows').update({ status: 'active' }).eq('id', id);
  const enrolled = await enrollProspects(id);
  return c.json({ activated: true, enrolled });
});

// Pause flow
app.post('/api/flows/:id/pause', async (c) => {
  const id = c.req.param('id');
  await supabase.from('flows').update({ status: 'paused' }).eq('id', id);
  return c.json({ paused: true });
});

// Get flow stats
app.get('/api/flows/:id/stats', async (c) => {
  const id = c.req.param('id');

  // Enrollment stats
  const { data: enrollments } = await supabase
    .from('flow_enrollments')
    .select('status')
    .eq('flow_id', id);

  const enrollmentStats = {
    total: enrollments?.length ?? 0,
    active: enrollments?.filter((e) => e.status === 'active').length ?? 0,
    replied: enrollments?.filter((e) => e.status === 'replied').length ?? 0,
    completed: enrollments?.filter((e) => e.status === 'completed').length ?? 0,
    opted_out: enrollments?.filter((e) => e.status === 'opted_out').length ?? 0,
  };

  // Send stats per step
  const { data: sends } = await supabase
    .from('flow_sends')
    .select('step_id, variant_id, status')
    .eq('enrollment_id', supabase.rpc ? '' : '') // We'll use a join
    // Actually let's aggregate differently
  ;

  // Step-level stats
  const { data: stepStats } = await supabase
    .from('flow_daily_stats')
    .select('*')
    .eq('flow_id', id)
    .order('date', { ascending: false })
    .limit(100);

  return c.json({ enrollments: enrollmentStats, daily: stepStats ?? [] });
});

// Get outreach accounts status
app.get('/api/accounts', async (c) => {
  const { data } = await supabase
    .from('wa_accounts')
    .select('id, label, phone_number, is_active, daily_limit, warmup_day, health_score, auto_paused, purpose')
    .in('purpose', ['outreach', 'both'])
    .order('label');
  return c.json(data ?? []);
});

// CRUD for flow steps
app.post('/api/flows/:flowId/steps', async (c) => {
  const flowId = c.req.param('flowId');
  const body = await c.req.json();
  const { data, error } = await supabase
    .from('flow_steps')
    .insert({ ...body, flow_id: flowId })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

// CRUD for variants
app.post('/api/steps/:stepId/variants', async (c) => {
  const stepId = c.req.param('stepId');
  const body = await c.req.json();
  const { data, error } = await supabase
    .from('flow_variants')
    .insert({ ...body, step_id: stepId })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

app.patch('/api/variants/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { data, error } = await supabase.from('flow_variants').update(body).eq('id', id).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

export function startAPI(port: number): void {
  serve({ fetch: app.fetch, port }, () => {
    logger.info({ port }, 'Outreach API listening');
  });
}
```

**Step 2: Add API start to index.ts**

Add `import { startAPI } from './api.js';` and call `startAPI(config.api.port);` in main().

**Step 3: Commit**

```bash
git add services/outreach-engine/src/api.ts services/outreach-engine/src/index.ts
git commit -m "feat: add outreach engine REST API — flows, steps, variants, accounts CRUD"
```

---

## Task 10: Dashboard — Install React Flow + tsparticles

**Files:**
- Modify: `apps/dashboard/package.json`

**Step 1: Install dependencies**

Run:
```bash
cd apps/dashboard && pnpm add @xyflow/react @tsparticles/react @tsparticles/slim
```

**Step 2: Commit**

```bash
git add apps/dashboard/package.json pnpm-lock.yaml
git commit -m "feat: add React Flow and tsparticles dependencies for campaign canvas"
```

---

## Task 11: Dashboard — Space Canvas Background Component

**Files:**
- Create: `apps/dashboard/src/components/canvas/SpaceBackground.tsx`

**Step 1: Create the star particles background**

```tsx
import { useCallback } from 'react'
import Particles from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import type { Engine } from '@tsparticles/engine'

export default function SpaceBackground() {
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine)
  }, [])

  return (
    <Particles
      id="space-particles"
      init={particlesInit}
      options={{
        fullScreen: false,
        background: { color: { value: 'transparent' } },
        fpsLimit: 30,
        particles: {
          color: { value: '#ffffff' },
          number: { value: 120, density: { enable: true, width: 1920, height: 1080 } },
          opacity: {
            value: { min: 0.1, max: 0.5 },
            animation: { enable: true, speed: 0.3, sync: false },
          },
          size: {
            value: { min: 0.5, max: 2 },
          },
          move: {
            enable: true,
            speed: 0.15,
            direction: 'none',
            outModes: { default: 'out' },
          },
        },
        detectRetina: true,
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/components/canvas/SpaceBackground.tsx
git commit -m "feat: add space particles background component for campaign canvas"
```

---

## Task 12: Dashboard — Flow Node Components

**Files:**
- Create: `apps/dashboard/src/components/canvas/nodes/AudienceNode.tsx`
- Create: `apps/dashboard/src/components/canvas/nodes/WhatsAppNode.tsx`
- Create: `apps/dashboard/src/components/canvas/nodes/VoiceNode.tsx`
- Create: `apps/dashboard/src/components/canvas/nodes/WaitNode.tsx`
- Create: `apps/dashboard/src/components/canvas/nodes/ConditionNode.tsx`
- Create: `apps/dashboard/src/components/canvas/nodes/ExitNode.tsx`
- Create: `apps/dashboard/src/components/canvas/nodes/index.ts`

**Step 1: Create AudienceNode**

```tsx
import { Handle, Position } from '@xyflow/react'

interface AudienceNodeData {
  label: string
  count: number
  filters: string[]
}

export default function AudienceNode({ data }: { data: AudienceNodeData }) {
  return (
    <div className="relative min-w-[220px] rounded-2xl border border-purple-500/30 bg-[#12111a]/90 p-4 backdrop-blur-sm shadow-[0_0_20px_rgba(168,85,247,0.15)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2.5 w-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">Audience</span>
      </div>
      <div className="text-2xl font-bold text-white">{data.count.toLocaleString()}</div>
      <div className="text-xs text-gray-400 mt-1">{data.label}</div>
      {data.filters.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.filters.map((f) => (
            <span key={f} className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300 border border-purple-500/20">
              {f}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-[#12111a]" />
    </div>
  )
}
```

**Step 2: Create WhatsAppNode**

```tsx
import { Handle, Position } from '@xyflow/react'

interface WhatsAppNodeData {
  label: string
  variantName: string
  sent: number
  delivered: number
  read: number
  replied: number
  abWinner?: 'A' | 'B' | null
}

export default function WhatsAppNode({ data }: { data: WhatsAppNodeData }) {
  const readRate = data.sent > 0 ? Math.round((data.read / data.sent) * 100) : 0
  const replyRate = data.sent > 0 ? Math.round((data.replied / data.sent) * 100) : 0

  return (
    <div className="relative min-w-[240px] rounded-2xl border border-green-500/30 bg-[#12111a]/90 p-4 backdrop-blur-sm shadow-[0_0_20px_rgba(34,197,94,0.15)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-green-300">WhatsApp</span>
        </div>
        {data.abWinner && (
          <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded-full">
            🏆 {data.abWinner}
          </span>
        )}
      </div>
      <div className="text-sm font-medium text-white mb-3">{data.label}</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Sent</span>
          <div className="text-white font-semibold">{data.sent.toLocaleString()}</div>
        </div>
        <div>
          <span className="text-gray-500">Read</span>
          <div className="text-green-300 font-semibold">{readRate}%</div>
        </div>
        <div>
          <span className="text-gray-500">Replied</span>
          <div className="text-emerald-300 font-semibold">{replyRate}%</div>
        </div>
        <div>
          <span className="text-gray-500">Variant</span>
          <div className="text-gray-300 font-medium">{data.variantName}</div>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-green-400 !w-3 !h-3 !border-2 !border-[#12111a]" />
      <Handle type="source" position={Position.Right} className="!bg-green-400 !w-3 !h-3 !border-2 !border-[#12111a]" />
    </div>
  )
}
```

**Step 3: Create VoiceNode**

```tsx
import { Handle, Position } from '@xyflow/react'

interface VoiceNodeData {
  label: string
  called: number
  answered: number
  interested: number
}

export default function VoiceNode({ data }: { data: VoiceNodeData }) {
  const answerRate = data.called > 0 ? Math.round((data.answered / data.called) * 100) : 0
  const interestRate = data.called > 0 ? Math.round((data.interested / data.called) * 100) : 0

  return (
    <div className="relative min-w-[220px] rounded-2xl border border-blue-500/30 bg-[#12111a]/90 p-4 backdrop-blur-sm shadow-[0_0_20px_rgba(59,130,246,0.15)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2.5 w-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">Voice Bot</span>
      </div>
      <div className="text-sm font-medium text-white mb-3">{data.label}</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Called</span>
          <div className="text-white font-semibold">{data.called.toLocaleString()}</div>
        </div>
        <div>
          <span className="text-gray-500">Answered</span>
          <div className="text-blue-300 font-semibold">{answerRate}%</div>
        </div>
        <div>
          <span className="text-gray-500">Interested</span>
          <div className="text-cyan-300 font-semibold">{interestRate}%</div>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-blue-400 !w-3 !h-3 !border-2 !border-[#12111a]" />
      <Handle type="source" position={Position.Right} className="!bg-blue-400 !w-3 !h-3 !border-2 !border-[#12111a]" />
    </div>
  )
}
```

**Step 4: Create WaitNode**

```tsx
import { Handle, Position } from '@xyflow/react'

interface WaitNodeData {
  hours: number
}

export default function WaitNode({ data }: { data: WaitNodeData }) {
  const label = data.hours >= 24
    ? `${Math.round(data.hours / 24)} days`
    : `${data.hours} hours`

  return (
    <div className="relative min-w-[120px] rounded-2xl border border-gray-600/30 bg-[#12111a]/90 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-gray-500" />
        <span className="text-xs text-gray-400">Wait {label}</span>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-gray-500 !w-3 !h-3 !border-2 !border-[#12111a]" />
      <Handle type="source" position={Position.Right} className="!bg-gray-500 !w-3 !h-3 !border-2 !border-[#12111a]" />
    </div>
  )
}
```

**Step 5: Create ConditionNode**

```tsx
import { Handle, Position } from '@xyflow/react'

interface ConditionNodeData {
  field: string
  yesCount: number
  noCount: number
}

export default function ConditionNode({ data }: { data: ConditionNodeData }) {
  const total = data.yesCount + data.noCount
  const yesRate = total > 0 ? Math.round((data.yesCount / total) * 100) : 0

  return (
    <div className="relative min-w-[160px] rounded-2xl border border-yellow-500/30 bg-[#12111a]/90 p-4 backdrop-blur-sm shadow-[0_0_15px_rgba(234,179,8,0.1)]"
      style={{ transform: 'rotate(0deg)' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-yellow-300">{data.field}?</span>
      </div>
      <div className="flex gap-3 text-xs">
        <div>
          <span className="text-green-400">Yes</span>
          <div className="text-white font-semibold">{yesRate}%</div>
        </div>
        <div>
          <span className="text-red-400">No</span>
          <div className="text-white font-semibold">{100 - yesRate}%</div>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-yellow-400 !w-3 !h-3 !border-2 !border-[#12111a]" />
      <Handle type="source" position={Position.Top} id="yes" className="!bg-green-400 !w-3 !h-3 !border-2 !border-[#12111a]" />
      <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-400 !w-3 !h-3 !border-2 !border-[#12111a]" />
    </div>
  )
}
```

**Step 6: Create ExitNode**

```tsx
import { Handle, Position } from '@xyflow/react'

interface ExitNodeData {
  label: string
  count: number
  type: 'success' | 'neutral' | 'negative'
}

const colors = {
  success: { border: 'border-emerald-500/30', glow: 'rgba(16,185,129,0.15)', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  neutral: { border: 'border-gray-500/30', glow: 'rgba(107,114,128,0.1)', dot: 'bg-gray-400', text: 'text-gray-300' },
  negative: { border: 'border-red-500/30', glow: 'rgba(239,68,68,0.15)', dot: 'bg-red-400', text: 'text-red-300' },
}

export default function ExitNode({ data }: { data: ExitNodeData }) {
  const c = colors[data.type]
  return (
    <div className={`relative min-w-[160px] rounded-2xl border ${c.border} bg-[#12111a]/90 p-4 backdrop-blur-sm`}
      style={{ boxShadow: `0 0 20px ${c.glow}` }}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${c.text}`}>Exit</span>
      </div>
      <div className="text-sm font-medium text-white">{data.label}</div>
      <div className="text-lg font-bold text-white mt-1">{data.count.toLocaleString()}</div>
      <Handle type="target" position={Position.Left} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-[#12111a]" />
    </div>
  )
}
```

**Step 7: Create index.ts barrel**

```typescript
export { default as AudienceNode } from './AudienceNode'
export { default as WhatsAppNode } from './WhatsAppNode'
export { default as VoiceNode } from './VoiceNode'
export { default as WaitNode } from './WaitNode'
export { default as ConditionNode } from './ConditionNode'
export { default as ExitNode } from './ExitNode'
```

**Step 8: Commit**

```bash
git add apps/dashboard/src/components/canvas/nodes/
git commit -m "feat: add space-themed flow canvas node components — audience, whatsapp, voice, wait, condition, exit"
```

---

## Task 13: Dashboard — Campaign Flow Canvas Page

**Files:**
- Create: `apps/dashboard/src/pages/admin/CampaignCanvas.tsx`

**Step 1: Create the main canvas page**

```tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import SpaceBackground from '../../components/canvas/SpaceBackground'
import {
  AudienceNode,
  WhatsAppNode,
  VoiceNode,
  WaitNode,
  ConditionNode,
  ExitNode,
} from '../../components/canvas/nodes'
import type { Flow, FlowStep, FlowVariant } from '@leadexpress/shared'

const nodeTypes: NodeTypes = {
  audience: AudienceNode,
  whatsapp: WhatsAppNode,
  voice: VoiceNode,
  wait: WaitNode,
  condition: ConditionNode,
  exit: ExitNode,
}

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: '#4ade80', strokeWidth: 2, opacity: 0.6 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#4ade80' },
}

interface FlowWithSteps extends Flow {
  steps: (FlowStep & { flow_variants: FlowVariant[] })[]
}

export default function CampaignCanvas() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [flows, setFlows] = useState<Flow[]>([])
  const [activeFlow, setActiveFlow] = useState<FlowWithSteps | null>(null)
  const [loading, setLoading] = useState(true)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Performance stats
  const [stats, setStats] = useState({
    sent: 0, delivered: 0, read: 0, replied: 0, trial: 0,
  })

  // Load flows list
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('flows')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setFlows(data)
      setLoading(false)
    })()
  }, [])

  // Load flow details + build canvas
  const loadFlow = useCallback(async (flowId: string) => {
    const { data: flow } = await supabase
      .from('flows')
      .select('*')
      .eq('id', flowId)
      .single()

    const { data: steps } = await supabase
      .from('flow_steps')
      .select('*, flow_variants(*)')
      .eq('flow_id', flowId)
      .order('position', { ascending: true })

    if (!flow || !steps) return

    const fullFlow: FlowWithSteps = { ...flow, steps }
    setActiveFlow(fullFlow)

    // Build nodes and edges from steps
    const newNodes: Node[] = []
    const newEdges: Edge[] = []

    steps.forEach((step, i) => {
      const variants = step.flow_variants ?? []
      const topVariant = variants.sort((a: FlowVariant, b: FlowVariant) => b.stats_replied - a.stats_replied)[0]

      const nodeBase = {
        id: step.id,
        position: { x: step.canvas_x || i * 320, y: step.canvas_y || 200 },
      }

      if (step.step_type === 'send_whatsapp') {
        newNodes.push({
          ...nodeBase,
          type: 'whatsapp',
          data: {
            label: topVariant?.name ?? `Step ${i + 1}`,
            variantName: topVariant?.name ?? '',
            sent: topVariant?.stats_sent ?? 0,
            delivered: topVariant?.stats_delivered ?? 0,
            read: topVariant?.stats_read ?? 0,
            replied: topVariant?.stats_replied ?? 0,
          },
        })
      } else if (step.step_type === 'send_voice') {
        newNodes.push({
          ...nodeBase,
          type: 'voice',
          data: {
            label: topVariant?.name ?? `Voice Step ${i + 1}`,
            called: topVariant?.stats_sent ?? 0,
            answered: topVariant?.stats_delivered ?? 0,
            interested: topVariant?.stats_replied ?? 0,
          },
        })
      } else if (step.step_type === 'wait') {
        newNodes.push({
          ...nodeBase,
          type: 'wait',
          data: { hours: step.delay_hours },
        })
      } else if (step.step_type === 'condition') {
        newNodes.push({
          ...nodeBase,
          type: 'condition',
          data: {
            field: step.condition_field ?? 'replied',
            yesCount: 0,
            noCount: 0,
          },
        })
      } else if (step.step_type === 'exit') {
        newNodes.push({
          ...nodeBase,
          type: 'exit',
          data: { label: 'Trial', count: 0, type: 'success' as const },
        })
      }

      // Connect to next step (or condition branches)
      if (step.step_type === 'condition') {
        if (step.condition_true_step_id) {
          newEdges.push({
            id: `${step.id}-yes`,
            source: step.id,
            sourceHandle: 'yes',
            target: step.condition_true_step_id,
            ...defaultEdgeOptions,
            style: { ...defaultEdgeOptions.style, stroke: '#4ade80' },
            label: 'Yes',
            labelStyle: { fill: '#4ade80', fontSize: 11 },
          })
        }
        if (step.condition_false_step_id) {
          newEdges.push({
            id: `${step.id}-no`,
            source: step.id,
            sourceHandle: 'no',
            target: step.condition_false_step_id,
            ...defaultEdgeOptions,
            style: { ...defaultEdgeOptions.style, stroke: '#ef4444' },
            label: 'No',
            labelStyle: { fill: '#ef4444', fontSize: 11 },
          })
        }
      } else if (i < steps.length - 1) {
        newEdges.push({
          id: `${step.id}-next`,
          source: step.id,
          target: steps[i + 1].id,
          ...defaultEdgeOptions,
        })
      }
    })

    setNodes(newNodes)
    setEdges(newEdges)

    // Load aggregate stats
    const { data: sends } = await supabase
      .from('flow_sends')
      .select('status')
      .in('enrollment_id',
        (await supabase.from('flow_enrollments').select('id').eq('flow_id', flowId)).data?.map(e => e.id) ?? []
      )
    if (sends) {
      setStats({
        sent: sends.length,
        delivered: sends.filter(s => s.status !== 'queued' && s.status !== 'failed').length,
        read: sends.filter(s => ['read', 'replied'].includes(s.status)).length,
        replied: sends.filter(s => s.status === 'replied').length,
        trial: 0, // TODO: count trial signups
      })
    }
  }, [setNodes, setEdges])

  // Load first flow on mount
  useEffect(() => {
    if (flows.length > 0 && !activeFlow) {
      loadFlow(flows[0].id)
    }
  }, [flows, activeFlow, loadFlow])

  // Realtime updates
  useEffect(() => {
    if (!activeFlow) return

    const channel = supabase
      .channel('flow-sends-rt')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'flow_sends',
      }, () => {
        // Refresh stats on any send update
        if (activeFlow) loadFlow(activeFlow.id)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeFlow, loadFlow])

  const deliveredRate = stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : '0'
  const readRate = stats.sent > 0 ? ((stats.read / stats.sent) * 100).toFixed(1) : '0'
  const replyRate = stats.sent > 0 ? ((stats.replied / stats.sent) * 100).toFixed(1) : '0'

  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ background: '#0a0a0f' }}>
      {/* Space particles */}
      <SpaceBackground />

      {/* Top Performance Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3"
        style={{ background: 'linear-gradient(180deg, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0) 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse" />
          <span className="text-sm font-bold uppercase tracking-widest text-white/80">Outreach Engine</span>
          {activeFlow && (
            <span className="text-xs text-gray-500 ml-2">
              {activeFlow.status === 'active' ? 'LIVE' : activeFlow.status.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-8 text-center">
          {[
            { label: 'SENT', value: stats.sent.toLocaleString(), sub: '' },
            { label: 'DELIVERED', value: stats.delivered.toLocaleString(), sub: `${deliveredRate}%` },
            { label: 'READ', value: stats.read.toLocaleString(), sub: `${readRate}%` },
            { label: 'REPLIED', value: stats.replied.toLocaleString(), sub: `${replyRate}%` },
            { label: 'TRIAL', value: stats.trial.toLocaleString(), sub: '' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{s.label}</div>
              <div className="text-lg font-bold text-white">{s.value}</div>
              {s.sub && <div className="text-[10px] text-green-400">{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* Flow selector */}
        <select
          className="rounded-lg bg-white/5 border border-white/10 text-white text-sm px-3 py-1.5"
          value={activeFlow?.id ?? ''}
          onChange={(e) => loadFlow(e.target.value)}
        >
          {flows.map((f) => (
            <option key={f.id} value={f.id} className="bg-[#12111a] text-white">
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* React Flow Canvas */}
      <div className="absolute inset-0 z-10">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.1}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'transparent' }}
        >
          <Background color="#1a1a2e" gap={40} size={1} />
          <Controls
            position="bottom-left"
            className="!bg-white/5 !border-white/10 !rounded-xl [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-white [&>button:hover]:!bg-white/10"
          />
          <MiniMap
            position="bottom-right"
            className="!bg-[#0a0a0f]/80 !border-white/10 !rounded-xl"
            nodeColor="#4ade80"
            maskColor="rgba(10,10,15,0.8)"
          />
        </ReactFlow>
      </div>

      {/* Bottom Stats Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-6 py-3"
        style={{ background: 'linear-gradient(0deg, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0) 100%)' }}>
        {[
          { value: stats.sent, label: 'REACHED', color: 'text-white' },
          { value: stats.replied, label: 'REPLIED', color: 'text-green-400' },
          { value: stats.trial, label: 'TRIAL', color: 'text-emerald-400' },
          { value: 0, label: 'PAID', color: 'text-yellow-400' },
        ].map((s) => (
          <div key={s.label} className="text-center min-w-[100px] rounded-xl bg-white/5 px-4 py-2 border border-white/5">
            <div className={`text-xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/pages/admin/CampaignCanvas.tsx
git commit -m "feat: add campaign flow canvas page with space theme, React Flow, and live stats"
```

---

## Task 14: Dashboard — Add Route + Sidebar Link

**Files:**
- Modify: `apps/dashboard/src/components/AdminLayout.tsx`
- Modify: `apps/dashboard/src/components/AdminSidebar.tsx`

**Step 1: Add route to AdminLayout.tsx**

Add import at top:
```typescript
import CampaignCanvas from '../pages/admin/CampaignCanvas'
```

Add to the `isFullBleed` check (alongside leads-map):
```typescript
const isFullBleed = location.pathname === '/admin/leads-map' || location.pathname === '/admin/campaigns'
```

Add route inside `<Routes>`:
```tsx
<Route path="/campaigns" element={<CampaignCanvas />} />
```

**Step 2: Add sidebar link to AdminSidebar.tsx**

Add `Rocket` icon import from lucide-react and add the campaigns link in the sidebar navigation, likely near "Message Templates":

```tsx
{ to: '/admin/campaigns', icon: Rocket, label: 'Campaigns', he: 'קמפיינים' },
```

**Step 3: Commit**

```bash
git add apps/dashboard/src/components/AdminLayout.tsx apps/dashboard/src/components/AdminSidebar.tsx
git commit -m "feat: add campaigns route and sidebar link — full-bleed space canvas page"
```

---

## Task 15: Docker Compose + Env Setup

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Add outreach-engine service to docker-compose.yml**

```yaml
  outreach-engine:
    build: ./services/outreach-engine
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_URL=redis://redis:6379
      - OUTREACH_API_PORT=3005
      - LOG_LEVEL=info
    depends_on:
      - redis
    ports:
      - "3005:3005"
    restart: unless-stopped
```

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add outreach-engine to docker-compose with Redis dependency"
```

---

## Task 16: Seed Data — Default Cold Outreach Flow

**Files:**
- Create: `services/outreach-engine/src/seed-default-flow.ts`

**Step 1: Create a seed script for the default flow**

```typescript
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!,
);

async function seed() {
  // 1. Create flow
  const { data: flow } = await supabase.from('flows').insert({
    name: 'Cold Outreach v1',
    description: 'Personal WhatsApp outreach → Follow-up → Voice Bot → Trial',
    status: 'draft',
    target_filter: { stages: ['prospect'] },
    exit_rules: ['replied', 'trial_started', 'opted_out'],
    throttle_config: { per_number_daily: 50, delay_min_sec: 45, delay_max_sec: 120 },
  }).select().single();

  if (!flow) { console.error('Failed to create flow'); return; }

  // 2. Create steps
  const steps = [
    { position: 0, step_type: 'send_whatsapp', channel: 'whatsapp_personal', delay_hours: 0, canvas_x: 0, canvas_y: 200 },
    { position: 1, step_type: 'wait', delay_hours: 72, canvas_x: 320, canvas_y: 200 },
    { position: 2, step_type: 'condition', condition_field: 'replied', canvas_x: 560, canvas_y: 200 },
    { position: 3, step_type: 'send_whatsapp', channel: 'whatsapp_personal', delay_hours: 0, canvas_x: 800, canvas_y: 350 },
    { position: 4, step_type: 'wait', delay_hours: 120, canvas_x: 1040, canvas_y: 350 },
    { position: 5, step_type: 'send_voice', channel: 'voice', delay_hours: 0, canvas_x: 1280, canvas_y: 350 },
    { position: 6, step_type: 'exit', canvas_x: 800, canvas_y: 50 }, // replied → trial
    { position: 7, step_type: 'exit', canvas_x: 1520, canvas_y: 350 }, // end of funnel
  ];

  const { data: createdSteps } = await supabase
    .from('flow_steps')
    .insert(steps.map((s) => ({ ...s, flow_id: flow.id })))
    .select('id, position')
    .order('position');

  if (!createdSteps) { console.error('Failed to create steps'); return; }

  // Wire condition branches
  const conditionStep = createdSteps[2]; // position 2
  const followUpStep = createdSteps[3]; // position 3 (no reply → follow-up)
  const trialExit = createdSteps[6]; // position 6 (replied → trial)

  await supabase.from('flow_steps').update({
    condition_true_step_id: trialExit.id,
    condition_false_step_id: followUpStep.id,
  }).eq('id', conditionStep.id);

  // 3. Create variants for WhatsApp steps
  // Step 0 — Cold outreach
  const step0 = createdSteps[0];
  await supabase.from('flow_variants').insert([
    {
      step_id: step0.id,
      name: 'Referral Angle',
      content: `Hey {{name}}, we're both in {{group_name}} 👋\nI use a smart system that filters all the messages in the group and sends me only the leads in my work area and my type of work.\nAn AI bot filters the leads directly to my WhatsApp.\nTo get a discount I need to bring 2 friends and honestly I don't have anyone so I sent to you, maybe you'd be interested :)\nSorry if not!`,
      weight: 50,
    },
    {
      step_id: step0.id,
      name: 'Social Proof',
      content: `Hey {{name}}, saw you're in {{group_name}}.\nMe and a few other {{profession}} guys from the group use a tool that filters only the relevant leads from the group straight to WhatsApp.\nSaves hours of scrolling. They're giving a free trial week.\nWant me to send you the link?`,
      weight: 30,
    },
    {
      step_id: step0.id,
      name: 'Pain Point',
      content: `Hey {{name}}, quick question — do you actually read all the messages in {{group_name}}? There are like 200 a day 😅\nI was missing jobs until I found this AI tool that sends me only the leads in my area. Free trial if you want to check it out.`,
      weight: 20,
    },
  ]);

  // Step 3 — Follow-up
  const step3 = createdSteps[3];
  await supabase.from('flow_variants').insert([
    {
      step_id: step3.id,
      name: 'Value Follow-up',
      content: `Hey {{name}}, sent you something a few days ago.\nSince then there were {{recent_lead_count}} new {{profession}} leads in {{group_name}} in {{area}}. Want me to show you which ones?`,
      weight: 100,
    },
  ]);

  // Step 5 — Voice bot
  const step5 = createdSteps[5];
  await supabase.from('flow_variants').insert([
    {
      step_id: step5.id,
      name: 'Voice Intro',
      content: '',
      voice_script: `Hi {{name}}, this is Lead Express. I saw you're in {{group_count}} WhatsApp groups for {{profession}} work. Last week there were {{lead_count}} leads in your area that you probably missed. We have an AI tool that filters the right leads directly to your WhatsApp. Want to try it free for a week?`,
      weight: 100,
    },
  ]);

  console.log('✅ Default flow seeded:', flow.id);
  console.log('   Steps:', createdSteps.length);
}

seed().catch(console.error);
```

**Step 2: Run the seed**

Run: `cd services/outreach-engine && npx tsx src/seed-default-flow.ts`

**Step 3: Commit**

```bash
git add services/outreach-engine/src/seed-default-flow.ts
git commit -m "feat: add seed script for default cold outreach flow with A/B variants"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Database migration | `supabase/migrations/006_outreach_flows.sql` |
| 2 | Shared TypeScript types | `packages/shared/src/types.ts` |
| 3 | Service scaffold | `services/outreach-engine/` (5 files) |
| 4 | Number manager | `services/outreach-engine/src/number-manager.ts` |
| 5 | Green API sender | `services/outreach-engine/src/sender/whatsapp.ts` |
| 6 | Template resolver | `services/outreach-engine/src/template-resolver.ts` |
| 7 | Flow engine | `services/outreach-engine/src/flow-engine.ts` |
| 8 | Worker + scheduler | `services/outreach-engine/src/worker.ts`, `scheduler.ts` |
| 9 | API endpoints | `services/outreach-engine/src/api.ts` |
| 10 | Install React Flow | `apps/dashboard/package.json` |
| 11 | Space background | `apps/dashboard/src/components/canvas/SpaceBackground.tsx` |
| 12 | Flow node components | `apps/dashboard/src/components/canvas/nodes/` (7 files) |
| 13 | Campaign canvas page | `apps/dashboard/src/pages/admin/CampaignCanvas.tsx` |
| 14 | Route + sidebar | `AdminLayout.tsx`, `AdminSidebar.tsx` |
| 15 | Docker compose | `docker-compose.yml` |
| 16 | Seed default flow | `services/outreach-engine/src/seed-default-flow.ts` |
