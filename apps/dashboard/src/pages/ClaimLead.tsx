import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  MapPin, Flame, Zap, Snowflake, ExternalLink, MessageCircle,
  Loader2, CheckCircle2, AlertCircle, ChevronRight, ShieldCheck, ShieldAlert,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  profession: string
  parsed_summary: string | null
  raw_message: string | null
  city: string | null
  zip_code: string | null
  urgency: 'hot' | 'warm' | 'cold'
  budget_range: string | null
  sender_id: string | null
  created_at: string
  group_name: string | null
  property_type: string | null
}

interface Publisher {
  id: string
  full_name: string | null
  slug: string | null
  trust_tier: string | null
  avatar_url: string | null
  business_name: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PROF_EMOJI: Record<string, string> = {
  hvac: '❄️', air_duct: '🌀', chimney: '🏠', garage_door: '🚗', roofing: '🏗️',
  plumbing: '🚰', electrical: '⚡', carpet_cleaning: '🧹', dryer_vent: '💨',
  locksmith: '🔑', fencing: '🧱', renovation: '🔨', cleaning: '✨', other: '📋',
}

const URG = {
  hot:  { icon: Flame,     label: '🔥 ASAP',      color: '#fe5b25', bg: '#fff3ed' },
  warm: { icon: Zap,       label: '⚡ This Week',  color: '#f59e0b', bg: '#fffbeb' },
  cold: { icon: Snowflake, label: '❄️ Flexible',   color: '#3b82f6', bg: '#eff6ff' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  return 'Posted today'
}

function profLabel(p: string) {
  return p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function decodeToken(t: string): { l: string; u: string; p: string; m: string } | null {
  try {
    const padded = t.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ClaimLead() {
  const { leadId } = useParams<{ leadId: string }>()
  const [params] = useSearchParams()
  const nav = useNavigate()

  const [lead, setLead] = useState<Lead | null>(null)
  const [publisher, setPublisher] = useState<Publisher | null>(null)
  const [claimCount, setClaimCount] = useState(0)
  const [senderPhone, setSenderPhone] = useState('')
  const [introMsg, setIntroMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!leadId) { setError('Invalid link'); setLoading(false); return }

    // Data is passed via ?d= param from claim-redirect (base64 encoded, bypasses RLS)
    const dataParam = params.get('d')
    if (dataParam) {
      try {
        const padded = dataParam.replace(/-/g, '+').replace(/_/g, '/')
        const parsed = JSON.parse(atob(padded))
        setLead(parsed.lead as Lead)
        setPublisher(parsed.publisher as Publisher | null)
        setClaimCount(parsed.claimCount ?? 0)
        setSenderPhone(parsed.senderPhone || '')
        setIntroMsg(parsed.introMsg || '')
        setLoading(false)
        return
      } catch (e) {
        console.error('[ClaimLead] Failed to parse data param:', e)
      }
    }

    // Fallback: try fetching from Supabase (works if user is logged in)
    supabase.from('leads').select('*').eq('id', leadId).maybeSingle()
      .then(({ data }) => {
        if (!data) { setError('Lead not found'); setLoading(false); return }
        setLead(data as Lead)
        setLoading(false)
      })
  }, [leadId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FBFBFD' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#fe5b25' }} />
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6" style={{ background: '#FBFBFD' }}>
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-lg font-semibold text-gray-800">{error || 'Lead not found'}</p>
        <p className="text-sm text-gray-500">This link may have expired or is invalid.</p>
      </div>
    )
  }

  const urg = URG[lead.urgency] || URG.cold
  const emoji = PROF_EMOJI[lead.profession] || '📋'
  const location = [lead.city, lead.zip_code].filter(Boolean).join(', ') || 'Your area'
  const isVerified = (publisher as any)?.is_verified || (publisher?.trust_tier && publisher.trust_tier !== 'none')
  const waUrl = senderPhone
    ? `https://wa.me/${senderPhone}${introMsg ? '?text=' + encodeURIComponent(introMsg) : ''}`
    : null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FBFBFD', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Brand bar */}
      <div className="flex items-center justify-center gap-1.5 py-3">
        <div className="w-5 h-5 rounded flex items-center justify-center text-white font-bold text-[10px]"
          style={{ background: '#fe5b25' }}>M</div>
        <span className="text-xs font-medium text-gray-400">MasterLeadFlow</span>
      </div>

      <div className="flex-1 px-4 pb-40 max-w-lg mx-auto w-full">
        {/* Header: profession + urgency */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ background: '#fff3ed' }}>
              {emoji}
            </div>
            <div>
              <div className="font-bold text-base text-gray-900">{profLabel(lead.profession)} Lead</div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin size={11} /> {location}
              </div>
            </div>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: urg.bg, color: urg.color }}>
            {urg.label}
          </div>
        </div>

        {/* Description + tags */}
        <div className="rounded-xl p-3.5 mb-3.5" style={{ background: '#f8f8fa' }}>
          <p className="text-sm leading-relaxed text-gray-600">
            {lead.parsed_summary || lead.raw_message || 'No details available'}
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            {lead.budget_range && (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-white border border-gray-100 text-gray-500">
                💰 {lead.budget_range}
              </span>
            )}
            {lead.property_type && (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-white border border-gray-100 text-gray-500">
                🏠 {lead.property_type}
              </span>
            )}
            <span className="text-xs px-2.5 py-1 rounded-lg bg-white border border-gray-100 text-gray-500">
              ⏱ {timeAgo(lead.created_at)}
            </span>
          </div>
        </div>

        {/* Publisher / Source */}
        {isVerified ? (
          /* Verified publisher — show name + avatar + badge */
          <button
            onClick={() => publisher?.slug ? nav(`/pro/${publisher.slug}`) : undefined}
            className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-white border border-gray-100 mb-4 text-left transition-colors hover:bg-gray-50"
          >
            {publisher?.avatar_url ? (
              <img src={publisher.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white"
                style={{ background: '#fe5b25' }}>
                {((publisher as any)?.display_name || publisher?.full_name || '?').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-gray-900 truncate">
                  {(publisher as any)?.display_name || publisher?.full_name || 'Unknown'}
                </span>
                <ShieldCheck size={14} className="text-green-500 shrink-0" />
              </div>
              <div className="text-xs text-gray-500 truncate">
                {publisher?.business_name || 'Contractor'} · {lead.group_name || 'WhatsApp Group'}
              </div>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              ✓ Verified
            </span>
            <ChevronRight size={14} className="text-gray-300 shrink-0" />
          </button>
        ) : (
          /* Not verified — show group source + WhatsApp profile pic if available */
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-gray-100 mb-4">
            {publisher?.avatar_url ? (
              <img src={publisher.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: '#f8f8fa' }}>
                📣
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 truncate">
                {(publisher as any)?.display_name || 'Posted in group'}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {lead.group_name || 'WhatsApp Group'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 flex flex-col gap-2.5 max-w-lg mx-auto"
        style={{ background: 'linear-gradient(transparent, #FBFBFD 20%)' }}>
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold text-white no-underline"
            style={{ background: '#25D366', boxShadow: '0 4px 12px rgba(37,211,102,0.3)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.627.616l4.584-1.212A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.205 0-4.247-.707-5.912-1.908l-.423-.31-2.823.746.583-2.735-.34-.441A9.958 9.958 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
            </svg>
            WhatsApp the Customer
          </a>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold text-white opacity-50"
            style={{ background: '#25D366' }}>
            WhatsApp unavailable
          </div>
        )}
        <button
          onClick={() => nav(`/leads/${leadId}`)}
          className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold bg-white border border-gray-200 text-gray-700"
        >
          <MessageCircle size={16} />
          Message in App
        </button>
      </div>
    </div>
  )
}
