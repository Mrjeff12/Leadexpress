import { createContext, useContext } from 'react'

export type Locale = 'en' | 'he'

const translations = {
  en: {
    // Nav
    'nav.dashboard': 'Dashboard',
    'nav.leads': 'My Leads',
    'nav.profile': 'Profile',
    'nav.subscription': 'Subscription',
    'nav.telegram': 'Connect Telegram',
    'nav.settings': 'Settings',
    'nav.admin': 'Admin Panel',
    'nav.admin.dashboard': 'Overview',
    'nav.admin.contractors': 'Contractors',
    'nav.admin.groups': 'Groups',
    'nav.admin.leads': 'All Leads',
    'nav.logout': 'Log Out',

    // Auth
    'auth.login': 'Log In',
    'auth.signup': 'Sign Up',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.name': 'Full Name',
    'auth.forgot': 'Forgot password?',
    'auth.no_account': "Don't have an account?",
    'auth.has_account': 'Already have an account?',
    'auth.tagline': 'Smart leads, delivered to your Telegram.',
    'auth.error.invalid': 'Invalid email or password',

    // Dashboard
    'dash.welcome': 'Welcome back',
    'dash.leads_today': 'Leads Today',
    'dash.leads_week': 'This Week',
    'dash.leads_total': 'Total Leads',
    'dash.active_since': 'Active since',
    'dash.recent_leads': 'Recent Leads',
    'dash.no_leads': 'No leads yet. Make sure your profile is complete and Telegram is connected.',
    'dash.plan': 'Plan',

    // Leads
    'lead.hot': 'Urgent',
    'lead.warm': 'This Week',
    'lead.cold': 'Flexible',
    'lead.budget': 'Budget',
    'lead.location': 'Location',
    'lead.source': 'Source',
    'lead.received': 'Received',

    // Professions
    'prof.hvac': 'HVAC',
    'prof.renovation': 'Renovation',
    'prof.fencing': 'Fencing',
    'prof.cleaning': 'Garage Cleaning',

    // Profile
    'profile.title': 'My Profile',
    'profile.professions': 'Professions',
    'profile.zip_codes': 'Service Areas (Zip Codes)',
    'profile.telegram_status': 'Telegram Status',
    'profile.connected': 'Connected',
    'profile.not_connected': 'Not Connected',
    'profile.save': 'Save Changes',
    'profile.saved': 'Saved!',

    // Subscription
    'sub.title': 'Subscription',
    'sub.current_plan': 'Current Plan',
    'sub.change_plan': 'Change Plan',
    'sub.starter': 'Starter',
    'sub.pro': 'Pro',
    'sub.unlimited': 'Unlimited',
    'sub.per_month': '/month',

    // Settings
    'settings.title': 'Service Settings',
    'settings.subtitle': 'Manage professions, coverage areas & schedule',
    'settings.save': 'Save',
    'settings.saved': 'Saved!',
    'settings.professions': 'Professions',
    'settings.zip_codes': 'Service Areas (ZIP)',
    'settings.schedule': 'Working Days & Hours',
    'settings.day_off': 'Day off',
    'settings.no_zips': 'No ZIP codes added yet.',
    'settings.map_key_missing': 'Add VITE_GOOGLE_MAPS_KEY to .env to display map',

    // Admin
    'admin.total_contractors': 'Active Contractors',
    'admin.leads_today': 'Leads Today',
    'admin.delivery_rate': 'Delivery Rate',
    'admin.active_groups': 'Active Groups',
    'admin.revenue': 'MRR',
  },
  he: {
    // Nav
    'nav.dashboard': 'דף הבית',
    'nav.leads': 'הלידים שלי',
    'nav.profile': 'פרופיל',
    'nav.subscription': 'מנוי',
    'nav.telegram': 'חיבור טלגרם',
    'nav.settings': 'הגדרות',
    'nav.admin': 'פאנל ניהול',
    'nav.admin.dashboard': 'סקירה',
    'nav.admin.contractors': 'קבלנים',
    'nav.admin.groups': 'קבוצות',
    'nav.admin.leads': 'כל הלידים',
    'nav.logout': 'התנתק',

    // Auth
    'auth.login': 'התחברות',
    'auth.signup': 'הרשמה',
    'auth.email': 'אימייל',
    'auth.password': 'סיסמה',
    'auth.name': 'שם מלא',
    'auth.forgot': 'שכחת סיסמה?',
    'auth.no_account': 'אין לך חשבון?',
    'auth.has_account': 'יש לך חשבון?',
    'auth.tagline': 'לידים חכמים, ישירות לטלגרם.',
    'auth.error.invalid': 'אימייל או סיסמה שגויים',

    // Dashboard
    'dash.welcome': 'ברוך הבא',
    'dash.leads_today': 'לידים היום',
    'dash.leads_week': 'השבוע',
    'dash.leads_total': 'סה"כ לידים',
    'dash.active_since': 'פעיל מאז',
    'dash.recent_leads': 'לידים אחרונים',
    'dash.no_leads': 'אין לידים עדיין. ודא שהפרופיל שלך מלא וטלגרם מחובר.',
    'dash.plan': 'מסלול',

    // Leads
    'lead.hot': 'דחוף',
    'lead.warm': 'השבוע',
    'lead.cold': 'גמיש',
    'lead.budget': 'תקציב',
    'lead.location': 'מיקום',
    'lead.source': 'מקור',
    'lead.received': 'התקבל',

    // Professions
    'prof.hvac': 'מזגנים',
    'prof.renovation': 'שיפוצים',
    'prof.fencing': 'גדרות',
    'prof.cleaning': 'ניקוי גראז׳',

    // Profile
    'profile.title': 'הפרופיל שלי',
    'profile.professions': 'מקצועות',
    'profile.zip_codes': 'אזורי שירות (מיקוד)',
    'profile.telegram_status': 'סטטוס טלגרם',
    'profile.connected': 'מחובר',
    'profile.not_connected': 'לא מחובר',
    'profile.save': 'שמור שינויים',
    'profile.saved': 'נשמר!',

    // Subscription
    'sub.title': 'מנוי',
    'sub.current_plan': 'מסלול נוכחי',
    'sub.change_plan': 'שנה מסלול',
    'sub.starter': 'סטארטר',
    'sub.pro': 'פרו',
    'sub.unlimited': 'ללא הגבלה',
    'sub.per_month': '/חודש',

    // Settings
    'settings.title': 'הגדרות שירות',
    'settings.subtitle': 'נהל מקצועות, אזורים ולוח זמנים',
    'settings.save': 'שמור',
    'settings.saved': 'נשמר!',
    'settings.professions': 'מקצועות',
    'settings.zip_codes': 'אזורי שירות (מיקוד)',
    'settings.schedule': 'ימי ושעות עבודה',
    'settings.day_off': 'יום חופש',
    'settings.no_zips': 'לא נוספו אזורים עדיין',
    'settings.map_key_missing': 'הוסף VITE_GOOGLE_MAPS_KEY ב-.env כדי להציג מפה',

    // Admin
    'admin.total_contractors': 'קבלנים פעילים',
    'admin.leads_today': 'לידים היום',
    'admin.delivery_rate': 'אחוז מסירה',
    'admin.active_groups': 'קבוצות פעילות',
    'admin.revenue': 'הכנסה חודשית',
  },
} as const

type TranslationKey = keyof (typeof translations)['en']

export const I18nContext = createContext<{
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey) => string
}>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
})

export function useI18n() {
  return useContext(I18nContext)
}

export function createTranslator(locale: Locale) {
  return (key: TranslationKey): string => {
    return translations[locale]?.[key] ?? key
  }
}

export function isRtl(locale: Locale): boolean {
  return locale === 'he'
}
