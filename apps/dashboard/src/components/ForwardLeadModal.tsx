import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { X, Send, Loader2, UserPlus, Radio } from 'lucide-react'

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

function formatPhoneE164(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  // Israeli local numbers: 0XX -> 972XX
  if (digits.startsWith('0')) {
    digits = '972' + digits.slice(1)
  }
  // US numbers without country code: 10 digits -> 1XXXXXXXXXX
  else if (digits.length === 10) {
    digits = '1' + digits
  }
  return digits
}

export default function ForwardLeadModal({ lead, isOpen, onClose }: ForwardLeadModalProps) {
  const { effectiveUserId } = useAuth()
  const { locale } = useI18n()

  const [mode, setMode] = useState<ModalMode>('direct')

  // Shared state
  const [dealType, setDealType] = useState<DealType>('percentage')
  const [dealValue, setDealValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Direct send state
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loadingContractors, setLoadingContractors] = useState(false)
  const [selectedContractorId, setSelectedContractorId] = useState<string>('')

  // Invite state
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [holdForInvite, setHoldForInvite] = useState(false)

  // Broadcast state
  const [broadcastDescription, setBroadcastDescription] = useState('')

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
      // Query contractors from profiles table joined with contractor data
      let query = supabase
        .from('contractors')
        .select('id, professions, trust_tier, profiles!inner(id, full_name, phone)')
        .not('id', 'eq', effectiveUserId!)

      // Filter by profession match if lead has one
      if (lead.profession) {
        query = query.contains('professions', [lead.profession])
      }

      const { data, error: fetchErr } = await query.order('created_at', { ascending: false }).limit(50)

      if (!fetchErr && data) {
        const mapped: Contractor[] = data.map((c: any) => ({
          id: c.id,
          full_name: c.profiles?.full_name || null,
          phone: c.profiles?.phone || null,
          professions: c.professions,
          trust_tier: c.trust_tier,
        }))
        setContractors(mapped)
        if (mapped.length > 0) {
          setSelectedContractorId(mapped[0].id)
        }
      }
    } catch {
      // silent
    }
    setLoadingContractors(false)
  }

  if (!isOpen || !lead) return null

  // ── Direct Send ──
  const handleDirectSend = async () => {
    if (!selectedContractorId) {
      setError(locale === 'he' ? 'אנא בחר קבלן' : 'Please select a contractor')
      return
    }
    if (!dealValue.trim()) {
      setError(locale === 'he' ? 'אנא הזן תנאי עסקה' : 'Please enter deal terms')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const { data: jobOrder, error: insertError } = await supabase
        .from('job_orders')
        .insert({
          lead_id: lead.id,
          contractor_id: effectiveUserId!,
          assigned_user_id: selectedContractorId,
          deal_type: dealType,
          deal_value: dealValue,
          status: 'pending',
          token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('access_token')
        .single()

      if (insertError) throw insertError

      const contractor = contractors.find((c) => c.id === selectedContractorId)
      if (!contractor?.phone) throw new Error('Contractor phone not found')

      const domain = window.location.origin
      const portalUrl = `${domain}/portal/job/${jobOrder.access_token}`
      const locationStr = [lead.city, lead.zip_code].filter(Boolean).join(', ') || 'your area'
      const name = contractor.full_name || ''

      const message =
        locale === 'he'
          ? `היי ${name}, יש לי עבודה בשבילך ב${locationStr}.\nתנאים: ${dealValue} (${dealType === 'percentage' ? '%' : dealType === 'fixed_price' ? '₪' : 'מותאם אישית'}).\nלחץ כאן לצפייה בפרטים ואישור:\n${portalUrl}`
          : `Hey ${name}, I have a job for you in ${locationStr}.\nTerms: ${dealValue} (${dealType === 'percentage' ? '%' : dealType === 'fixed_price' ? '$' : 'custom'}).\nClick here to view details and approve:\n${portalUrl}`

      const formattedPhone = formatPhoneE164(contractor.phone)
      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      window.open(waUrl, '_blank')
      onClose()
    } catch (err: any) {
      console.error('Error forwarding lead:', err)
      setError(err.message || 'Failed to forward lead')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Invite New ──
  const handleInviteSend = async () => {
    if (!invitePhone.trim()) {
      setError(locale === 'he' ? 'אנא הזן מספר טלפון' : 'Please enter a phone number')
      return
    }
    if (!inviteName.trim()) {
      setError(locale === 'he' ? 'אנא הזן שם מלא' : 'Please enter full name')
      return
    }
    if (!dealValue.trim()) {
      setError(locale === 'he' ? 'אנא הזן תנאי עסקה' : 'Please enter deal terms')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const normalizedPhone = '+' + formatPhoneE164(invitePhone)

      const { data: invite, error: inviteErr } = await supabase
        .from('contractor_invites')
        .insert({
          invited_by: effectiveUserId!,
          phone: normalizedPhone,
          full_name: inviteName.trim(),
          lead_id: lead.id,
          deal_type: dealType,
          deal_value: dealValue,
          hold_job: holdForInvite,
          status: 'pending',
        })
        .select('id')
        .single()

      if (inviteErr) throw inviteErr

      const domain = window.location.origin
      const registerUrl = `${domain}/register?invite=${invite.id}`
      const locationStr = [lead.city, lead.zip_code].filter(Boolean).join(', ') || 'your area'

      const message =
        locale === 'he'
          ? `היי ${inviteName}, יש לי הזדמנות עבודה בשבילך ב${locationStr} (${lead.profession}).\nתנאים: ${dealValue} (${dealType === 'percentage' ? '%' : dealType === 'fixed_price' ? '₪' : 'מותאם אישית'}).\nהירשם כאן כדי לצפות בפרטים:\n${registerUrl}`
          : `Hey ${inviteName}, I have a job opportunity for you in ${locationStr} (${lead.profession}).\nTerms: ${dealValue} (${dealType === 'percentage' ? '%' : dealType === 'fixed_price' ? '$' : 'custom'}).\nRegister here to view the details:\n${registerUrl}`

      const formattedPhone = formatPhoneE164(invitePhone)
      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      window.open(waUrl, '_blank')
      onClose()
    } catch (err: any) {
      console.error('Error inviting contractor:', err)
      setError(err.message || 'Failed to send invite')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Broadcast ──
  const handleBroadcast = async () => {
    if (!dealValue.trim()) {
      setError(locale === 'he' ? 'אנא הזן תנאי עסקה' : 'Please enter deal terms')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const { data: broadcast, error: broadcastErr } = await supabase
        .from('job_broadcasts')
        .insert({
          lead_id: lead.id,
          publisher_id: effectiveUserId!,
          deal_type: dealType,
          deal_value: dealValue,
          description: broadcastDescription.trim() || null,
        })
        .select('id')
        .single()

      if (broadcastErr) throw broadcastErr

      // Trigger WhatsApp broadcast via Edge Function
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('broadcast-job', {
        body: { broadcast_id: broadcast.id },
      })

      if (fnErr) {
        console.warn('Broadcast edge function error:', fnErr)
        setSuccessMsg(
          locale === 'he'
            ? 'הפרסום נוצר אבל שליחת ההודעות נכשלה. נסה שוב מעמוד העבודות.'
            : 'Broadcast created but WhatsApp delivery failed. Retry from Jobs page.'
        )
      } else {
        const matchCount = fnData?.sent ?? fnData?.matched_count ?? 0
        setSuccessMsg(
          locale === 'he'
            ? `השידור נשלח ל-${matchCount} קבלנים`
            : `Broadcast sent to ${matchCount} contractors`
        )
      }
    } catch (err: any) {
      console.error('Error broadcasting job:', err)
      setError(err.message || 'Failed to broadcast job')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = () => {
    if (mode === 'direct') handleDirectSend()
    else if (mode === 'invite') handleInviteSend()
    else handleBroadcast()
  }

  const isSubmitDisabled =
    submitting ||
    !!successMsg ||
    (mode === 'direct' && contractors.length === 0 && !loadingContractors)

  const modes: { id: ModalMode; label: string; icon: typeof Send }[] = [
    {
      id: 'direct',
      label: locale === 'he' ? 'שלח לקבלן' : 'Send to Contractor',
      icon: Send,
    },
    {
      id: 'invite',
      label: locale === 'he' ? 'הזמן חדש' : 'Invite New',
      icon: UserPlus,
    },
    {
      id: 'broadcast',
      label: locale === 'he' ? 'שדר לרשת' : 'Broadcast to Network',
      icon: Radio,
    },
  ]

  const headerTitle =
    mode === 'direct'
      ? locale === 'he' ? 'שלח ליד לקבלן' : 'Send Lead to Contractor'
      : mode === 'invite'
        ? locale === 'he' ? 'הזמן קבלן חדש' : 'Invite New Contractor'
        : locale === 'he' ? 'שדר עבודה לרשת' : 'Broadcast Job to Network'

  const submitLabel =
    mode === 'direct'
      ? locale === 'he' ? 'צור קישור ושלח' : 'Generate Link & Send'
      : mode === 'invite'
        ? locale === 'he' ? 'שלח הזמנה' : 'Send Invite'
        : locale === 'he' ? 'שדר עכשיו' : 'Broadcast Now'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <h2 className="text-lg font-bold text-stone-800">{headerTitle}</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {/* Mode Toggle */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {modes.map((m) => {
              const Icon = m.icon
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMode(m.id)
                    setError(null)
                    setSuccessMsg(null)
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-xl border transition-colors ${
                    mode === m.id
                      ? 'bg-[#fff4ef] border-[#fdd5c5] text-[#c43d10]'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <Icon size={14} />
                  {m.label}
                </button>
              )
            })}
          </div>

          {/* Success Message */}
          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-green-50 text-green-700 text-sm font-medium border border-green-100">
              {successMsg}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          {/* Lead Summary Preview */}
          <div className="mb-6 p-4 rounded-xl bg-stone-50 border border-stone-100">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
              {locale === 'he' ? 'פרטי הליד' : 'Lead Details'}
            </p>
            <p className="text-sm text-stone-700 line-clamp-3">
              {lead.parsed_summary || lead.raw_message || 'No details available'}
            </p>
            <div className="mt-2 text-xs text-stone-500 flex items-center gap-2">
              <span className="px-2 py-1 bg-white rounded-md border border-stone-200">
                {lead.profession}
              </span>
              {(lead.city || lead.zip_code) && (
                <span className="px-2 py-1 bg-white rounded-md border border-stone-200">
                  {[lead.city, lead.zip_code].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* ── Mode-specific fields ── */}

            {/* Direct: Contractor Selection */}
            {mode === 'direct' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  {locale === 'he' ? 'בחר קבלן' : 'Select Contractor'}
                </label>
                {loadingContractors ? (
                  <div className="h-10 rounded-xl bg-stone-100 animate-pulse" />
                ) : contractors.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 text-amber-700 text-sm border border-amber-100">
                    {locale === 'he'
                      ? 'לא נמצאו קבלנים מתאימים באזור.'
                      : 'No matching contractors found in the area.'}
                  </div>
                ) : (
                  <select
                    value={selectedContractorId}
                    onChange={(e) => setSelectedContractorId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:border-[#fe5b25] focus:ring-1 focus:ring-[#fe5b25] outline-none"
                  >
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name || 'Unnamed'}{' '}
                        {c.trust_tier ? `[${c.trust_tier}]` : ''}{' '}
                        {c.professions?.length ? `(${c.professions.join(', ')})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Invite: Phone & Name */}
            {mode === 'invite' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    {locale === 'he' ? 'שם מלא' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder={locale === 'he' ? 'לדוגמה: ישראל ישראלי' : 'e.g. John Smith'}
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:border-[#fe5b25] focus:ring-1 focus:ring-[#fe5b25] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    {locale === 'he' ? 'מספר טלפון' : 'Phone Number'}
                  </label>
                  <input
                    type="tel"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    placeholder={locale === 'he' ? '050-1234567' : '+1 (555) 123-4567'}
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:border-[#fe5b25] focus:ring-1 focus:ring-[#fe5b25] outline-none"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={holdForInvite}
                    onChange={(e) => setHoldForInvite(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-300 text-[#e04d1c] focus:ring-[#fe5b25]"
                  />
                  <span className="text-sm text-stone-600">
                    {locale === 'he' ? 'שמור את העבודה עבורו' : 'Hold this job for them'}
                  </span>
                </label>
              </>
            )}

            {/* Broadcast: Description + Info */}
            {mode === 'broadcast' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    {locale === 'he' ? 'תיאור נוסף (אופציונלי)' : 'Description (optional)'}
                  </label>
                  <textarea
                    value={broadcastDescription}
                    onChange={(e) => setBroadcastDescription(e.target.value)}
                    rows={3}
                    placeholder={
                      locale === 'he'
                        ? 'הוסף פרטים נוספים על העבודה...'
                        : 'Add more details about the job...'
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm focus:border-[#fe5b25] focus:ring-1 focus:ring-[#fe5b25] outline-none resize-none"
                  />
                </div>
                <div className="p-3 rounded-xl bg-blue-50 text-blue-700 text-sm border border-blue-100">
                  {locale === 'he'
                    ? 'העבודה תישלח לכל הקבלנים המתאימים באזור.'
                    : 'Your job will be sent to matching contractors in the area.'}
                </div>
              </>
            )}

            {/* Deal Type (shared) */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                {locale === 'he' ? 'סוג עסקה' : 'Deal Type'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'percentage', label: locale === 'he' ? 'אחוזים' : 'Percentage' },
                  { id: 'fixed_price', label: locale === 'he' ? 'מחיר קבוע' : 'Fixed Price' },
                  { id: 'custom', label: locale === 'he' ? 'אחר' : 'Custom' },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setDealType(type.id as DealType)}
                    className={`py-2 px-3 text-xs font-medium rounded-xl border transition-colors ${
                      dealType === type.id
                        ? 'bg-[#fff4ef] border-[#fdd5c5] text-[#c43d10]'
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deal Value (shared) */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                {locale === 'he' ? 'תנאי העסקה (ערך)' : 'Deal Terms (Value)'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  placeholder={
                    dealType === 'percentage'
                      ? 'e.g. 20'
                      : dealType === 'fixed_price'
                        ? 'e.g. 500'
                        : 'e.g. $100 + materials'
                  }
                  className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:border-[#fe5b25] focus:ring-1 focus:ring-[#fe5b25] outline-none"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">
                  {dealType === 'percentage'
                    ? '%'
                    : dealType === 'fixed_price'
                      ? locale === 'he'
                        ? '₪'
                        : '$'
                      : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
          >
            {successMsg
              ? locale === 'he' ? 'סגור' : 'Close'
              : locale === 'he' ? 'ביטול' : 'Cancel'}
          </button>
          {!successMsg && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className="flex items-center gap-2 px-5 py-2 bg-[#e04d1c] hover:bg-[#c43d10] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === 'broadcast' ? (
                <Radio size={16} />
              ) : mode === 'invite' ? (
                <UserPlus size={16} />
              ) : (
                <Send size={16} />
              )}
              {submitLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
