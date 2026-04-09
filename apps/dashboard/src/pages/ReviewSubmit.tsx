import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import StarRating from '../components/StarRating'
import ReviewForm from '../components/ReviewForm'
import { CheckCircle2, AlertCircle, Clock, Loader2, ArrowLeft, Sparkles } from 'lucide-react'

/* ───────────────── Types ───────────────── */

type PageState =
  | 'loading'
  | 'ready'
  | 'already_reviewed'
  | 'not_completed'
  | 'expired'
  | 'submitted'
  | 'error'

interface JobInfo {
  contractor_id: string
  contractor_name: string
  status: string
  completed_at: string | null
}

/* ───────────────── Component ───────────────── */

export default function ReviewSubmit() {
  const { jobOrderId } = useParams<{ jobOrderId: string }>()
  const { user } = useAuth()

  const [state, setState] = useState<PageState>('loading')
  const [jobInfo, setJobInfo] = useState<JobInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!jobOrderId || !user) return
    let cancelled = false

    async function load() {
      /* Fetch job order with contractor info */
      const { data: job, error: jobErr } = await supabase
        .from('job_orders')
        .select('contractor_id, status, completed_at, profiles!job_orders_contractor_id_fkey(full_name)')
        .eq('id', jobOrderId)
        .single()

      if (cancelled) return

      if (jobErr || !job) {
        setErrorMsg(jobErr?.message || 'Job order not found')
        setState('error')
        return
      }

      const contractorName =
        (job.profiles as any)?.full_name || 'Contractor'

      setJobInfo({
        contractor_id: job.contractor_id,
        contractor_name: contractorName,
        status: job.status,
        completed_at: job.completed_at,
      })

      /* Check: job must be completed */
      if (job.status !== 'completed') {
        setState('not_completed')
        return
      }

      /* Check: 30-day review window */
      if (job.completed_at) {
        const daysSince =
          (Date.now() - new Date(job.completed_at).getTime()) / (1000 * 60 * 60 * 24)
        if (daysSince > 30) {
          setState('expired')
          return
        }
      }

      /* Check: already reviewed */
      const { count } = await supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('job_order_id', jobOrderId)
        .eq('reviewer_id', user.id)

      if (cancelled) return

      if (count && count > 0) {
        setState('already_reviewed')
        return
      }

      setState('ready')
    }

    load()
    return () => { cancelled = true }
  }, [jobOrderId, user])

  /* ── Skeleton ── */
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-xl mx-auto py-16 px-4">
          <div className="flex justify-center mb-6">
            <Loader2 size={32} className="animate-spin text-[#ff6b35]" />
          </div>
          <div className="space-y-4 animate-pulse">
            <div className="h-8 w-48 rounded-lg bg-white/10" />
            <div className="h-4 w-64 rounded bg-white/5" />
            <div className="h-64 rounded-2xl bg-white/5" />
          </div>
        </div>
      </div>
    )
  }

  /* ── Error ── */
  if (state === 'error') {
    return (
      <StatusPage
        icon={
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(255,69,58,0.12)]">
            <AlertCircle size={32} className="text-[#ff453a]" />
          </div>
        }
        title="Something went wrong"
        subtitle={errorMsg}
      />
    )
  }

  /* ── Already reviewed ── */
  if (state === 'already_reviewed') {
    return (
      <StatusPage
        icon={
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(48,209,88,0.12)]">
            <CheckCircle2 size={32} className="text-[#a1a1a6]" />
          </div>
        }
        title="Already reviewed"
        subtitle="You've already submitted a review for this job."
      />
    )
  }

  /* ── Not completed ── */
  if (state === 'not_completed') {
    return (
      <StatusPage
        icon={
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(255,107,53,0.12)]">
            <Clock size={32} className="text-[#ff6b35]" />
          </div>
        }
        title="Job not completed"
        subtitle="This job must be completed before you can leave a review."
      />
    )
  }

  /* ── Expired ── */
  if (state === 'expired') {
    return (
      <StatusPage
        icon={
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(99,99,102,0.12)]">
            <Clock size={32} className="text-[#636366]" />
          </div>
        }
        title="Review window expired"
        subtitle="The 30-day review window has expired for this job."
      />
    )
  }

  /* ── Submitted success ── */
  if (state === 'submitted') {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(48,209,88,0.12)] border border-[rgba(48,209,88,0.2)] mb-2 animate-[bounce_0.6s_ease-in-out]">
            <Sparkles size={32} className="text-[#30d158]" />
          </div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>Review submitted!</h2>
          <p className="text-sm text-[#a1a1a6]">
            Waiting for the other party to review. Both reviews will be published once complete.
          </p>
          <div className="pt-4">
            <StarRating rating={5} size="lg" />
          </div>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1.5 text-sm text-[#ff6b35] hover:brightness-125 mt-4 transition-all"
          >
            <ArrowLeft size={14} /> Back to Jobs
          </Link>
        </div>
      </div>
    )
  }

  /* ── Ready: show form ── */
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-xl mx-auto py-8 px-4 space-y-4">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-[#636366] hover:text-[#a1a1a6] transition-colors"
        >
          <ArrowLeft size={14} /> Back to Jobs
        </Link>

        <ReviewForm
          jobOrderId={jobOrderId!}
          revieweeId={jobInfo!.contractor_id}
          revieweeName={jobInfo!.contractor_name}
          onSuccess={() => setState('submitted')}
        />
      </div>
    </div>
  )
}

/* ───────────────── Status helper ───────────────── */

function StatusPage({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-3">
        <div className="flex justify-center">{icon}</div>
        <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>{title}</h2>
        <p className="text-sm text-[#a1a1a6]">{subtitle}</p>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-[#ff6b35] hover:brightness-125 mt-4 transition-all"
        >
          <ArrowLeft size={14} /> Back to Jobs
        </Link>
      </div>
    </div>
  )
}
