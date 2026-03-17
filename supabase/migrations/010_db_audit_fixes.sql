-- Migration 010: Database Audit Fixes
-- Fixes constraints, adds indexes, creates professions table, tightens RLS

BEGIN;

-- ============================================================
-- 1. Expand leads.profession CHECK constraint
-- ============================================================
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_profession_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_profession_check CHECK (
  profession IN (
    'hvac','air_duct','chimney','dryer_vent','garage_door','locksmith','roofing',
    'plumbing','electrical','painting','cleaning','carpet_cleaning',
    'renovation','fencing','landscaping','tiling','kitchen','bathroom','pool',
    'moving','other'
  )
);

-- ============================================================
-- 2. Expand groups.category CHECK constraint (allow NULL too)
-- ============================================================
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_category_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_category_check CHECK (
  category IS NULL OR category IN (
    'hvac','air_duct','chimney','dryer_vent','garage_door','locksmith','roofing',
    'plumbing','electrical','painting','cleaning','carpet_cleaning',
    'renovation','fencing','landscaping','tiling','kitchen','bathroom','pool',
    'moving','other'
  )
);

-- ============================================================
-- 3. Add 'claimed' to leads.status CHECK
-- ============================================================
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check CHECK (
  status IN ('new','parsed','sent','expired','claimed')
);

-- ============================================================
-- 4. Add working_hours column to contractors
-- ============================================================
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS working_hours JSONB NOT NULL DEFAULT '{
  "mon": {"start": "09:00", "end": "18:00", "enabled": true},
  "tue": {"start": "09:00", "end": "18:00", "enabled": true},
  "wed": {"start": "09:00", "end": "18:00", "enabled": true},
  "thu": {"start": "09:00", "end": "18:00", "enabled": true},
  "fri": {"start": "09:00", "end": "18:00", "enabled": true},
  "sat": {"start": "09:00", "end": "18:00", "enabled": false},
  "sun": {"start": "09:00", "end": "18:00", "enabled": false}
}'::jsonb;

-- ============================================================
-- 5. Add GIN indexes on contractors arrays
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contractors_professions ON public.contractors USING GIN(professions);
CREATE INDEX IF NOT EXISTS idx_contractors_zip_codes   ON public.contractors USING GIN(zip_codes);

-- ============================================================
-- 6. Add partial unique index on leads.content_hash
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_content_hash_unique
  ON public.leads(content_hash) WHERE content_hash IS NOT NULL;

-- ============================================================
-- 7. Remove redundant idx_groups_wa index
--    (wa_group_id UNIQUE constraint already creates an implicit index)
-- ============================================================
DROP INDEX IF EXISTS idx_groups_wa;

-- ============================================================
-- 8. Add 'migration' to pipeline_events.stage CHECK
-- ============================================================
ALTER TABLE public.pipeline_events DROP CONSTRAINT IF EXISTS pipeline_events_stage_check;
ALTER TABLE public.pipeline_events ADD CONSTRAINT pipeline_events_stage_check CHECK (
  stage IN (
    'received','quick_filtered','sender_filtered','pattern_matched',
    'ai_parsing','ai_parsed','no_lead','lead_created',
    'matched','sent','claimed','expired',
    'migration'
  )
);

-- ============================================================
-- 9. Create professions table for admin management
-- ============================================================
CREATE TABLE IF NOT EXISTS public.professions (
  id          TEXT PRIMARY KEY,
  name_en     TEXT NOT NULL,
  name_he     TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '🔧',
  color       TEXT NOT NULL DEFAULT 'hsl(205 85% 52%)',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.professions ENABLE ROW LEVEL SECURITY;

-- Anyone can read professions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'professions' AND policyname = 'professions_read'
  ) THEN
    CREATE POLICY professions_read ON public.professions FOR SELECT USING (true);
  END IF;
END $$;

-- Only admins can manage professions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'professions' AND policyname = 'professions_admin'
  ) THEN
    CREATE POLICY professions_admin ON public.professions FOR ALL USING (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );
  END IF;
END $$;

-- Seed the 20 professions
INSERT INTO public.professions (id, name_en, name_he, emoji, color, is_active, sort_order) VALUES
  ('hvac',            'HVAC',            'מזגנים',          '❄️',  'hsl(205 85% 52%)', true, 1),
  ('air_duct',        'Air Duct',        'תעלות אוויר',    '💨', 'hsl(200 70% 50%)', true, 2),
  ('chimney',         'Chimney',         'ארובות',          '🏠', 'hsl(20 60% 45%)',  true, 3),
  ('dryer_vent',      'Dryer Vent',      'פתח מייבש',       '🌀', 'hsl(280 50% 55%)', true, 4),
  ('garage_door',     'Garage Door',     'דלת מוסך',        '🚪', 'hsl(30 70% 50%)',  true, 5),
  ('locksmith',       'Locksmith',       'מנעולן',          '🔑', 'hsl(35 80% 45%)',  true, 6),
  ('roofing',         'Roofing',         'גגות',            '🏗️', 'hsl(15 65% 50%)',  true, 7),
  ('plumbing',        'Plumbing',        'אינסטלציה',       '🔧', 'hsl(190 70% 45%)', true, 8),
  ('electrical',      'Electrical',      'חשמל',            '⚡', 'hsl(45 90% 50%)',  true, 9),
  ('painting',        'Painting',        'צביעה',           '🎨', 'hsl(340 75% 55%)', true, 10),
  ('cleaning',        'Cleaning',        'ניקיון',          '🧹', 'hsl(160 50% 48%)', true, 11),
  ('carpet_cleaning', 'Carpet Cleaning', 'ניקוי שטיחים',   '🧼', 'hsl(170 55% 45%)', true, 12),
  ('renovation',      'Renovation',      'שיפוצים',         '🔨', 'hsl(28 90% 56%)',  true, 13),
  ('fencing',         'Fencing',         'גדרות',           '🏗️', 'hsl(262 68% 56%)', true, 14),
  ('landscaping',     'Landscaping',     'גינון',           '🌿', 'hsl(140 50% 40%)', true, 15),
  ('tiling',          'Tiling',          'ריצוף',           '🔲', 'hsl(210 40% 55%)', true, 16),
  ('kitchen',         'Kitchen',         'מטבחים',          '🍳', 'hsl(50 70% 50%)',  true, 17),
  ('bathroom',        'Bathroom',        'חדרי אמבטיה',    '🚿', 'hsl(195 65% 50%)', true, 18),
  ('pool',            'Pool',            'בריכות',          '🏊', 'hsl(200 80% 55%)', true, 19),
  ('moving',          'Moving',          'הובלות',          '📦', 'hsl(25 60% 50%)',  true, 20)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 10. Restrict RLS on leads
--     Contractors should only see leads matching their profession + zip
-- ============================================================
DROP POLICY IF EXISTS leads_read ON public.leads;

CREATE POLICY leads_read ON public.leads FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  OR EXISTS (
    SELECT 1 FROM public.contractors c
    WHERE c.user_id = auth.uid()
      AND c.is_active = true
      AND leads.profession = ANY(c.professions)
      AND leads.zip_code  = ANY(c.zip_codes)
  )
);

COMMIT;
