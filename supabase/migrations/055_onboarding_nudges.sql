-- Onboarding nudge templates — 4 waves of follow-up for stuck prospects
-- Wave 1: 30 min — gentle reminder
-- Wave 2: 1 hour — offer help
-- Wave 3: 1 day — show value they're missing
-- Wave 4: 2 days — last call

INSERT INTO message_templates (name, touch_number, category, body_template, language) VALUES

-- ══════════════════════════════════════════════════════
-- WAVE 1 — 30 minutes (gentle nudge per step)
-- ══════════════════════════════════════════════════════

('onboard_nudge1_first_name', 1, 'custom', 'היי! 👋 התחלנו רישום אבל נתקענו.
מה השם שלך? לוקח דקה לסיים ⚡', 'he'),

('onboard_nudge1_profession', 1, 'custom', 'היי {name}! חסר לנו רק מה המקצוע שלך ונסיים 🔧
תכתוב מה אתה עושה — למשל "אינסטלציה" או "חשמל"', 'he'),

('onboard_nudge1_city_state', 1, 'custom', '{name}, כמעט סיימנו!
באיזה מדינה אתה עובד?
🌴 Florida  🗽 New York  🤠 Texas', 'he'),

('onboard_nudge1_city', 1, 'custom', '{name}, חסר רק לבחור אזורים ואתה בפנים!
תשלח מספרים מהרשימה או שם עיר 📍', 'he'),

('onboard_nudge1_working_days', 1, 'custom', '{name}, שלב אחרון!
מתי אתה עובד?
1. ראשון-חמישי
2. כל יום', 'he'),

('onboard_nudge1_confirm', 1, 'custom', '{name}, הפרופיל שלך מוכן! ✅
תשלח *YES* ותתחיל לקבל עבודות מיד 🚀', 'he'),

-- ══════════════════════════════════════════════════════
-- WAVE 2 — 1 hour (offer help)
-- ══════════════════════════════════════════════════════

('onboard_nudge2_first_name', 2, 'custom', 'עדיין פה אם צריך 👋
אם משהו לא ברור — תשאל, אני כאן לעזור.
כדי להתחיל פשוט תכתוב לי את השם שלך ✏️', 'he'),

('onboard_nudge2_profession', 2, 'custom', '{name}, אם לא בטוח מה לכתוב — אלה המקצועות הפופולריים:
🔧 Plumbing
⚡ Electrical
❄️ HVAC
🏠 General Contractor

תכתוב מה שמתאים לך', 'he'),

('onboard_nudge2_city_state', 2, 'custom', '{name}, רגע — באיזה מדינה אתה?
רוב הקבלנים שלנו ב-Florida, אבל יש גם ב-NY ו-TX.
תכתוב את שם המדינה ונמשיך', 'he'),

('onboard_nudge2_city', 2, 'custom', '{name}, לא צריך להתאמץ — תכתוב "all" ואני אוסיף את כל האזורים.
או תבחר ערים ספציפיות מהרשימה 📍', 'he'),

('onboard_nudge2_working_days', 2, 'custom', '{name}, לא צריך להיות מדויק —
רוב הקבלנים בוחרים "כל יום" ואז משנים אם צריך.
תכתוב 1 או 2 ונסיים 👍', 'he'),

('onboard_nudge2_confirm', 2, 'custom', '{name}, רק מילה אחת חסרה — *YES*
ואתה מתחיל לקבל עבודות מקבוצות WhatsApp ישר לפלאפון 📱', 'he'),

-- ══════════════════════════════════════════════════════
-- WAVE 3 — 1 day (show value)
-- ══════════════════════════════════════════════════════

('onboard_nudge3_generic', 3, 'custom', 'היי {name}, מאז שהתחלנו היו {lead_count} עבודות חדשות באזור שלך 🔥
קבלנים אחרים כבר תפסו אותן.
תסיים רישום ותתחיל לקבל גם — לוקח דקה.
תשלח כל הודעה ונמשיך מאיפה שעצרנו', 'he'),

-- ══════════════════════════════════════════════════════
-- WAVE 4 — 2 days (last call)
-- ══════════════════════════════════════════════════════

('onboard_nudge4_generic', 4, 'custom', '{name}, עדיין פה אם תרצה 👍
אם השירות לא מתאים — בסדר גמור, אין לחץ.
אם כן מעוניין — תשלח הודעה ונסיים רישום בדקה.
אנחנו לא שולחים יותר הודעות אחרי זה ✌️', 'he'),

-- Groups step nudges
('onboard_nudge1_groups', 1, 'custom', '{name}, נשאר רק לשלוח לינק לקבוצת WhatsApp שאתה חבר בה 📲
אנחנו נמצא לך עבודות משם!', 'he'),

('onboard_nudge2_groups', 2, 'custom', '{name}, ככה זה עובד — תשלח לינק לקבוצה של קבלנים ואנחנו נסרוק עבודות בשבילך 🔍
לא יודע איך? תכתוב "עזרה"', 'he'),

('onboard_nudge3_groups', 3, 'custom', '{name}, קבלנים אחרים כבר מקבלים עבודות מהקבוצות שלהם 🔥
תשלח לינק לקבוצה ותתחיל גם — לוקח 10 שניות', 'he'),

('onboard_nudge4_groups', 4, 'custom', '{name}, עדיין פה אם תרצה 👍
תשלח לינק לקבוצה בכל זמן ונתחיל למצוא לך עבודות.
לא שולחים יותר הודעות ✌️', 'he');

-- ══════════════════════════════════════════════════════
-- CHURNED WIN-BACK TEMPLATES
-- ══════════════════════════════════════════════════════

-- Payment Failed — handled by Stripe automatic retries, no WhatsApp messages
-- After 3 failed retries → alert admin to handle manually

-- Recent churn (left within 30 days)
('winback_recent_1', 1, 'reactivation', 'היי {name}, חסר לנו אותך! 👋
היו {lead_count} עבודות חדשות באזור שלך מאז שעזבת.
רוצה לחזור? תשלח הודעה', 'he'),

('winback_recent_2', 2, 'reactivation', '{name}, קבלנים אחרים באזור שלך תפסו {lead_count} עבודות השבוע 🔥
רוצה לחזור? תשלח "כן"', 'he'),

('winback_recent_3', 3, 'reactivation', '{name}, הצעה מיוחדת — חודש ראשון ב-50% הנחה 🎁
רוצה לחזור ולקבל עבודות? תשלח הודעה
לא שולחים יותר אחרי זה ✌️', 'he'),

-- No value (felt service wasn't useful)
('winback_no_value_1', 1, 'reactivation', 'היי {name}, שיפרנו את המערכת! 🚀
עכשיו יש הרבה יותר עבודות באזור שלך.
רוצה לנסות שוב? שבוע ניסיון חינם 🎁', 'he'),

('winback_no_value_2', 2, 'reactivation', '{name}, מאז שעזבת הוספנו {lead_count} עבודות חדשות באזור שלך 📈
רוצה לבדוק? תשלח הודעה
לא שולחים יותר ✌️', 'he'),

-- Seasonal (construction workers)
('winback_seasonal_1', 1, 'reactivation', 'היי {name}, העונה חוזרת! 🔨☀️
כבר יש {lead_count} עבודות חדשות באזור שלך.
רוצה להפעיל מחדש? תשלח "כן"', 'he');

-- ══════════════════════════════════════════════════════
-- RPC: find stuck onboarding prospects needing nudge
-- ══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_stuck_onboarding()
RETURNS TABLE (
  phone TEXT,
  step TEXT,
  first_name TEXT,
  prospect_id UUID,
  minutes_stuck NUMERIC,
  nudges_sent INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    o.phone,
    o.step,
    COALESCE((o.data->>'firstName')::text, '') AS first_name,
    (o.data->>'prospectId')::uuid AS prospect_id,
    EXTRACT(EPOCH FROM (NOW() - o.updated_at)) / 60 AS minutes_stuck,
    COALESCE((o.data->>'nudges_sent')::integer, 0) AS nudges_sent
  FROM wa_onboard_state o
  WHERE o.step NOT IN ('groups', 'done')
    AND o.updated_at < NOW() - INTERVAL '25 minutes'
  ORDER BY o.updated_at ASC;
$$;

-- Track nudge count in onboard state data
COMMENT ON FUNCTION get_stuck_onboarding IS
'Returns onboarding prospects stuck for 25+ minutes.
nudges_sent field tracks how many nudges already sent (0-4).
Caller should:
  - nudges_sent=0 AND minutes_stuck>=30: send wave 1
  - nudges_sent=1 AND minutes_stuck>=60: send wave 2
  - nudges_sent=2 AND minutes_stuck>=1440 (24h): send wave 3
  - nudges_sent=3 AND minutes_stuck>=2880 (48h): send wave 4
  - nudges_sent>=4: stop, prospect declined
After sending, update wa_onboard_state.data.nudges_sent += 1';
