import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import {
  Send,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Smartphone,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'

const BOT_NAME = 'LeadExpressBot'

function qrUrl(data: string, size = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=FAFAF8&color=2D6A4F&margin=8`
}

export default function TelegramConnect() {
  const { profile } = useAuth()
  const { locale } = useI18n()
  const isRtl = locale === 'he'

  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  const isConnected = !!profile?.telegram_chat_id

  async function generateLink() {
    setGenerating(true)
    try {
      // TODO: In production, call Supabase Edge Function:
      // const { data } = await supabase.functions.invoke('create-telegram-link')
      // setLinkToken(data.token)

      // Dev mode — generate a placeholder token
      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      setLinkToken(token)
    } finally {
      setGenerating(false)
    }
  }

  const telegramUrl = linkToken ? `https://t.me/${BOT_NAME}?start=${linkToken}` : null

  async function copyLink() {
    if (!telegramUrl) return
    await navigator.clipboard.writeText(telegramUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
          {isRtl ? 'חיבור טלגרם' : 'Connect Telegram'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'hsl(40 4% 42%)' }}>
          {isRtl
            ? 'חבר את חשבון הטלגרם שלך כדי לקבל לידים ישירות לנייד.'
            : 'Connect your Telegram to receive leads directly on your phone.'}
        </p>
      </div>

      {isConnected ? (
        /* ── Connected state ── */
        <div className="glass-panel p-8 text-center">
          <div
            className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'hsl(152 46% 85%)' }}
          >
            <CheckCircle2 className="w-10 h-10" style={{ color: 'hsl(155 44% 30%)' }} />
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'hsl(40 8% 10%)' }}>
            {isRtl ? 'טלגרם מחובר!' : 'Telegram Connected!'}
          </h2>
          <p className="text-sm mb-4" style={{ color: 'hsl(40 4% 42%)' }}>
            {isRtl
              ? 'אתה מוגדר לקבל לידים חדשים ישירות לטלגרם.'
              : "You're set to receive new leads directly in Telegram."}
          </p>

          <div
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs"
            style={{ background: 'hsl(152 46% 85% / 0.3)', color: 'hsl(155 44% 30%)' }}
          >
            <Send className="w-3.5 h-3.5" />
            Chat ID: {profile?.telegram_chat_id}
          </div>

          {/* What to expect */}
          <div
            className="mt-6 rounded-xl p-4 text-start text-sm"
            style={{ background: 'hsl(40 15% 96%)', color: 'hsl(40 4% 42%)' }}
          >
            <p className="font-medium mb-2" style={{ color: 'hsl(40 8% 10%)' }}>
              {isRtl ? 'מה לצפות:' : 'What to expect:'}
            </p>
            <ul className="space-y-1.5">
              {[
                isRtl ? '🔥 לידים חמים ישלחו אליך מיד' : '🔥 Hot leads sent to you instantly',
                isRtl ? '✅ תפוס ליד בלחיצת כפתור' : '✅ Claim leads with one tap',
                isRtl ? '📊 צפה בסטטוס עם /status' : '📊 Check your status with /status',
                isRtl ? '⚙️ עדכן העדפות עם /professions' : '⚙️ Update preferences with /professions',
              ].map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        /* ── Not connected ── */
        <div className="space-y-5">
          {/* How it works — steps */}
          <div className="glass-panel p-6">
            <h2 className="text-base font-medium mb-5" style={{ color: 'hsl(40 8% 10%)' }}>
              {isRtl ? 'איך זה עובד?' : 'How it works'}
            </h2>
            <div className="space-y-5">
              {[
                {
                  icon: <QrCode className="w-5 h-5" />,
                  en: 'Generate your personal QR code below.',
                  he: 'צור קוד QR אישי למטה.',
                },
                {
                  icon: <Smartphone className="w-5 h-5" />,
                  en: 'Scan the QR with your phone camera — it opens Telegram automatically.',
                  he: 'סרוק את ה-QR עם המצלמה — הוא פותח את הטלגרם אוטומטית.',
                },
                {
                  icon: <ArrowRight className="w-5 h-5" />,
                  en: 'The bot will guide you to pick your professions and service areas.',
                  he: 'הבוט ידריך אותך לבחור מקצועות ואזורי שירות.',
                },
                {
                  icon: <CheckCircle2 className="w-5 h-5" />,
                  en: "Done! You'll start receiving matching leads instantly.",
                  he: 'סיימת! תתחיל לקבל לידים מתאימים באופן מיידי.',
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'hsl(155 44% 30%)', color: 'white' }}
                  >
                    {item.icon}
                  </div>
                  <p className="text-sm pt-1.5" style={{ color: 'hsl(40 4% 42%)' }}>
                    {isRtl ? item.he : item.en}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* QR Code section */}
          {!linkToken ? (
            <button
              onClick={generateLink}
              disabled={generating}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              {generating
                ? isRtl ? 'מייצר...' : 'Generating...'
                : isRtl ? 'צור קוד QR' : 'Generate QR Code'}
            </button>
          ) : (
            <div className="glass-panel p-6 space-y-5">
              {/* QR Code */}
              <div className="flex flex-col items-center">
                <p className="text-sm font-medium mb-4" style={{ color: 'hsl(40 8% 10%)' }}>
                  {isRtl ? 'סרוק עם הטלפון:' : 'Scan with your phone:'}
                </p>
                <div
                  className="rounded-2xl p-3 shadow-lg"
                  style={{ background: '#FAFAF8', border: '2px solid hsl(155 44% 30% / 0.2)' }}
                >
                  <img
                    src={qrUrl(telegramUrl!)}
                    alt="Telegram QR Code"
                    width={280}
                    height={280}
                    className="rounded-xl"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                <p className="text-xs mt-3" style={{ color: 'hsl(40 4% 55%)' }}>
                  {isRtl
                    ? 'פותח את הטלפון ← מצלמה ← סרוק את הקוד'
                    : 'Open phone camera → point at QR → tap the link'}
                </p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'hsl(35 15% 88%)' }} />
                <span className="text-xs" style={{ color: 'hsl(40 4% 55%)' }}>
                  {isRtl ? 'או' : 'or'}
                </span>
                <div className="flex-1 h-px" style={{ background: 'hsl(35 15% 88%)' }} />
              </div>

              {/* Copy link */}
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'hsl(40 4% 42%)' }}>
                  {isRtl ? 'שתף קישור ישירות:' : 'Share link directly:'}
                </p>
                <div
                  className="flex items-center gap-2 rounded-xl p-3 text-sm"
                  style={{ background: 'hsl(152 46% 85% / 0.2)' }}
                >
                  <code
                    className="flex-1 truncate text-xs"
                    style={{ color: 'hsl(155 44% 30%)' }}
                  >
                    {telegramUrl}
                  </code>
                  <button
                    onClick={copyLink}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-white/50 transition"
                    style={{ color: 'hsl(155 44% 30%)' }}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Open directly */}
              <a
                href={telegramUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
              >
                <ExternalLink className="w-4 h-4" />
                {isRtl ? 'פתח בטלגרם' : 'Open in Telegram'}
              </a>

              {/* Regenerate */}
              <button
                onClick={generateLink}
                className="w-full text-center text-xs py-1"
                style={{ color: 'hsl(40 4% 55%)' }}
              >
                {isRtl ? 'צור קישור חדש' : 'Generate new link'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
