-- ============================================================
-- Lead Express — Development Seed Data
-- ============================================================

-- 1. Create auth users
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@leadexpress.com', '{"full_name": "Jeff (Admin)"}'),
  ('c0000000-0000-0000-0000-000000000001', 'contractor@leadexpress.com', '{"full_name": "Carlos Mendez"}'),
  ('c0000000-0000-0000-0000-000000000002', 'mike@leadexpress.com', '{"full_name": "Mike O''Brien"}'),
  ('c0000000-0000-0000-0000-000000000003', 'sarah@leadexpress.com', '{"full_name": "Sarah Cohen"}');

-- 2. Create profiles (the trigger would do this in Supabase, but locally we insert manually)
INSERT INTO public.profiles (id, role, full_name, phone, telegram_chat_id, preferred_locale) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin', 'Jeff (Admin)', '+1-305-555-0100', 1799297275, 'en'),
  ('c0000000-0000-0000-0000-000000000001', 'contractor', 'Carlos Mendez', '+1-305-555-0101', NULL, 'en'),
  ('c0000000-0000-0000-0000-000000000002', 'contractor', 'Mike O''Brien', '+1-305-555-0102', NULL, 'en'),
  ('c0000000-0000-0000-0000-000000000003', 'contractor', 'Sarah Cohen', '+1-305-555-0103', NULL, 'he');

-- 3. Contractors with professions and zip codes
INSERT INTO public.contractors (user_id, professions, zip_codes) VALUES
  ('c0000000-0000-0000-0000-000000000001', '{hvac,renovation}', '{33125,33130,33133,33135}'),
  ('c0000000-0000-0000-0000-000000000002', '{fencing,renovation}', '{33301,33304,33311,33316}'),
  ('c0000000-0000-0000-0000-000000000003', '{cleaning}', '{33125,33130,33301}');

-- 4. Subscriptions
INSERT INTO public.subscriptions (user_id, plan_id, status) VALUES
  ('c0000000-0000-0000-0000-000000000001', (SELECT id FROM public.plans WHERE slug = 'pro'), 'active'),
  ('c0000000-0000-0000-0000-000000000002', (SELECT id FROM public.plans WHERE slug = 'starter'), 'active'),
  ('c0000000-0000-0000-0000-000000000003', (SELECT id FROM public.plans WHERE slug = 'unlimited'), 'active');

-- 5. WhatsApp groups
INSERT INTO public.groups (wa_group_id, name, category, status, message_count, last_message_at) VALUES
  ('120363001234567890@g.us', 'Miami Home Services 🏠', 'hvac', 'active', 342, now() - interval '10 minutes'),
  ('120363009876543210@g.us', 'South FL Contractors', 'renovation', 'active', 189, now() - interval '30 minutes'),
  ('120363005555555555@g.us', 'Broward Handyman Network', 'fencing', 'active', 94, now() - interval '2 hours'),
  ('120363007777777777@g.us', 'Palm Beach Renovations', 'renovation', 'paused', 67, now() - interval '1 day');

-- 6. Sample leads
INSERT INTO public.leads (group_id, wa_message_id, raw_message, profession, zip_code, city, urgency, parsed_summary, status, sent_to_count, created_at) VALUES
  (
    (SELECT id FROM public.groups WHERE name = 'Miami Home Services 🏠'),
    'wa_msg_001', 'AC unit stopped working, house is 90°F, need someone ASAP. Call Maria 305-555-0147',
    'hvac', '33125', 'Miami', 'hot',
    'AC unit not working, 90°F inside, needs immediate repair',
    'sent', 2, now() - interval '15 minutes'
  ),
  (
    (SELECT id FROM public.groups WHERE name = 'South FL Contractors'),
    'wa_msg_002', 'Looking for someone to renovate my kitchen. Budget around 15k-20k. Not urgent, probably next month.',
    'renovation', '33130', 'Miami', 'cold',
    'Kitchen renovation, $15k-$20k budget, flexible timeline',
    'sent', 3, now() - interval '2 hours'
  ),
  (
    (SELECT id FROM public.groups WHERE name = 'Broward Handyman Network'),
    'wa_msg_003', 'Need a new fence installed, 200ft backyard, vinyl preferred. Can someone come this week?',
    'fencing', '33301', 'Fort Lauderdale', 'warm',
    'Vinyl fence installation, 200ft backyard, available this week',
    'sent', 1, now() - interval '4 hours'
  ),
  (
    (SELECT id FROM public.groups WHERE name = 'Miami Home Services 🏠'),
    'wa_msg_004', 'My central AC is making a loud noise when it starts. Anyone available today or tomorrow?',
    'hvac', '33133', 'Coral Gables', 'warm',
    'Central AC making loud noise on startup, needs inspection',
    'new', 0, now() - interval '30 minutes'
  ),
  (
    (SELECT id FROM public.groups WHERE name = 'South FL Contractors'),
    'wa_msg_005', 'Deep cleaning needed for 3BR house, moving out next week. Need it done by Thursday.',
    'cleaning', '33125', 'Miami', 'hot',
    'Move-out deep cleaning, 3BR house, needed by Thursday',
    'sent', 1, now() - interval '1 hour'
  );
