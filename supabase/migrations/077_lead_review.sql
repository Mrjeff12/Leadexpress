-- Lead Quality Review system
-- Adds review workflow columns to the leads table

ALTER TABLE leads ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending'
  CHECK (review_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE leads ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS idx_leads_review_status ON leads(review_status);
CREATE INDEX IF NOT EXISTS idx_leads_reviewed_at ON leads(reviewed_at DESC) WHERE reviewed_at IS NOT NULL;
