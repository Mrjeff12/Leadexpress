import { useState } from 'react'
import { X, Send, Loader2, Wrench, MapPin, DollarSign, Phone, User, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const BRAND = '#ff6b35'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: (portalUrl: string) => void
}

export default function InviteSubModal({ open, onClose, onSuccess }: Props) {
  const { effectiveUserId } = useAuth()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [portalUrl, setPortalUrl] = useState('')

  // Form fields
  const [description, setDescription] = useState('')
  const [profession, setProfession] = useState('')
  const [city, setCity] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [publisherCut, setPublisherCut] = useState('')
  const [contractorPay, setContractorPay] = useState('')
  const [subPhone, setSubPhone] = useState('')
  const [dealType] = useState('percentage')

  if (!open) return null

  const canSubmit = description.trim() && subPhone.trim()

  async function handleSubmit() {
    if (!canSubmit || loading || !effectiveUserId) return
    setLoading(true)

    try {
      // 1. Create a lead for this job
      const { data: lead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          raw_message: description.trim(),
          parsed_summary: description.trim(),
          profession: profession.trim().toLowerCase().replace(/\s+/g, '_') || null,
          city: city.trim() || null,
          zip_code: zipCode.trim() || null,
          source: 'publisher_invite',
        })
        .select('id')
        .single()

      if (leadErr || !lead) throw new Error('Failed to create lead')

      // 2. Create job_order with publisher set, contractor NULL
      const { data: job, error: jobErr } = await supabase
        .from('job_orders')
        .insert({
          lead_id: lead.id,
          contractor_id: null,
          publisher_user_id: effectiveUserId,
          deal_type: dealType,
          deal_value: contractorPay.trim() || '0',
          status: 'pending',
          customer_address: customerAddress.trim() || null,
          publisher_cut: publisherCut.trim() || null,
          contractor_pay: contractorPay.trim() || null,
        })
        .select('id, access_token')
        .single()

      if (jobErr || !job) throw new Error('Failed to create job order')

      const url = `https://app.masterleadflow.com/portal/job/${job.access_token}`
      setPortalUrl(url)

      // 3. Send WhatsApp to the sub-contractor
      const cleanPhone = subPhone.trim().startsWith('+') ? subPhone.trim() : `+${subPhone.trim()}`

      // Get publisher name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', effectiveUserId)
        .single()

      const pubName = profile?.full_name || 'A contractor'
      const profLabel = profession ? profession.replace(/_/g, ' ') : 'a job'
      const loc = [city, zipCode].filter(Boolean).join(', ')

      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_invite',
          phone: cleanPhone,
          publisher_name: pubName,
          profession: profLabel,
          location: loc,
          portal_url: url,
        }),
      })

      setSent(true)
      onSuccess?.(url)
    } catch (err) {
      console.error('Invite error:', err)
      alert('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setSent(false)
    setPortalUrl('')
    setDescription('')
    setProfession('')
    setCity('')
    setZipCode('')
    setCustomerAddress('')
    setPublisherCut('')
    setContractorPay('')
    setSubPhone('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={handleClose}>
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      {/* Sheet */}
      <div
        className="relative w-full max-w-md rounded-t-3xl overflow-hidden"
        style={{ background: '#141414', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: '#2c2c2e' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <h2 className="text-[17px] font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>
            {sent ? 'Invite Sent! 🎉' : 'Invite Sub-Contractor'}
          </h2>
          <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <X size={16} className="text-white" />
          </button>
        </div>

        {sent ? (
          /* Success state */
          <div className="px-5 pb-8 pt-4">
            <div className="rounded-2xl p-5 text-center" style={{ background: '#1c1c1e' }}>
              <p className="text-5xl mb-3">📤</p>
              <p className="text-[15px] font-semibold text-white mb-2">WhatsApp invite sent!</p>
              <p className="text-[12px] mb-4" style={{ color: '#a1a1a6' }}>
                The sub-contractor will receive a link to see the job details and sign up.
              </p>
              <div className="rounded-xl p-3 text-left" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] font-semibold mb-1" style={{ color: '#636366' }}>PORTAL LINK</p>
                <p className="text-[11px] break-all" style={{ color: BRAND }}>{portalUrl}</p>
              </div>
            </div>
          </div>
        ) : (
          /* Form */
          <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: 'calc(90vh - 80px)' }}>
            <div className="space-y-3">
              {/* Job description */}
              <FormField icon={<FileText size={14} />} label="Job description *">
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Locksmith needed for residential lock change..."
                  rows={2}
                  className="w-full bg-transparent text-[13px] text-white placeholder-[#48484a] focus:outline-none resize-none"
                />
              </FormField>

              {/* Profession + Location row */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <FormField icon={<Wrench size={14} />} label="Trade">
                    <input
                      value={profession}
                      onChange={e => setProfession(e.target.value)}
                      placeholder="e.g. Locksmith"
                      className="w-full bg-transparent text-[13px] text-white placeholder-[#48484a] focus:outline-none"
                    />
                  </FormField>
                </div>
                <div className="flex-1">
                  <FormField icon={<MapPin size={14} />} label="City, ZIP">
                    <input
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="e.g. Miami, 33101"
                      className="w-full bg-transparent text-[13px] text-white placeholder-[#48484a] focus:outline-none"
                    />
                  </FormField>
                </div>
              </div>

              {/* Address */}
              <FormField icon={<MapPin size={14} />} label="Customer address">
                <input
                  value={customerAddress}
                  onChange={e => setCustomerAddress(e.target.value)}
                  placeholder="Full address (optional)"
                  className="w-full bg-transparent text-[13px] text-white placeholder-[#48484a] focus:outline-none"
                />
              </FormField>

              {/* Commission split */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <FormField icon={<DollarSign size={14} />} label="My cut">
                    <input
                      value={publisherCut}
                      onChange={e => setPublisherCut(e.target.value)}
                      placeholder="e.g. $200"
                      className="w-full bg-transparent text-[13px] text-white placeholder-[#48484a] focus:outline-none"
                    />
                  </FormField>
                </div>
                <div className="flex-1">
                  <FormField icon={<DollarSign size={14} />} label="Sub pay">
                    <input
                      value={contractorPay}
                      onChange={e => setContractorPay(e.target.value)}
                      placeholder="e.g. $800"
                      className="w-full bg-transparent text-[13px] text-white placeholder-[#48484a] focus:outline-none"
                    />
                  </FormField>
                </div>
              </div>

              {/* Divider */}
              <div className="pt-2 pb-1">
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
              </div>

              {/* Sub-contractor phone */}
              <FormField icon={<Phone size={14} />} label="Sub-contractor's phone *">
                <input
                  value={subPhone}
                  onChange={e => setSubPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  type="tel"
                  dir="ltr"
                  className="w-full bg-transparent text-[13px] text-white placeholder-[#48484a] focus:outline-none"
                />
              </FormField>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                className="w-full rounded-2xl py-4 text-[15px] font-bold text-white mt-2 active:scale-[0.97] transition-all disabled:opacity-40"
                style={{
                  background: canSubmit ? BRAND : '#2c2c2e',
                  boxShadow: canSubmit ? '0 0 24px rgba(255,107,53,0.25)' : 'none',
                  color: canSubmit ? '#fff' : '#636366',
                }}
              >
                {loading
                  ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  : <span className="flex items-center justify-center gap-2">
                      <Send size={16} />
                      Send invite via WhatsApp
                    </span>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FormField({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ color: '#636366' }}>{icon}</span>
        <span className="text-[10px] font-semibold uppercase" style={{ color: '#636366', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      {children}
    </div>
  )
}
