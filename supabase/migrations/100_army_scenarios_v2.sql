-- ══════════════════════════════════════════════════
-- 100 — Army Scenarios V2 (variations, placeholders, cooldown)
-- ══════════════════════════════════════════════════

-- Add cooldown (days before same scenario can repeat in same group)
ALTER TABLE army_scenarios
  ADD COLUMN IF NOT EXISTS cooldown_days integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS placeholders jsonb NOT NULL DEFAULT '[]';

-- Add group_name to runs for display
ALTER TABLE army_scenario_runs
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS lines_used jsonb; -- actual texts chosen (after variation + placeholder fill)
