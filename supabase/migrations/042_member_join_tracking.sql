-- ============================================================
-- Lead Express — Member Join/Leave Tracking
-- Track when members join and leave WhatsApp groups
-- ============================================================

ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS joined_group_at TIMESTAMPTZ;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS left_group_at TIMESTAMPTZ;

-- Backfill: existing members get their created_at as join date
UPDATE public.group_members SET joined_group_at = created_at WHERE joined_group_at IS NULL;

-- Index for finding recent joins
CREATE INDEX IF NOT EXISTS idx_gm_joined ON public.group_members(joined_group_at DESC) WHERE joined_group_at IS NOT NULL;
