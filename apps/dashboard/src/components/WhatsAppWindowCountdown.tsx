import { useState, useEffect } from 'react'
import { MessageCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useContractor } from '../lib/useContractor'
import { useI18n } from '../lib/i18n'

const REBECA_PHONE = '14155238886'
const WA_LINK = `https://wa.me/${REBECA_PHONE}?text=${encodeURIComponent('👋')}`

interface TimeLeft {
  h: number
  m: number
  expired: boolean
}

export default function WhatsAppWindowCountdown() {
  const { contractor } = useContractor()
  const { locale } = useI18n()
  const isHe = locale === 'he'
  const [time, setTime] = useState<TimeLeft | null>(null)

  const windowUntil = contractor?.wa_window_until

  useEffect(() => {
    if (!windowUntil) {
      setTime({ h: 0, m: 0, expired: true })
      return
    }

    function calc(): TimeLeft {
      const diff = new Date(windowUntil!).getTime() - Date.now()
      if (diff <= 0) return { h: 0, m: 0, expired: true }
      return {
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        expired: false,
      }
    }

    setTime(calc())
    const iv = setInterval(() => setTime(calc()), 30_000) // update every 30s
    return () => clearInterval(iv)
  }, [windowUntil])

  if (!contractor?.wa_notify || time === null) return null

  const totalMins = time.h * 60 + time.m

  // Expired
  if (time.expired) {
    return (
      <a
        href={WA_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 transition-colors hover:bg-red-500/15"
      >
        <MessageCircle size={14} className="text-red-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-red-400">
          {isHe ? 'וואטסאפ מנותק — שלח 👋 לחיבור מחדש' : 'WhatsApp disconnected — send 👋 to reconnect'}
        </span>
      </a>
    )
  }

  // < 1 hour — urgent
  if (totalMins < 60) {
    return (
      <a
        href={WA_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 animate-pulse transition-colors hover:bg-red-500/15"
      >
        <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-red-400">
          {isHe
            ? `${time.m} דק׳ נשארו — שלח 👋 להישאר מחובר`
            : `${time.m}m left — send 👋 to stay connected`}
        </span>
      </a>
    )
  }

  // 1-6 hours — warning
  if (time.h < 6) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <MessageCircle size={14} className="text-amber-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-amber-400">
          {isHe ? `⚠ ${time.h} שע׳ ${time.m} דק׳ נשארו` : `⚠ ${time.h}h ${time.m}m left`}
        </span>
      </div>
    )
  }

  // > 6 hours — all good
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
      <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
      <span className="text-[11px] font-semibold text-emerald-400">
        {isHe ? `וואטסאפ מחובר ✓ ${time.h} שע׳ ${time.m} דק׳` : `WhatsApp ✓ ${time.h}h ${time.m}m`}
      </span>
    </div>
  )
}
