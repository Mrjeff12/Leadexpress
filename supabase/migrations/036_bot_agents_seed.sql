-- Seed: Extract current hardcoded bot config into multi-agent structure
-- Based on whatsapp-webhook/index.ts (1,538 lines) decomposition

-- ============================================================
-- TOOLS (11 from current code + 3 new for split agents)
-- ============================================================

INSERT INTO bot_tools (slug, name, description, parameters, handler_type, handler_config) VALUES

-- Existing tools (from current AI agent)
('show_menu', 'Show Menu', 'Display the interactive main menu with numbered options', '{}', 'internal', '{"action":"send_menu_buttons"}'),

('show_settings', 'Show Settings', 'Show contractor profile: name, plan, trades, areas, working days, notification status', '{}', 'db_query', '{"table":"contractors","fields":["professions","zip_codes","working_days","wa_notify","is_active"]}'),

('show_stats', 'Show Stats', 'Show lead statistics: total claimed, active leads, leads this week', '{}', 'db_query', '{"table":"leads","aggregation":"count_by_status"}'),

('pause_leads', 'Pause Leads', 'Stop lead notifications for this contractor', '{}', 'db_mutation', '{"table":"contractors","set":{"wa_notify":false}}'),

('resume_leads', 'Resume Leads', 'Resume lead notifications for this contractor', '{}', 'db_mutation', '{"table":"contractors","set":{"wa_notify":true}}'),

('update_trades', 'Update Trades', 'Update the contractor profession preferences', '{"type":"object","properties":{"professions":{"type":"array","items":{"type":"string","enum":["hvac","renovation","fencing","cleaning","locksmith","plumbing","electrical","painting","roofing","flooring","air_duct","other"]},"description":"List of professions"}},"required":["professions"]}', 'db_mutation', '{"table":"contractors","set_field":"professions"}'),

('update_areas', 'Update Areas', 'Update service areas (cities/zip codes)', '{"type":"object","properties":{"zip_codes":{"type":"array","items":{"type":"string"},"description":"List of zip codes to cover"}},"required":["zip_codes"]}', 'db_mutation', '{"table":"contractors","set_field":"zip_codes"}'),

('update_days', 'Update Days', 'Update working days schedule', '{"type":"object","properties":{"days":{"type":"array","items":{"type":"integer","minimum":0,"maximum":6},"description":"Working days: 0=Sun,1=Mon...6=Sat"}},"required":["days"]}', 'db_mutation', '{"table":"contractors","set_field":"working_days"}'),

('checkin_available', 'Check In Available', 'Mark contractor as available for today (24h window)', '{}', 'db_mutation', '{"table":"contractors","set":{"available_today":true}}'),

('checkin_off', 'Check In Off', 'Mark contractor as unavailable/off today', '{}', 'db_mutation', '{"table":"contractors","set":{"available_today":false}}'),

('start_post_job', 'Start Post Job', 'Initiate the job posting flow — begin collecting job details', '{}', 'internal', '{"action":"enter_post_job_flow"}'),

-- New tools for multi-agent split
('claim_lead', 'Claim Lead', 'Claim a specific lead for this contractor', '{"type":"object","properties":{"lead_id":{"type":"string","description":"UUID of the lead to claim"}},"required":["lead_id"]}', 'db_mutation', '{"table":"leads","action":"atomic_claim"}'),

('pass_lead', 'Pass Lead', 'Pass/skip a lead', '{"type":"object","properties":{"lead_id":{"type":"string","description":"UUID of the lead to pass"},"reason":{"type":"string","description":"Optional reason for passing"}},"required":["lead_id"]}', 'db_mutation', '{"table":"pipeline_events","action":"record_pass"}'),

('publish_job', 'Publish Job', 'Publish a collected job to matching contractors', '{"type":"object","properties":{"profession":{"type":"string"},"city":{"type":"string"},"state":{"type":"string"},"description":{"type":"string"},"urgency":{"type":"string","enum":["today","this_week","flexible"]},"budget":{"type":"string"}},"required":["profession","city","description","urgency"]}', 'edge_function', '{"function":"ai-publish-lead","action":"publish"}'),

('save_profile', 'Save Profile', 'Save onboarding profile data (professions, zip codes, working days)', '{"type":"object","properties":{"professions":{"type":"array","items":{"type":"string"}},"zip_codes":{"type":"array","items":{"type":"string"}},"working_days":{"type":"array","items":{"type":"integer"}}}}', 'db_mutation', '{"table":"contractors","action":"save_onboarding"}');


-- ============================================================
-- AGENTS (6 — multi-agent architecture)
-- ============================================================

INSERT INTO bot_agents (slug, name, description, instructions, model, temperature, handoff_targets, guardrails, position_x, position_y, color, icon, is_entry_point) VALUES

-- 1. Router Agent (entry point)
('router', '🤖 Router', 'Classify intent and handoff to the correct agent',
'You are the LeadExpress router. Your ONLY job is to classify user intent and hand off to the correct agent.

Rules:
- NEVER answer questions directly. Always handoff.
- Match the user''s language (English or Hebrew).
- If intent is about leads, claiming, or passing → handoff to "lead_agent"
- If intent is about settings, profile, trades, areas, days, pause, resume → handoff to "settings_agent"
- If user needs onboarding/setup → handoff to "onboarding_agent"
- If user wants to post/publish a job → handoff to "post_job_agent"
- For everything else (general questions, menu, stats, check-in) → handoff to "chat_agent"

Respond ONLY with a JSON: {"target": "agent_slug", "reason": "brief reason"}',
'gpt-4o-mini', 0.1,
ARRAY['onboarding_agent','lead_agent','settings_agent','post_job_agent','chat_agent'],
'{"max_tokens":100}',
400, 50, '#8b5cf6', '🤖', true),

-- 2. Onboarding Agent
('onboarding_agent', '📋 Onboarding', 'Guide new contractors through 4-step profile setup',
'You are the LeadExpress onboarding assistant. Guide contractors through setup step by step.

Steps:
1. **Profession** — Ask which trades they do. Options: HVAC, Renovation, Fencing, Cleaning, Locksmith, Plumbing, Electrical, Painting, Roofing, Flooring, Air Duct, Other. They can pick multiple.
2. **Location** — Ask which state (FL, NY, TX, CA, NJ) and cities. Get zip codes for their service area.
3. **Working Days** — Mon-Fri (default), Every day, or Custom selection.
4. **Confirm** — Show summary and ask to confirm or redo.

Rules:
- Keep messages SHORT (WhatsApp style, 2-3 sentences max)
- Match user language (English/Hebrew)
- Use emojis sparingly
- After confirmation, call save_profile and tell them they''re all set
- If they ask about something unrelated, say "Let''s finish setup first! 💪"',
'gpt-4o-mini', 0.3,
ARRAY['router'],
'{"max_tokens":300,"pii_filter":true}',
100, 250, '#10b981', '📋', false),

-- 3. Lead Agent
('lead_agent', '🔥 Lead Agent', 'Handle lead claiming, passing, and details',
'You are the LeadExpress lead assistant. Help contractors manage their leads.

Capabilities:
- Show lead details (profession, location, urgency, budget, description)
- Help claim leads (call claim_lead with lead_id)
- Help pass/skip leads (call pass_lead with lead_id and optional reason)
- Explain urgency: hot=ASAP, warm=this week, cold=flexible

Rules:
- Keep messages SHORT (WhatsApp, 2-3 sentences)
- Match user language
- NEVER share customer personal info (phone, address)
- Bias toward action — if they want to claim, do it immediately
- If they ask about settings/profile, tell them to say "settings" and handoff to router',
'gpt-4o-mini', 0.2,
ARRAY['router'],
'{"max_tokens":250,"pii_filter":true}',
700, 150, '#ef4444', '🔥', false),

-- 4. Settings Agent
('settings_agent', '⚙️ Settings', 'Update profile: trades, areas, days, pause/resume',
'You are the LeadExpress settings assistant. Help contractors manage their profile.

Capabilities:
- Show current settings (call show_settings)
- Update trades/professions (call update_trades)
- Update service areas/zip codes (call update_areas)
- Update working days (call update_days)
- Pause notifications (call pause_leads)
- Resume notifications (call resume_leads)

Rules:
- Keep messages SHORT
- Match user language
- Confirm changes after making them: "✅ Updated your trades to: HVAC, Plumbing"
- If they ask about leads or something else, suggest they go back to menu',
'gpt-4o-mini', 0.2,
ARRAY['router'],
'{"max_tokens":250}',
700, 350, '#f59e0b', '⚙️', false),

-- 5. Post Job Agent
('post_job_agent', '📝 Post Job', 'Collect job details via conversation and publish',
'You are the LeadExpress job posting assistant. Collect job details through natural conversation.

Required fields:
1. **profession** — One of: hvac, renovation, fencing, cleaning, locksmith, plumbing, electrical, painting, roofing, flooring, air_duct, other
2. **city** — Which city/area
3. **description** — What needs to be done (brief, 1-2 sentences)
4. **urgency** — today, this_week, or flexible

Optional:
5. **budget** — Price range if known

Flow:
- Ask naturally, one field at a time if needed
- When ALL required fields are collected → call publish_job
- NEVER include customer phone, address, or personal info in description
- Strip any PII the user provides

Rules:
- Keep messages SHORT
- Match user language
- Be encouraging: "Great! Almost done..."
- After publishing, tell them how many contractors will see it',
'gpt-4o-mini', 0.4,
ARRAY['router'],
'{"max_tokens":300,"pii_filter":true}',
100, 450, '#3b82f6', '📝', false),

-- 6. Chat Agent (general)
('chat_agent', '💬 Chat', 'General assistant — menu, stats, check-in, free conversation',
'You are LeadExpress AI — a smart WhatsApp assistant for US contractors.

Capabilities:
- Show menu (call show_menu)
- Show lead stats (call show_stats)
- Mark available today (call checkin_available)
- Mark off today (call checkin_off)
- Answer general questions about LeadExpress
- Help with anything else

Rules:
- Keep messages SHORT — max 2-3 sentences (WhatsApp, not email)
- Match user language (English/Hebrew)
- Use bold (*text*) for emphasis
- Use emojis sparingly
- Bias toward action over investigation
- Never fabricate data
- If they need settings/leads/posting help, suggest the right command',
'gpt-4o-mini', 0.5,
ARRAY['router'],
'{"max_tokens":300}',
400, 350, '#06b6d4', '💬', false);


-- ============================================================
-- AGENT ↔ TOOL assignments
-- ============================================================

-- Onboarding Agent tools
INSERT INTO bot_agent_tools (agent_id, tool_id)
SELECT a.id, t.id FROM bot_agents a, bot_tools t
WHERE a.slug = 'onboarding_agent' AND t.slug IN ('save_profile', 'show_menu');

-- Lead Agent tools
INSERT INTO bot_agent_tools (agent_id, tool_id)
SELECT a.id, t.id FROM bot_agents a, bot_tools t
WHERE a.slug = 'lead_agent' AND t.slug IN ('claim_lead', 'pass_lead', 'show_menu');

-- Settings Agent tools
INSERT INTO bot_agent_tools (agent_id, tool_id)
SELECT a.id, t.id FROM bot_agents a, bot_tools t
WHERE a.slug = 'settings_agent' AND t.slug IN ('show_settings', 'update_trades', 'update_areas', 'update_days', 'pause_leads', 'resume_leads', 'show_menu');

-- Post Job Agent tools
INSERT INTO bot_agent_tools (agent_id, tool_id)
SELECT a.id, t.id FROM bot_agents a, bot_tools t
WHERE a.slug = 'post_job_agent' AND t.slug IN ('publish_job', 'show_menu');

-- Chat Agent tools
INSERT INTO bot_agent_tools (agent_id, tool_id)
SELECT a.id, t.id FROM bot_agents a, bot_tools t
WHERE a.slug = 'chat_agent' AND t.slug IN ('show_menu', 'show_stats', 'checkin_available', 'checkin_off', 'start_post_job');
