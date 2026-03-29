import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  User,
  Phone,
  MessageCircle,
  Briefcase,
  MapPin,
  FileText,
  AlignLeft,
  Clock,
  Building2,
  Languages,
  ShieldCheck,
  Activity,
  MessageSquare,
  Image,
} from 'lucide-react'

/* ── Checklist definition ──────────────────────────── */

interface CheckItem {
  key: string
  label: string
  labelHe: string
  points: number
  icon: React.ElementType
  check: (p: any) => boolean
}

const CHECKLIST: CheckItem[] = [
  { key: 'full_name',     label: 'Full name',            labelHe: 'שם מלא',              points: 10, icon: User,          check: p => !!p?.full_name },
  { key: 'phone',         label: 'Phone number',         labelHe: 'מספר טלפון',          points: 5,  icon: Phone,         check: p => !!p?.phone },
  { key: 'whatsapp',      label: 'WhatsApp connected',   labelHe: 'WhatsApp מחובר',       points: 5,  icon: MessageCircle, check: p => !!p?.whatsapp_phone },
  { key: 'professions',   label: 'Professions set',      labelHe: 'מקצועות מוגדרים',     points: 10, icon: Briefcase,     check: p => Array.isArray(p?.professions) && p.professions.length > 0 },
  { key: 'service_areas', label: 'Service areas set',    labelHe: 'אזורי שירות מוגדרים', points: 10, icon: MapPin,        check: p => Array.isArray(p?.zip_codes) && p.zip_codes.length > 0 },
  { key: 'headline',      label: 'Professional headline',labelHe: 'כותרת מקצועית',       points: 10, icon: FileText,      check: p => !!p?.profile?.headline },
  { key: 'bio',           label: 'Bio (50+ chars)',      labelHe: 'ביוגרפיה (50+ תווים)',points: 10, icon: AlignLeft,     check: p => (p?.profile?.bio?.length ?? 0) >= 50 },
  { key: 'experience',    label: 'Years experience',     labelHe: 'שנות ניסיון',         points: 5,  icon: Clock,         check: p => p?.profile?.years_experience != null && p.profile.years_experience > 0 },
  { key: 'business_name', label: 'Business name',        labelHe: 'שם העסק',             points: 5,  icon: Building2,     check: p => !!p?.profile?.business_name },
  { key: 'languages',     label: 'Languages',            labelHe: 'שפות',                points: 5,  icon: Languages,     check: p => Array.isArray(p?.profile?.languages) && p.profile.languages.length > 0 },
  { key: 'license',       label: 'License number',       labelHe: 'מספר רישיון',         points: 5,  icon: ShieldCheck,   check: p => !!p?.profile?.license_number },
  { key: 'lead_activity', label: 'Lead activity',        labelHe: 'פעילות לידים',        points: 5,  icon: Activity,      check: p => (p?.stats?.leads_contacted ?? 0) > 0 },
  { key: 'lead_feedback', label: 'Lead feedback',        labelHe: 'משוב על לידים',       points: 5,  icon: MessageSquare, check: p => (p?.stats?.feedbacks_given ?? 0) > 0 },
  { key: 'portfolio',     label: 'Portfolio',            labelHe: 'תיק עבודות',          points: 10, icon: Image,         check: p => (p?.portfolio_count ?? 0) > 0 || (p?.stats?.successful_jobs ?? 0) > 0 },
]

const TOTAL_POINTS = CHECKLIST.reduce((s, c) => s + c.points, 0)

/* ── Progress ring ─────────────────────────────────── */

function ProgressRing({ percent }: { percent: number }) {
  const size = 96
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  const color = percent >= 80 ? '#22c55e' : percent >= 50 ? '#fe5b25' : '#f59e0b'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span
        className="absolute text-xl font-bold"
        style={{ color }}
      >
        {percent}%
      </span>
    </div>
  )
}

/* ── Component ─────────────────────────────────────── */

interface ProfileCompletionBarProps {
  completeness: number
  profile: any
}

export default function ProfileCompletionBar({ completeness, profile }: ProfileCompletionBarProps) {
  const { locale } = useI18n()
  const isHe = locale === 'he'

  // Compute actual completeness from checklist
  const earned = CHECKLIST.reduce(
    (sum, item) => sum + (item.check(profile) ? item.points : 0),
    0,
  )
  const percent = Math.min(Math.round((earned / TOTAL_POINTS) * 100), 100)

  const incomplete = CHECKLIST.filter(item => !item.check(profile))
  const complete = CHECKLIST.filter(item => item.check(profile))

  const heading = isHe ? 'השלמת פרופיל' : 'Profile Completion'
  const encouragement =
    percent === 100
      ? isHe ? 'מושלם! הפרופיל שלך מלא.' : 'Perfect! Your profile is complete.'
      : percent >= 70
        ? isHe ? 'כמעט שם! עוד כמה צעדים.' : 'Almost there! Just a few more steps.'
        : isHe ? 'פרופיל מלא = יותר לידים. בוא נשלים אותו!' : 'A complete profile gets more leads. Let\'s finish it!'

  return (
    <div className="glass-panel p-6" dir={isHe ? 'rtl' : 'ltr'}>
      {/* Header + Ring */}
      <div className="flex flex-col items-center gap-3 mb-4">
        <ProgressRing percent={percent} />
        <h3 className="text-base font-semibold text-gray-800">{heading}</h3>
        <p className="text-sm text-gray-500 text-center leading-relaxed">{encouragement}</p>
      </div>

      {/* Incomplete items */}
      {incomplete.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {isHe ? 'נדרש להשלמה' : 'Still needed'}
          </p>
          {incomplete.map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                to="/profile/edit"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl
                           bg-orange-50/60 hover:bg-orange-100/80
                           transition-colors group"
              >
                <Circle className="w-4 h-4 text-[#fe5b25]/50 flex-shrink-0" />
                <Icon className="w-4 h-4 text-[#fe5b25]/70 flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-1">
                  {isHe ? item.labelHe : item.label}
                </span>
                <span className="text-xs text-gray-400">+{item.points}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#fe5b25] transition-colors rtl:rotate-180" />
              </Link>
            )
          })}
        </div>
      )}

      {/* Completed items (collapsed) */}
      {complete.length > 0 && (
        <div className="space-y-1 mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {isHe ? 'הושלם' : 'Completed'} ({complete.length})
          </p>
          {complete.map(item => {
            const Icon = item.icon
            return (
              <div
                key={item.key}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl opacity-60"
              >
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-500 line-through">
                  {isHe ? item.labelHe : item.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* CTA */}
      {percent < 100 && (
        <Link
          to="/profile/edit"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4
                     rounded-xl bg-[#fe5b25] text-white font-medium text-sm
                     hover:bg-[#e5501f] transition-colors shadow-sm"
        >
          {isHe ? 'השלם פרופיל' : 'Complete Profile'}
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </Link>
      )}
    </div>
  )
}
