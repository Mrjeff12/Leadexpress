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
      .select('*, subcontractors(full_name, phone), leads(profession, city, zip_code, parsed_summary)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setJob({
            ...data,
            sub_name: (data as any).subcontractors?.full_name || '',
            sub_phone: (data as any).subcontractors?.phone || '',
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
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="w-7 h-7 animate-spin text-[#fe5b25]" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 text-center">
        <p className="text-gray-400 mb-4">Job not found</p>
        <button onClick={() => nav('/jobs')} className="text-[#fe5b25] font-semibold text-sm">
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
    <div className="min-h-[100dvh] bg-white flex flex-col max-w-[480px] mx-auto">
      {/* Orange header */}
      <div className="bg-[#fe5b25] px-5 pt-5 pb-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-full opacity-[0.08] -translate-y-8 translate-x-8" />

        <div className="flex items-center justify-between mb-3 relative">
          <button
            onClick={() => nav(-1)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft size={17} className="text-white" />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-white/60">
              <Timer size={10} />{getJobDuration(job)}
            </span>
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
              isCompleted ? 'bg-green-400/30 text-white' : 'bg-white/20 text-white'
            }`}>
              {isCompleted ? 'Completed' : 'Active'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 relative">
          <div>
            <h1 className="text-[20px] font-bold text-white tracking-tight">{profLabel}</h1>
            {job.lead_city && (
              <p className="text-[11px] text-white/60">{job.lead_city}{job.lead_zip ? `, ${job.lead_zip}` : ''}</p>
            )}
          </div>
          {amount && (
            <span className="text-[22px] font-bold text-white">${amount}</span>
          )}
        </div>

        {/* Progress steps */}
        <div className="flex items-center">
          {STATUS_STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  i < currentStep ? 'bg-white text-[#fe5b25]' :
                  i === currentStep ? 'bg-white text-[#fe5b25] ring-4 ring-white/20' :
                  'bg-white/20 text-white/40'
                }`}>
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span className={`text-[8px] font-medium mt-1 ${
                  i === currentStep ? 'text-white' : i < currentStep ? 'text-white/60' : 'text-white/20'
                }`}>{s}</span>
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`h-[2px] w-full mt-[-14px] ${i < currentStep ? 'bg-white/60' : 'bg-white/15'}`} />
              )}
            </div>
          ))}
        </div>

        {!isCompleted && (
          <button
            onClick={markAsDone}
            disabled={updating}
            className="w-full mt-4 bg-white text-[#fe5b25] py-3 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-60"
          >
            {updating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Mark as Done
          </button>
        )}
      </div>

      {/* Map placeholder */}
      <div className="h-[90px] bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
        <div className="absolute inset-0 opacity-15">
          {[0,1,2,3,4].map(i => <div key={`h${i}`} className="absolute left-0 right-0 border-b border-gray-400" style={{top:`${i*25}%`}} />)}
          {[0,1,2,3,4].map(i => <div key={`v${i}`} className="absolute top-0 bottom-0 border-r border-gray-400" style={{left:`${i*25}%`}} />)}
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-6 h-6 rounded-full bg-[#fe5b25]/20 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[#fe5b25] border-2 border-white shadow-sm" />
          </div>
        </div>
        {job.customer_address && (
          <div className="absolute bottom-2 left-3 right-3">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm">
              <Navigation size={10} className="text-blue-500" />
              <span className="text-[10px] font-medium truncate">{job.customer_address}</span>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-4 space-y-4 pb-8">
        {/* Job info card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-gray-400">{job.deal_type || 'Fixed price'}</span>
            {amount && <span className="text-[15px] font-bold text-green-600">${amount}</span>}
          </div>
          <p className="text-[14px] font-medium leading-relaxed mb-2 text-gray-800">
            {job.lead_summary || profLabel}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {job.scheduled_date && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Clock size={10} />{formatDate(job.scheduled_date)}
              </span>
            )}
            {job.created_at && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Timer size={10} />Created {formatDate(job.created_at)}
              </span>
            )}
          </div>
          {job.notes && (
            <div className="bg-amber-50 rounded-lg p-2.5 mt-3">
              <p className="text-[10px] text-amber-700 font-medium">📝 {job.notes}</p>
            </div>
          )}
        </div>

        {/* Customer card */}
        {job.customer_name && (
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Customer</p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-10 h-10 rounded-full bg-[#fe5b25] flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0">
                  {job.customer_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold">{job.customer_name}</p>
                  <p className="text-[10px] text-gray-400">
                    {job.lead_city ? `${job.lead_city} · ` : ''}End customer
                  </p>
                </div>
              </div>

              {job.customer_address && (
                <button
                  onClick={() => copyToClipboard(job.customer_address!)}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors"
                  style={{ borderTop: '1px solid #f3f4f6' }}
                >
                  <MapPin size={13} className="text-gray-400" />
                  <div className="flex-1 text-left">
                    <p className="text-[13px] font-medium text-gray-800">{job.customer_address}</p>
                  </div>
                  <Copy size={12} className="text-[#fe5b25]" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Subcontractor card */}
        {job.sub_name && (
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Assigned To</p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600 text-[13px] font-bold flex-shrink-0">
                  {job.sub_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold">{job.sub_name}</p>
                  <p className="text-[10px] text-gray-400">Subcontractor</p>
                </div>
                <ChevronRight size={14} className="text-gray-300" />
              </div>
              {job.sub_phone && (
                <div className="flex gap-2">
                  <a
                    href={`tel:${job.sub_phone}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-50 active:scale-95 transition-transform"
                  >
                    <Phone size={13} className="text-green-600" />
                    <span className="text-[11px] font-semibold text-green-600">Call</span>
                  </a>
                  <a
                    href={`https://wa.me/${job.sub_phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#25D366]/10 active:scale-95 transition-transform"
                  >
                    <MessageCircle size={13} className="text-[#25D366]" />
                    <span className="text-[11px] font-semibold text-[#25D366]">WhatsApp</span>
                  </a>
                  <a
                    href={`sms:${job.sub_phone}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-50 active:scale-95 transition-transform"
                  >
                    <MessageSquare size={13} className="text-blue-500" />
                    <span className="text-[11px] font-semibold text-blue-500">SMS</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
