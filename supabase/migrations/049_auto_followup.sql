-- Template store for follow-up messages
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  touch_number INTEGER NOT NULL, -- 1=first outreach, 2=follow-up 1, 3=follow-up 2
  category TEXT NOT NULL DEFAULT 'follow_up' CHECK (category IN ('first_touch', 'follow_up', 'reactivation', 'custom')),
  body_template TEXT NOT NULL, -- supports {name}, {group_name}, {lead_count}, {contractor_count}
  language TEXT NOT NULL DEFAULT 'he' CHECK (language IN ('he', 'en')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  send_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_templates ON message_templates FOR ALL USING (public.is_admin());

-- Seed templates
INSERT INTO message_templates (name, touch_number, category, body_template, language) VALUES
-- Touch 2 (Follow-up 1, day 3)
('follow_up_direct', 2, 'follow_up', 'היי {name}, חוזר אליך.
היו השבוע עבודות חדשות באזור שלך מ-{group_name}.
עדיין רלוונטי?', 'he'),

('follow_up_numbers', 2, 'follow_up', 'היי {name}, מאז שדיברנו היו {lead_count} עבודות חדשות באזור שלך מ-{group_name}.
רוצה לקבל אותן ישר לפלאפון?', 'he'),

('follow_up_success', 2, 'follow_up', 'היי {name}, רציתי לספר לך —
קבלן כמוך מ-{group_name} סגר 3 עבודות בשבוע הראשון.
רוצה לנסות גם?', 'he'),

('follow_up_question', 2, 'follow_up', 'היי {name}, שאלה קצרה —
איך אתה מוצא עבודות חדשות היום חוץ מ-{group_name}?
יש לנו דרך שחוסכת הרבה זמן', 'he'),

-- Touch 3 (Follow-up 2, day 7)
('last_touch_friendly', 3, 'follow_up', '{name}, הודעה אחרונה ממני!
אם תצטרך עבודות מ-{group_name} או מקבוצות אחרות — אני כאן 👍', 'he'),

('last_touch_fomo', 3, 'follow_up', '{name}, רק רציתי שתדע —
{contractor_count} קבלנים מ-{group_name} כבר מקבלים עבודות דרכנו.
הדלת פתוחה אם תרצה להצטרף 🤝', 'he'),

('last_touch_value', 3, 'follow_up', '{name}, לא רוצה להפריע!
רק שתדע שאנחנו סורקים את {group_name} ועוד קבוצות ויכולים לשלוח לך עבודות מתאימות — בחינם לתקופת ניסיון.
תגיד מתי נוח 👍', 'he'),

('last_touch_short', 3, 'follow_up', '{name}, עדיין מחפש עבודות? 🔧', 'he');
