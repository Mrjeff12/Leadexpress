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
    {"role":"A","delay_min":0,"delay_max":0,"text":"אחי מישהו יודע איפה למצוא עבודות באזור מיאמי? קבוצות כבר לא עוזרות"},
    {"role":"B","delay_min":3,"delay_max":8,"text":"יש אפליקציה שנקראת masterlead, בוט שסורק קבוצות ווצאפ ושולח לך רק את העבודות שמתאימות לך"},
    {"role":"A","delay_min":1,"delay_max":3,"text":"מה זה סורק קבוצות? לא הבנתי"},
    {"role":"B","delay_min":2,"delay_max":5,"text":"כן יש שם בוט שסורק קבוצות ושולחת לך הודעה כשיש עבודה באזור שלך ובמקצוע שלך"},
    {"role":"C","delay_min":5,"delay_max":15,"text":"אני משתמש כבר חודש, כל בוקר אני מקבל הודעה עם העבודות החדשות. וואלה נוח חוסך לי גלילה בקבוצה גם ככה היא על השתק"}
  ]'::jsonb
),
(
  'מה זה masterlead?',
  'מישהו רואה את השם ושואל, שניים מסבירים',
  'curiosity',
  '[
    {"role":"A","delay_min":0,"delay_max":0,"text":"חבר׳ה מישהו מכיר את masterlead? ראיתי את זה כמה פעמים"},
    {"role":"B","delay_min":2,"delay_max":6,"text":"כן אחי זה בוט שעובד על ווצאפ, סורק קבוצות ושולח לך רק עבודות שרלוונטיות לאזור שלך"},
    {"role":"C","delay_min":3,"delay_max":8,"text":"גם אני שם, אתה יכול גם לפרסם שם עבודה שלא מתאימה לך וזה מגיע למלא קבלנים מתאימים"},
    {"role":"A","delay_min":1,"delay_max":3,"text":"וואלה , וזה עובד?"},
    {"role":"B","delay_min":2,"delay_max":4,"text":"אני מקבל כל פעם שמפרסמים בקבוצה או מישהו מעלה עבודה אני מקבל לפרטי שלי אותה אם היא מתאימה לי , אחלה דבר תנסה זה גם חינם הם לא לוקחים עמלה או משהו רק מנוי חודשי"}
  ]'::jsonb
),
(
  'המלצה לחבר',
  'חייל מתלונן שאין עבודה, חבר ממליץ',
  'recommendation',
  '[
    {"role":"A","delay_min":0,"delay_max":0,"text":"אין עבודה בכלל השבוע, יושב בבית כל היום"},
    {"role":"B","delay_min":4,"delay_max":10,"text":"וואלה תנסה להרשם ל masterleadflow זה מחבר בין מלא קבלנים מעבירים עבודות מקבלים עבודות"},
    {"role":"A","delay_min":1,"delay_max":3,"text":"מה עושה בדיוק?"},
    {"role":"B","delay_min":2,"delay_max":5,"text":"אתה אומר לו מה המקצוע שלך ואיפה אתה עובד, והוא שולח לך כל עבודה חדשה ישר לווצאפ. אני מצאתי שלוש עבודות השבוע ככה"},
    {"role":"A","delay_min":1,"delay_max":2,"text":"וזה עולה כסף?"},
    {"role":"B","delay_min":2,"delay_max":4,"text":"יש שם נסיון חינם לאיזה שבוע עולה איזה 80 דולר בחודש זה מחבר את כל הקבלנים ביחד יכולים גם לנהל את המעקב אחרי העבודה בפנים ,נוח מאוד"}
  ]'::jsonb
),
(
  'שיחה על כלים',
  'דיון טבעי על כלים למציאת עבודות',
  'general',
  '[
    {"role":"A","delay_min":0,"delay_max":0,"text":"באיזה אפליקציות אתם משתמשים למצוא עבודות חוץ מקבוצות ווצאפ?"},
    {"role":"B","delay_min":3,"delay_max":7,"text":"אני משתמש ב-masterlead, יש להם בוט שסורק את כל הקבוצות ושולח לך רק מה שרלוונטי"},
    {"role":"C","delay_min":2,"delay_max":6,"text":"גם אני, נוח גם כי יש שם אימות למפרסם ולמי שלוקח את העבודה אין גניבות"},
    {"role":"A","delay_min":1,"delay_max":3,"text":"מה זה להעביר משם עבודה לא הבנתי ?"},
    {"role":"B","delay_min":2,"delay_max":5,"text":"אתה מפרסם עבודה שם זה מגיע לכל מי שרלוונטי בלבד לפרטי שלו והוא בוחר אם להגיב לך חזרה , זה מחבר בין איזה 2000 ישראלים נוח"}
  ]'::jsonb
),
(
  'מישהו ניסה?',
  'שאלה תמימה לגבי masterlead, תשובות חיוביות',
  'curiosity',
  '[
    {"role":"A","delay_min":0,"delay_max":0,"text":"מישהו פה ניסה את masterlead? שווה?"},
    {"role":"B","delay_min":5,"delay_max":12,"text":"אני שם כבר חודשיים. בהתחלה לא האמנתי אבל הבוט באמת שולח עבודות רלוונטיות, חוסך לי את כל הגלילה בקבוצות"},
    {"role":"C","delay_min":3,"delay_max":8,"text":"אני נרשמתי שבוע שעבר, מה שאהבתי זה שאפשר להעביר עבודות שלא מתאימות בין קבלנים ולנהל את זה מהממשק נוח לעקוב"},
    {"role":"A","delay_min":1,"delay_max":3,"text":"ואיך נרשמים?"},
    {"role":"B","delay_min":2,"delay_max":4,"text":"תחפש masterlead בגוגל, ההרשמה לוקחת דקה. יש גרסה בחינם לנסות"}
  ]'::jsonb
);
