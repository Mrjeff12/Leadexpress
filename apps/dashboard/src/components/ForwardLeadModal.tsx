import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { X, Send, Loader2 } from 'lucide-react'

interface Lead {
  id: string
  profession: string
  city: string | null
  zip_code: string | null
  parsed_summary: string | null
  raw_message: string | null
}

interface Subcontractor {
  id: string
  full_name: string
  phone: string
}

interface ForwardLeadModalProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
}

type DealType = 'percentage' | 'fixed_price' | 'custom'

export default function ForwardLeadModal({ lead, isOpen, onClose }: ForwardLeadModalProps) {
  const { user } = useAuth()
  const { locale } = useI18n()
  
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [loadingSubs, setLoadingSubs] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const [selectedSubId, setSelectedSubId] = useState<string>('')
  const [dealType, setDealType] = useState<DealType>('percentage')
  const [dealValue, setDealValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && user) {
      fetchSubcontractors()
    }
  }, [isOpen, user])

  async function fetchSubcontractors() {
    setLoadingSubs(true)
    const { data, error } = await supabase
      .from('subcontractors')
      .select('id, full_name, phone')
      .eq('contractor_id', user!.id)
      .order('full_name')
      
    if (!error && data) {
      setSubcontractors(data)
      if (data.length > 0 && !selectedSubId) {
        setSelectedSubId(data[0].id)
      }
    }
    setLoadingSubs(false)
  }

  if (!isOpen || !lead) return null

  const handleSend = async () => {
    if (!selectedSubId) {
      setError(locale === 'he' ? 'אנא בחר קבלן משנה' : 'Please select a subcontractor')
      return
    }
    if (!dealValue.trim()) {
      setError(locale === 'he' ? 'אנא הזן תנאי עסקה' : 'Please enter deal terms')
      return
    }
    
    setError(null)
    setSubmitting(true)
    
    try {
      // 1. Insert job order
      const { data: jobOrder, error: insertError } = await supabase
        .from('job_orders')
        .insert({
          lead_id: lead.id,
          contractor_id: user!.id,
          subcontractor_id: selectedSubId,
          deal_type: dealType,
          deal_value: dealValue,
          status: 'pending'
        })
        .select('access_token')
        .single()
        
      if (insertError) throw insertError
      
      // 2. Construct WhatsApp URL
      const sub = subcontractors.find(s => s.id === selectedSubId)
      if (!sub) throw new Error('Subcontractor not found')
      
      const domain = window.location.origin
      const portalUrl = `${domain}/portal/job/${jobOrder.access_token}`
      
      const locationStr = [lead.city, lead.zip_code].filter(Boolean).join(', ') || 'your area'
      
      const message = locale === 'he' 
        ? `היי ${sub.full_name}, יש לי עבודה בשבילך ב${locationStr}.\nתנאים: ${dealValue} (${dealType === 'percentage' ? '%' : dealType === 'fixed_price' ? '₪' : 'מותאם אישית'}).\nלחץ כאן לצפייה בפרטים ואישור:\n${portalUrl}`
        : `Hey ${sub.full_name}, I have a job for you in ${locationStr}.\nTerms: ${dealValue} (${dealType === 'percentage' ? '%' : dealType === 'fixed_price' ? '$' : 'custom'}).\nClick here to view details and approve:\n${portalUrl}`
        
      let formattedPhone = sub.phone.replace(/\D/g, '')
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '972' + formattedPhone.slice(1)
      }
      
      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      
      // 3. Open WhatsApp and close modal
      window.open(waUrl, '_blank')
      onClose()
      
      // Reset state
      setDealValue('')
      setDealType('percentage')
    } catch (err: any) {
      console.error('Error forwarding lead:', err)
      setError(err.message || 'Failed to forward lead')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <h2 className="text-lg font-bold text-stone-800">
            {locale === 'he' ? 'העבר ליד לקבלן משנה' : 'Forward Lead to Subcontractor'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
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
            {/* Subcontractor Selection */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                {locale === 'he' ? 'בחר קבלן משנה' : 'Select Subcontractor'}
              </label>
              {loadingSubs ? (
                <div className="h-10 rounded-xl bg-stone-100 animate-pulse" />
              ) : subcontractors.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 text-amber-700 text-sm border border-amber-100">
                  {locale === 'he' 
                    ? 'לא נמצאו קבלני משנה. הוסף אותם בעמוד קבלני משנה.' 
                    : 'No subcontractors found. Add them in the Subcontractors page.'}
                </div>
              ) : (
                <select
                  value={selectedSubId}
                  onChange={(e) => setSelectedSubId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                >
                  {subcontractors.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.full_name} ({sub.phone})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Deal Type */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                {locale === 'he' ? 'סוג עסקה' : 'Deal Type'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'percentage', label: locale === 'he' ? 'אחוזים' : 'Percentage' },
                  { id: 'fixed_price', label: locale === 'he' ? 'מחיר קבוע' : 'Fixed Price' },
                  { id: 'custom', label: locale === 'he' ? 'אחר' : 'Custom' }
                ].map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setDealType(type.id as DealType)}
                    className={`py-2 px-3 text-xs font-medium rounded-xl border transition-colors ${
                      dealType === type.id 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deal Value */}
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
                    dealType === 'percentage' ? 'e.g. 20' : 
                    dealType === 'fixed_price' ? 'e.g. 500' : 
                    'e.g. $100 + materials'
                  }
                  className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">
                  {dealType === 'percentage' ? '%' : dealType === 'fixed_price' ? (locale === 'he' ? '₪' : '$') : ''}
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
            {locale === 'he' ? 'ביטול' : 'Cancel'}
          </button>
          <button
            onClick={handleSend}
            disabled={submitting || subcontractors.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {locale === 'he' ? 'צור קישור ושלח' : 'Generate Link & Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
