-- 080: GIN index on matched_contractors, sender_name column, notification delivery tracking

-- GIN index for fast JSONB/array lookups on matched_contractors
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_matched_gin
  ON leads USING GIN (matched_contractors);

-- Store the sender display name directly on the lead
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sender_name text;

-- Notification delivery tracking columns
ALTER TABLE lead_notifications ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE lead_notifications ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending';

-- Update the unique constraint to allow multiple channels per contractor per lead
-- (the existing UNIQUE(lead_id, contractor_id) stays — push notifications share a row
--  with the primary channel, so upsert with ignoreDuplicates handles it)

-- Allow 'push' as a valid channel value
ALTER TABLE lead_notifications DROP CONSTRAINT IF EXISTS lead_notifications_channel_check;
ALTER TABLE lead_notifications ADD CONSTRAINT lead_notifications_channel_check
  CHECK (channel IN ('whatsapp', 'telegram', 'push'));
