import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { ToggleLeft, ToggleRight, Clock, Loader2, RefreshCw, AlertCircle } from 'lucide-react'

interface CronJob {
  jobid: number
  jobname: string
  schedule: string
  active: boolean
}

const CRON_LABELS: Record<string, { label: string; description: string }> = {
  'process-onboarding-nudges': { label: 'Onboarding Nudges', description: 'Sends nudge messages to users stuck in onboarding steps' },
  'process-trial-nudges': { label: 'Trial Nudges', description: 'Engages trial users with usage tips and conversion prompts' },
  'process-winback-nudges': { label: 'Win-back', description: 'Re-engages churned or expired trial users' },
  'process-paying-check': { label: 'Paying Check', description: 'Verifies paying users have active Stripe subscriptions' },
}

function formatSchedule(schedule: string): string {
  if (schedule.includes('*/15')) return 'Every 15 min'
  if (schedule.match(/^0 \*\/1/)) return 'Every hour'
  if (schedule.match(/^0 \*\/6/)) return 'Every 6 hours'
  if (schedule.includes('0 9')) return 'Daily at 9:00 AM'
  if (schedule.match(/^\*\/\d+/)) {
    const m = schedule.match(/^\*\/(\d+)/)
    return `Every ${m?.[1]} min`
  }
  return schedule
}

export default function AutomationToggles() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchJobs() {
    setError(null)
    const { data, error: err } = await supabase.rpc('run_sql', {
      query: "SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid"
    })
    if (err) {
      // Fallback: try direct SQL
      const { data: d2, error: e2 } = await supabase
        .from('cron_jobs_view')
        .select('jobid, jobname, schedule, active')
        .order('jobid')
      if (e2) {
        setError('Could not load cron jobs. Make sure the cron extension is enabled.')
        setLoading(false)
        return
      }
      setJobs((d2 || []) as CronJob[])
    } else {
      setJobs((data || []) as CronJob[])
    }
    setLoading(false)
  }

  useEffect(() => { fetchJobs() }, [])

  async function toggleJob(jobid: number, newActive: boolean) {
    setToggling(jobid)
    const { error: err } = await supabase.rpc('run_sql', {
      query: `SELECT cron.alter_job(${jobid}, active := ${newActive})`
    })
    if (err) {
      setError(`Failed to toggle job ${jobid}`)
    } else {
      setJobs(prev => prev.map(j => j.jobid === jobid ? { ...j, active: newActive } : j))
    }
    setToggling(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-[#5856D6]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#5856D6]" />
          <h3 className="text-sm font-bold text-[#0b0707]/80">Cron Job Automations</h3>
          <span className="text-[9px] text-[#3b3b3b]/40 bg-[#f5f2ed] px-2 py-0.5 rounded-full">
            {jobs.filter(j => j.active).length}/{jobs.length} active
          </span>
        </div>
        <button
          onClick={() => { setLoading(true); fetchJobs() }}
          className="flex items-center gap-1 text-[10px] text-[#3b3b3b]/50 hover:text-[#3b3b3b]/80 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-xs text-red-600">{error}</span>
        </div>
      )}

      <div className="grid gap-3">
        {jobs.map((job) => {
          const meta = CRON_LABELS[job.jobname] || { label: job.jobname, description: '' }
          const isToggling = toggling === job.jobid

          return (
            <div
              key={job.jobid}
              className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: job.active ? '#34C759' : '#C7C7CC' }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#0b0707]/80 truncate">{meta.label}</span>
                    <span className="text-[9px] font-mono text-[#3b3b3b]/30 bg-[#f5f2ed] px-1.5 py-0.5 rounded shrink-0">
                      {formatSchedule(job.schedule)}
                    </span>
                  </div>
                  {meta.description && (
                    <p className="text-[10px] text-[#3b3b3b]/40 mt-0.5 truncate">{meta.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 ml-4">
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background: job.active ? 'rgba(52,199,89,0.1)' : 'rgba(142,142,147,0.1)',
                    color: job.active ? '#34C759' : '#8E8E93',
                  }}
                >
                  {job.active ? 'ON' : 'OFF'}
                </span>
                <button
                  onClick={() => toggleJob(job.jobid, !job.active)}
                  disabled={isToggling}
                  className="transition-transform hover:scale-105 disabled:opacity-50"
                >
                  {isToggling ? (
                    <Loader2 className="w-6 h-6 animate-spin text-[#5856D6]" />
                  ) : job.active ? (
                    <ToggleRight className="w-8 h-8 text-[#34C759]" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-[#C7C7CC]" />
                  )}
                </button>
              </div>
            </div>
          )
        })}

        {jobs.length === 0 && !error && (
          <div className="text-center py-8 text-[#3b3b3b]/30 text-xs">
            No cron jobs found. Make sure pg_cron is configured.
          </div>
        )}
      </div>
    </div>
  )
}
