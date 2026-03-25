import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/shared'
import TrustBadge from './TrustBadge'
import StarRating from './StarRating'
import {
  X,
  Loader2,
  Sparkles,
  MapPin,
  Clock,
  Send,
  ShieldCheck,
  BadgeCheck,
  ExternalLink,
  CheckCircle,
  Users,
} from 'lucide-react'

/* ───────────────── Types ───────────────── */

interface BroadcastResponsesPanelProps {
  broadcast: {
    id: string
    status: string
    deal_type: string
    deal_value: string
    description: string | null
    sent_count: number
    expires_at: string
    created_at: string
    lead?: {
      profession: string
      city: string | null
      zip_code: string | null
      parsed_summary: string | null
    }
  } | null
  isOpen: boolean
  onClose: () => void
  onChoose: (broadcastId: string, contractorId: string) => Promise<void>
}

interface BroadcastResponse {
  contractor_id: string
  full_name: string
  headline: string | null
  slug: string | null
  trust_tier: 'new' | 'verified' | 'trusted' | 'elite'
  avg_rating: number | null
  review_count: number
  professions: string[]
  insurance_verified: boolean
  licensed: boolean
  is_chosen: boolean
  responded_at: string
}

/* ───────────────── Helpers ───────────────── */

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Deterministic gradient from name string */
function avatarGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const gradients = [
    'from-orange-500 to-pink-500',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-purple-500 to-fuchsia-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-red-500',
    'from-indigo-500 to-violet-500',
    'from-lime-500 to-green-500',
  ]
  return gradients[Math.abs(hash) % gradients.length]
}

function timeRemaining(expiresAt: string, he: boolean): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return he ? 'פג תוקף' : 'Expired'
  const hrs = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hrs > 24) {
    const days = Math.floor(hrs / 24)
    return he ? `${days} ימים נותרו` : `${days}d remaining`
  }
  if (hrs > 0) return he ? `${hrs} שע׳ ${mins} דק׳ נותרו` : `${hrs}h ${mins}m remaining`
  return he ? `${mins} דק׳ נותרו` : `${mins}m remaining`
}

/* ───────────────── Status Badge ───────────────── */

function StatusBadge({ status, he }: { status: string; he: boolean }) {
  const config: Record<string, { label: string; labelHe: string; cls: string }> = {
    pending:  { label: 'Pending',  labelHe: 'ממתין',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    open:     { label: 'Open',     labelHe: 'פתוח',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    assigned: { label: 'Assigned', labelHe: 'הוקצה',  cls: 'bg-green-50 text-green-700 border-green-200' },
    expired:  { label: 'Expired',  labelHe: 'פג תוקף', cls: 'bg-stone-100 text-stone-500 border-stone-200' },
    cancelled:{ label: 'Cancelled',labelHe: 'בוטל',   cls: 'bg-red-50 text-red-700 border-red-200' },
  }
  const c = config[status] || config.pending
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${c.cls}`}>
      {he ? c.labelHe : c.label}
    </span>
  )
}

/* ───────────────── Skeleton ───────────────── */

function ResponseSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-stone-100 p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-stone-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-stone-200 rounded" />
              <div className="h-3 w-20 bg-stone-100 rounded" />
            </div>
            <div className="h-8 w-20 bg-stone-200 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ───────────────── Component ───────────────── */

export default function BroadcastResponsesPanel({
  broadcast,
  isOpen,
  onClose,
  onChoose,
}: BroadcastResponsesPanelProps) {
  const { locale } = useI18n()
  const panelRef = useRef<HTMLDivElement>(null)
  const he = locale === 'he'

  const [responses, setResponses] = useState<BroadcastResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [choosingId, setChoosingId] = useState<string | null>(null)

  /* ── Fetch responses when opened ── */
  useEffect(() => {
    if (!isOpen || !broadcast) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase.rpc('get_broadcast_responses', {
          p_broadcast_id: broadcast!.id,
        })
        if (cancelled) return
        if (error) throw error
        setResponses((data as BroadcastResponse[]) || [])
      } catch (err) {
        console.error('Failed to load broadcast responses:', err)
        if (!cancelled) setResponses([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [isOpen, broadcast?.id])

  /* ── Handle choose ── */
  async function handleChoose(contractorId: string) {
    if (!broadcast) return
    setChoosingId(contractorId)
    try {
      await onChoose(broadcast.id, contractorId)
    } finally {
      setChoosingId(null)
    }
  }

  if (!isOpen || !broadcast) return null

  const location = broadcast.lead
    ? [broadcast.lead.city, broadcast.lead.zip_code].filter(Boolean).join(', ')
    : ''

  const dealLabel = broadcast.deal_type === 'percentage'
    ? `${broadcast.deal_value}% ${he ? 'מהעבודה' : 'of job'}`
    : broadcast.deal_type === 'fixed_price'
      ? `$${broadcast.deal_value} ${he ? 'קבוע' : 'fixed'}`
      : broadcast.deal_value

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-[440px] max-w-full bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#fee8df] to-[#fff4ef] flex items-center justify-center border border-[#fdd5c5] shrink-0">
              <Users className="w-4 h-4 text-[#e04d1c]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-stone-800 truncate">
                  {he ? 'תגובות לשידור' : 'Broadcast Responses'}
                </h2>
                <StatusBadge status={broadcast.status} he={he} />
              </div>
              {location && (
                <p className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {location}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Broadcast Summary */}
          <div className="px-6 py-5 border-b border-stone-100">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-3">
              {he ? 'פרטי שידור' : 'Broadcast Details'}
            </p>

            {/* Profession + deal */}
            {broadcast.lead?.profession && (
              <p className="text-sm font-semibold text-stone-800 mb-1">
                {broadcast.lead.profession}
              </p>
            )}

            {broadcast.lead?.parsed_summary && (
              <p className="text-xs text-stone-500 leading-relaxed line-clamp-2 mb-3">
                {broadcast.lead.parsed_summary}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {/* Deal terms */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#fff4ef] text-[#e04d1c] border border-[#fdd5c5]">
                {dealLabel}
              </span>

              {/* Sent count */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                <Send className="w-3 h-3" />
                {he ? `נשלח ל-${broadcast.sent_count}` : `Sent to ${broadcast.sent_count}`}
              </span>

              {/* Time remaining */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                <Clock className="w-3 h-3" />
                {timeRemaining(broadcast.expires_at, he)}
              </span>
            </div>
          </div>

          {/* Responses Section */}
          <div className="px-6 py-5">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-4">
              {he ? 'קבלנים מעוניינים' : 'Interested Contractors'}
              {!loading && responses.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[#fe5b25] text-white text-[10px]">
                  {responses.length}
                </span>
              )}
            </p>

            {loading ? (
              <ResponseSkeleton />
            ) : responses.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-full bg-[#fff4ef] flex items-center justify-center mb-4 border border-[#fdd5c5]">
                  <Sparkles className="w-6 h-6 text-[#e04d1c]" />
                </div>
                <p className="text-sm font-semibold text-stone-800 mb-1">
                  {he ? 'אין תגובות עדיין' : 'No responses yet'}
                </p>
                <p className="text-xs text-stone-400 max-w-[240px]">
                  {he
                    ? 'קבלנים יראו את השידור ויוכלו להביע עניין'
                    : 'Contractors will see the broadcast and can express interest'}
                </p>
              </div>
            ) : (
              /* Response Cards */
              <div className="space-y-3">
                {responses.map((r) => {
                  const isChosen = broadcast.status === 'assigned' && r.is_chosen
                  return (
                    <div
                      key={r.contractor_id}
                      className={`rounded-2xl border p-4 transition-all ${
                        isChosen
                          ? 'border-[#fe5b25] bg-[#fff4ef] ring-1 ring-[#fdd5c5]'
                          : 'border-stone-100 bg-white hover:border-stone-200 hover:shadow-sm'
                      }`}
                    >
                      {/* Chosen badge */}
                      {isChosen && (
                        <div className="flex items-center gap-1.5 mb-3 px-2 py-1 rounded-lg bg-[#fe5b25]/10 w-fit">
                          <CheckCircle className="w-3.5 h-3.5 text-[#fe5b25]" />
                          <span className="text-[11px] font-bold text-[#e04d1c]">
                            {he ? 'נבחר' : 'Chosen'}
                          </span>
                        </div>
                      )}

                      {/* Top row: avatar + name + trust badge */}
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient(
                            r.full_name
                          )} text-white text-xs font-bold`}
                        >
                          {getInitials(r.full_name)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-stone-800 truncate">
                              {r.full_name}
                            </p>
                            <TrustBadge tier={r.trust_tier} size="sm" />
                          </div>

                          {r.headline && (
                            <p className="text-xs text-stone-500 truncate mt-0.5">
                              {r.headline}
                            </p>
                          )}

                          {/* Rating */}
                          {r.avg_rating != null && r.avg_rating > 0 && (
                            <div className="mt-1.5">
                              <StarRating
                                rating={r.avg_rating}
                                size="sm"
                                showValue
                                count={r.review_count}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Profession tags */}
                      {r.professions && r.professions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {r.professions.slice(0, 4).map((prof) => (
                            <span
                              key={prof}
                              className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-medium border border-stone-200"
                            >
                              {prof}
                            </span>
                          ))}
                          {r.professions.length > 4 && (
                            <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-400 text-[10px] font-medium">
                              +{r.professions.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Verification badges */}
                      {(r.insurance_verified || r.licensed) && (
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          {r.insurance_verified && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200">
                              <ShieldCheck className="w-3 h-3" />
                              {he ? 'ביטוח מאומת' : 'Insured'}
                            </span>
                          )}
                          {r.licensed && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-200">
                              <BadgeCheck className="w-3 h-3" />
                              {he ? 'בעל רישיון' : 'Licensed'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Responded time */}
                      <p className="text-[10px] text-stone-400 mt-2.5">
                        {he ? 'הגיב ' : 'Responded '}
                        {timeAgo(r.responded_at, he)}
                      </p>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-3">
                        {r.slug && (
                          <a
                            href={`/pro/${r.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-bold rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {he ? 'צפה בפרופיל' : 'View Profile'}
                          </a>
                        )}

                        {broadcast.status !== 'assigned' && (
                          <button
                            onClick={() => handleChoose(r.contractor_id)}
                            disabled={choosingId !== null}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#fe5b25] hover:bg-[#e04d1c] text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 ml-auto"
                          >
                            {choosingId === r.contractor_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            {he ? 'בחר' : 'Choose'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide-in keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
