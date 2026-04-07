import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Clock, Flame, Zap, Snowflake,
  Share2, MessageCircle, Phone, Loader2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useUserSubscription } from '../hooks/useUserSubscription'

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
}

const URG = {
  hot:  { icon: Flame,     label: 'Urgent', color: '#FF3B30', bg: '#FFF1F0', border: '#FFD0CC' },
  warm: { icon: Zap,       label: 'Warm',   color: '#FF9500', bg: '#FFF8EE', border: '#FFE4B3' },
  cold: { icon: Snowflake, label: 'Cold',   color: '#5AC8FA', bg: '#F0F9FF', border: '#BAE6FD' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { effectiveUserId } = useAuth()
  const { canSeeLeadDetails } = useUserSubscription()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [senderPhone, setSenderPhone] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    // Only select fields safe for all users — sender_id only for premium
    const columns = canSeeLeadDetails
      ? 'id, profession, parsed_summary, raw_message, city, zip_code, urgency, budget_range, sender_id, created_at, group_name'
      : 'id, profession, parsed_summary, city, zip_code, urgency, budget_range, created_at, group_name'
    supabase
      .from('leads')
      .select(columns)
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setLead(data as Lead | null)
        setLoading(false)
      })
  }, [id, canSeeLeadDetails])

  useEffect(() => {
    if (!lead?.sender_id || !canSeeLeadDetails) return
    const phone = lead.sender_id.replace(/@.*$/, '')
    setSenderPhone(phone)
  }, [lead, canSeeLeadDetails])

  function contactLead() {
    if (!canSeeLeadDetails || !senderPhone) return
    const msg = encodeURIComponent(`Hi, I saw your lead for ${lead?.profession || 'service'} and I'm available to help!`)
    window.open(`https://wa.me/${senderPhone}?text=${msg}`, '_blank')
  }

  function shareLeadInfo() {
    if (navigator.share && lead) {
      navigator.share({
        title: `Lead: ${lead.profession}`,
        text: lead.parsed_summary || lead.raw_message || '',
      }).catch(() => {})
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="w-7 h-7 animate-spin text-[#fe5b25]" />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 text-center">
        <p className="text-gray-400 mb-4">Lead not found</p>
        <button onClick={() => nav('/leads')} className="text-[#fe5b25] font-semibold text-sm">
          Back to Leads
        </button>
      </div>
    )
  }

  const urg = URG[lead.urgency] || URG.warm
  const UrgIcon = urg.icon
  const profLabel = lead.profession?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Service'

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col max-w-[480px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center active:scale-95 transition-transform"
        >
          <ArrowLeft size={17} strokeWidth={1.8} />
        </button>
        <h1 className="text-[18px] font-bold tracking-tight flex-1">Lead Details</h1>
        <button
          onClick={shareLeadInfo}
          className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Share2 size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div className="flex-1 px-5 pb-8">
        {/* Urgency badge + time */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: urg.bg, border: `1px solid ${urg.border}` }}
          >
            <UrgIcon size={12} style={{ color: urg.color }} />
            <span className="text-[11px] font-bold" style={{ color: urg.color }}>{urg.label.toUpperCase()}</span>
          </div>
          <span className="text-[11px] text-gray-400">{timeAgo(lead.created_at)}</span>
        </div>

        {/* Title */}
        <h2 className="text-[24px] font-bold tracking-tight mb-1">{profLabel}</h2>
        {lead.budget_range && (
          <p className="text-[20px] font-bold text-green-600 mb-4">{lead.budget_range}</p>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <div className="bg-gray-50 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={13} className="text-gray-400" />
              <span className="text-[11px] text-gray-400">Location</span>
            </div>
            <p className="text-[13px] font-semibold text-gray-800">
              {[lead.city, lead.zip_code].filter(Boolean).join(', ') || 'Not specified'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={13} className="text-gray-400" />
              <span className="text-[11px] text-gray-400">Posted</span>
            </div>
            <p className="text-[13px] font-semibold text-gray-800">{timeAgo(lead.created_at)}</p>
            {lead.urgency === 'hot' && (
              <p className="text-[10px] text-red-500">Needs immediate help</p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mb-5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
            <p className="text-[13px] text-gray-600 leading-relaxed">
              {lead.parsed_summary || lead.raw_message || 'No description available.'}
            </p>
          </div>
        </div>

        {/* Source */}
        {lead.group_name && (
          <div className="mb-5">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Source</p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#fe5b25]/10 flex items-center justify-center flex-shrink-0">
                <MessageCircle size={16} className="text-[#fe5b25]" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-800">{lead.group_name}</p>
                <p className="text-[11px] text-gray-400">WhatsApp Group</p>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        {canSeeLeadDetails ? (
          <button
            onClick={contactLead}
            className="w-full bg-[#fe5b25] text-white py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            <Phone size={18} />
            Contact Lead Publisher
          </button>
        ) : (
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 text-center">
            <p className="text-[13px] font-semibold text-gray-700 mb-1">Upgrade to See Contact Info</p>
            <p className="text-[12px] text-gray-400 mb-3">Subscribe to contact lead publishers directly</p>
            <button
              onClick={() => nav('/subscription')}
              className="bg-[#fe5b25] text-white px-6 py-2.5 rounded-xl text-[13px] font-semibold active:scale-95 transition-transform"
            >
              View Plans
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
