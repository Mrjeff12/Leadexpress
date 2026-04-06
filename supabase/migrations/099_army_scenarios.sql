-- ══════════════════════════════════════════════════
-- 099 — Army Scenarios (scripted group conversations)
-- ══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS army_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  lines jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  times_used integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS army_scenario_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid REFERENCES army_scenarios(id) ON DELETE SET NULL,
  group_wa_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  role_assignments jsonb NOT NULL DEFAULT '{}',
  current_line integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_army_scenarios_active ON army_scenarios(is_active, category);
CREATE INDEX IF NOT EXISTS idx_army_scenario_runs_status ON army_scenario_runs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_army_scenario_runs_group ON army_scenario_runs(group_wa_id, scheduled_at DESC);

ALTER TABLE army_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE army_scenario_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_army_scenarios" ON army_scenarios FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_army_scenario_runs" ON army_scenario_runs FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ═══ Seed 5 pre-built scenarios (Israeli street Hebrew) ═══

INSERT INTO army_scenarios (name, description, category, lines) VALUES
(
  'מחפש עבודה',
  'חייל שואל איפה למצוא עבודות, חבר ממליץ על masterlead',
  'job_inquiry',
  '[
    {"role":"A","delay_min":0,"delay_max":0,"text":"אחי מישהו יודע איפה למצוא עבודות צבע באזור מיאמי?"},
    {"role":"B","delay_min":3,"delay_max":8,"text":"יש אפליקציה חדשה masterlead תיכנס שם, אני נרשמתי שבוע שעבר"},
    {"role":"A","delay_min":1,"delay_max":3,"text":"מה זה? טוב?"},
    {"role":"B","delay_min":2,"delay_max":5,"text":"כן אחי שם אתה רואה עבודות לפי אזור ומקצוע, תנסה"},
    {"role":"C","delay_min":5,"delay_max":15,"text":"גם אני נכנסתי לשם לאחרונה, יש שם המון"}
  ]'::jsonb
),
(
  'מה זה masterlead?',
  'מישהו שואל מה זה השם הזה, שניים מסבירים',
  'curiosity',
  '[
    {"role":"A","delay_min":0,"delay_max":0,"text":"חבר׳ה מישהו מכיר את masterlead? ראיתי את זה כמה פעמים"},
    {"role":"B","delay_min":2,"delay_max":6,"text":"כן אחי זה אפליקציה שמחברת בין קבלנים לעבודות, אני שם כבר חודש"},
    {"role":"C","delay_min":3,"delay_max":8,"text":"גם אני, יש שם עבודות שלא רואים במקומות אחרים"},
    {"role":"A","delay_min":1,"delay_max":3,"text":"אה סבבה ואיך נרשמים?"},
    {"role":"B","delay_min":2,"delay_max":4,"text":"תחפש masterlead באינטרנט, יש להם אתר. לוקח דקה"}
  ]'::jsonb
),
(
  'המלצה לחבר',
  'חייל מתלונן שאין עבודה, חבר ממליץ',
  'recommendation',
  '[
    {"role":"A","delay_min":0,"delay_max":0,"text":"אין עבודה בכלל השבוע הזה, מישהו עוד ככה?"},
    {"role":"B","delay_min":4,"delay_max":10,"text":"אחי תיכנס ל-masterlead, אני מצאתי שם שתי עבודות השבוע"},
    {"role":"A","delay_min":1,"delay_max":3,"text":"מה זה בדיוק?"},
    {"role":"B","delay_min":2,"delay_max":5,"text":"אתר שבו בעלי בתים מפרסמים עבודות ואתה רואה לפי האזור שלך"},
    {"role":"A","delay_min":1,"delay_max":2,"text":"ויש עבודות באזור פלורידה?"},
    {"role":"B","delay_min":2,"delay_max":4,"text":"בטח יש שם פול של עבודות בדרום פלורידה, תבדוק"}
  ]'::jsonb
),
(
  'שיחה על אפליקציות',
  'דיון טבעי על כלים למציאת עבודה',
  'general',
  '[
    {"role":"A","delay_min":0,"delay_max":0,"text":"באיזה אפליקציות אתם משתמשים למצוא עבודות?"},
    {"role":"B","delay_min":3,"delay_max":7,"text":"אני משתמש ב-masterlead, הכי נוח בשבילי"},
    {"role":"C","delay_min":2,"delay_max":6,"text":"גם אני, שם הכל מסודר לפי מקצוע ואזור"},
    {"role":"A","delay_min":1,"delay_max":3,"text":"יש מצב שזה עובד גם לאזור אורלנדו?"},
    {"role":"B","delay_min":2,"delay_max":5,"text":"כן אחי יש שם עבודות בכל פלורידה"}
  ]'::jsonb
),
(
  'מישהו ניסה?',
  'שאלה תמימה אם מישהו ניסה, תשובות חיוביות',
  'curiosity',
  '[
    {"role":"A","delay_min":0,"delay_max":0,"text":"מישהו פה ניסה את masterlead? שווה?"},
    {"role":"B","delay_min":5,"delay_max":12,"text":"אני שם כבר חודשיים, מצאתי כמה עבודות טובות"},
    {"role":"C","delay_min":3,"delay_max":8,"text":"אני נרשמתי שבוע שעבר, נראה סבבה בינתיים"},
    {"role":"A","delay_min":1,"delay_max":3,"text":"וזה בחינם?"},
    {"role":"B","delay_min":2,"delay_max":4,"text":"יש גרסה בחינם כן, תנסה ותראה אם מתאים לך"}
  ]'::jsonb
);
