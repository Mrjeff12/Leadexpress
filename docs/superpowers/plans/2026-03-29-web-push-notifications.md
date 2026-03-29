# Web Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contractors receive native push notifications on their phone/desktop when a new lead arrives, even when the dashboard is closed. A persistent banner prompts them to enable it once after magic-link login.

**Architecture:** Service Worker in the dashboard receives Web Push payloads and shows OS notifications. The `notification` backend service gains a `push-worker` that pulls from a new BullMQ `push-notifications` queue. The `matching` service enqueues push jobs alongside existing Telegram/WA jobs. Subscriptions are stored in a new `push_subscriptions` Supabase table.

**Tech Stack:** `web-push` (Node.js VAPID), Browser Push API, BullMQ, Supabase RLS, React hook + component

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/069_push_subscriptions.sql` | Create | DB table + RLS |
| `apps/dashboard/public/sw.js` | Create | Service Worker — show push notification |
| `apps/dashboard/src/hooks/usePushNotifications.ts` | Create | Register SW, subscribe, save to DB |
| `apps/dashboard/src/components/PushBanner.tsx` | Create | Persistent banner until push enabled |
| `apps/dashboard/src/App.tsx` | Modify | Add `<PushBanner />` inside `AppShell` |
| `apps/dashboard/src/lib/supabase.ts` | Read only | Use existing client |
| `services/notification/package.json` | Modify | Add `web-push` + `@types/web-push` deps |
| `services/notification/src/config.ts` | Modify | Add VAPID config + push queue name |
| `services/notification/src/push-worker.ts` | Create | BullMQ worker — sends Web Push |
| `services/notification/src/index.ts` | Modify | Start push-worker alongside telegram worker |
| `services/matching/src/matcher.ts` | Modify | Add push queue, enqueue push jobs |

---

## Task 1: Supabase Migration — `push_subscriptions` table

**Files:**
- Create: `supabase/migrations/069_push_subscriptions.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/069_push_subscriptions.sql

CREATE TABLE public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Contractors can read/write only their own subscriptions
CREATE POLICY "push_subscriptions_own"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role (backend) can read all subscriptions to send pushes
-- (service role bypasses RLS by default — no extra policy needed)

COMMENT ON TABLE public.push_subscriptions IS
  'Browser Web Push subscriptions for contractors. Each row is one browser/device.';
```

- [ ] **Step 2: Apply the migration**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
npx supabase db push --db-url "postgresql://postgres.zyytzwlvtuhgbjpalbgd:$(cat .env | grep SUPABASE_DB_PASSWORD | cut -d= -f2)@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
```

If you don't have the DB URL locally, apply via Supabase MCP tool:
```
mcp__0d9c8720__apply_migration — project_id: zyytzwlvtuhgbjpalbgd
```

- [ ] **Step 3: Verify table exists**

Run in Supabase SQL editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'push_subscriptions'
ORDER BY ordinal_position;
```
Expected: 7 columns — id, user_id, endpoint, p256dh, auth, user_agent, created_at

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/069_push_subscriptions.sql
git commit -m "feat(db): add push_subscriptions table with RLS"
```

---

## Task 2: Generate VAPID Keys

**Files:** None (env vars only)

VAPID (Voluntary Application Server Identification) is a pair of keys that authenticates your push server with browser push services.

- [ ] **Step 1: Generate keys**

```bash
cd /Users/bigjeff/Desktop/Leadexpress
npx web-push generate-vapid-keys
```

Expected output:
```
=======================================
Public Key:
BExamplePublicKeyHere...

Private Key:
ExamplePrivateKeyHere...
=======================================
```

- [ ] **Step 2: Save keys to env**

Add to `services/notification/.env` (create if not exists):
```
VAPID_PUBLIC_KEY=<paste public key>
VAPID_PRIVATE_KEY=<paste private key>
VAPID_SUBJECT=mailto:admin@leadexpress.io
```

Add to `apps/dashboard/.env` (create if not exists):
```
VITE_VAPID_PUBLIC_KEY=<paste same public key>
```

- [ ] **Step 3: Add to Render env for notification service**

In Render dashboard → notification service → Environment:
- `VAPID_PUBLIC_KEY` = public key
- `VAPID_PRIVATE_KEY` = private key
- `VAPID_SUBJECT` = `mailto:admin@leadexpress.io`

- [ ] **Step 4: Add to Render env for dashboard (Vite build var)**

In Render dashboard → dashboard service → Environment:
- `VITE_VAPID_PUBLIC_KEY` = public key

> ⚠️ VAPID keys are generated once and never change. If you regenerate, all existing browser subscriptions stop working.

---

## Task 3: Service Worker

**Files:**
- Create: `apps/dashboard/public/sw.js`

The service worker runs in the background in the browser, separate from the page JS. It intercepts push events from the browser's push service and shows OS notifications.

- [ ] **Step 1: Create the service worker**

```javascript
// apps/dashboard/public/sw.js
// Minimal push-only service worker — no caching logic

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: '🔔 New Lead', body: event.data.text() };
  }

  const title = payload.title || '🔔 New Lead Available';
  const options = {
    body: payload.body || 'A new lead matched your profile. Tap to view.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.leadId || 'lead-notification',   // replaces previous notification of same tag
    renotify: true,
    data: {
      url: payload.url || '/',
      leadId: payload.leadId,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If dashboard already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          return;
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
```

- [ ] **Step 2: Add a placeholder icon**

Check if `apps/dashboard/public/icon-192.png` exists:
```bash
ls apps/dashboard/public/icon-192.png 2>/dev/null && echo "exists" || echo "missing"
```

If missing, copy any existing icon or create a placeholder:
```bash
# Use existing favicon or logo if available
cp apps/dashboard/public/favicon.ico apps/dashboard/public/icon-192.png 2>/dev/null || \
  curl -s "https://via.placeholder.com/192/fe5b25/ffffff.png?text=LE" -o apps/dashboard/public/icon-192.png
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/public/sw.js apps/dashboard/public/icon-192.png
git commit -m "feat(dashboard): add push notification service worker"
```

---

## Task 4: `usePushNotifications` Hook

**Files:**
- Create: `apps/dashboard/src/hooks/usePushNotifications.ts`

- [ ] **Step 1: Read the existing supabase lib to confirm export name**

```bash
head -5 apps/dashboard/src/lib/supabase.ts
```

Expected: `export const supabase = createClient(...)`

- [ ] **Step 2: Create the hook**

```typescript
// apps/dashboard/src/hooks/usePushNotifications.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export type PushStatus = 'unsupported' | 'denied' | 'default' | 'granted' | 'loading'

export interface UsePushNotificationsResult {
  status: PushStatus
  enable: () => Promise<void>
  isLoading: boolean
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function usePushNotifications(): UsePushNotificationsResult {
  const { user } = useAuth()
  const [status, setStatus] = useState<PushStatus>('loading')
  const [isLoading, setIsLoading] = useState(false)

  // Determine initial push status
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    const perm = Notification.permission
    if (perm === 'granted') {
      setStatus('granted')
    } else if (perm === 'denied') {
      setStatus('denied')
    } else {
      setStatus('default')
    }
  }, [])

  const enable = useCallback(async () => {
    if (!user) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    setIsLoading(true)
    try {
      // 1. Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready

      // 2. Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission as PushStatus)
        return
      }

      // 3. Subscribe to push
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string
      if (!vapidPublicKey) {
        console.error('VITE_VAPID_PUBLIC_KEY not set')
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      // 4. Save subscription to Supabase
      const { endpoint, keys } = subscription.toJSON() as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }

      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: navigator.userAgent.slice(0, 200),
        },
        { onConflict: 'user_id,endpoint' }
      )

      if (error) {
        console.error('Failed to save push subscription:', error)
        return
      }

      setStatus('granted')
    } catch (err) {
      console.error('Push subscription failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  return { status, enable, isLoading }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/hooks/usePushNotifications.ts
git commit -m "feat(dashboard): add usePushNotifications hook"
```

---

## Task 5: `PushBanner` Component

**Files:**
- Create: `apps/dashboard/src/components/PushBanner.tsx`

The banner is shown on every authenticated page and is **not dismissible** until push is enabled. Once `status === 'granted'`, it renders null.

- [ ] **Step 1: Detect iOS for the Add-to-Home-Screen hint**

iOS requires PWA installed to Home Screen for push to work. Detection:
```typescript
const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent)
const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone === true
const showIosHint = isIos && !isInStandaloneMode
```

- [ ] **Step 2: Create the component**

```tsx
// apps/dashboard/src/components/PushBanner.tsx
import { Bell, Loader2 } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useAuth } from '../lib/auth'

export function PushBanner() {
  const { user } = useAuth()
  const { status, enable, isLoading } = usePushNotifications()

  // Only show to logged-in contractors
  if (!user) return null
  // Already enabled or not supported — hide
  if (status === 'granted' || status === 'unsupported' || status === 'loading') return null
  // Permission permanently denied — can't do anything, hide
  if (status === 'denied') return null

  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isInStandaloneMode =
    'standalone' in window.navigator && (window.navigator as any).standalone === true
  const showIosHint = isIos && !isInStandaloneMode

  return (
    <div
      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-white text-sm font-medium z-30"
      style={{
        background: 'linear-gradient(90deg, #fe5b25 0%, #ff8c42 100%)',
        minHeight: '44px',
      }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Bell className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">
          {showIosHint
            ? '📱 Tap Share → Add to Home Screen, then enable notifications'
            : "🔔 Enable notifications — get leads instantly, even when this tab is closed"}
        </span>
      </div>

      {!showIosHint && (
        <button
          onClick={enable}
          disabled={isLoading}
          className="flex-shrink-0 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            'Enable'
          )}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/PushBanner.tsx
git commit -m "feat(dashboard): add PushBanner component — persistent until push enabled"
```

---

## Task 6: Wire `PushBanner` into `App.tsx`

**Files:**
- Modify: `apps/dashboard/src/App.tsx`

The banner goes inside `AppShell`, above the existing banners (`CompleteAccountBanner`, `SubscriptionBanner`).

- [ ] **Step 1: Add import at the top of App.tsx**

Find the existing imports block (around line 16) and add:
```typescript
import { PushBanner } from './components/PushBanner'
```

- [ ] **Step 2: Insert `<PushBanner />` into AppShell**

Find this block in `AppShell` (around line 165):
```tsx
      <CompleteAccountBanner />
      <SubscriptionBanner />
      <ImpersonationBanner />
```

Replace with:
```tsx
      <PushBanner />
      <CompleteAccountBanner />
      <SubscriptionBanner />
      <ImpersonationBanner />
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
cd apps/dashboard
npm run build 2>&1 | tail -20
```

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/App.tsx
git commit -m "feat(dashboard): show PushBanner in AppShell for all contractors"
```

---

## Task 7: `notification` service — add `web-push` dependency

**Files:**
- Modify: `services/notification/package.json`
- Modify: `services/notification/src/config.ts`

- [ ] **Step 1: Add `web-push` to package.json**

In `services/notification/package.json`, add to `dependencies`:
```json
"web-push": "^3.6.7"
```

Add to `devDependencies`:
```json
"@types/web-push": "^3.6.4"
```

Final `dependencies` block should look like:
```json
"dependencies": {
  "bullmq": "^5.34.3",
  "dotenv": "^16.4.7",
  "ioredis": "^5.4.2",
  "pino": "^9.6.0",
  "web-push": "^3.6.7"
},
"devDependencies": {
  "@types/node": "^22.13.4",
  "@types/web-push": "^3.6.4",
  "tsx": "^4.19.3",
  "typescript": "^5.7.3"
}
```

- [ ] **Step 2: Install the dependency**

```bash
cd services/notification
npm install
```

Expected: `added N packages`

- [ ] **Step 3: Update `config.ts` — add VAPID + push queue**

Replace the entire contents of `services/notification/src/config.ts`:

```typescript
import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

function parseRedis() {
  const url = process.env.REDIS_URL;
  if (url && !process.env.REDIS_HOST) {
    try {
      const parsed = new URL(url);
      const useTls = parsed.protocol === 'rediss:';
      return {
        host: parsed.hostname || '127.0.0.1',
        port: Number(parsed.port || 6379),
        password: parsed.password || undefined,
        username: parsed.username || undefined,
        ...(useTls ? { tls: {} } : {}),
      };
    } catch { /* fall through */ }
  }
  return {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

export const config = {
  redis: {
    ...parseRedis(),
    maxRetriesPerRequest: null as null,
  },

  telegram: {
    botToken: required('TELEGRAM_BOT_TOKEN'),
  },

  vapid: {
    publicKey: optional('VAPID_PUBLIC_KEY'),
    privateKey: optional('VAPID_PRIVATE_KEY'),
    subject: optional('VAPID_SUBJECT') ?? 'mailto:admin@leadexpress.io',
  },

  worker: {
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 10),
  },

  rateLimiter: {
    max: Number(process.env.RATE_LIMIT_MAX ?? 25),
    duration: Number(process.env.RATE_LIMIT_DURATION ?? 1000),
  },

  queues: {
    notifications: 'notifications',
    pushNotifications: 'push-notifications',
  },
} as const;
```

- [ ] **Step 4: Commit**

```bash
git add services/notification/package.json services/notification/src/config.ts
git commit -m "feat(notification): add web-push dependency and VAPID config"
```

---

## Task 8: `push-worker.ts` — send Web Push

**Files:**
- Create: `services/notification/src/push-worker.ts`

- [ ] **Step 1: Create the push worker**

```typescript
// services/notification/src/push-worker.ts
import { Worker } from 'bullmq';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import IORedis from 'ioredis';
import type { Logger } from 'pino';
import { config } from './config.js';

export interface PushNotificationJob {
  leadId: string;
  contractorId: string;
  title: string;
  body: string;
  url?: string;
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

function makeRedis() {
  return process.env.REDIS_URL
    ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new IORedis({ ...config.redis });
}

export function createPushWorker(log: Logger): { worker: Worker; cleanup: () => Promise<void> } {
  // Skip if VAPID keys not configured
  if (!config.vapid.publicKey || !config.vapid.privateKey) {
    log.warn('VAPID keys not configured — push-worker disabled');
    // Return a no-op cleanup so index.ts can unconditionally call it
    return {
      worker: null as unknown as Worker,
      cleanup: async () => {},
    };
  }

  webpush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey,
  );

  const connection = makeRedis();

  const worker = new Worker<PushNotificationJob>(
    config.queues.pushNotifications,
    async (job) => {
      const { leadId, contractorId, title, body, url } = job.data;
      const jobLog = log.child({ jobId: job.id, leadId, contractorId });

      // Fetch all browser subscriptions for this contractor
      const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', contractorId);

      if (error) {
        throw new Error(`Failed to fetch push subscriptions: ${error.message}`);
      }

      if (!subs || subs.length === 0) {
        jobLog.info('No push subscriptions found — skipping');
        return { sent: 0 };
      }

      const payload = JSON.stringify({ title, body, leadId, url: url ?? '/' });
      let sentCount = 0;
      const expiredIds: string[] = [];

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          sentCount++;
        } catch (err: any) {
          // 410 Gone = subscription expired/unsubscribed — clean it up
          if (err.statusCode === 410 || err.statusCode === 404) {
            jobLog.info({ endpoint: sub.endpoint }, 'Push subscription expired — queuing for deletion');
            expiredIds.push(sub.id);
          } else {
            jobLog.warn({ endpoint: sub.endpoint, statusCode: err.statusCode, err: err.message }, 'Push send failed');
          }
        }
      }

      // Delete expired subscriptions
      if (expiredIds.length > 0) {
        await supabase.from('push_subscriptions').delete().in('id', expiredIds);
        jobLog.info({ count: expiredIds.length }, 'Deleted expired push subscriptions');
      }

      // Log to pipeline_events
      await supabase.from('pipeline_events').insert({
        stage: 'push_sent',
        lead_id: leadId,
        detail: { contractorId, sent: sentCount, expired: expiredIds.length },
      });

      jobLog.info({ sent: sentCount, total: subs.length }, 'Push notifications sent');
      return { sent: sentCount };
    },
    {
      connection,
      concurrency: config.worker.concurrency,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on('completed', (job, result) => {
    log.info({ jobId: job?.id, result }, 'Push job completed');
  });

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, 'Push job failed');
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'Push worker error');
  });

  const cleanup = async () => {
    await worker.close();
  };

  return { worker, cleanup };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd services/notification
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add services/notification/src/push-worker.ts
git commit -m "feat(notification): add push-worker for Web Push notifications"
```

---

## Task 9: Wire push-worker into `notification/index.ts`

**Files:**
- Modify: `services/notification/src/index.ts`

- [ ] **Step 1: Update index.ts to start both workers**

Replace the entire file:

```typescript
import pino from 'pino';
import { config } from './config.js';
import { createNotificationWorker } from './worker.js';
import { createPushWorker } from './push-worker.js';

const log = pino({ name: 'notification-service' });

log.info(
  {
    redis: `${config.redis.host}:${config.redis.port}`,
    concurrency: config.worker.concurrency,
    queues: [config.queues.notifications, config.queues.pushNotifications],
    vapidConfigured: !!(config.vapid.publicKey && config.vapid.privateKey),
  },
  'Starting notification service',
);

const { worker: telegramWorker, cleanup: cleanupTelegram } = createNotificationWorker(log);
const { worker: pushWorker, cleanup: cleanupPush } = createPushWorker(log);

async function shutdown(signal: string) {
  log.info({ signal }, 'Shutting down');
  await cleanupTelegram();
  await cleanupPush();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (err) => {
  log.fatal({ err }, 'Unhandled rejection — shutting down');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

telegramWorker.on('ready', () => {
  log.info('Telegram notification worker ready');
});

if (pushWorker) {
  pushWorker.on('ready', () => {
    log.info('Push notification worker ready');
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd services/notification
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add services/notification/src/index.ts
git commit -m "feat(notification): start push-worker alongside telegram worker"
```

---

## Task 10: Update `notification` Dockerfile for `web-push`

**Files:**
- Read: `services/notification/Dockerfile`

The existing Dockerfile probably uses `npm ci`. Since `web-push` is a standard npm package, no Dockerfile changes are needed if it already does `npm ci`. Verify:

- [ ] **Step 1: Check the Dockerfile**

```bash
cat services/notification/Dockerfile
```

- [ ] **Step 2: Ensure package-lock.json is up to date**

```bash
cd services/notification
npm install
git add package.json package-lock.json
git commit -m "chore(notification): update package-lock with web-push"
```

---

## Task 11: Update `matching` service — enqueue push jobs

**Files:**
- Modify: `services/matching/src/matcher.ts`

Push notifications are sent **in addition to** Telegram/WA — they are not a replacement.

- [ ] **Step 1: Add push queue to `createMatchingWorker`**

In `services/matching/src/worker.ts`, add a third queue after `waNotificationQueue`:

```typescript
// After waNotificationQueue definition (around line 45), add:
const pushNotificationQueue = new Queue('push-notifications', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});
```

Update the `matchLead` call to pass it:
```typescript
const matched = await matchLead(lead, notificationQueue, jobLog, waNotificationQueue, pushNotificationQueue);
```

Update `cleanup`:
```typescript
const cleanup = async () => {
  await worker.close();
  await notificationQueue.close();
  await waNotificationQueue.close();
  await pushNotificationQueue.close();
};
```

- [ ] **Step 2: Update `matchLead` signature in `matcher.ts`**

Change the function signature from:
```typescript
export async function matchLead(
  lead: Lead,
  notificationQueue: Queue,
  log: Logger,
  waNotificationQueue?: Queue,
): Promise<number>
```

To:
```typescript
export async function matchLead(
  lead: Lead,
  notificationQueue: Queue,
  log: Logger,
  waNotificationQueue?: Queue,
  pushNotificationQueue?: Queue,
): Promise<number>
```

- [ ] **Step 3: Add Supabase query for push subscriptions in `matchLead`**

Inside `matchLead`, after `const capped = contractors.slice(0, config.matching.maxContractorsPerLead);` and before the `telegramJobs`/`waJobs` arrays, add:

```typescript
// Fetch contractors that have push subscriptions
const contractorIds = capped.map((c) => c.user_id);
const { data: pushSubs } = await supabase
  .from('push_subscriptions')
  .select('user_id')
  .in('user_id', contractorIds);

const contractorsWithPush = new Set((pushSubs ?? []).map((s: { user_id: string }) => s.user_id));
```

- [ ] **Step 4: Add push jobs array and enqueue logic**

After the `waJobs` array declaration, add:
```typescript
const pushJobs: Array<{ name: string; data: Record<string, unknown>; opts: Record<string, unknown> }> = [];
```

Inside the `for (const contractor of capped)` loop, after the existing `if/else if` block, add:
```typescript
// Push notification (additive — sent regardless of WA/Telegram routing)
if (contractorsWithPush.has(contractor.user_id)) {
  const professionLabel = lead.profession.replace(/_/g, ' ').toUpperCase();
  const location = [lead.city, lead.zip_code].filter(Boolean).join(', ');
  pushJobs.push({
    name: 'send-push-notification',
    data: {
      leadId: lead.id,
      contractorId: contractor.user_id,
      title: `🔥 New ${professionLabel} Lead`,
      body: `${location} — ${lead.urgency === 'hot' ? 'ASAP' : lead.urgency === 'warm' ? 'This Week' : 'Flexible'}`,
      url: '/leads',
    },
    opts: {
      jobId: `push-notif-${lead.id}-${contractor.user_id}`,
      attempts: 2,
      backoff: { type: 'exponential' as const, delay: 1000 },
    },
  });
}
```

- [ ] **Step 5: Enqueue push jobs**

After the existing `if (waJobs.length > 0 && waNotificationQueue)` block, add:
```typescript
if (pushJobs.length > 0 && pushNotificationQueue) {
  await pushNotificationQueue.addBulk(pushJobs);
}
```

Update `totalSent` to include push:
```typescript
const totalSent = telegramJobs.length + waJobs.length + pushJobs.length;
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd services/matching
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add services/matching/src/matcher.ts services/matching/src/worker.ts
git commit -m "feat(matching): enqueue push notifications for contractors with push subscriptions"
```

---

## Task 12: Push to Render and verify

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Add VAPID env vars to Render**

In Render dashboard:
- `notification` service → Environment → add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `dashboard` service → Environment → add `VITE_VAPID_PUBLIC_KEY`
- Trigger manual redeploy on dashboard (build var change requires rebuild)

- [ ] **Step 3: Verify notification service logs**

After redeploy, check logs in Render for `notification` service:
```
Expected: "Push notification worker ready"
Expected: "Starting notification service" with vapidConfigured: true
```

- [ ] **Step 4: End-to-end test**

1. Open dashboard in Chrome on your phone
2. Confirm orange `PushBanner` appears at top
3. Tap "Enable" → browser permission prompt → "Allow"
4. Check Supabase: `SELECT * FROM push_subscriptions WHERE user_id = '<your-user-id>';` — should have 1 row
5. Wait for a lead to arrive (or manually insert a test lead matching a contractor's zip/profession)
6. Confirm push notification appears on your phone screen

- [ ] **Step 5: Verify pipeline_events**

```sql
SELECT stage, detail, created_at
FROM pipeline_events
WHERE stage = 'push_sent'
ORDER BY created_at DESC
LIMIT 5;
```

Expected: rows with `sent > 0`.
