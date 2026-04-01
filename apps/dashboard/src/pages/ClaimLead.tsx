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
  const [contractorId, setContractorId] = useState('')
  const [isRegistered, setIsRegistered] = useState(false)
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
        setContractorId(parsed.contractorId || '')
        setIsRegistered(parsed.isRegistered ?? false)
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

  const displayName = (publisher as any)?.display_name || publisher?.full_name || null
  const groupName = (lead as any).group_name || 'WhatsApp Group'

  const handleWhatsAppClick = () => {
    if (!waUrl) return
    // Record claim (fire-and-forget, don't block navigation)
    if (leadId && contractorId) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      fetch(`${supabaseUrl}/functions/v1/record-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, contractorId }),
      }).catch(() => {}) // silent — don't block user
    }
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FBFBFD', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Brand bar */}
      <div className="flex items-center justify-center gap-1.5 py-3 border-b border-gray-100">
        <div className="w-5 h-5 rounded flex items-center justify-center text-white font-bold text-[10px]"
          style={{ background: '#fe5b25' }}>M</div>
        <span className="text-xs font-semibold text-gray-500">MasterLeadFlow</span>
      </div>

      <div className="flex-1 px-4 pb-44 max-w-lg mx-auto w-full">

        {/* ── Publisher / Source (TOP) ── */}
        <div className="pt-5 pb-4">
          {isVerified ? (
            <button
              onClick={() => publisher?.slug ? nav(`/pro/${publisher.slug}`) : undefined}
              className="w-full flex items-center gap-3 text-left"
            >
              {publisher?.avatar_url ? (
                <img src={publisher.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md" />
              ) : (
                <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-base text-white border-2 border-white shadow-md"
                  style={{ background: '#fe5b25' }}>
                  {(displayName || '?').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base text-gray-900 truncate">{displayName || 'Unknown'}</span>
                  <ShieldCheck size={15} className="text-green-500 shrink-0" />
                </div>
                <div className="text-xs text-gray-500 truncate">{publisher?.business_name || 'Contractor'}</div>
                <div className="text-xs text-gray-400 truncate">{groupName}</div>
              </div>
              <ChevronRight size={16} className="text-gray-300 shrink-0" />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {publisher?.avatar_url ? (
                <img src={publisher.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md" />
              ) : (
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl border-2 border-white shadow-md" style={{ background: '#fff3ed' }}>
                  📣
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base text-gray-900 truncate">{displayName || 'Group Post'}</div>
                <div className="text-xs text-gray-500 truncate">{groupName}</div>
                <div className="text-xs text-gray-400">{timeAgo(lead.created_at)}</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Lead Details Card (BELOW publisher) ── */}
        <div className="rounded-2xl overflow-hidden mb-3" style={{ border: '1px solid #e8e8ec', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          {/* Card header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ background: '#fff3ed', borderBottom: '1px solid #f0ebe6' }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{emoji}</span>
              <span className="font-bold text-sm text-gray-900">{profLabel(lead.profession)} Lead</span>
            </div>
            <div className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: urg.bg, color: urg.color }}>
              {urg.label}
            </div>
          </div>

          {/* Card body */}
          <div className="px-4 py-4 bg-white">
            <p className="text-[15px] leading-relaxed text-gray-700 mb-3">
              {lead.parsed_summary || lead.raw_message || 'No details available'}
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs px-2.5 py-1.5 rounded-lg text-gray-600 font-medium" style={{ background: '#f8f8fa', border: '1px solid #f0f0f0' }}>
                📍 {lead.city || 'N/A'}{lead.zip_code ? `, ${lead.zip_code}` : ''}
              </span>
              {lead.budget_range && (
                <span className="text-xs px-2.5 py-1.5 rounded-lg text-gray-600 font-medium" style={{ background: '#f8f8fa', border: '1px solid #f0f0f0' }}>
                  💰 {lead.budget_range}
                </span>
              )}
              <span className="text-xs px-2.5 py-1.5 rounded-lg text-gray-600 font-medium" style={{ background: '#f8f8fa', border: '1px solid #f0f0f0' }}>
                ⏱ {timeAgo(lead.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Trust footer */}
        <div className="text-center py-2">
          <p className="text-[11px] text-gray-400">
            Respond quickly for best results
          </p>
        </div>
      </div>

      {/* Sticky bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 flex flex-col gap-2.5 max-w-lg mx-auto"
        style={{ background: 'linear-gradient(transparent, #FBFBFD 20%)' }}>
        {waUrl ? (
          <button
            onClick={handleWhatsAppClick}
            className="flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold text-white"
            style={{ background: '#25D366', boxShadow: '0 4px 12px rgba(37,211,102,0.3)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.627.616l4.584-1.212A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.205 0-4.247-.707-5.912-1.908l-.423-.31-2.823.746.583-2.735-.34-.441A9.958 9.958 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
            </svg>
            WhatsApp the Customer
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold text-white opacity-50"
            style={{ background: '#25D366' }}>
            WhatsApp unavailable
          </div>
        )}
        <button
          onClick={() => isRegistered ? nav(`/leads/${leadId}`) : undefined}
          disabled={!isRegistered}
          className={`flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold border ${
            isRegistered
              ? 'bg-white border-gray-200 text-gray-700 cursor-pointer'
              : 'bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed opacity-50'
          }`}
        >
          <MessageCircle size={16} />
          {isRegistered ? 'Message in App' : 'Message in App (Members Only)'}
        </button>
      </div>
    </div>
  )
}
