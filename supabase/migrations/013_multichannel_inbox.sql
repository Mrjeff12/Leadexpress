-- Add channel to prospect_messages to support Twilio vs Green API
ALTER TABLE prospect_messages
ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'green_api' 
CHECK (channel IN ('green_api', 'twilio', 'system'));

-- Add system event type to messages to allow inline system messages in the chat timeline
-- (Though we also have prospect_events, sometimes it's easier to query a unified timeline)

-- Allow wa_account_id to be null if it's a twilio message (since twilio isn't in wa_accounts table currently)
ALTER TABLE prospect_messages
ALTER COLUMN wa_account_id DROP NOT NULL;

-- Add template_id if it was sent via a template
ALTER TABLE prospect_messages
ADD COLUMN IF NOT EXISTS template_id TEXT;
