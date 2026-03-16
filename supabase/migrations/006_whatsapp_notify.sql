-- 006: WhatsApp Business API notification support
-- Adds availability tracking for the daily check-in flow

-- Add WhatsApp notification fields to contractors
ALTER TABLE contractors
  ADD COLUMN wa_notify boolean NOT NULL DEFAULT false,
  ADD COLUMN wa_phone_id text,
  ADD COLUMN available_today boolean NOT NULL DEFAULT false,
  ADD COLUMN wa_window_until timestamptz;

-- Add WhatsApp phone to profiles (contractor's WhatsApp number for receiving leads)
ALTER TABLE profiles
  ADD COLUMN whatsapp_phone text;

-- Index for quick lookup of available contractors
CREATE INDEX idx_contractors_available
  ON contractors (available_today)
  WHERE available_today = true AND wa_notify = true;

-- Queue name constant for WhatsApp notifications
INSERT INTO pipeline_events (stage, detail)
VALUES ('migration', '{"version": "006", "description": "WhatsApp notify support"}'::jsonb);
