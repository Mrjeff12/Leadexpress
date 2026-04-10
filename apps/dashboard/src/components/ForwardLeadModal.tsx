import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { PROFESSIONS } from '../lib/professions'
import { PROFESSION_ICONS, formatProfession } from '../lib/profession-icons'
import {
  X, Send, Loader2, UserPlus, Radio,
  ArrowRight, MapPin, Percent, DollarSign, Hash,
  CheckCircle2, Phone, Shield,
} from 'lucide-react'

interface Lead {
  id: string
  profession: string
  city: string | null
  zip_code: string | null
  parsed_summary: string | null
  raw_message: string | null
}

interface Contractor {
  id: string
  full_name: string | null
  phone: string | null
  professions: string[] | null
  trust_tier: string | null
}

interface ForwardLeadModalProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
}

type DealType = 'percentage' | 'fixed_price' | 'custom'
type ModalMode = 'direct' | 'invite' | 'broadcast'

const profMap = Object.fromEntries(PROFESSIONS.map(p => [p.id, p]))

function formatPhoneE164(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = '972' + digits.slice(1)
  else if (digits.length === 10) digits = '1' + digits
  return digits
}

export default function ForwardLeadModal({ lead, isOpen, onClose }: ForwardLeadModalProps) {
  const { effectiveUserId } = useAuth()
  const { locale } = useI18n()
  const he = locale === 'he'

  const [mode, setMode] = useState<ModalMode>('direct')
  const [dealType, setDealType] = useState<DealType>('percentage')
  const [dealValue, setDealValue] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loadingContractors, setLoadingContractors] = useState(false)
  const [selectedContractorId, setSelectedContractorId] = useState<string>('')

  const [invitePhone, setInvitePhone] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [holdForInvite, setHoldForInvite] = useState(false)

  const [broadcastDescription, setBroadcastDescription] = useState('')

  const submittingRef = useRef(false)

  useEffect(() => {
    if (isOpen && effectiveUserId) {
      setMode('direct')
      setSelectedContractorId('')
      setDealValue('')
      setDealType('percentage')
      setError(null)
      setSuccessMsg(null)
      setInvitePhone('')
      setInviteName('')
      setHoldForInvite(false)
      setBroadcastDescription('')
      fetchContractors()
    }
  }, [isOpen, effectiveUserId])

  async function fetchContractors() {
    if (!lead) return
    setLoadingContractors(true)
    try {
      let query = supabase
        .from('contractors')
        .select('id, professions, trust_tier, profiles!inner(id, full_name, phone)')
        .not('id', 'eq', effectiveUserId!)
      if (lead.profession) query = query.contains('professions', [lead.profession])
      const { data, error: fetchErr } = await query.order('created_at', { ascending: false }).limit(50)
      if (!fetchErr && data) {
        const mapped: Contractor[] = data.map((c: any) => ({
          id: c.id, full_name: c.profiles?.full_name || null, phone: c.profiles?.phone || null,
          professions: c.professions, trust_tier: c.trust_tier,
        }))
        setContractors(mapped)
        if (mapped.length > 0) setSelectedContractorId(mapped[0].id)
      }
    } catch { /* silent */ }
    setLoadingContractors(false)
  }

  if (!isOpen || !lead) return null

  const handleDirectSend = async () => {
    if (!selectedContractorId) { setError(he ? 'אנא בחר קבלן' : 'Please select a contractor'); return }
    if (!dealValue.trim()) { setError(he ? 'אנא הזן תנאי עסקה' : 'Please enter deal terms'); return }
    if (submittingRef.current) return
    submittingRef.current = true
    setError(null); setSubmitting(true)
    try {
      const { data: existing } = await supabase.from('job_orders').select('id')
        .eq('lead_id', lead.id).eq('assigned_user_id', selectedContractorId).in('status', ['pending', 'accepted']).maybeSingle()
      if (existing) { setError(he ? 'כבר קיימת עבודה פעילה' : 'Active job already exists'); return }

      const { data: jobOrder, error: insertError } = await supabase.from('job_orders').insert({
        lead_id: lead.id, contractor_id: effectiveUserId!, assigned_user_id: selectedContractorId,
        deal_type: dealType, deal_value: dealValue, status: 'pending',
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }).select('access_token').single()
      if (insertError) throw insertError

      const contractor = contractors.find(c => c.id === selectedContractorId)
      if (!contractor?.phone) throw new Error('Contractor phone not found')
      const domain = window.location.origin
      const portalUrl = `${domain}/portal/job/${jobOrder.access_token}`
      const locationStr = [lead.city, lead.zip_code].filter(Boolean).join(', ') || 'your area'
      const name = contractor.full_name || ''
      const dealStr = dealType === 'percentage' ? `${dealValue}%` : dealType === 'fixed_price' ? `$${dealValue}` : dealValue
      const message = he
        ? `היי ${name}, יש לי עבודה בשבילך ב${locationStr}.\nתנאים: ${dealStr}\nלחץ כאן:\n${portalUrl}`
        : `Hey ${name}, I have a job for you in ${locationStr}.\nTerms: ${dealStr}\nClick here:\n${portalUrl}`
      window.open(`https://wa.me/${formatPhoneE164(contractor.phone)}?text=${encodeURIComponent(message)}`, '_blank')
      onClose()
    } catch (err: any) { setError(err.message || 'Failed') }
    finally { setSubmitting(false); submittingRef.current = false }
  }

  const handleInviteSend = async () => {
    if (!invitePhone.trim()) { setError(he ? 'הזן מספר טלפון' : 'Enter phone'); return }
    if (!inviteName.trim()) { setError(he ? 'הזן שם' : 'Enter name'); return }
    if (!dealValue.trim()) { setError(he ? 'הזן תנאי עסקה' : 'Enter deal terms'); return }
    if (submittingRef.current) return
    submittingRef.current = true
    setError(null); setSubmitting(true)
    try {
      const normalizedPhone = '+' + formatPhoneE164(invitePhone)
      const { data: invite, error: inviteErr } = await supabase.from('contractor_invites').insert({
        invited_by: effectiveUserId!, phone: normalizedPhone, full_name: inviteName.trim(),
        lead_id: lead.id, deal_type: dealType, deal_value: dealValue, hold_job: holdForInvite, status: 'pending',
      }).select('id').single()
      if (inviteErr) throw inviteErr
      const domain = window.location.origin
      const registerUrl = `${domain}/register?invite=${invite.id}`
      const locationStr = [lead.city, lead.zip_code].filter(Boolean).join(', ') || 'your area'
      const dealStr = dealType === 'percentage' ? `${dealValue}%` : dealType === 'fixed_price' ? `$${dealValue}` : dealValue
      const message = he
        ? `היי ${inviteName}, יש לי עבודה ב${locationStr} (${lead.profession}).\nתנאים: ${dealStr}\nהירשם:\n${registerUrl}`
        : `Hey ${inviteName}, I have a job in ${locationStr} (${lead.profession}).\nTerms: ${dealStr}\nRegister:\n${registerUrl}`
      window.open(`https://wa.me/${formatPhoneE164(invitePhone)}?text=${encodeURIComponent(message)}`, '_blank')
      onClose()
    } catch (err: any) { setError(err.message || 'Failed') }
    finally { setSubmitting(false); submittingRef.current = false }
  }

  const handleBroadcast = async () => {
    if (!dealValue.trim()) { setError(he ? 'הזן תנאי עסקה' : 'Enter deal terms'); return }
    if (submittingRef.current) return
    submittingRef.current = true
    setError(null); setSubmitting(true)
    try {
      const { data: existing } = await supabase.from('job_broadcasts').select('id')
        .eq('lead_id', lead.id).eq('publisher_id', effectiveUserId!).eq('status', 'open').maybeSingle()
      if (existing) { setError(he ? 'כבר קיים שידור פעיל' : 'Active broadcast exists'); return }
      const { data: broadcast, error: broadcastErr } = await supabase.from('job_broadcasts').insert({
        lead_id: lead.id, publisher_id: effectiveUserId!, deal_type: dealType, deal_value: dealValue,
        description: broadcastDescription.trim() || null, min_tier: verifiedOnly ? 'verified' : null,
      }).select('id').single()
      if (broadcastErr) throw broadcastErr
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('broadcast-job', { body: { broadcast_id: broadcast.id } })
      if (fnErr) {
        setSuccessMsg(he ? 'הפרסום נוצר אבל שליחת ההודעות נכשלה' : 'Broadcast created but delivery failed')
      } else {
        const cnt = fnData?.sent ?? fnData?.matched_count ?? 0
        setSuccessMsg(he ? `נשלח ל-${cnt} קבלנים` : `Sent to ${cnt} contractors`)
      }
    } catch (err: any) { setError(err.message || 'Failed') }
    finally { setSubmitting(false); submittingRef.current = false }
  }

  const handleSubmit = () => {
    if (mode === 'direct') handleDirectSend()
    else if (mode === 'invite') handleInviteSend()
    else handleBroadcast()
  }

  const isDisabled = submitting || !!successMsg || (mode === 'direct' && contractors.length === 0 && !loadingContractors)

  const prof = profMap[lead.profession]
  const profIcon = PROFESSION_ICONS[lead.profession]
  const profLabel = prof ? (he ? prof.he : prof.en) : formatProfession(lead.profession)
  const location = [lead.city, lead.zip_code].filter(Boolean).join(', ')

  const modes: { id: ModalMode; label: string; labelHe: string; icon: typeof Send }[] = [
    { id: 'direct', label: 'Direct', labelHe: 'ישיר', icon: Send },
    { id: 'invite', label: 'Invite', labelHe: 'הזמן', icon: UserPlus },
    { id: 'broadcast', label: 'Broadcast', labelHe: 'שדר', icon: Radio },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-[24px] sm:rounded-[24px] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()} style={{ fontFamily: 'Outfit, sans-serif' }}>

        {/* ── Header ── */}
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[18px] font-light tracking-tight text-black">
              {he ? 'העבר עבודה' : 'Forward Job'}
            </h2>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-stone-50 flex items-center justify-center active:scale-95 transition-all">
              <X size={16} className="text-stone-500" />
            </button>
          </div>

          {/* Lead Preview */}
          <div className="flex items-center gap-3 p-3 rounded-[16px] bg-stone-50">
            {profIcon
              ? <span style={{ color: '#fe5b25', width: 20, height: 20, display: 'inline-flex', flexShrink: 0 }} className="[&>svg]:w-5 [&>svg]:h-5">{profIcon}</span>
              : <span className="text-[#fe5b25]"><Send size={20} /></span>
            }
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-black truncate">{profLabel}</p>
              {location && <p className="text-[10px] text-stone-400">{location}</p>}
            </div>
          </div>
        </div>

        {/* ── Mode Toggle ── */}
        <div className="px-6 mb-4">
          <div className="flex bg-stone-50 rounded-[14px] p-1 gap-1">
            {modes.map(m => {
              const active = mode === m.id
              const I = m.icon
              return (
                <button key={m.id} onClick={() => { setMode(m.id); setError(null); setSuccessMsg(null) }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-[11px] font-bold uppercase tracking-wider transition-all ${
                    active ? 'bg-white text-black shadow-sm' : 'text-stone-400'
                  }`}>
                  <I size={13} />
                  {he ? m.labelHe : m.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-4">

          {/* Success */}
          {successMsg && (
            <div className="p-4 rounded-[16px] bg-stone-50 text-center">
              <CheckCircle2 size={28} className="text-black mx-auto mb-2" />
              <p className="text-[13px] font-semibold text-black">{successMsg}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-[14px] bg-red-50 border border-red-100">
              <p className="text-[12px] font-medium text-red-600">{error}</p>
            </div>
          )}

          {!successMsg && (
            <>
              {/* ── Direct: Contractor Select ── */}
              {mode === 'direct' && (
                <div>
                  <Label>{he ? 'בחר קבלן' : 'Select Contractor'}</Label>
                  {loadingContractors ? (
                    <div className="h-12 rounded-[14px] bg-stone-50 animate-pulse" />
                  ) : contractors.length === 0 ? (
                    <div className="p-4 rounded-[14px] bg-stone-50 text-center">
                      <p className="text-[12px] text-stone-500">{he ? 'לא נמצאו קבלנים מתאימים' : 'No matching contractors found'}</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {contractors.map(c => {
                        const selected = selectedContractorId === c.id
                        const initials = c.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
                        return (
                          <button key={c.id} onClick={() => setSelectedContractorId(c.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-[14px] transition-all text-left ${
                              selected ? 'bg-stone-900 text-white' : 'bg-stone-50 text-black hover:bg-stone-100'
                            }`}>
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 ${
                              selected ? 'bg-[#fe5b25] text-white' : 'bg-stone-200 text-stone-600'
                            }`}>
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[13px] font-semibold truncate ${selected ? 'text-white' : 'text-black'}`}>
                                {c.full_name || 'Unnamed'}
                              </p>
                              {c.professions?.length && (
                                <p className={`text-[10px] truncate ${selected ? 'text-white/60' : 'text-stone-400'}`}>
                                  {c.professions.slice(0, 2).map(p => profMap[p] ? (he ? profMap[p].he : profMap[p].en) : p).join(', ')}
                                </p>
                              )}
                            </div>
                            {selected && <CheckCircle2 size={16} className="text-[#fe5b25] shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Invite: Phone & Name ── */}
              {mode === 'invite' && (
                <>
                  <div>
                    <Label>{he ? 'שם מלא' : 'Full Name'}</Label>
                    <Input value={inviteName} onChange={setInviteName} placeholder={he ? 'ישראל ישראלי' : 'John Smith'} />
                  </div>
                  <div>
                    <Label>{he ? 'טלפון' : 'Phone'}</Label>
                    <Input value={invitePhone} onChange={setInvitePhone} placeholder={he ? '050-1234567' : '+1 (555) 123-4567'} type="tel" />
                  </div>
                  <Toggle checked={holdForInvite} onChange={setHoldForInvite}
                    label={he ? 'שמור עבודה עבורו' : 'Hold job for them'} />
                </>
              )}

              {/* ── Broadcast: Description ── */}
              {mode === 'broadcast' && (
                <>
                  <div>
                    <Label>{he ? 'תיאור נוסף' : 'Description'}</Label>
                    <textarea value={broadcastDescription} onChange={e => setBroadcastDescription(e.target.value)}
                      rows={3} placeholder={he ? 'פרטים נוספים...' : 'Additional details...'}
                      className="w-full px-4 py-3 rounded-[14px] bg-stone-50 text-[13px] text-black outline-none focus:ring-2 focus:ring-black/5 resize-none" />
                  </div>
                  <Toggle checked={verifiedOnly} onChange={setVerifiedOnly}
                    label={he ? 'מאומתים בלבד' : 'Verified only'}
                    sub={he ? 'שלח רק לקבלנים שעברו אימות' : 'Only ID-verified contractors'} />
                </>
              )}

              {/* ── Deal Terms (shared) ── */}
              <div>
                <Label>{he ? 'סוג עסקה' : 'Deal Type'}</Label>
                <div className="flex gap-2">
                  {([
                    { id: 'percentage' as DealType, icon: Percent, label: '%' },
                    { id: 'fixed_price' as DealType, icon: DollarSign, label: '$' },
                    { id: 'custom' as DealType, icon: Hash, label: he ? 'אחר' : 'Other' },
                  ]).map(t => {
                    const active = dealType === t.id
                    const I = t.icon
                    return (
                      <button key={t.id} onClick={() => setDealType(t.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-[14px] text-[12px] font-bold transition-all ${
                          active ? 'bg-black text-white' : 'bg-stone-50 text-stone-500 hover:bg-stone-100'
                        }`}>
                        <I size={13} />
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <Label>{he ? 'ערך' : 'Value'}</Label>
                <div className="relative">
                  <input type="text" value={dealValue} onChange={e => setDealValue(e.target.value)}
                    placeholder={dealType === 'percentage' ? '15' : dealType === 'fixed_price' ? '500' : he ? '$100 + חומרים' : '$100 + materials'}
                    className="w-full px-4 py-3 rounded-[14px] bg-stone-50 text-[14px] font-semibold text-black outline-none focus:ring-2 focus:ring-black/5" />
                  {dealType !== 'custom' && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 text-[14px] font-bold">
                      {dealType === 'percentage' ? '%' : '$'}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-6 pt-2">
          {successMsg ? (
            <button onClick={onClose}
              className="w-full py-4 rounded-2xl text-[14px] font-bold bg-stone-50 text-black active:scale-[0.97] transition-all">
              {he ? 'סגור' : 'Close'}
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={isDisabled}
              className="w-full py-4 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-all text-white bg-black disabled:opacity-40">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {mode === 'direct' ? (he ? 'שלח' : 'Send') : mode === 'invite' ? (he ? 'הזמן' : 'Invite') : (he ? 'שדר' : 'Broadcast')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Helpers ── */

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-2">{children}</p>
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-4 py-3 rounded-[14px] bg-stone-50 text-[13px] text-black outline-none focus:ring-2 focus:ring-black/5" />
  )
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 p-3 rounded-[14px] text-left transition-all ${checked ? 'bg-black' : 'bg-stone-50'}`}>
      <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${checked ? 'bg-[#fe5b25]' : 'bg-stone-200'}`}>
        {checked && <CheckCircle2 size={12} className="text-white" />}
      </div>
      <div className="flex-1">
        <p className={`text-[12px] font-semibold ${checked ? 'text-white' : 'text-black'}`}>{label}</p>
        {sub && <p className={`text-[10px] mt-0.5 ${checked ? 'text-white/50' : 'text-stone-400'}`}>{sub}</p>}
      </div>
    </button>
  )
}
