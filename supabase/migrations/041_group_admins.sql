-- ============================================================
-- Lead Express — Group Admin Tracking
-- Track WhatsApp group admins for partner outreach program
-- ============================================================

-- Add known_admins counter to groups (mirrors known_sellers, known_buyers)
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS known_admins INTEGER DEFAULT 0;

-- RPC: Sync admin counts for all groups from group_members classification
CREATE OR REPLACE FUNCTION public.sync_group_admin_counts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.groups g
  SET known_admins = COALESCE(sub.cnt, 0)
  FROM (
    SELECT group_id, COUNT(*) AS cnt
    FROM public.group_members
    WHERE classification = 'admin'
    GROUP BY group_id
  ) sub
  WHERE g.id = sub.group_id;
$$;

-- RPC: Get all group admins with their group info (for War Room)
CREATE OR REPLACE FUNCTION public.get_group_admins()
RETURNS TABLE (
  member_id       UUID,
  wa_sender_id    TEXT,
  display_name    TEXT,
  contact_name    TEXT,
  total_messages  INTEGER,
  last_seen_at    TIMESTAMPTZ,
  group_id        UUID,
  group_name      TEXT,
  group_category  TEXT,
  group_status    TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    gm.id AS member_id,
    gm.wa_sender_id,
    gm.display_name,
    gm.contact_name,
    gm.total_messages,
    gm.last_seen_at,
    g.id AS group_id,
    g.name AS group_name,
    g.category AS group_category,
    g.status AS group_status
  FROM public.group_members gm
  JOIN public.groups g ON g.id = gm.group_id
  WHERE gm.classification = 'admin'
  ORDER BY gm.last_seen_at DESC NULLS LAST;
$$;
