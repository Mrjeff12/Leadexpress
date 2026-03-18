import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/shadcn/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/shadcn/ui/card'
import { Badge } from '../components/shadcn/ui/badge'
import { MapPin, Clock, FileText, CheckCircle, Phone } from 'lucide-react'

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

  const handleApprove = async () => {
    if (!token) return
    setActionLoading(true)
    try {
      const { data, error } = await supabase
        .rpc('update_job_order_status_by_token', { token, new_status: 'accepted' })
      
      if (error) throw error
      if (!data) throw new Error('Failed to approve job')
      
      // Update local state with the newly returned unmasked data
      setJob(data as unknown as Job)
    } catch (err: any) {
      console.error('Error approving job:', err)
      alert('Failed to approve job. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500">Loading job details...</p>
        </div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-red-500">Link Invalid or Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{error || 'This job order could not be found.'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const contractorName = job.contractor_name || 'A contractor'
  const isAccepted = job.status === 'accepted'
  const lead = job.lead || {
    city: null,
    zip_code: null,
    urgency: null,
    summary: null,
    description: null,
    sender_id: null
  }

  const formatPhoneNumber = (senderId: string | null) => {
    if (!senderId) return 'No phone provided'
    return senderId.replace('@c.us', '')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex justify-center items-start font-sans">
      <Card className="w-full max-w-lg shadow-lg border-0">
        <CardHeader className="bg-primary/5 border-b pb-6">
          <div className="flex justify-between items-start mb-2">
            <Badge variant={isAccepted ? "default" : "secondary"} className={isAccepted ? "bg-green-500 hover:bg-green-600" : ""}>
              {isAccepted ? 'Accepted' : 'Pending Approval'}
            </Badge>
            <span className="text-xs text-gray-400">
              {new Date(job.created_at).toLocaleDateString()}
            </span>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {contractorName} sent you a job
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Job Summary */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Job Details</h3>
            
            <div className="flex items-start gap-3 text-gray-700">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">
                  {[lead.city, lead.zip_code].filter(Boolean).join(', ') || 'Location not specified'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-gray-700">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <p>{lead.urgency || 'Standard timeframe'}</p>
            </div>

            <div className="flex items-start gap-3 text-gray-700">
              <FileText className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <p className="text-sm leading-relaxed">{lead.summary || lead.description || 'No description provided.'}</p>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Deal Terms */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Deal Terms</h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 capitalize">{job.deal_type?.replace('_', ' ')}</span>
                <span className="font-bold text-lg text-gray-900">{job.deal_value}</span>
              </div>
            </div>
          </div>

          {/* Customer Details (Hidden until accepted) */}
          {isAccepted && lead.sender_id && (
            <>
              <div className="h-px bg-gray-100" />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-green-600 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Customer Contact
                </h3>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100 space-y-3">
                  <div className="flex items-center gap-3 text-gray-800">
                    <Phone className="w-5 h-5 text-green-600 shrink-0" />
                    <a href={`tel:${formatPhoneNumber(lead.sender_id)}`} className="font-medium text-green-700 hover:underline">
                      {formatPhoneNumber(lead.sender_id)}
                    </a>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>

        {!isAccepted && (
          <CardFooter className="bg-gray-50 border-t p-6">
            <Button 
              className="w-full h-12 text-lg font-medium" 
              onClick={handleApprove}
              disabled={actionLoading}
            >
              {actionLoading ? 'Approving...' : 'Approve Job'}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
