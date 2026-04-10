-- ============================================================
-- 105: DM campaign stats RPC + cron for sending & follow-ups
-- ============================================================

-- ─── Stats update helper ───
CREATE OR REPLACE FUNCTION public.update_dm_campaign_stats(p_campaign_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE dm_campaigns SET
    total_sent = (SELECT count(*) FROM dm_outreach WHERE campaign_id = p_campaign_id AND status NOT IN ('queued', 'failed')),
    total_replied = (SELECT count(*) FROM dm_outreach WHERE campaign_id = p_campaign_id AND status IN ('replied', 'interested', 'not_interested', 'registered')),
    total_registered = (SELECT count(*) FROM dm_outreach WHERE campaign_id = p_campaign_id AND status = 'registered'),
    updated_at = now()
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_dm_campaign_stats(UUID) TO authenticated;

-- ─── Cron: send queued DMs every 5 minutes ───
SELECT cron.schedule(
  'send-dm-batch',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-dm',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'campaign_id', c.id,
      'limit', 10
    )
  )
  FROM dm_campaigns c
  WHERE c.status = 'active';
  $$
);

-- ─── Cron: process follow-ups every 15 minutes ───
SELECT cron.schedule(
  'dm-follow-ups',
  '*/15 * * * *',
  $$
  UPDATE dm_outreach
  SET status = 'queued',
      follow_up_count = follow_up_count + 1,
      last_follow_up_at = now(),
      next_follow_up_at = NULL
  WHERE status = 'sent'
    AND next_follow_up_at IS NOT NULL
    AND next_follow_up_at <= now()
    AND follow_up_count < (
      SELECT COALESCE(max_follow_ups, 1)
      FROM dm_campaigns
      WHERE id = campaign_id
    );
  $$
);
