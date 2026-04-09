import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Clock, DollarSign, MessageCircle,
  CheckCircle2, Phone, Loader2, Timer, Copy, Navigation,
  Star, ChevronRight, MessageSquare,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'

interface SubProfile {
  avg_rating: number
  review_count: number
  tier: string
  avatar_url: string | null
  years_experience: number | null
}

interface JobOrder {
  id: string
  lead_id: string | null
  subcontractor_id: string | null
  deal_type: string
  deal_value: string
  status: string
  payment_status: string | null
  payment_amount: number | null
  payment_due_at: string | null
  job_amount: number | null
  customer_name: string | null
  customer_address: string | null
  scheduled_date: string | null
  notes: string | null
  created_at: string
  updated_at: string | null
  completed_at: string | null
  sub_name: string
  sub_phone: string
  sub_profile: SubProfile | null
  lead_profession: string | null
  lead_city: string | null
  lead_zip: string | null
  lead_summary: string | null
}

const STATUS_STEPS = ['Pending', 'Active', 'Working', 'Done']

function getStepIndex(status: string) {
  if (status === 'pending') return 0
  if (status === 'accepted') return 2
  if (status === 'completed') return 3
  return 0
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getJobDuration(job: JobOrder) {
  const start = new Date(job.created_at)
  const end = job.completed_at ? new Date(job.completed_at) : new Date()
  const h = Math.floor((end.getTime() - start.getTime()) / 3600000)
  if (h < 1) return 'Less than 1h'
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { effectiveUserId } = useAuth()
  const [job, setJob] = useState<JobOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('job_orders')
      .select('*, subcontractors(full_name, phone), contractors(full_name, whatsapp_phone), leads(profession, city, zip_code, parsed_summary), contractor_profiles!job_orders_contractor_id_fkey(avg_rating, review_count, tier, avatar_url, years_experience)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const sub = (data as any).subcontractors;
          const ctr = (data as any).contractors;
          const cp = (data as any).contractor_profiles;
          setJob({
            ...data,
            sub_name: sub?.full_name || ctr?.full_name || '',
            sub_phone: sub?.phone || ctr?.whatsapp_phone || '',
            sub_profile: cp || null,
            lead_profession: (data as any).leads?.profession || null,
            lead_city: (data as any).leads?.city || null,
            lead_zip: (data as any).leads?.zip_code || null,
            lead_summary: (data as any).leads?.parsed_summary || null,
          })
        }
        setLoading(false)
      })
  }, [id])

  async function markAsDone() {
    if (!job || updating) return
    setUpdating(true)
    await supabase
      .from('job_orders')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', job.id)
    setJob(prev => prev ? { ...prev, status: 'completed', completed_at: new Date().toISOString() } : prev)
    setUpdating(false)

    // Send review notifications to both parties (fire-and-forget)
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_order_id: job.id }),
    }).catch(() => {})
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-[#0a0a0a]">
        <Loader2 className="w-7 h-7 animate-spin text-[#ff6b35]" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 text-center bg-[#0a0a0a]">
        <p className="text-[#a1a1a6] mb-4">Job not found</p>
        <button onClick={() => nav('/jobs')} className="text-[#ff6b35] font-semibold text-sm">
          Back to Jobs
        </button>
      </div>
    )
  }

  const currentStep = getStepIndex(job.status)
  const profLabel = job.lead_profession?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Job'
  const isCompleted = job.status === 'completed'
  const amount = job.job_amount || job.payment_amount || null

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] flex flex-col max-w-[480px] mx-auto" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Compact header — single row nav + inline title */}
      <div className="bg-[#0a0a0a] px-5 pt-4 pb-3">
        {/* Nav row */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => nav(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] text-[#636366]">
              <Timer size={9} />{getJobDuration(job)}
            </span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: isCompleted ? 'rgba(48,209,88,0.15)' : 'rgba(255,107,53,0.15)',
                color: isCompleted ? '#30d158' : '#ff6b35',
              }}
            >
              {isCompleted ? 'Done' : 'Active'}
            </span>
          </div>
        </div>

        {/* Title + amount inline */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[18px] font-bold text-white" style={{ letterSpacing: '-0.03em' }}>{profLabel}</h1>
            {job.lead_city && (
              <p className="text-[10px] text-[#636366]">{job.lead_city}{job.lead_zip ? `, ${job.lead_zip}` : ''}</p>
            )}
          </div>
          {amount && (
            <span className="text-[20px] font-bold text-[#30d158]" style={{ letterSpacing: '-0.03em' }}>${amount}</span>
          )}
        </div>

        {/* Compact inline stepper — dots only */}
        <div className="flex items-center gap-1 mb-3">
          {STATUS_STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1 gap-1">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                style={{
                  background: i <= currentStep ? '#ff6b35' : '#2c2c2e',
                  color: i <= currentStep ? '#fff' : '#636366',
                  boxShadow: i === currentStep ? '0 0 0 3px rgba(255,107,53,0.2)' : 'none',
                }}
              >
                {i < currentStep ? '✓' : i + 1}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className="h-[1.5px] flex-1" style={{ background: i < currentStep ? '#ff6b35' : 'rgba(255,255,255,0.06)' }} />
              )}
            </div>
          ))}
        </div>

        {!isCompleted && (
          <button
            onClick={markAsDone}
            disabled={updating}
            className="w-full py-3 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-60 text-white"
            style={{ background: '#ff6b35', boxShadow: '0 0 20px rgba(255,107,53,0.3)' }}
          >
            {updating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Mark as Done
          </button>
        )}
      </div>

      <div className="px-5 py-4 space-y-4 pb-8">
        {/* Job info card */}
        <div className="rounded-2xl p-4" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-[#636366]">{job.deal_type || 'Fixed price'}</span>
            {amount && <span className="text-[15px] font-bold text-[#30d158]">${amount}</span>}
          </div>
          <p className="text-[14px] font-medium leading-relaxed mb-2 text-[#a1a1a6]">
            {job.lead_summary || profLabel}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {job.scheduled_date && (
              <span className="flex items-center gap-1 text-[11px] text-[#636366]">
                <Clock size={10} />{formatDate(job.scheduled_date)}
              </span>
            )}
            {job.created_at && (
              <span className="flex items-center gap-1 text-[11px] text-[#636366]">
                <Timer size={10} />Created {formatDate(job.created_at)}
              </span>
            )}
          </div>
          {job.notes && (
            <div className="rounded-lg p-2.5 mt-3" style={{ background: 'rgba(255,107,53,0.08)' }}>
              <p className="text-[10px] text-[#ff6b35] font-medium">📝 {job.notes}</p>
            </div>
          )}
        </div>

        {/* Customer card */}
        {job.customer_name && (
          <div>
            <p className="text-[11px] font-semibold text-[#636366] uppercase tracking-wider mb-2">Customer</p>
            <div className="rounded-2xl overflow-hidden" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-10 h-10 rounded-full bg-[#ff6b35] flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0">
                  {job.customer_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-white">{job.customer_name}</p>
                  <p className="text-[10px] text-[#a1a1a6]">
                    {job.lead_city ? `${job.lead_city} · ` : ''}End customer
                  </p>
                </div>
              </div>

              {job.customer_address && (
                <button
                  onClick={() => copyToClipboard(job.customer_address!)}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-[#2c2c2e] transition-colors"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: '#141414' }}
                >
                  <MapPin size={13} className="text-[#636366]" />
                  <div className="flex-1 text-left">
                    <p className="text-[13px] font-medium text-[#a1a1a6]">{job.customer_address}</p>
                  </div>
                  <Copy size={12} className="text-[#ff6b35]" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Subcontractor card */}
        {job.sub_name && (
          <div>
            <p className="text-[11px] font-semibold text-[#636366] uppercase tracking-wider mb-2">Assigned To</p>
            <div className="rounded-2xl p-4" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3 mb-3">
                {job.sub_profile?.avatar_url ? (
                  <img src={job.sub_profile.avatar_url} alt="" className="w-11 h-11 rounded-2xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-[13px] font-bold flex-shrink-0"
                    style={{ background: 'rgba(255,107,53,0.15)', color: '#ff6b35' }}>
                    {job.sub_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-white">{job.sub_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {job.sub_profile && job.sub_profile.avg_rating > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Star size={10} style={{ fill: '#ff6b35', color: '#ff6b35' }} />
                        <span className="text-[10px] font-semibold" style={{ color: '#ff6b35' }}>{job.sub_profile.avg_rating}</span>
                        <span className="text-[9px]" style={{ color: '#636366' }}>({job.sub_profile.review_count})</span>
                      </span>
                    )}
                    {job.sub_profile?.tier && job.sub_profile.tier !== 'new' && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,107,53,0.1)', color: '#ff6b35' }}>
                        {job.sub_profile.tier === 'elite' ? '🏆' : job.sub_profile.tier === 'trusted' ? '✅' : '🔵'} {job.sub_profile.tier}
                      </span>
                    )}
                    {!job.sub_profile?.avg_rating && (
                      <span className="text-[10px] text-[#636366]">Subcontractor</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} className="text-[#48484a]" />
              </div>
              {job.sub_phone && (
                <div className="flex gap-2">
                  <a
                    href={`tel:${job.sub_phone}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl active:scale-95 transition-transform"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <Phone size={13} className="text-[#30d158]" />
                    <span className="text-[11px] font-semibold text-[#30d158]">Call</span>
                  </a>
                  <a
                    href={`https://wa.me/${job.sub_phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl active:scale-95 transition-transform"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <MessageCircle size={13} className="text-[#25D366]" />
                    <span className="text-[11px] font-semibold text-[#25D366]">WhatsApp</span>
                  </a>
                  <a
                    href={`sms:${job.sub_phone}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl active:scale-95 transition-transform"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <MessageSquare size={13} className="text-[#0a84ff]" />
                    <span className="text-[11px] font-semibold text-[#0a84ff]">SMS</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rate this job — shown when completed */}
        {isCompleted && (
          <div>
            <p className="text-[11px] font-semibold text-[#636366] uppercase tracking-wider mb-2">Review</p>
            <button
              onClick={() => nav(`/review-submit/${job.id}`)}
              className="w-full rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
              style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.15)' }}
            >
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,107,53,0.15)' }}>
                <Star size={20} className="text-[#ff6b35]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-bold text-white">Rate this job</p>
                <p className="text-[11px] text-[#a1a1a6]">Help other contractors make better decisions</p>
              </div>
              <ChevronRight size={14} className="text-[#48484a]" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
