import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { PROFESSIONS } from '../lib/professions'
import { timeAgo } from '../lib/shared'
import {
  ArrowLeft,
  Eye,
  Users,
  Clock,
  MapPin,
  Star,
  Shield,
  ShieldCheck,
  MessageCircle,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Radio,
  ChevronRight,
  RefreshCw,
  Inbox,
  Sparkles,
} from 'lucide-react'

/* ───────────────── Types ───────────────── */

interface BroadcastDetail {
  id: string
  lead_id: string
  publisher_id: string
  deal_type: string
  deal_value: string
  description: string | null
  status: string
  max_recipients: number
  sent_count: number
  expires_at: string
  created_at: string
  updated_at: string
  min_tier: string | null
  // Joined from lead
  lead_profession: string | null
  lead_city: string | null
  lead_zip: string | null
  lead_summary: string | null
}

interface Applicant {
  id: string
  contractor_id: string
  status: string
  created_at: string
  full_name: string | null
  slug: string | null
  headline: string | null
  avg_rating: number | null
  review_count: number | null
  tier: string | null
  insurance_verified: boolean | null
  license_number: string | null
  professions: string[] | null
}

/* ───────────────── Helpers ───────────────── */

const profLookup = Object.fromEntries(PROFESSIONS.map((p) => [p.id, p]))

function profLabel(id: string | null): string {
  if (!id) return ''
  return profLookup[id]?.en ?? id
}

function statusColor(s: string) {
  switch (s) {
    case 'open': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
    case 'assigned': return 'bg-blue-500/10 text-blue-600 border-blue-200'
    case 'closed': return 'bg-stone-500/10 text-stone-500 border-stone-200'
    case 'expired': return 'bg-amber-500/10 text-amber-600 border-amber-200'
    default: return 'bg-stone-100 text-stone-500 border-stone-200'
  }
}

function tierBadge(tier: string | null) {
  if (!tier) return null
  const map: Record<string, { bg: string; text: string }> = {
    elite: { bg: 'bg-amber-50', text: 'text-amber-700' },
    trusted: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    verified: { bg: 'bg-[#fe5b25]/10', text: 'text-[#fe5b25]' },
    new: { bg: 'bg-stone-100', text: 'text-stone-500' },
  }
  const style = map[tier] ?? map.new
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </span>
  )
}

function timeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const hrs = Math.floor(diff / 3_600_000)
  if (hrs >= 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h left`
  if (hrs > 0) return `${hrs}h left`
  return `${Math.floor(diff / 60_000)}m left`
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}


/* ───────────────── Component ───────────────── */

export default function PublishedJobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { effectiveUserId } = useAuth()
  const { locale } = useI18n()
  const isHe = locale === 'he'

  const [broadcast, setBroadcast] = useState<BroadcastDetail | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [choosing, setChoosing] = useState<string | null>(null)
  const [rebroadcasting, setRebroadcasting] = useState(false)
  const [rebroadcastMsg, setRebroadcastMsg] = useState<string | null>(null)

  /* ─── Fetch broadcast + responses ─── */

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        // Fetch broadcast with lead info
        const { data: bData, error: bErr } = await supabase
          .from('job_broadcasts')
          .select(`
            id, lead_id, publisher_id, deal_type, deal_value, description,
            status, max_recipients, sent_count, expires_at, created_at, updated_at, min_tier,
            leads!inner ( profession, city, zip_code, parsed_summary )
          `)
          .eq('id', id)
          .maybeSingle()

        if (bErr) throw bErr

        if (!bData) {
          if (!cancelled) setError('Job broadcast not found')
          return
        }

        const lead = (bData as any).leads
        const mapped: BroadcastDetail = {
          ...bData,
          lead_profession: lead?.profession ?? null,
          lead_city: lead?.city ?? null,
          lead_zip: lead?.zip_code ?? null,
          lead_summary: lead?.parsed_summary ?? null,
        }

        if (!cancelled) setBroadcast(mapped)

        // Fetch responses using the RPC
        const { data: rData, error: rErr } = await supabase.rpc('get_broadcast_responses', {
          p_broadcast_id: id,
        })

        if (rErr) throw rErr

        const responses: Applicant[] = (Array.isArray(rData) ? rData : []).map((r: any) => ({
          id: r.id,
          contractor_id: r.contractor_id,
          status: r.status,
          created_at: r.created_at,
          full_name: r.full_name,
          slug: r.slug,
          headline: r.headline,
          avg_rating: r.avg_rating,
          review_count: r.review_count ?? 0,
          tier: r.tier,
          insurance_verified: r.insurance_verified ?? false,
          license_number: r.license_number,
          professions: r.professions ?? [],
        }))

        if (!cancelled) setApplicants(responses)
      } catch (e: any) {
        console.error('[PublishedJobDetail] load error:', e)
        if (!cancelled) {
          setError(e?.message || 'Failed to load broadcast details')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  /* ─── Accept contractor ─── */

  async function handleChoose(contractorId: string) {
    if (!broadcast) return
    setChoosing(contractorId)
    try {
      const { error: err } = await supabase.rpc('choose_contractor_for_broadcast', {
        p_broadcast_id: broadcast.id,
        p_contractor_id: contractorId,
      })
      if (err) throw err
      // Refresh
      setBroadcast((prev) => prev ? { ...prev, status: 'assigned' } : prev)
      setApplicants((prev) =>
        prev.map((a) => ({
          ...a,
          status: a.contractor_id === contractorId ? 'chosen' : a.status === 'interested' ? 'closed' : a.status,
        }))
      )
    } catch (e: any) {
      console.error('[PublishedJobDetail] choose error:', e)
    } finally {
      setChoosing(null)
    }
  }

  /* ─── Rebroadcast ─── */

  async function handleRebroadcast() {
    if (!broadcast || rebroadcasting) return
    setRebroadcasting(true)
    setRebroadcastMsg(null)
    try {
      const { data, error: err } = await supabase.functions.invoke('broadcast-job', {
        body: { action: 'send_broadcast', broadcast_id: broadcast.id },
      })
      if (err) throw err
      const sent = data?.sent_count ?? 0
      setBroadcast(prev => prev ? { ...prev, sent_count: prev.sent_count + sent } : prev)
      setRebroadcastMsg(
        sent > 0
          ? (isHe ? `נשלח ל-${sent} קבלנים נוספים` : `Sent to ${sent} more contractors`)
          : (isHe ? 'אין קבלנים נוספים באזור' : 'No additional contractors found in area')
      )
    } catch (e: any) {
      console.error('[Rebroadcast] error:', e)
      setRebroadcastMsg(isHe ? 'שגיאה בשידור מחדש' : 'Rebroadcast failed')
    } finally {
      setRebroadcasting(false)
    }
  }

  /* ─── Loading ─── */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#fe5b25]" />
      </div>
    )
  }

  if (!broadcast) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="w-8 h-8 text-stone-400" />
        <p className="text-stone-500 text-sm">Job broadcast not found</p>
        <button onClick={() => navigate('/jobs')} className="text-[#fe5b25] text-sm font-medium hover:underline">
          {isHe ? 'חזרה לעבודות' : 'Back to Jobs'}
        </button>
      </div>
    )
  }

  const dealDisplay =
    broadcast.deal_type === 'percentage'
      ? `${broadcast.deal_value}%`
      : broadcast.deal_type === 'fixed_price'
        ? `$${Number(broadcast.deal_value).toLocaleString()}`
        : broadcast.deal_value

  const jobTitle = profLabel(broadcast.lead_profession) || (isHe ? 'עבודה' : 'Job')

  /* ───────────────── Render ───────────────── */

  return (
    <div className="max-w-3xl mx-auto pb-12" dir={isHe ? 'rtl' : 'ltr'}>

      {/* ─── Header ─── */}
      <div className="px-4 sm:px-6 pt-6 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/jobs')}
            className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={16} className="text-stone-600" />
          </button>
          <div className="flex-1" />
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusColor(broadcast.status)}`}>
            {broadcast.status.charAt(0).toUpperCase() + broadcast.status.slice(1)}
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              {jobTitle}
            </h1>
            <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5">
              <MapPin size={11} />
              {broadcast.lead_city || broadcast.lead_zip || 'Unknown location'}
              <span className="text-stone-300">·</span>
              {isHe ? 'פורסם' : 'Posted'} {timeAgo(broadcast.created_at, isHe)}
            </p>
          </div>
          <span className="text-2xl font-bold text-[#fe5b25] whitespace-nowrap">{dealDisplay}</span>
        </div>
      </div>

      {/* ─── Stats bar ─── */}
      <div className="px-4 sm:px-6 mb-5">
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-6 sm:gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
              <Radio size={14} className="text-stone-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-stone-900">{broadcast.sent_count}</p>
              <p className="text-[10px] text-stone-500 uppercase tracking-wide">{isHe ? 'נשלח' : 'Sent'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#fe5b25]/10 flex items-center justify-center">
              <Users size={14} className="text-[#fe5b25]" />
            </div>
            <div>
              <p className="text-lg font-bold text-stone-900">{applicants.length}</p>
              <p className="text-[10px] text-stone-500 uppercase tracking-wide">{isHe ? 'תגובות' : 'Responses'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
              <Clock size={14} className="text-stone-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-700">{timeRemaining(broadcast.expires_at)}</p>
              <p className="text-[10px] text-stone-500 uppercase tracking-wide">{isHe ? 'זמן' : 'Time'}</p>
            </div>
          </div>
          {broadcast.min_tier && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <ShieldCheck size={14} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-700 capitalize">{broadcast.min_tier}+</p>
                <p className="text-[10px] text-stone-500 uppercase tracking-wide">{isHe ? 'דרגה מינימלית' : 'Min Tier'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Job description ─── */}
      <div className="px-4 sm:px-6 mb-5">
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
            {isHe ? 'תיאור העבודה' : 'Job Description'}
          </h2>
          <p className="text-sm leading-relaxed text-stone-700">
            {broadcast.description || broadcast.lead_summary || (isHe ? 'אין תיאור' : 'No description provided.')}
          </p>
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-stone-100">
            <span className="text-xs text-stone-500 flex items-center gap-1">
              <MapPin size={11} />
              {broadcast.lead_city || broadcast.lead_zip || '—'}
            </span>
            <span className="text-xs text-emerald-600 font-semibold">
              {broadcast.deal_type === 'fixed_price' ? 'Fixed' : broadcast.deal_type === 'percentage' ? 'Percentage' : 'Custom'}
              {' · '}{dealDisplay}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Applicant responses ─── */}
      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-stone-700">
            {isHe ? `תגובות (${applicants.length})` : `Responses (${applicants.length})`}
          </h2>
          <span className="text-[10px] text-stone-400">
            {isHe ? 'החדש ביותר' : 'Newest first'}
          </span>
        </div>

        {applicants.length === 0 ? (
          /* Empty state */
          <div className="glass-panel rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-3">
              <Inbox size={24} className="text-stone-400" />
            </div>
            <h3 className="text-sm font-semibold text-stone-700 mb-1">
              {isHe ? 'עדיין אין תגובות' : 'No responses yet'}
            </h3>
            <p className="text-xs text-stone-500 max-w-xs mx-auto">
              {isHe
                ? 'קבלנים עדיין לא הביעו עניין. נסה לשדר מחדש כדי להגיע לעוד קבלנים.'
                : 'Contractors haven\'t responded yet. Try rebroadcasting to reach more contractors in your area.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {applicants.map((a, i) => {
              const isChosen = a.status === 'chosen'
              const isClosed = a.status === 'closed'
              const isBestMatch = i === 0 && a.status === 'interested'

              return (
                <div
                  key={a.id}
                  className={`glass-panel rounded-2xl p-5 transition-all ${
                    isBestMatch ? 'ring-1 ring-[#fe5b25]/20' : ''
                  } ${isChosen ? 'ring-1 ring-emerald-300 bg-emerald-50/30' : ''} ${
                    isClosed ? 'opacity-50' : ''
                  }`}
                >
                  {/* Best match badge */}
                  {isBestMatch && (
                    <div className="flex items-center gap-1 mb-3">
                      <Sparkles size={12} className="text-amber-500" />
                      <span className="text-[10px] font-bold text-amber-600">
                        {isHe ? 'התאמה מובילה' : 'Best match'}
                      </span>
                    </div>
                  )}

                  {/* Chosen badge */}
                  {isChosen && (
                    <div className="flex items-center gap-1 mb-3">
                      <CheckCircle2 size={12} className="text-emerald-600" />
                      <span className="text-[10px] font-bold text-emerald-600">
                        {isHe ? 'נבחר' : 'Accepted'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    {/* Avatar / Initials */}
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#fe5b25] to-orange-400 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {getInitials(a.full_name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-stone-900 truncate">{a.full_name || 'Unknown'}</p>
                        {a.insurance_verified && <ShieldCheck size={13} className="text-[#fe5b25] shrink-0" />}
                      </div>
                      <p className="text-[11px] text-stone-500 truncate">
                        {a.headline || (a.professions?.length ? a.professions.map(profLabel).join(', ') : '—')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {a.avg_rating != null && (
                          <span className="flex items-center gap-0.5 text-[11px] font-semibold text-amber-500">
                            <Star size={10} fill="#f59e0b" className="text-amber-500" />
                            {a.avg_rating.toFixed(1)}
                          </span>
                        )}
                        {(a.review_count ?? 0) > 0 && (
                          <span className="text-[10px] text-stone-400">({a.review_count} reviews)</span>
                        )}
                        {tierBadge(a.tier)}
                      </div>
                    </div>

                    <span className="text-[10px] text-stone-400 whitespace-nowrap shrink-0">
                      {timeAgo(a.created_at, isHe)}
                    </span>
                  </div>

                  {/* Actions */}
                  {!isClosed && !isChosen && broadcast.status === 'open' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleChoose(a.contractor_id)}
                        disabled={choosing !== null}
                        className="flex-1 bg-[#fe5b25] hover:bg-[#e5501f] disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {choosing === a.contractor_id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={13} />
                        )}
                        {isHe ? 'בחר' : 'Accept'}
                      </button>
                      <button className="flex-1 glass-panel py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-stone-50 transition-colors">
                        <MessageCircle size={13} className="text-[#fe5b25]" />
                        {isHe ? 'צ׳אט' : 'Chat'}
                      </button>
                      {a.slug && (
                        <button
                          onClick={() => window.open(`/contractor/${a.slug}`, '_blank')}
                          className="w-10 glass-panel py-2.5 rounded-xl flex items-center justify-center hover:bg-stone-50 transition-colors"
                        >
                          <ChevronRight size={14} className="text-stone-400" />
                        </button>
                      )}
                    </div>
                  )}

                  {isChosen && (
                    <div className="flex gap-2">
                      <button className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5">
                        <CheckCircle2 size={13} />
                        {isHe ? 'התקבל' : 'Accepted'}
                      </button>
                      <button className="flex-1 glass-panel py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-stone-50 transition-colors">
                        <MessageCircle size={13} className="text-[#fe5b25]" />
                        {isHe ? 'צ׳אט' : 'Chat'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Rebroadcast CTA ─── */}
      {broadcast.status === 'open' && (
        <div className="px-4 sm:px-6 mt-6">
          <div className="glass-panel rounded-2xl p-5 text-center">
            <p className="text-xs text-stone-500 mb-3">
              {isHe ? 'לא מוצא את ההתאמה הנכונה?' : 'Not finding the right fit?'}
            </p>
            <button
              onClick={handleRebroadcast}
              disabled={rebroadcasting}
              className="bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white py-3 px-6 rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-2"
            >
              {rebroadcasting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {isHe ? 'שדר מחדש לעוד קבלנים' : 'Rebroadcast to More Contractors'}
            </button>
            {rebroadcastMsg && (
              <p className="text-xs text-stone-500 mt-2">{rebroadcastMsg}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
