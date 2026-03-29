import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Briefcase,
  Send,
  Loader2,
  CheckCircle,
  MapPin,
  Clock,
  User,
  Phone,
  FileText,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Search,
} from 'lucide-react'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const REBECCA_PHONE = '13058516498'
const JOB_TYPES = ['Percentage', 'Fixed Price', 'Custom'] as const
const TIMELINES = ['ASAP', 'This week', 'This month', 'Flexible'] as const
const STEPS = ['Job Details', 'Location & Timeline', 'Your Info'] as const

interface GeoResult {
  id: string
  place_name: string
  text: string
}

export default function NewJobOffer() {
  const [params] = useSearchParams()
  const contractorName = params.get('name') ?? ''
  const contractorId = params.get('contractor') ?? ''

  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    jobTitle: '',
    description: '',
    jobType: 'Fixed Price' as (typeof JOB_TYPES)[number],
    budgetValue: '',
    location: '',
    timeline: 'Flexible' as (typeof TIMELINES)[number],
    senderName: '',
    senderPhone: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // Location autocomplete
  const [locQuery, setLocQuery] = useState('')
  const [locResults, setLocResults] = useState<GeoResult[]>([])
  const [showLocResults, setShowLocResults] = useState(false)
  const locRef = useRef<HTMLDivElement>(null)
  const locTimeout = useRef<ReturnType<typeof setTimeout>>()

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  // Location search with Mapbox
  useEffect(() => {
    clearTimeout(locTimeout.current)
    if (!locQuery.trim() || locQuery.length < 2 || !MAPBOX_TOKEN) {
      setLocResults([])
      return
    }
    locTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locQuery)}.json?country=us&types=place,postcode,locality,neighborhood,address&limit=5&autocomplete=true&access_token=${MAPBOX_TOKEN}`
        )
        const data = await res.json()
        setLocResults(data.features ?? [])
        setShowLocResults(true)
      } catch {
        setLocResults([])
      }
    }, 250)
    return () => clearTimeout(locTimeout.current)
  }, [locQuery])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (locRef.current && !locRef.current.contains(e.target as Node)) setShowLocResults(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Step validation
  const stepValid = [
    form.jobTitle.trim().length > 0 && form.description.trim().length > 0,
    true, // location & timeline are optional
    form.senderName.trim().length > 0 && form.senderPhone.trim().length > 0,
  ]

  const handleSubmit = () => {
    if (sending) return
    setSending(true)

    const lines = [
      `*New Job Offer via MasterLeadFlow*`,
      ``,
      `*Job:* ${form.jobTitle}`,
      `*Description:* ${form.description}`,
      `*Type:* ${form.jobType}`,
      form.budgetValue ? `*Budget:* ${form.budgetValue}` : null,
      form.location ? `*Location:* ${form.location}` : null,
      `*Timeline:* ${form.timeline}`,
      ``,
      `*From:* ${form.senderName}`,
      `*Phone:* ${form.senderPhone}`,
      contractorName ? `*For:* ${contractorName}` : null,
    ].filter(Boolean).join('\n')

    window.open(`https://wa.me/${REBECCA_PHONE}?text=${encodeURIComponent(lines)}`, '_blank')
    setSending(false)
    setSent(true)
  }

  // Success state
  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#faf9f6' }}>
        <div className="max-w-md w-full text-center space-y-5">
          <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#0b0707' }}>Offer Sent!</h1>
          <p className="text-sm leading-relaxed" style={{ color: '#3b3b3b', opacity: 0.6 }}>
            We'll connect you with {contractorName || 'the contractor'} shortly via WhatsApp.
          </p>

          {/* Summary */}
          <div className="text-left rounded-2xl p-4 space-y-2" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)' }}>
            <SummaryRow label="Job" value={form.jobTitle} />
            <SummaryRow label="Type" value={form.jobType} />
            {form.budgetValue && <SummaryRow label="Budget" value={form.budgetValue} />}
            {form.location && <SummaryRow label="Location" value={form.location} />}
            <SummaryRow label="Timeline" value={form.timeline} />
          </div>

          <a href={contractorName ? `/pro/${params.get('slug') || ''}` : '/'} className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all hover:scale-105" style={{ background: '#fe5b25' }}>
            Done
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#faf9f6' }}>
      {/* Header */}
      <header className="px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-[9px]" style={{ background: 'linear-gradient(135deg, #fe5b25, #ff7a4d)' }}>MLF</div>
        <span className="text-sm font-bold tracking-tight" style={{ color: '#0b0707' }}>MasterLeadFlow</span>
      </header>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 sm:px-5 pb-8">
        {/* Title */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold" style={{ color: '#0b0707' }}>Send Job Offer</h1>
          {contractorName && (
            <p className="text-sm mt-1" style={{ color: '#3b3b3b', opacity: 0.5 }}>
              To: <span className="font-semibold" style={{ opacity: 1, color: '#0b0707' }}>{contractorName}</span>
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 my-5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: i < step ? '100%' : i === step ? '50%' : '0%',
                    background: i <= step ? '#fe5b25' : 'transparent',
                  }}
                />
              </div>
              <span className="text-[10px] font-medium" style={{ color: i <= step ? '#fe5b25' : 'rgba(59,59,59,0.3)' }}>
                {s}
              </span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1">
          {step === 0 && (
            <div className="space-y-5 animate-fade-in-up">
              <Field icon={Briefcase} label="Job Title" required>
                <WizardInput value={form.jobTitle} onChange={set('jobTitle')} placeholder="e.g. Kitchen Remodel, AC Install" autoFocus />
              </Field>
              <Field icon={FileText} label="Description" required>
                <textarea
                  value={form.description}
                  onChange={(e) => set('description')(e.target.value)}
                  rows={4}
                  placeholder="Describe the job — scope, size, any special requirements..."
                  autoFocus={false}
                  className="w-full px-4 py-3 rounded-2xl text-sm resize-none transition-all focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/20"
                  style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)', color: '#0b0707' }}
                />
              </Field>
              <Field icon={DollarSign} label="Job Type">
                <div className="flex gap-2">
                  {JOB_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('jobType')(t)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: form.jobType === t ? '#0b0707' : 'white',
                        color: form.jobType === t ? 'white' : '#3b3b3b',
                        border: `1px solid ${form.jobType === t ? '#0b0707' : 'rgba(0,0,0,0.06)'}`,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
              <Field icon={DollarSign} label="Budget / Value">
                <WizardInput value={form.budgetValue} onChange={set('budgetValue')} placeholder={form.jobType === 'Percentage' ? '30%' : '$5,000'} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5 animate-fade-in-up">
              <Field icon={MapPin} label="Location">
                <div ref={locRef} className="relative">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(0,0,0,0.25)' }} />
                    <input
                      type="text"
                      value={form.location || locQuery}
                      onChange={(e) => {
                        const v = e.target.value
                        setLocQuery(v)
                        set('location')(v)
                      }}
                      onFocus={() => locResults.length > 0 && setShowLocResults(true)}
                      placeholder="Search city, address, or ZIP..."
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/20"
                      style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)', color: '#0b0707' }}
                    />
                  </div>

                  {/* Autocomplete dropdown */}
                  {showLocResults && locResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-2xl overflow-hidden shadow-xl z-20" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)' }}>
                      {locResults.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          aria-label={`Select location: ${r.place_name}`}
                          onClick={() => {
                            set('location')(r.place_name)
                            setLocQuery(r.place_name)
                            setShowLocResults(false)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors"
                          style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}
                        >
                          <MapPin size={14} style={{ color: '#fe5b25', flexShrink: 0 }} />
                          <span className="truncate" style={{ color: '#0b0707' }}>{r.place_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>

              <Field icon={Clock} label="Timeline">
                <div className="grid grid-cols-2 gap-2">
                  {TIMELINES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('timeline')(t)}
                      className="py-3 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: form.timeline === t ? '#0b0707' : 'white',
                        color: form.timeline === t ? 'white' : '#3b3b3b',
                        border: `1px solid ${form.timeline === t ? '#0b0707' : 'rgba(0,0,0,0.06)'}`,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Selected location display */}
              {form.location && !showLocResults && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl" style={{ background: 'rgba(254,91,37,0.06)', border: '1px solid rgba(254,91,37,0.12)' }}>
                  <MapPin size={14} style={{ color: '#fe5b25' }} />
                  <span className="text-sm font-medium truncate" style={{ color: '#0b0707' }}>{form.location}</span>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-fade-in-up">
              <Field icon={User} label="Your Name" required>
                <WizardInput value={form.senderName} onChange={set('senderName')} placeholder="John Smith" autoFocus />
              </Field>
              <Field icon={Phone} label="Your Phone" required>
                <WizardInput value={form.senderPhone} onChange={set('senderPhone')} placeholder="+1 (305) 555-0123" type="tel" pattern="[0-9+\-() ]*" />
              </Field>

              {/* Review summary */}
              <div className="mt-6">
                <p className="text-xs font-semibold mb-3" style={{ color: '#3b3b3b', opacity: 0.5 }}>REVIEW YOUR OFFER</p>
                <div className="rounded-2xl p-4 space-y-2" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <SummaryRow label="Job" value={form.jobTitle} />
                  <SummaryRow label="Type" value={form.jobType} />
                  {form.budgetValue && <SummaryRow label="Budget" value={form.budgetValue} />}
                  {form.location && <SummaryRow label="Location" value={form.location} />}
                  <SummaryRow label="Timeline" value={form.timeline} />
                  {contractorName && <SummaryRow label="For" value={contractorName} />}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons — sticky bottom */}
        <div className="flex gap-3 mt-6 pt-4 sticky bottom-0 bg-[#faf9f6] pb-4 sm:pb-0 sm:static" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95"
              style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', color: '#3b3b3b' }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {step < 2 ? (
            <button
              type="button"
              onClick={() => stepValid[step] && setStep(step + 1)}
              disabled={!stepValid[step]}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
              style={{ background: '#fe5b25' }}
            >
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!stepValid[2] || sending}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-bold text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
              style={{ background: '#25D366' }}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={14} />}
              Send via WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Sub Components ── */

function Field({ icon: Icon, label, required, children }: {
  icon: React.ElementType; label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: '#0b0707' }}>
        <Icon className="w-4 h-4" style={{ color: 'rgba(0,0,0,0.25)' }} />
        {label}
        {required && <span style={{ color: '#fe5b25' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function WizardInput({ value, onChange, placeholder, type = 'text', autoFocus, pattern }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; autoFocus?: boolean; pattern?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      pattern={pattern}
      className="w-full px-4 py-3 rounded-2xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/20"
      style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)', color: '#0b0707' }}
    />
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: '#3b3b3b', opacity: 0.5 }}>{label}</span>
      <span className="font-medium" style={{ color: '#0b0707' }}>{value}</span>
    </div>
  )
}
