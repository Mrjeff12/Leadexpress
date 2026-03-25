# Job Broadcast System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable contractors to broadcast job opportunities to the network, receive interest from matching contractors, review profiles, and assign work — with an invite flow for unregistered contractors.

**Architecture:** New DB tables (job_broadcasts, job_broadcast_responses, contractor_invites) + new column on job_orders (assigned_user_id, broadcast_id). Atomic RPC functions handle state transitions. WhatsApp webhook extended with new button handlers. ForwardLeadModal gets a broadcast mode toggle. New "Responses" view in dashboard.

**Tech Stack:** PostgreSQL (Supabase), Twilio WhatsApp Content API, React + TailwindCSS, Supabase Edge Functions (Deno)

---

## Task 1: Database Migration — New Tables + job_orders Changes

**Files:**
- Create: `supabase/migrations/061_job_broadcast_system.sql`

**Step 1: Write the migration**

```sql
-- ============================================================
-- 061: Job Broadcast System
-- Enables contractors to broadcast jobs to the network,
-- receive interest, and choose from responding contractors.
-- ============================================================
BEGIN;

-- ============================================================
-- 1. job_broadcasts — published job opportunities
-- ============================================================
CREATE TABLE public.job_broadcasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  publisher_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deal_type        TEXT NOT NULL CHECK (deal_type IN ('percentage', 'fixed_price', 'custom')),
  deal_value       TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'assigned', 'closed', 'expired')),
  max_recipients   INTEGER NOT NULL DEFAULT 50,
  sent_count       INTEGER NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '72 hours'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jb_publisher ON public.job_broadcasts(publisher_id, status);
CREATE INDEX idx_jb_lead ON public.job_broadcasts(lead_id);
CREATE INDEX idx_jb_status_expires ON public.job_broadcasts(status, expires_at)
  WHERE status = 'open';

CREATE TRIGGER set_jb_updated_at
  BEFORE UPDATE ON public.job_broadcasts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE public.job_broadcasts ENABLE ROW LEVEL SECURITY;

-- Publisher: full CRUD on own
CREATE POLICY jb_publisher ON public.job_broadcasts
  FOR ALL USING (
    publisher_id = auth.uid()
    OR public.is_admin()
  );

-- Responding contractors: can read broadcasts they responded to
CREATE POLICY jb_responders_read ON public.job_broadcasts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.job_broadcast_responses
      WHERE broadcast_id = id AND contractor_id = auth.uid()
    )
  );


-- ============================================================
-- 2. job_broadcast_responses — contractor interest
-- ============================================================
CREATE TABLE public.job_broadcast_responses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id     UUID NOT NULL REFERENCES public.job_broadcasts(id) ON DELETE CASCADE,
  contractor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'interested'
    CHECK (status IN ('interested', 'chosen', 'closed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(broadcast_id, contractor_id)
);

-- Only one chosen per broadcast
CREATE UNIQUE INDEX idx_one_chosen_per_broadcast
  ON public.job_broadcast_responses(broadcast_id) WHERE status = 'chosen';

CREATE INDEX idx_jbr_broadcast ON public.job_broadcast_responses(broadcast_id, status);
CREATE INDEX idx_jbr_contractor ON public.job_broadcast_responses(contractor_id);

-- RLS
ALTER TABLE public.job_broadcast_responses ENABLE ROW LEVEL SECURITY;

-- Contractor: read/insert own responses
CREATE POLICY jbr_own ON public.job_broadcast_responses
  FOR ALL USING (
    contractor_id = auth.uid()
    OR public.is_admin()
  );

-- Publisher: read responses to own broadcasts
CREATE POLICY jbr_publisher_read ON public.job_broadcast_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.job_broadcasts
      WHERE id = broadcast_id AND publisher_id = auth.uid()
    )
  );


-- ============================================================
-- 3. contractor_invites — invite unregistered contractors
-- ============================================================
CREATE TABLE public.contractor_invites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone            TEXT NOT NULL CHECK (phone ~ '^\+\d{7,15}$'),
  name             TEXT NOT NULL,
  broadcast_id     UUID REFERENCES public.job_broadcasts(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'registered', 'expired')),
  invited_user_id  UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status != 'registered' OR invited_user_id IS NOT NULL),
  UNIQUE(inviter_id, phone)
);

CREATE INDEX idx_ci_phone ON public.contractor_invites(phone, status);
CREATE INDEX idx_ci_inviter ON public.contractor_invites(inviter_id);

-- RLS
ALTER TABLE public.contractor_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY ci_own ON public.contractor_invites
  FOR ALL USING (
    inviter_id = auth.uid()
    OR invited_user_id = auth.uid()
    OR public.is_admin()
  );


-- ============================================================
-- 4. Add columns to job_orders
-- ============================================================
ALTER TABLE public.job_orders
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS broadcast_id UUID REFERENCES public.job_broadcasts(id);

CREATE INDEX idx_jo_assigned_user ON public.job_orders(assigned_user_id)
  WHERE assigned_user_id IS NOT NULL;
CREATE INDEX idx_jo_broadcast ON public.job_orders(broadcast_id)
  WHERE broadcast_id IS NOT NULL;


-- ============================================================
-- 5. GIN indexes for contractor matching performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contractors_professions_gin
  ON public.contractors USING GIN (professions);
CREATE INDEX IF NOT EXISTS idx_contractors_zip_codes_gin
  ON public.contractors USING GIN (zip_codes);


-- ============================================================
-- 6. Fix reviews RLS — allow both parties to submit reviews
-- ============================================================
DROP POLICY IF EXISTS reviews_insert ON public.reviews;

CREATE POLICY reviews_insert ON public.reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM job_orders jo
      WHERE jo.id = job_order_id
        AND jo.status = 'completed'
        AND (jo.contractor_id = auth.uid() OR jo.assigned_user_id = auth.uid())
    )
  );


-- ============================================================
-- 7. Update submit_review to allow both parties
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_review(
  p_job_order_id UUID,
  p_reviewee_id UUID,
  p_overall SMALLINT,
  p_quality SMALLINT DEFAULT NULL,
  p_communication SMALLINT DEFAULT NULL,
  p_timeliness SMALLINT DEFAULT NULL,
  p_would_hire_again BOOLEAN DEFAULT NULL,
  p_review_text TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reviewer_id UUID := auth.uid();
  v_job RECORD;
  v_review_id UUID;
BEGIN
  SELECT * INTO v_job FROM job_orders WHERE id = p_job_order_id;
  IF v_job IS NULL THEN RAISE EXCEPTION 'Job order not found'; END IF;
  IF v_job.status != 'completed' THEN RAISE EXCEPTION 'Job must be completed before reviewing'; END IF;

  -- Validate reviewer is part of the job (either side)
  IF v_job.contractor_id != v_reviewer_id AND COALESCE(v_job.assigned_user_id, '00000000-0000-0000-0000-000000000000') != v_reviewer_id THEN
    RAISE EXCEPTION 'You are not part of this job order';
  END IF;

  -- Validate time window (30 days)
  IF v_job.updated_at < now() - INTERVAL '30 days' THEN
    RAISE EXCEPTION 'Review window has expired (30 days)';
  END IF;

  -- Cannot review yourself
  IF p_reviewee_id = v_reviewer_id THEN
    RAISE EXCEPTION 'Cannot review yourself';
  END IF;

  INSERT INTO reviews (
    job_order_id, reviewer_id, reviewee_id,
    overall, quality, communication, timeliness,
    would_hire_again, review_text
  ) VALUES (
    p_job_order_id, v_reviewer_id, p_reviewee_id,
    p_overall, p_quality, p_communication, p_timeliness,
    p_would_hire_again, p_review_text
  )
  RETURNING id INTO v_review_id;

  PERFORM award_network_points(v_reviewer_id, 'review_submitted', 50, jsonb_build_object(
    'review_id', v_review_id,
    'job_order_id', p_job_order_id
  ));

  RETURN v_review_id;
END;
$$;


-- ============================================================
-- 8. choose_contractor_for_broadcast — atomic assignment
-- ============================================================
CREATE OR REPLACE FUNCTION public.choose_contractor_for_broadcast(
  p_broadcast_id UUID,
  p_contractor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_broadcast RECORD;
  v_job_order_id UUID;
  v_result JSONB;
BEGIN
  -- Lock and validate broadcast
  SELECT * INTO v_broadcast
  FROM job_broadcasts
  WHERE id = p_broadcast_id AND status = 'open'
  FOR UPDATE;

  IF v_broadcast IS NULL THEN
    RAISE EXCEPTION 'Broadcast is no longer open';
  END IF;

  -- Validate caller is the publisher
  IF v_broadcast.publisher_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the publisher can choose a contractor';
  END IF;

  -- Validate contractor responded
  IF NOT EXISTS (
    SELECT 1 FROM job_broadcast_responses
    WHERE broadcast_id = p_broadcast_id
      AND contractor_id = p_contractor_id
      AND status = 'interested'
  ) THEN
    RAISE EXCEPTION 'Contractor has not expressed interest';
  END IF;

  -- 1. Update broadcast status
  UPDATE job_broadcasts
  SET status = 'assigned', updated_at = now()
  WHERE id = p_broadcast_id;

  -- 2. Mark chosen response
  UPDATE job_broadcast_responses
  SET status = 'chosen'
  WHERE broadcast_id = p_broadcast_id AND contractor_id = p_contractor_id;

  -- 3. Close all other responses
  UPDATE job_broadcast_responses
  SET status = 'closed'
  WHERE broadcast_id = p_broadcast_id
    AND contractor_id != p_contractor_id
    AND status = 'interested';

  -- 4. Create job_order
  INSERT INTO job_orders (
    lead_id, contractor_id, assigned_user_id, broadcast_id,
    deal_type, deal_value, status
  ) VALUES (
    v_broadcast.lead_id,
    v_broadcast.publisher_id,
    p_contractor_id,
    p_broadcast_id,
    v_broadcast.deal_type,
    v_broadcast.deal_value,
    'pending'
  )
  RETURNING id INTO v_job_order_id;

  -- 5. Build result for notifications
  SELECT jsonb_build_object(
    'job_order_id', v_job_order_id,
    'broadcast_id', p_broadcast_id,
    'publisher_id', v_broadcast.publisher_id,
    'chosen_contractor_id', p_contractor_id,
    'lead_id', v_broadcast.lead_id,
    'deal_type', v_broadcast.deal_type,
    'deal_value', v_broadcast.deal_value,
    'closed_contractor_ids', (
      SELECT COALESCE(jsonb_agg(contractor_id), '[]'::jsonb)
      FROM job_broadcast_responses
      WHERE broadcast_id = p_broadcast_id AND status = 'closed'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.choose_contractor_for_broadcast(UUID, UUID) TO authenticated;


-- ============================================================
-- 9. respond_to_broadcast — contractor expresses interest
-- ============================================================
CREATE OR REPLACE FUNCTION public.respond_to_broadcast(p_broadcast_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_broadcast RECORD;
  v_response_id UUID;
BEGIN
  SELECT * INTO v_broadcast
  FROM job_broadcasts
  WHERE id = p_broadcast_id;

  IF v_broadcast IS NULL THEN
    RAISE EXCEPTION 'Broadcast not found';
  END IF;

  IF v_broadcast.status != 'open' THEN
    RAISE EXCEPTION 'Broadcast is no longer accepting responses';
  END IF;

  IF v_broadcast.expires_at < now() THEN
    UPDATE job_broadcasts SET status = 'expired' WHERE id = p_broadcast_id;
    RAISE EXCEPTION 'Broadcast has expired';
  END IF;

  -- Cannot respond to own broadcast
  IF v_broadcast.publisher_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot respond to your own broadcast';
  END IF;

  INSERT INTO job_broadcast_responses (broadcast_id, contractor_id)
  VALUES (p_broadcast_id, auth.uid())
  ON CONFLICT (broadcast_id, contractor_id) DO NOTHING
  RETURNING id INTO v_response_id;

  RETURN v_response_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_broadcast(UUID) TO authenticated;


-- ============================================================
-- 10. handle_invite_registration — auto-link on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_invite_registration(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invite RECORD;
  v_result JSONB := '[]'::jsonb;
BEGIN
  FOR v_invite IN
    SELECT * FROM contractor_invites
    WHERE phone = p_phone AND status = 'pending'
  LOOP
    UPDATE contractor_invites
    SET status = 'registered', invited_user_id = v_user_id
    WHERE id = v_invite.id;

    -- Award points to inviter
    PERFORM award_network_points(v_invite.inviter_id, 'invite_converted', 100, jsonb_build_object(
      'invite_id', v_invite.id,
      'invited_user_id', v_user_id
    ));

    v_result := v_result || jsonb_build_object(
      'invite_id', v_invite.id,
      'inviter_id', v_invite.inviter_id,
      'broadcast_id', v_invite.broadcast_id
    );
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_invite_registration(TEXT) TO authenticated;


-- ============================================================
-- 11. get_broadcast_responses — for publisher dashboard
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_broadcast_responses(p_broadcast_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Validate caller is publisher or admin
  IF NOT EXISTS (
    SELECT 1 FROM job_broadcasts
    WHERE id = p_broadcast_id
      AND (publisher_id = auth.uid() OR public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at)
    FROM (
      SELECT
        jbr.id,
        jbr.contractor_id,
        jbr.status,
        jbr.created_at,
        p.full_name,
        cp.slug,
        cp.headline,
        cp.avg_rating,
        cp.review_count,
        cp.tier,
        cp.insurance_verified,
        cp.license_number,
        c.professions,
        (SELECT calculate_contractor_stats(jbr.contractor_id)) AS stats
      FROM job_broadcast_responses jbr
      JOIN profiles p ON p.id = jbr.contractor_id
      LEFT JOIN contractor_profiles cp ON cp.user_id = jbr.contractor_id
      LEFT JOIN contractors c ON c.user_id = jbr.contractor_id
      WHERE jbr.broadcast_id = p_broadcast_id
    ) r
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_broadcast_responses(UUID) TO authenticated;


-- ============================================================
-- 12. Update evaluate_tiers to count both sides of job_orders
-- ============================================================
-- The existing evaluate_tiers counts job_orders WHERE contractor_id = user.
-- We need to also count WHERE assigned_user_id = user.
-- This is handled by updating calculate_contractor_stats:
CREATE OR REPLACE FUNCTION public.calculate_contractor_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'leads_contacted', COALESCE((SELECT count(*) FROM lead_contact_events WHERE user_id = p_user_id), 0),
    'successful_jobs', COALESCE((SELECT count(*) FROM lead_feedback WHERE user_id = p_user_id AND rating = 'got_job'), 0),
    'feedbacks_given', COALESCE((SELECT count(*) FROM lead_feedback WHERE user_id = p_user_id), 0),
    'groups_active', COALESCE((
      SELECT count(DISTINCT id)
      FROM contractor_group_links
      WHERE user_id = p_user_id AND status = 'joined'
    ), 0),
    'job_orders_total', COALESCE((
      SELECT count(*) FROM job_orders
      WHERE contractor_id = p_user_id OR assigned_user_id = p_user_id
    ), 0),
    'job_orders_completed', COALESCE((
      SELECT count(*) FROM job_orders
      WHERE (contractor_id = p_user_id OR assigned_user_id = p_user_id) AND status = 'completed'
    ), 0),
    'avg_response_mins', (
      SELECT ROUND(EXTRACT(EPOCH FROM avg(responded_at - created_at)) / 60)
      FROM job_orders
      WHERE (contractor_id = p_user_id OR assigned_user_id = p_user_id) AND responded_at IS NOT NULL
    ),
    'member_since', (SELECT created_at FROM profiles WHERE id = p_user_id),
    'network_points', COALESCE((SELECT network_points FROM profiles WHERE id = p_user_id), 0),
    'network_level', COALESCE((SELECT network_level FROM profiles WHERE id = p_user_id), 'member'),
    'available_today', COALESCE((SELECT available_today FROM contractors WHERE user_id = p_user_id), false)
  ) INTO result;

  RETURN result;
END;
$$;

COMMIT;
```

**Step 2: Apply the migration**

Run: `npx supabase db push` or apply via Supabase dashboard.

**Step 3: Verify tables exist**

Run SQL: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'job_broadcast%' OR table_name = 'contractor_invites';`

Expected: 3 rows (job_broadcasts, job_broadcast_responses, contractor_invites)

**Step 4: Verify RPC functions**

Run SQL: `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('choose_contractor_for_broadcast', 'respond_to_broadcast', 'handle_invite_registration', 'get_broadcast_responses');`

Expected: 4 rows

**Step 5: Commit**

```bash
git add supabase/migrations/061_job_broadcast_system.sql
git commit -m "feat: add job broadcast system DB schema — tables, RLS, RPCs"
```

---

## Task 2: WhatsApp Templates — Twilio Content API

**Files:**
- Create: `setup-twilio-broadcast-templates.js`

**Step 1: Write the template setup script**

```javascript
// setup-twilio-broadcast-templates.js
// Creates WhatsApp Content Templates for the broadcast system
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const TEMPLATES = [
  {
    friendly_name: 'le_broadcast_notify',
    language: 'en',
    variables: {
      '1': 'profession_emoji',
      '2': 'profession',
      '3': 'city',
      '4': 'deal_summary',
      '5': 'publisher_name',
    },
    types: {
      'twilio/quick-reply': {
        body: '{{1}} *Job Available: {{2}}*\n━━━━━━━━━━━━━━━\n\n📍 *Location:* {{3}}\n💰 *Terms:* {{4}}\n👤 *From:* {{5}}\n\n⚡ Interested?',
        actions: [
          { title: '✅ Interested', id: 'broadcast_interested' },
          { title: '❌ Pass', id: 'broadcast_pass' },
        ],
      },
    },
  },
  {
    friendly_name: 'le_broadcast_interest',
    language: 'en',
    variables: {
      '1': 'contractor_name',
      '2': 'tier',
      '3': 'rating',
      '4': 'completed_jobs',
      '5': 'profile_url',
    },
    types: {
      'twilio/call-to-action': {
        body: '👋 *{{1}} is interested in your job!*\n\n🏅 {{2}} | ⭐ {{3}} | ✅ {{4}} jobs\n\nCheck their profile and all responses:',
        actions: [
          {
            title: '👤 View Profile',
            type: 'URL',
            url: '{{5}}',
          },
        ],
      },
    },
  },
  {
    friendly_name: 'le_broadcast_chosen',
    language: 'en',
    variables: {
      '1': 'profession',
      '2': 'city',
      '3': 'portal_url',
    },
    types: {
      'twilio/call-to-action': {
        body: '🎉 *You\'ve been selected for a {{1}} job in {{2}}!*\n\nTap below to view details and confirm:',
        actions: [
          {
            title: '📋 View Job Details',
            type: 'URL',
            url: '{{3}}',
          },
        ],
      },
    },
  },
  {
    friendly_name: 'le_broadcast_closed',
    language: 'en',
    variables: {},
    types: {
      'twilio/text': {
        body: 'Thanks for your interest! This job has been assigned to another contractor.\n\nKeep your profile updated to get more opportunities! 💪',
      },
    },
  },
  {
    friendly_name: 'le_contractor_invite',
    language: 'en',
    variables: {
      '1': 'inviter_name',
      '2': 'register_url',
    },
    types: {
      'twilio/call-to-action': {
        body: '👋 *{{1}} wants to send you work on LeadExpress!*\n\nJoin now to see job details and start receiving opportunities:',
        actions: [
          {
            title: '🚀 Register Now',
            type: 'URL',
            url: '{{2}}',
          },
        ],
      },
    },
  },
];

async function createTemplates() {
  for (const tpl of TEMPLATES) {
    console.log(`Creating template: ${tpl.friendly_name}`);
    const res = await fetch(
      `https://content.twilio.com/v1/Content`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
        body: JSON.stringify(tpl),
      }
    );
    const data = await res.json();
    console.log(`  SID: ${data.sid || 'ERROR'}`);
    if (!res.ok) console.log(`  Error:`, JSON.stringify(data));
  }
}

createTemplates();
```

**Step 2: Run the script**

Run: `TWILIO_ACCOUNT_SID=xxx TWILIO_AUTH_TOKEN=xxx node setup-twilio-broadcast-templates.js`

**Step 3: Record the SIDs and commit**

```bash
git add setup-twilio-broadcast-templates.js
git commit -m "feat: add Twilio templates for broadcast system"
```

---

## Task 3: WhatsApp Webhook — Handle Broadcast Buttons

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts`
  - Line ~42: Add new template SIDs to CONTENT object
  - Line ~471: Add broadcast button handlers in handleButtonPayload
  - Line ~2707: Extend publishJob or add new broadcastJob function

**Step 1: Add template SIDs to CONTENT object (~line 42)**

Add after existing SIDs:
```typescript
BROADCAST_NOTIFY:    'HX_______________________',  // fill after running setup script
BROADCAST_INTEREST:  'HX_______________________',
BROADCAST_CHOSEN:    'HX_______________________',
BROADCAST_CLOSED:    'HX_______________________',
CONTRACTOR_INVITE:   'HX_______________________',
```

**Step 2: Add button handlers in handleButtonPayload (~line 471)**

Add new cases:
```typescript
case 'broadcast_interested': {
  // Contractor clicked "Interested" on a broadcast notification
  const { data: ctx } = await supabase
    .from('wa_onboard_state')
    .select('data')
    .eq('phone', phone)
    .eq('step', 'broadcast_pending')
    .maybeSingle();

  if (!ctx?.data) {
    await sendText(phone, 'This broadcast is no longer available.');
    break;
  }

  const broadcastId = (ctx.data as any).broadcastId;
  const profile = await getOrCreateProfile(phone);
  if (!profile) {
    await sendText(phone, 'Please register first to respond to broadcasts.');
    break;
  }

  // Insert response via RPC
  const { error: respErr } = await supabase.rpc('respond_to_broadcast', {
    p_broadcast_id: broadcastId,
  });

  if (respErr) {
    await sendText(phone, respErr.message || 'Could not register your interest.');
    break;
  }

  // Clean up state
  await supabase.from('wa_onboard_state').delete()
    .eq('phone', phone).eq('step', 'broadcast_pending');

  // Get publisher info for notification
  const { data: broadcast } = await supabase
    .from('job_broadcasts')
    .select('publisher_id, leads(profession, city)')
    .eq('id', broadcastId)
    .single();

  if (broadcast) {
    // Get publisher phone
    const { data: publisher } = await supabase
      .from('profiles')
      .select('whatsapp_phone, full_name')
      .eq('id', broadcast.publisher_id)
      .single();

    // Get responding contractor info
    const { data: responder } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', profile.id)
      .single();

    const { data: cp } = await supabase
      .from('contractor_profiles')
      .select('tier, avg_rating, slug')
      .eq('user_id', profile.id)
      .single();

    const stats = await supabase.rpc('calculate_contractor_stats', { p_user_id: profile.id });

    if (publisher?.whatsapp_phone) {
      const profileUrl = `${DOMAIN}/pro/${cp?.slug || profile.id}`;
      await sendButtons(publisher.whatsapp_phone, CONTENT.BROADCAST_INTEREST, {
        '1': responder?.full_name || 'A contractor',
        '2': cp?.tier || 'new',
        '3': String(cp?.avg_rating || '0'),
        '4': String(stats?.data?.job_orders_completed || '0'),
        '5': profileUrl,
      });
    }
  }

  await sendText(phone, '✅ Great! Your interest has been registered. The publisher will review your profile and get back to you.');
  break;
}

case 'broadcast_pass': {
  await supabase.from('wa_onboard_state').delete()
    .eq('phone', phone).eq('step', 'broadcast_pending');
  await sendText(phone, '👍 No problem. We\'ll send you more opportunities soon!');
  break;
}
```

**Step 3: Add broadcastJob function (~after publishJob at line 2707)**

```typescript
async function broadcastJob(broadcastId: string): Promise<void> {
  // 1. Get broadcast details
  const { data: broadcast, error: bErr } = await supabase
    .from('job_broadcasts')
    .select('*, leads(profession, city, zip_code)')
    .eq('id', broadcastId)
    .single();

  if (bErr || !broadcast) {
    console.error('Broadcast not found:', broadcastId);
    return;
  }

  const lead = broadcast.leads as any;
  const profession = lead?.profession || 'general';
  const city = lead?.city || 'your area';
  const zipCode = lead?.zip_code;

  // 2. Get publisher name
  const { data: publisher } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', broadcast.publisher_id)
    .single();

  // 3. Find matching contractors
  let query = supabase
    .from('contractors')
    .select('user_id, profiles(whatsapp_phone, full_name)')
    .eq('is_active', true)
    .contains('professions', [profession]);

  if (zipCode) {
    query = query.contains('zip_codes', [zipCode]);
  }

  const { data: matches } = await query.limit(broadcast.max_recipients);

  if (!matches || matches.length === 0) {
    console.log('No matching contractors for broadcast:', broadcastId);
    return;
  }

  // 4. Filter out the publisher themselves
  const eligible = matches.filter(m => m.user_id !== broadcast.publisher_id);

  // 5. Send WhatsApp to each
  const PROFESSION_EMOJI: Record<string, string> = {
    hvac: '❄️', renovation: '🏗️', fencing: '🏗️', cleaning: '🧹',
    plumbing: '🔧', electrical: '⚡', painting: '🎨', roofing: '🏠',
    landscaping: '🌿', flooring: '🪵', general: '📋',
  };

  const emoji = PROFESSION_EMOJI[profession] || '📋';
  const dealSummary = broadcast.deal_type === 'percentage'
    ? `${broadcast.deal_value}%`
    : broadcast.deal_type === 'fixed_price'
    ? `$${broadcast.deal_value}`
    : broadcast.deal_value;

  let sentCount = 0;

  for (const contractor of eligible) {
    const phone = (contractor.profiles as any)?.whatsapp_phone;
    if (!phone) continue;

    // Store broadcast context for button callback
    await supabase.from('wa_onboard_state').upsert({
      phone: normalizePhone(phone),
      step: 'broadcast_pending',
      data: { broadcastId: broadcast.id },
    }, { onConflict: 'phone,step' });

    await sendButtons(phone, CONTENT.BROADCAST_NOTIFY, {
      '1': emoji,
      '2': profession,
      '3': city,
      '4': dealSummary,
      '5': publisher?.full_name || 'A contractor',
    });

    sentCount++;
  }

  // Update sent count
  await supabase
    .from('job_broadcasts')
    .update({ sent_count: sentCount })
    .eq('id', broadcast.id);
}
```

**Step 4: Commit**

```bash
git add supabase/functions/whatsapp-webhook/index.ts
git commit -m "feat: WhatsApp webhook handlers for broadcast system"
```

---

## Task 4: React Hook — useBroadcasts

**Files:**
- Create: `apps/dashboard/src/hooks/useBroadcasts.ts`

**Step 1: Write the hook**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

interface BroadcastResponse {
  id: string
  contractor_id: string
  status: string
  created_at: string
  full_name: string
  slug: string | null
  headline: string | null
  avg_rating: number
  review_count: number
  tier: string
  insurance_verified: boolean
  license_number: string | null
  professions: string[]
  stats: Record<string, any>
}

interface Broadcast {
  id: string
  lead_id: string
  publisher_id: string
  deal_type: string
  deal_value: string
  description: string | null
  status: string
  max_recipients: number
  sent_count: number
  expires_at: string
  created_at: string
  lead?: {
    profession: string
    city: string | null
    zip_code: string | null
    parsed_summary: string | null
  }
  responses?: BroadcastResponse[]
}

export function useBroadcasts() {
  const { effectiveUserId } = useAuth()
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBroadcasts = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)

    const { data, error } = await supabase
      .from('job_broadcasts')
      .select('*, leads(profession, city, zip_code, parsed_summary)')
      .eq('publisher_id', effectiveUserId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setBroadcasts(data.map(b => ({ ...b, lead: b.leads as any })))
    }
    setLoading(false)
  }, [effectiveUserId])

  useEffect(() => { fetchBroadcasts() }, [fetchBroadcasts])

  const createBroadcast = async (params: {
    lead_id: string
    deal_type: string
    deal_value: string
    description?: string
  }) => {
    const { data, error } = await supabase
      .from('job_broadcasts')
      .insert({
        ...params,
        publisher_id: effectiveUserId!,
      })
      .select()
      .single()

    if (error) throw error
    await fetchBroadcasts()
    return data
  }

  const getResponses = async (broadcastId: string): Promise<BroadcastResponse[]> => {
    const { data, error } = await supabase.rpc('get_broadcast_responses', {
      p_broadcast_id: broadcastId,
    })
    if (error) throw error
    return data || []
  }

  const chooseContractor = async (broadcastId: string, contractorId: string) => {
    const { data, error } = await supabase.rpc('choose_contractor_for_broadcast', {
      p_broadcast_id: broadcastId,
      p_contractor_id: contractorId,
    })
    if (error) throw error
    await fetchBroadcasts()
    return data
  }

  const closeBroadcast = async (broadcastId: string) => {
    const { error } = await supabase
      .from('job_broadcasts')
      .update({ status: 'closed' })
      .eq('id', broadcastId)
      .eq('publisher_id', effectiveUserId!)
    if (error) throw error
    await fetchBroadcasts()
  }

  return {
    broadcasts,
    loading,
    createBroadcast,
    getResponses,
    chooseContractor,
    closeBroadcast,
    refetch: fetchBroadcasts,
  }
}

export function useContractorInvites() {
  const { effectiveUserId } = useAuth()

  const sendInvite = async (params: {
    phone: string
    name: string
    broadcast_id?: string
  }) => {
    // Normalize phone to E.164
    let phone = params.phone.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = '972' + phone.slice(1)
    else if (phone.length === 10) phone = '1' + phone
    if (!phone.startsWith('+')) phone = '+' + phone

    const { data, error } = await supabase
      .from('contractor_invites')
      .insert({
        inviter_id: effectiveUserId!,
        phone,
        name: params.name,
        broadcast_id: params.broadcast_id || null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  return { sendInvite }
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/hooks/useBroadcasts.ts
git commit -m "feat: useBroadcasts and useContractorInvites hooks"
```

---

## Task 5: ForwardLeadModal — Add Broadcast Mode

**Files:**
- Modify: `apps/dashboard/src/components/ForwardLeadModal.tsx`

**Step 1: Rewrite ForwardLeadModal with 3 modes**

The modal needs a toggle between:
1. "Send to registered contractor" (existing flow, but from profiles not subcontractors)
2. "Invite new contractor" (phone + name → invite)
3. "Broadcast to network" (publish to matching contractors)

Full rewrite of ForwardLeadModal.tsx — replace entire file content. Key changes:
- Add `mode` state: 'direct' | 'invite' | 'broadcast'
- For 'direct': query registered contractors from profiles/contractors tables instead of subcontractors
- For 'invite': phone + name input, calls useContractorInvites.sendInvite()
- For 'broadcast': deal terms + description, calls useBroadcasts.createBroadcast()
- Trigger WhatsApp sending via Supabase Edge Function call after broadcast creation

**Step 2: Commit**

```bash
git add apps/dashboard/src/components/ForwardLeadModal.tsx
git commit -m "feat: ForwardLeadModal with broadcast, direct, and invite modes"
```

---

## Task 6: Broadcast Responses Panel

**Files:**
- Create: `apps/dashboard/src/components/BroadcastResponsesPanel.tsx`

**Step 1: Write the responses panel**

A side panel (similar to JobDetailPanel) that shows:
- Broadcast status + sent_count + response count
- List of interested contractors with:
  - Avatar (initials), name, tier badge, star rating
  - Completed jobs count, response time
  - "View Profile" link (opens PublicProfile)
  - "Choose" button
- When "Choose" is clicked → calls chooseContractor → panel updates

**Step 2: Commit**

```bash
git add apps/dashboard/src/components/BroadcastResponsesPanel.tsx
git commit -m "feat: BroadcastResponsesPanel — view and choose from interested contractors"
```

---

## Task 7: JobsDashboard — Add Broadcasts Tab

**Files:**
- Modify: `apps/dashboard/src/pages/JobsDashboard.tsx`

**Step 1: Add broadcasts tab/section**

Add a tab or section to JobsDashboard that shows:
- Active broadcasts with status badges (open/assigned/closed/expired)
- Response count per broadcast
- Click to open BroadcastResponsesPanel
- Integration with existing job_orders list (broadcasts that resulted in job_orders show in both views)

**Step 2: Commit**

```bash
git add apps/dashboard/src/pages/JobsDashboard.tsx
git commit -m "feat: broadcasts tab in JobsDashboard"
```

---

## Task 8: Edge Function — Trigger Broadcast Sends

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts`
  - Or create: `supabase/functions/broadcast-job/index.ts`

**Step 1: Create broadcast trigger**

When a new row is inserted into `job_broadcasts`, trigger WhatsApp sends to matching contractors. Options:
- Database webhook trigger → calls Edge Function
- Or: call from the frontend after creating the broadcast

Recommended: Call the `broadcastJob()` function from within the webhook when receiving a database webhook event, or expose it as a separate Edge Function that the frontend calls after insert.

**Step 2: Commit**

```bash
git add supabase/functions/
git commit -m "feat: broadcast-job Edge Function for WhatsApp distribution"
```

---

## Task 9: Invite Flow — WhatsApp + Registration Link

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts` — add invite send logic
- Modify: Registration flow to call `handle_invite_registration`

**Step 1: Send invite WhatsApp**

After `contractor_invites` insert, send WhatsApp using `le_contractor_invite` template with registration URL.

**Step 2: Hook into registration**

After a new user completes onboarding (has phone number set), call `handle_invite_registration(phone)` to auto-link pending invites and deliver waiting jobs.

**Step 3: Commit**

```bash
git commit -m "feat: contractor invite flow with WhatsApp + auto-link on registration"
```

---

## Task 10: Notify Closed Contractors

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts` or create trigger

**Step 1: After choose_contractor_for_broadcast**

The RPC returns `closed_contractor_ids`. The frontend (or a DB trigger) must send WhatsApp to each using `le_broadcast_closed` template.

**Step 2: Commit**

```bash
git commit -m "feat: WhatsApp notification to closed broadcast respondents"
```

---

## Execution Order

```
Task 1: DB Migration          ← foundation, everything depends on this
Task 2: Twilio Templates      ← needed before webhook changes
Task 3: Webhook Handlers      ← backend logic
Task 4: React Hook            ← frontend data layer
Task 5: ForwardLeadModal      ← main UI entry point
Task 6: Responses Panel       ← publisher picks contractor
Task 7: JobsDashboard         ← broadcasts listing
Task 8: Broadcast Trigger     ← WhatsApp distribution
Task 9: Invite Flow           ← growth engine
Task 10: Close Notifications  ← cleanup
```

Tasks 4-7 can be parallelized (frontend). Tasks 2-3 and 8-10 are sequential (backend).
