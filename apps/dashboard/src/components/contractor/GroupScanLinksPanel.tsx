import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { useContractorGroupScanLinks, type GroupScanStatus } from '../../hooks/useContractorGroupScanLinks'
import { Plus, Link as LinkIcon, CheckCircle2, XCircle, Clock, ShieldAlert, Users } from 'lucide-react'

const StatusBadge = ({ status, locale }: { status: GroupScanStatus; locale: string }) => {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[10px] font-bold">
          <Clock className="w-3 h-3" />
          {locale === 'he' ? 'ממתין' : 'Pending'}
        </span>
      )
    case 'joined':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#fff4ef] text-[#e04d1c] text-[10px] font-bold">
          <CheckCircle2 className="w-3 h-3" />
          {locale === 'he' ? 'נכנסנו' : 'Joined'}
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-bold">
          <XCircle className="w-3 h-3" />
          {locale === 'he' ? 'נכשל' : 'Failed'}
        </span>
      )
    case 'blocked_private':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-bold" title={locale === 'he' ? 'קבוצה פרטית כרגע לא נתמכת' : 'Private groups not supported currently'}>
          <ShieldAlert className="w-3 h-3" />
          {locale === 'he' ? 'פרטי (לא נתמך)' : 'Private (Unsupported)'}
        </span>
      )
    case 'archived':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-500 text-[10px] font-bold">
          {locale === 'he' ? 'בארכיון' : 'Archived'}
        </span>
      )
  }
}

export default function GroupScanLinksPanel() {
  const { locale } = useI18n()
  const { data, loading, addLink } = useContractorGroupScanLinks()
  const [newLink, setNewLink] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLink.trim()) return

    setSubmitting(true)
    setErrorMsg(null)
    const res = await addLink(newLink)
    if (res.success) {
      setNewLink('')
    } else {
      setErrorMsg(res.error || 'Error adding link')
    }
    setSubmitting(false)
  }

  return (
    <div className="bg-white/40 rounded-2xl p-4 border border-stone-100 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-[#fe5b25]/10 flex items-center justify-center">
          <LinkIcon className="w-3.5 h-3.5 text-[#e04d1c]" />
        </div>
        <span className="text-[12px] font-extrabold text-stone-800">
          {locale === 'he' ? 'קבוצות WhatsApp לסריקה' : 'WhatsApp Groups for Scanning'}
        </span>
      </div>

      <p className="text-[10px] text-stone-500 mb-3 leading-relaxed">
        {locale === 'he' 
          ? 'הוסף קישורי הזמנה לקבוצות WhatsApp שתרצה שנסרוק עבורך. שים לב: קבוצות פרטיות כרגע לא נתמכות.'
          : 'Add WhatsApp invite links for groups you want us to scan. Note: Private groups are currently not supported.'}
      </p>

      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder="https://chat.whatsapp.com/..."
            className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/20 focus:border-[#fe5b25]/50 transition-all"
            dir="ltr"
          />
          <button
            type="submit"
            disabled={submitting || !newLink.trim()}
            className="px-3 py-1.5 rounded-xl bg-[#fe5b25] text-white text-xs font-bold hover:bg-[#e04d1c] disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            {submitting ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {locale === 'he' ? 'הוסף' : 'Add'}
          </button>
        </div>
        {errorMsg && (
          <p className="text-[10px] text-red-500 mt-1.5 font-medium">{errorMsg}</p>
        )}
      </form>

      <div className="space-y-4 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
        {loading && data.own.length === 0 && data.admin.length === 0 ? (
          <div className="text-center py-4 text-[11px] text-stone-400">
            {locale === 'he' ? 'טוען...' : 'Loading...'}
          </div>
        ) : (
          <>
            {/* Own Groups */}
            {data.own.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
                  {locale === 'he' ? 'הקבוצות שהוספת' : 'Your Groups'}
                </h4>
                <div className="space-y-1.5">
                  {data.own.map((link) => (
                    <div key={link.id} className="flex items-center justify-between bg-white border border-stone-100 rounded-lg p-2">
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <span className="text-[11px] font-medium text-stone-700 truncate" dir="ltr">
                          {link.group_name || link.invite_link_normalized}
                        </span>
                        <span className="text-[9px] text-stone-400">
                          {new Date(link.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <StatusBadge status={link.status} locale={locale} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Groups (Masked) */}
            {data.admin.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
                  {locale === 'he' ? 'קבוצות מערכת' : 'System Groups'}
                </h4>
                <div className="space-y-1.5">
                  {data.admin.map((link) => (
                    <div key={link.id} className="flex items-center justify-between bg-stone-50 border border-stone-100 rounded-lg p-2 opacity-80">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-stone-200 flex items-center justify-center">
                          <Users className="w-3 h-3 text-stone-500" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-medium text-stone-600">
                            {link.group_name}
                          </span>
                          <span className="text-[9px] text-stone-400 flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" />
                            {link.member_count}+ {locale === 'he' ? 'חברים' : 'members'}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={link.status} locale={locale} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.own.length === 0 && data.admin.length === 0 && (
              <div className="text-center py-4 text-[11px] text-stone-400">
                {locale === 'he' ? 'לא הוספו קבוצות עדיין' : 'No groups added yet'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
