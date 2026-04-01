import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Loader2, CheckCircle2, XCircle, Clock, Copy, MessageCircle, ExternalLink,
} from 'lucide-react'

type Action = 'took' | 'not_relevant' | 'still_talking'

export default function ClaimFollowup() {
  const [params] = useSearchParams()
  const token = params.get('t') || ''

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState<Action | null>(null)
  const [jobData, setJobData] = useState<{ id: string; accessToken: string } | null>(null)
  const [publisherMessage, setPublisherMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6" style={{ background: '#FBFBFD' }}>
        <XCircle className="w-12 h-12 text-red-400" />
        <p className="text-lg font-semibold text-gray-800">Invalid link</p>
        <p className="text-sm text-gray-500">This follow-up link is not valid.</p>
      </div>
    )
  }

  const handleAction = async (action: Action) => {
    setLoading(true)
    setError(null)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/claim-followup-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === 'invalid_token' ? 'This link has expired or is invalid.' : 'Something went wrong.')
        return
      }
      setSubmitted(action)
      if (data.jobOrder) setJobData(data.jobOrder)
      if (data.publisherMessage) setPublisherMessage(data.publisherMessage)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (publisherMessage) {
      navigator.clipboard.writeText(publisherMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Success states
  if (submitted === 'took' && publisherMessage) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#FBFBFD', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
        <div className="flex items-center justify-center gap-1.5 py-3 border-b border-gray-100">
          <div className="w-5 h-5 rounded flex items-center justify-center text-white font-bold text-[10px]"
            style={{ background: '#fe5b25' }}>M</div>
          <span className="text-xs font-semibold text-gray-500">MasterLeadFlow</span>
        </div>

        <div className="flex-1 px-4 pt-8 pb-32 max-w-lg mx-auto w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Job Created!</h1>
            <p className="text-sm text-gray-500 mt-1">Now send this message to the customer to confirm the job</p>
          </div>

          {/* Publisher message card */}
          <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '1px solid #e8e8ec', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#f8f8fa', borderBottom: '1px solid #f0f0f0' }}>
              <span className="text-sm font-semibold text-gray-700">Message for Customer</span>
              <button onClick={handleCopy} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg"
                style={{ background: copied ? '#dcfce7' : '#fff', color: copied ? '#16a34a' : '#6b7280', border: '1px solid #e5e7eb' }}>
                <Copy size={12} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="px-4 py-4 bg-white">
              <p className="text-[14px] leading-relaxed text-gray-700 whitespace-pre-line">{publisherMessage}</p>
            </div>
          </div>

          <p className="text-center text-[11px] text-gray-400 mb-6">
            Send this to the customer so they can approve the job and track everything securely
          </p>
        </div>

        {/* Sticky bottom buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 flex flex-col gap-2.5 max-w-lg mx-auto"
          style={{ background: 'linear-gradient(transparent, #FBFBFD 20%)' }}>
          <button
            onClick={() => {
              if (publisherMessage) {
                const encoded = encodeURIComponent(publisherMessage)
                window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer')
              }
            }}
            className="flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold text-white"
            style={{ background: '#25D366', boxShadow: '0 4px 12px rgba(37,211,102,0.3)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.627.616l4.584-1.212A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.205 0-4.247-.707-5.912-1.908l-.423-.31-2.823.746.583-2.735-.34-.441A9.958 9.958 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
            </svg>
            Send via WhatsApp
          </button>
          <button onClick={handleCopy}
            className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold bg-white border border-gray-200 text-gray-700">
            <Copy size={16} />
            {copied ? 'Copied!' : 'Copy Message'}
          </button>
        </div>
      </div>
    )
  }

  if (submitted === 'not_relevant') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6" style={{ background: '#FBFBFD' }}>
        <XCircle className="w-12 h-12 text-gray-300" />
        <p className="text-lg font-semibold text-gray-800">Got it, no problem</p>
        <p className="text-sm text-gray-500">We'll keep sending you relevant leads.</p>
      </div>
    )
  }

  if (submitted === 'still_talking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6" style={{ background: '#FBFBFD' }}>
        <Clock className="w-12 h-12 text-blue-400" />
        <p className="text-lg font-semibold text-gray-800">Good luck!</p>
        <p className="text-sm text-gray-500">We'll check back later. Hope you close the deal!</p>
      </div>
    )
  }

  // Main form
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FBFBFD', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div className="flex items-center justify-center gap-1.5 py-3 border-b border-gray-100">
        <div className="w-5 h-5 rounded flex items-center justify-center text-white font-bold text-[10px]"
          style={{ background: '#fe5b25' }}>M</div>
        <span className="text-xs font-semibold text-gray-500">MasterLeadFlow</span>
      </div>

      <div className="flex-1 px-4 pt-10 max-w-lg mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-gray-900">How did it go?</h1>
          <p className="text-sm text-gray-500 mt-1">Did you connect with the customer?</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleAction('took')}
            disabled={loading}
            className="flex items-center gap-3 px-5 py-4 rounded-2xl text-left transition-all active:scale-[0.98]"
            style={{ background: '#fff', border: '1px solid #e8e8ec', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            <div className="w-11 h-11 rounded-full bg-green-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <span className="font-semibold text-[15px] text-gray-900 block">I took the job</span>
              <span className="text-xs text-gray-500">Create a job and send confirmation to customer</span>
            </div>
          </button>

          <button
            onClick={() => handleAction('still_talking')}
            disabled={loading}
            className="flex items-center gap-3 px-5 py-4 rounded-2xl text-left transition-all active:scale-[0.98]"
            style={{ background: '#fff', border: '1px solid #e8e8ec', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <span className="font-semibold text-[15px] text-gray-900 block">Still talking</span>
              <span className="text-xs text-gray-500">We'll follow up again later</span>
            </div>
          </button>

          <button
            onClick={() => handleAction('not_relevant')}
            disabled={loading}
            className="flex items-center gap-3 px-5 py-4 rounded-2xl text-left transition-all active:scale-[0.98]"
            style={{ background: '#fff', border: '1px solid #e8e8ec', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            <div className="w-11 h-11 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <span className="font-semibold text-[15px] text-gray-900 block">Not relevant</span>
              <span className="text-xs text-gray-500">Didn't work out this time</span>
            </div>
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center mt-6">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#fe5b25' }} />
          </div>
        )}
      </div>
    </div>
  )
}
