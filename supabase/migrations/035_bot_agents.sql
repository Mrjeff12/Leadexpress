-- Bot Mission Control: Multi-Agent Architecture
-- Agents, tools, and their relationships stored in DB for live editing

-- ============================================================
-- bot_tools: each tool the bot can call
-- ============================================================
CREATE TABLE bot_tools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  parameters  jsonb NOT NULL DEFAULT '{}',
  handler_type text NOT NULL DEFAULT 'internal'
    CHECK (handler_type IN ('internal','db_query','db_mutation','api_call','edge_function')),
  handler_config jsonb NOT NULL DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- bot_agents: each agent with instructions, model, guardrails
-- ============================================================
CREATE TABLE bot_agents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  description     text NOT NULL DEFAULT '',
  instructions    text NOT NULL DEFAULT '',
  model           text NOT NULL DEFAULT 'gpt-4o-mini',
  temperature     float NOT NULL DEFAULT 0.3,
  handoff_targets text[] NOT NULL DEFAULT '{}',
  guardrails      jsonb NOT NULL DEFAULT '{"max_tokens":300,"pii_filter":true}',
  position_x      float NOT NULL DEFAULT 0,
  position_y      float NOT NULL DEFAULT 0,
  color           text NOT NULL DEFAULT '#6366f1',
  icon            text NOT NULL DEFAULT '🤖',
  is_entry_point  boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- bot_agent_tools: junction (which tools belong to which agent)
-- ============================================================
CREATE TABLE bot_agent_tools (
  agent_id uuid NOT NULL REFERENCES bot_agents(id) ON DELETE CASCADE,
  tool_id  uuid NOT NULL REFERENCES bot_tools(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, tool_id)
);

-- ============================================================
-- Extend wa_agent_sessions for multi-agent tracking
-- ============================================================
ALTER TABLE wa_agent_sessions
  ADD COLUMN IF NOT EXISTS current_agent_slug text DEFAULT 'router',
  ADD COLUMN IF NOT EXISTS handoff_history jsonb DEFAULT '[]';

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_bot_agents_active ON bot_agents(is_active) WHERE is_active = true;
CREATE INDEX idx_bot_tools_active ON bot_tools(is_active) WHERE is_active = true;
CREATE INDEX idx_bot_agent_tools_agent ON bot_agent_tools(agent_id);
CREATE INDEX idx_bot_agent_tools_tool ON bot_agent_tools(tool_id);

-- ============================================================
-- Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_bot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bot_agents_updated_at
  BEFORE UPDATE ON bot_agents
  FOR EACH ROW EXECUTE FUNCTION update_bot_updated_at();

CREATE TRIGGER bot_tools_updated_at
  BEFORE UPDATE ON bot_tools
  FOR EACH ROW EXECUTE FUNCTION update_bot_updated_at();

-- ============================================================
-- RLS: admin-only access
-- ============================================================
ALTER TABLE bot_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_agent_tools ENABLE ROW LEVEL SECURITY;

-- Admin read/write
CREATE POLICY "admin_bot_agents" ON bot_agents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_bot_tools" ON bot_tools
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_bot_agent_tools" ON bot_agent_tools
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role (Edge Functions) can read
CREATE POLICY "service_read_bot_agents" ON bot_agents
  FOR SELECT USING (true);

CREATE POLICY "service_read_bot_tools" ON bot_tools
  FOR SELECT USING (true);

CREATE POLICY "service_read_bot_agent_tools" ON bot_agent_tools
  FOR SELECT USING (true);
