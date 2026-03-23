-- ============================================================
-- Lead Express — Member Profile Enrichment
-- Store WhatsApp profile data: avatar, name, about/status
-- ============================================================

ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS profile_name TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS about TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ;
