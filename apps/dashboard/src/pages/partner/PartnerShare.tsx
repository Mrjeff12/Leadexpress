import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { usePartnerProfile } from '../../hooks/usePartnerProfile'
import { useToast } from '../../components/hooks/use-toast'
import {
  Copy,
  Check,
  Share2,
  MessageCircle,
  Mail,
  Globe,
  QrCode,
  Link2,
  Sparkles,
  Gift,
} from 'lucide-react'

export default function PartnerShare() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { toast } = useToast()
  const { partner, loading } = usePartnerProfile()
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null)

  const referralUrl = partner ? `https://leadexpress.co/join/${partner.slug}` : ''

  function copyToClipboard(text: string, id?: string) {
    navigator.clipboard.writeText(text)
    if (id) {
      setCopiedTemplate(id)
      setTimeout(() => setCopiedTemplate(null), 2000)
    } else {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
    toast({
      title: he ? 'הועתק!' : 'Copied!',
      description: he ? 'הטקסט הועתק ללוח' : 'Text copied to clipboard',
    })
  }

  const templates = [
    {
      id: 'whatsapp',
      icon: MessageCircle,
      color: '#25D366',
      label: 'WhatsApp',
      text: he
        ? `היי! אני משתמש ב-Lead Express כדי לקבל לידים ישר לווצאפ. Game changer.\n\n🎁 כל מי שנרשם דרך הקישור שלי מקבל 7 ימי ניסיון חינם!\n\n${referralUrl}`
        : `Hey everyone! I've been using Lead Express to get job leads straight to my WhatsApp. Game changer.\n\n🎁 Everyone who signs up through my link gets a FREE 7-day trial!\n\nIf you want to try it, here's my link:\n${referralUrl}`,
    },
    {
      id: 'email',
      icon: Mail,
      color: '#6366f1',
      label: 'Email',
      text: he
        ? `שלום,\n\nרציתי לשתף איתך כלי שעוזר לי לקבל לידים חדשים ישירות לווצאפ.\n\nLead Express סורק קבוצות WhatsApp של קבלנים ושולח לידים רלוונטיים באזור שלך.\n\n🎁 יש 7 ימי ניסיון חינם למי שנרשם דרך הקישור שלי:\n${referralUrl}\n\nבהצלחה!`
        : `Hi,\n\nI wanted to share a tool that's been helping me get new leads from WhatsApp groups.\n\nLead Express scans contractor WhatsApp groups and sends me relevant leads in my area.\n\n🎁 Sign up through my link and get a FREE 7-day trial — no credit card needed:\n${referralUrl}\n\nCheers!`,
    },
    {
      id: 'social',
      icon: Globe,
      color: '#fe5b25',
      label: he ? 'רשתות חברתיות' : 'Social',
      text: he
        ? `💡 טיפ לקבלנים: הכירו את Lead Express - כלי שסורק קבוצות WhatsApp ומוצא לכם לידים חדשים באזור שלכם.\n\n🎁 7 ימי ניסיון חינם דרך הקישור שלי:\n${referralUrl}`
        : `💡 Pro tip for contractors: Check out Lead Express - it scans WhatsApp groups and finds you new leads in your area.\n\n🎁 Get a FREE 7-day trial through my link:\n${referralUrl}`,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-[#fe5b25] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-8 pb-16 pt-2">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          {he ? 'שתף והרוויח' : 'Share & Earn'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {he ? 'שתף את הקישור שלך כדי להרוויח 15% עמלה חוזרת' : 'Share your link to earn 15% recurring commission'}
        </p>
      </header>

      {/* Referral Link Card */}
      <div className="glass-panel p-6 border-none shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#fff4ef] text-[#fe5b25] flex items-center justify-center">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900">{he ? 'קישור ההפניה שלך' : 'Your Referral Link'}</h2>
            <p className="text-xs text-zinc-400">{he ? 'שתף קישור זה עם קבלנים' : 'Share this link with contractors'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 px-4 py-3.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-mono text-zinc-700 truncate">
            {referralUrl}
          </div>
          <button
            onClick={() => copyToClipboard(referralUrl)}
            className="shrink-0 flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold text-white transition-all shadow-md shadow-[#fe5b25]/20"
            style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedLink ? (he ? 'הועתק!' : 'Copied!') : (he ? 'העתק' : 'Copy')}
          </button>
        </div>
      </div>

      {/* 7-Day Free Trial Banner */}
      <div className="glass-panel p-5 border-none shadow-lg bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-emerald-800">
              {he ? '🎁 7 ימי ניסיון חינם לכל מי שנרשם!' : '🎁 7-Day FREE Trial for Everyone!'}
            </h3>
            <p className="text-xs text-emerald-600 mt-0.5">
              {he
                ? 'כל מי שנרשם דרך הקישור שלך מקבל 7 ימי ניסיון חינם. ככה קל יותר לשכנע אותם!'
                : 'Everyone who signs up through your link gets a free 7-day trial. Makes it much easier to convince them!'}
            </p>
          </div>
        </div>
      </div>

      {/* WhatsApp Preview Mockup */}
      <div className="glass-panel p-6 border-none shadow-lg">
        <h2 className="text-sm font-bold text-zinc-900 mb-4">
          {he ? 'כך זה ייראה בקבוצה שלך' : 'This is how it looks in your group'}
        </h2>
        <div className="rounded-2xl overflow-hidden border border-zinc-200" style={{ background: '#e5ddd5' }}>
          {/* WhatsApp header */}
          <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#075e54' }}>
            <div className="w-8 h-8 rounded-full overflow-hidden">
              <img src="https://i.pravatar.cc/64?img=12" alt="" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {he ? 'קבוצת קבלנים 🔨' : 'Contractors Hub 🔨'}
              </p>
              <p className="text-[10px] text-white/60">
                {he ? '48 משתתפים' : '48 participants'}
              </p>
            </div>
          </div>

          {/* Chat messages */}
          <div className="px-4 py-5 space-y-3">
            {/* Other people messages */}
            <div className="flex gap-2 max-w-[85%]">
              <img src="https://i.pravatar.cc/40?img=33" alt="" className="w-7 h-7 rounded-full shrink-0 mt-1" />
              <div className="rounded-xl rounded-tl-sm px-3 py-2 text-[13px] leading-relaxed shadow-sm" style={{ background: '#ffffff' }}>
                <p className="text-[11px] font-bold text-teal-700 mb-0.5">Mike R.</p>
                {he ? 'מישהו מכיר חשמלאי טוב באזור מיאמי?' : 'Anyone know a good electrician in Miami area?'}
              </div>
            </div>

            <div className="flex gap-2 max-w-[85%]">
              <img src="https://i.pravatar.cc/40?img=51" alt="" className="w-7 h-7 rounded-full shrink-0 mt-1" />
              <div className="rounded-xl rounded-tl-sm px-3 py-2 text-[13px] leading-relaxed shadow-sm" style={{ background: '#ffffff' }}>
                <p className="text-[11px] font-bold text-indigo-700 mb-0.5">David K.</p>
                {he ? 'אצלנו הרבה עבודה השבוע 💪' : 'Business is booming this week 💪'}
              </div>
            </div>

            {/* Partner's message (green bubble) */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-xl rounded-tr-sm px-3 py-2 text-[13px] leading-relaxed shadow-sm" style={{ background: '#dcf8c6' }}>
                <p className="whitespace-pre-line">
                  {he
                    ? `היי! אני משתמש ב-Lead Express כדי לקבל לידים ישר לווצאפ. Game changer.\n\n🎁 כל מי שנרשם דרך הקישור שלי מקבל 7 ימי ניסיון חינם!\n\n`
                    : `Hey everyone! I've been using Lead Express to get job leads straight to my WhatsApp. Game changer.\n\n🎁 Everyone who signs up through my link gets a FREE 7-day trial!\n\n`}
                  <span className="text-blue-600 underline">{referralUrl || 'leadexpress.co/join/you'}</span>
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-zinc-500">10:42</span>
                  <svg viewBox="0 0 16 11" className="w-4 h-3 text-blue-500 fill-current">
                    <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.146l-.311.31a.445.445 0 0 0-.14.337c0 .136.047.249.14.337l2.995 2.83c.09.089.2.147.335.174.136.027.263.004.381-.065.118-.07.218-.17.3-.3l6.64-8.203a.446.446 0 0 0 .102-.363.476.476 0 0 0-.18-.323l-.304-.173z" />
                    <path d="M14.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.136-.313.313 1.793 1.694c.09.089.2.147.335.174.136.027.263.004.381-.065.118-.07.218-.17.3-.3l6.64-8.203a.446.446 0 0 0 .102-.363.476.476 0 0 0-.18-.323l-.304-.173z" opacity=".4" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Reactions from group */}
            <div className="flex gap-2 max-w-[85%]">
              <img src="https://i.pravatar.cc/40?img=15" alt="" className="w-7 h-7 rounded-full shrink-0 mt-1" />
              <div className="rounded-xl rounded-tl-sm px-3 py-2 text-[13px] leading-relaxed shadow-sm" style={{ background: '#ffffff' }}>
                <p className="text-[11px] font-bold text-orange-700 mb-0.5">Carlos M.</p>
                {he ? 'מעניין! אני בודק את זה 👀' : 'Interesting! Checking it out 👀'}
              </div>
            </div>

            <div className="flex gap-2 max-w-[85%]">
              <img src="https://i.pravatar.cc/40?img=60" alt="" className="w-7 h-7 rounded-full shrink-0 mt-1" />
              <div className="rounded-xl rounded-tl-sm px-3 py-2 text-[13px] leading-relaxed shadow-sm" style={{ background: '#ffffff' }}>
                <p className="text-[11px] font-bold text-purple-700 mb-0.5">James T.</p>
                {he ? '7 ימים חינם? אני בפנים! 🔥' : '7 days free? I\'m in! 🔥'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Code */}
        <div className="glass-panel p-6 border-none shadow-lg flex flex-col items-center">
          <div className="flex items-center gap-2 mb-4 self-start">
            <QrCode className="w-5 h-5 text-zinc-400" />
            <h2 className="text-sm font-bold text-zinc-900">{he ? 'קוד QR' : 'QR Code'}</h2>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-zinc-100 shadow-sm">
            {referralUrl && (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(referralUrl)}`}
                alt="QR Code"
                width={200}
                height={200}
                className="w-[200px] h-[200px]"
              />
            )}
          </div>
          <p className="text-[11px] text-zinc-400 mt-3 text-center">
            {he ? 'סרוק כדי לפתוח את דף ההרשמה' : 'Scan to open the signup page'}
          </p>
        </div>

        {/* Share Templates */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-zinc-400" />
            <h2 className="text-sm font-bold text-zinc-900">
              {he ? 'תבניות הודעה מוכנות' : 'Ready-to-Share Templates'}
            </h2>
          </div>

          {templates.map(template => (
            <div key={template.id} className="glass-panel p-5 border-none shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${template.color}10`, color: template.color }}
                  >
                    <template.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-zinc-800">{template.label}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(template.text, template.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 border border-zinc-200 hover:bg-zinc-50 transition-all"
                >
                  {copiedTemplate === template.id ? (
                    <><Check className="w-3.5 h-3.5 text-green-500" /> {he ? 'הועתק!' : 'Copied!'}</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> {he ? 'העתק' : 'Copy'}</>
                  )}
                </button>
              </div>
              <div className="px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-100">
                <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line line-clamp-4">
                  {template.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tip */}
      <div className="rounded-2xl p-5 bg-[#fff4ef] border border-[#fee8df] flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-[#fe5b25] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[#c43d10] mb-1">
            {he ? 'טיפ להגדלת הרווח' : 'Pro tip to maximize earnings'}
          </p>
          <p className="text-xs text-[#c43d10]/70">
            {he
              ? 'שתף את הקישור ישירות בקבוצות WhatsApp שלך. הנסיון החינם של 7 ימים הופך את זה לקל — אין סיכון, אין כרטיס אשראי. הודעות אישיות עובדות הכי טוב!'
              : 'Share your link directly in WhatsApp groups. The 7-day free trial makes it a no-brainer — no risk, no credit card. Personal messages convert best!'}
          </p>
        </div>
      </div>
    </div>
  )
}
