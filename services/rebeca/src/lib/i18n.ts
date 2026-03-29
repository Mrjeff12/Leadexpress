type Lang = 'he' | 'en';

export function lang(phone: string): Lang {
  return phone.startsWith('+972') ? 'he' : 'en';
}

const STRINGS: Record<Lang, Record<string, string>> = {
  he: {
    processing:            'רגע, מעבד את ההודעה הקודמת...',
    profession_fallback:   'מה המקצוע שלך? (למשל: אינסטלציה, חשמל, ניקוי צנרות)',
    profession_fallback2:  'מה אתה עושה? כתוב או שלח הודעה קולית 🎙️',
    subscription_expired:  'היי {{name}}! המנוי שלך פג תוקף.\nכנס ל-masterleadflow.com להארכה.\n\nאתה עדיין יכול להשתמש בתפריט.',
    unsubscribed:          'בוצע. לא תקבל יותר הודעות מאיתנו.',
    error_generic:         'סליחה, משהו השתבש. נסה שוב בעוד רגע 🙏',
    incomplete_profile:    'עדיין חסרים כמה פרטים. נסה שוב עם שם, מקצוע, מדינה וערים.',
    menu:                  '📋 *תפריט MasterLeadFlow*\n\nשלח מספר:\n\n1️⃣ ⚙️ ההגדרות שלי\n2️⃣ 📍 עדכן אזורי עבודה\n3️⃣ 🔧 עדכן מקצועות\n4️⃣ 📅 ימי עבודה\n5️⃣ ⏸️ עצור / חדש לידים\n\nאו שלח STOP לביטול מנוי.',
    available_confirm:     '✅ אתה אקטיבי! לידים יגיעו היום.',
    off_today:             '👍 בסדר, יום חופש! נתראה מחר.',
  },
  en: {
    processing:            'One moment, processing your previous message...',
    profession_fallback:   'What trade do you work in? (e.g. plumbing, electrical, HVAC)',
    profession_fallback2:  'What services do you offer? Type or send a voice note 🎙️',
    subscription_expired:  'Hi {{name}}! Your subscription has expired.\nVisit masterleadflow.com to renew.\n\nYou can still use the menu and chat below.',
    unsubscribed:          "You've been unsubscribed. You won't receive any more messages from us.",
    error_generic:         'Sorry, something went wrong. Please try again in a moment 🙏',
    incomplete_profile:    'A few details are still missing. Please include your name, trade, state, and cities.',
    menu:                  '📋 *MasterLeadFlow Menu*\n\nReply with a number:\n\n1️⃣ ⚙️ My Settings\n2️⃣ 📍 Update Areas\n3️⃣ 🔧 Update Trades\n4️⃣ 📅 Working Days\n5️⃣ ⏸️ Pause / Resume Leads\n\nOr send STOP to unsubscribe.',
    available_confirm:     "✅ You're live! Leads will come through today.",
    off_today:             '👍 Got it, enjoy your day off! See you tomorrow.',
  },
};

export function t(phone: string, key: string, vars?: Record<string, string>): string {
  const l = lang(phone);
  let str = STRINGS[l][key] ?? STRINGS.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{{${k}}}`, v);
    }
  }
  return str;
}
