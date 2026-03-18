import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/shadcn/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/shadcn/ui/card'
import { Badge } from '../components/shadcn/ui/badge'
import { MapPin, Clock, FileText, CheckCircle, Phone, XCircle, Globe } from 'lucide-react'

type PortalLang = 'en' | 'he'

const t = (lang: PortalLang, en: string, he: string) => lang === 'he' ? he : en

interface Job {
  id: string
  lead_id: string
  contractor_id: string
  subcontractor_id: string | null
  deal_type: string
  deal_value: string
  status: string
  created_at: string
  updated_at: string
  contractor_name: string
  lead: {
    city: string | null
    zip_code: string | null
    urgency: string | null
    summary: string | null
    description: string | null
    sender_id: string | null
  }
}

export default function JobPortal() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [lang, setLang] = useState<PortalLang>(() => {
    const saved = localStorage.getItem('le-portal-lang') as PortalLang | null
    return saved === 'en' ? 'en' : 'he'
  })

  const toggleLang = () => {
    const next = lang === 'en' ? 'he' : 'en'
    setLang(next)
    localStorage.setItem('le-portal-lang', next)
  }

  useEffect(() => {
    async function fetchJob() {
      if (!token) return

      try {
        const { data, error: rpcError } = await supabase
          .rpc('get_job_order_by_token', { token })

        if (rpcError) throw rpcError
        if (!data) throw new Error('Job not found')

        setJob(data as unknown as Job)
      } catch (err: any) {
        console.error('Error fetching job:', err)
        setError(err.message || 'Failed to load job details')
      } finally {
        setLoading(false)
      }
    }

    fetchJob()
  }, [token])

  const handleAction = async (newStatus: 'accepted' | 'rejected') => {
    if (!token) return
    setActionLoading(true)
    try {
      const { data, error } = await supabase
        .rpc('update_job_order_status_by_token', { token, new_status: newStatus })

      if (error) throw error
      if (!data) throw new Error('Failed to update job')

      setJob(data as unknown as Job)
    } catch (err: any) {
      console.error('Error updating job:', err)
      alert(t(lang, 'Failed to update job. Please try again.', 'שגיאה בעדכון העבודה. נסה שוב.'))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-[#fe5b25] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-500">{t(lang, 'Loading job details...', 'טוען פרטי עבודה...')}</p>
        </div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-red-500">
              {t(lang, 'Link Invalid or Expired', 'הקישור לא תקין או פג תוקף')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{error || t(lang, 'This job order could not be found.', 'לא נמצאה הזמנת עבודה.')}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const contractorName = job.contractor_name || t(lang, 'A contractor', 'קבלן')
  const isAccepted = job.status === 'accepted'
  const isRejected = job.status === 'rejected'
  const isPending = job.status === 'pending'

  const lead = job.lead || {
    city: null, zip_code: null, urgency: null, summary: null, description: null, sender_id: null
  }

  const formatPhoneNumber = (senderId: string | null) => {
    if (!senderId) return t(lang, 'No phone provided', 'לא סופק טלפון')
    return senderId.replace('@c.us', '')
  }

  const dealTypeLabel = (dt: string) => {
    if (dt === 'percentage') return lang === 'he' ? 'אחוזים' : 'Percentage'
    if (dt === 'fixed_price') return lang === 'he' ? 'מחיר קבוע' : 'Fixed Price'
    return lang === 'he' ? 'מותאם אישית' : 'Custom'
  }

  const urgencyLabel = (u: string | null) => {
    if (!u) return t(lang, 'Standard timeframe', 'לוח זמנים רגיל')
    if (u === 'hot') return lang === 'he' ? 'דחוף' : 'Urgent'
    if (u === 'warm') return lang === 'he' ? 'רגיל' : 'Standard'
    return lang === 'he' ? 'לא דחוף' : 'Not urgent'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex justify-center items-start font-sans" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {/* Language toggle */}
      <button
        onClick={toggleLang}
        className="fixed top-4 right-4 z-50 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium bg-white/80 backdrop-blur shadow-sm hover:bg-white transition-all border-gray-200 text-gray-500"
      >
        <Globe className="w-3.5 h-3.5" />
        {lang === 'en' ? 'עב' : 'EN'}
      </button>

      <Card className="w-full max-w-lg shadow-lg border-0">
        <CardHeader className="bg-[#fff4ef]/50 border-b pb-6">
          <div className="flex justify-between items-start mb-2">
            <Badge
              variant={isAccepted ? "default" : isRejected ? "destructive" : "secondary"}
              className={isAccepted ? "bg-[#fe5b25] hover:bg-[#e04d1c]" : isRejected ? "bg-red-500 hover:bg-red-600" : ""}
            >
              {isAccepted
                ? t(lang, 'Accepted', 'אושר')
                : isRejected
                  ? t(lang, 'Declined', 'נדחה')
                  : t(lang, 'Pending Approval', 'ממתין לאישור')}
            </Badge>
            <span className="text-xs text-gray-400">
              {new Date(job.created_at).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US')}
            </span>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {t(lang,
              `${contractorName} sent you a job`,
              `${contractorName} שלח לך עבודה`
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Job Summary */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {t(lang, 'Job Details', 'פרטי העבודה')}
            </h3>

            <div className="flex items-start gap-3 text-gray-700">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <p className="font-medium">
                {[lead.city, lead.zip_code].filter(Boolean).join(', ') || t(lang, 'Location not specified', 'מיקום לא צוין')}
              </p>
            </div>

            <div className="flex items-start gap-3 text-gray-700">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <p>{urgencyLabel(lead.urgency)}</p>
            </div>

            <div className="flex items-start gap-3 text-gray-700">
              <FileText className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <p className="text-sm leading-relaxed">
                {lead.summary || lead.description || t(lang, 'No description provided.', 'אין תיאור.')}
              </p>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Deal Terms */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {t(lang, 'Deal Terms', 'תנאי העסקה')}
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{dealTypeLabel(job.deal_type)}</span>
                <span className="font-bold text-lg text-gray-900">{job.deal_value}</span>
              </div>
            </div>
          </div>

          {/* Customer Details (visible only after acceptance) */}
          {isAccepted && lead.sender_id && (
            <>
              <div className="h-px bg-gray-100" />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#e04d1c] uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {t(lang, 'Customer Contact', 'פרטי הלקוח')}
                </h3>
                <div className="bg-[#fff4ef] p-4 rounded-lg border border-green-100 space-y-3">
                  <div className="flex items-center gap-3 text-gray-800">
                    <Phone className="w-5 h-5 text-[#e04d1c] shrink-0" />
                    <a href={`tel:${formatPhoneNumber(lead.sender_id)}`} className="font-medium text-green-700 hover:underline">
                      {formatPhoneNumber(lead.sender_id)}
                    </a>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Rejected state */}
          {isRejected && (
            <>
              <div className="h-px bg-gray-100" />
              <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-center">
                <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-600 font-medium">
                  {t(lang, 'You declined this job.', 'דחית את העבודה הזו.')}
                </p>
              </div>
            </>
          )}
        </CardContent>

        {isPending && (
          <CardFooter className="bg-gray-50 border-t p-6 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12 text-base font-medium border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => handleAction('rejected')}
              disabled={actionLoading}
            >
              {actionLoading ? '...' : t(lang, 'Decline', 'דחה')}
            </Button>
            <Button
              className="flex-1 h-12 text-base font-medium bg-[#e04d1c] hover:bg-[#c43d10]"
              onClick={() => handleAction('accepted')}
              disabled={actionLoading}
            >
              {actionLoading ? '...' : t(lang, 'Approve Job', 'אשר עבודה')}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
