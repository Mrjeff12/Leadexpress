-- ============================================================================
-- Migration 087: Remove Telegram and SMS notification channels
-- ============================================================================
-- Telegram and SMS are no longer used. Only WhatsApp + Push remain.
-- ============================================================================

-- Remove Telegram cron job
SELECT cron.unschedule('notify-telegram');

-- Drain any pending Telegram/SMS jobs
UPDATE job_queue SET status = 'dead', error = 'channel_removed'
WHERE queue IN ('notify_telegram', 'notify_sms') AND status IN ('pending', 'claimed');
