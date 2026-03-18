import { ArrowRight, Users, DollarSign, BarChart3, MessageCircle } from 'lucide-react'
import { Player } from '@remotion/player'
import { useLang } from '../i18n/LanguageContext'
import {
  SubcontractorDemo,
  DEMO_DURATION_FRAMES,
  DEMO_FPS,
  DEMO_WIDTH,
  DEMO_HEIGHT,
} from '../remotion/SubcontractorDemo'

export default function SubcontractorFeature() {
  const { lang } = useLang()
  const he = lang === 'he'

  const features = [
    {
      icon: Users,
      title: he ? 'נהל קבלני משנה' : 'Manage Subcontractors',
      desc: he
        ? 'בנה רשת של קבלני משנה אמינים עם פרופילים, מקצועות, ומעקב ביצועים.'
        : 'Build a trusted network of subs with profiles, trades, and performance tracking.',
    },
    {
      icon: MessageCircle,
      title: he ? 'שליחה ב-WhatsApp' : 'WhatsApp Forwarding',
      desc: he
        ? 'העבר לידים בלחיצה אחת עם הודעה מוכנה — כתובת, פרטי עבודה, ולינק לפורטל.'
        : 'Forward leads in one click with a ready-made message — address, job details, and portal link.',
    },
    {
      icon: DollarSign,
      title: he ? 'הגדר תנאי עסקה' : 'Set Deal Terms',
      desc: he
        ? 'בחר אחוזים, מחיר קבוע, או התאמה אישית — אתה שולט בחלוקה.'
        : 'Choose percentage, fixed price, or custom — you control the split.',
    },
    {
      icon: BarChart3,
      title: he ? 'מעקב עבודות' : 'Track Every Job',
      desc: he
        ? 'דשבורד מלא עם סטטוסים, תשלומים, ולוחות זמנים לכל עבודה.'
        : 'Full dashboard with status, payments, and timelines for every job.',
    },
  ]

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #0f0f1a 40%, #1a0f0a 100%)' }}
    >
      <div className="max-w-7xl mx-auto px-6 py-24">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#fe5b25]/10 border border-[#fe5b25]/20 mb-6">
            <Users className="w-4 h-4 text-[#fe5b25]" />
            <span className="text-xs font-bold text-[#fe5b25] uppercase tracking-wider">
              {he ? 'ניהול קבלני משנה' : 'Subcontractor Management'}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5" style={{ letterSpacing: -1.5 }}>
            {he ? (
              <>לידים שאתה לא יכול לקחת?<br /><span className="text-[#fe5b25]">תרוויח מהם בכל זאת.</span></>
            ) : (
              <>Leads you can't take?<br /><span className="text-[#fe5b25]">Earn from them anyway.</span></>
            )}
          </h2>
          <p className="text-lg text-white/40 max-w-2xl mx-auto leading-relaxed">
            {he
              ? 'העבר לידים לרשת קבלני המשנה שלך, הגדר תנאי עסקה, ועקוב אחרי כל עבודה — הכל ממקום אחד.'
              : 'Forward leads to your sub network, set deal terms, and track every job — all from one place.'}
          </p>
        </div>

        {/* Video — full width, bigger */}
        <div className="rounded-2xl overflow-hidden mb-16" style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
          <Player
            component={SubcontractorDemo}
            durationInFrames={DEMO_DURATION_FRAMES}
            fps={DEMO_FPS}
            compositionWidth={DEMO_WIDTH}
            compositionHeight={DEMO_HEIGHT}
            style={{ width: '100%' }}
            autoPlay
            loop
            controls={false}
          />
        </div>

        {/* Features grid — 4 columns below */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
              <div className="w-12 h-12 rounded-xl bg-[#fe5b25]/10 border border-[#fe5b25]/15 flex items-center justify-center">
                <f.icon className="w-5 h-5 text-[#fe5b25]" />
              </div>
              <h3 className="text-white font-bold text-sm">{f.title}</h3>
              <p className="text-white/35 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA centered */}
        <div className="flex justify-center mt-10">
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#fe5b25] text-white font-bold text-sm hover:bg-[#e04d1c] transition-all shadow-lg shadow-orange-600/20"
          >
            {he ? 'התחל עכשיו' : 'Get Started'}
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  )
}
