-- 065: Lead notifications dedup — prevents double-send from competing systems
CREATE TABLE IF NOT EXISTS public.lead_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel       text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'telegram')),
  sent_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id, contractor_id)
);

ALTER TABLE public.lead_notifications ENABLE ROW LEVEL SECURITY;

-- Service role only (workers use service key)
CREATE POLICY "service_role_only" ON public.lead_notifications
  USING (auth.role() = 'service_role');

-- Index for fast lookups by lead
CREATE INDEX idx_lead_notifications_lead ON public.lead_notifications(lead_id);
