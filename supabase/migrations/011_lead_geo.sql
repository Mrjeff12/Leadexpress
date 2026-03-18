-- Add geographic columns to leads for map display
-- state: US state abbreviation (e.g. 'FL', 'TX')
-- latitude/longitude: approximate coordinates (state-level precision)

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Index for geographic queries
CREATE INDEX IF NOT EXISTS idx_leads_state ON leads (state) WHERE state IS NOT NULL;

-- Update the AI parser prompt instruction: state is now extracted by the parser.
-- The parser will also populate lat/lng using a ZIP3 → state → coordinates lookup.

COMMENT ON COLUMN leads.state IS 'US state abbreviation, e.g. FL, TX. Populated by parser from ZIP or AI extraction.';
COMMENT ON COLUMN leads.latitude IS 'Approximate latitude (state-center precision). For map display.';
COMMENT ON COLUMN leads.longitude IS 'Approximate longitude (state-center precision). For map display.';
