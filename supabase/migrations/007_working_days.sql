-- 007: Add working_days to contractors for WhatsApp bot scheduling
-- 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS working_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}';

COMMENT ON COLUMN contractors.working_days IS 'Days contractor works (0=Sun..6=Sat). Check-in only sent on these days.';
