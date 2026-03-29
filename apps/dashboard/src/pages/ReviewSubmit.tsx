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
      <div className="max-w-xl mx-auto py-16 px-4">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-white/10" />
          <div className="h-4 w-64 rounded bg-white/5" />
          <div className="h-64 rounded-2xl bg-white/5" />
        </div>
      </div>
    )
  }

  /* ── Error ── */
  if (state === 'error') {
    return (
      <StatusPage
        icon={<AlertCircle size={40} className="text-red-400" />}
        title="Something went wrong"
        subtitle={errorMsg}
      />
    )
  }

  /* ── Already reviewed ── */
  if (state === 'already_reviewed') {
    return (
      <StatusPage
        icon={<CheckCircle2 size={40} className="text-emerald-400" />}
        title="Already reviewed"
        subtitle="You've already submitted a review for this job."
      />
    )
  }

  /* ── Not completed ── */
  if (state === 'not_completed') {
    return (
      <StatusPage
        icon={<Clock size={40} className="text-amber-400" />}
        title="Job not completed"
        subtitle="This job must be completed before you can leave a review."
      />
    )
  }

  /* ── Expired ── */
  if (state === 'expired') {
    return (
      <StatusPage
        icon={<Clock size={40} className="text-white/40" />}
        title="Review window expired"
        subtitle="The 30-day review window has expired for this job."
      />
    )
  }

  /* ── Submitted success ── */
  if (state === 'submitted') {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 mb-2 animate-[bounce_0.6s_ease-in-out]">
          <Sparkles size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Review submitted!</h2>
        <p className="text-sm text-white/50">
          Waiting for the other party to review. Both reviews will be published once complete.
        </p>
        <div className="pt-4">
          <StarRating rating={5} size="lg" />
        </div>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 mt-4"
        >
          <ArrowLeft size={14} /> Back to Jobs
        </Link>
      </div>
    )
  }

  /* ── Ready: show form ── */
  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-4">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
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
    <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-3">
      <div className="flex justify-center">{icon}</div>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="text-sm text-white/50">{subtitle}</p>
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 mt-4"
      >
        <ArrowLeft size={14} /> Back to Jobs
      </Link>
    </div>
  )
}
