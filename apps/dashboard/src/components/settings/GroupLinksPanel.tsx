import { useState } from 'react'
import { Plus, Trash2, Clock, CheckCircle, XCircle, Link as LinkIcon, UserPlus, Copy, Check } from 'lucide-react'
import type { GroupLink } from '../../hooks/useContractorGroupLinks'

interface GroupLinksPanelProps {
  links: GroupLink[]
  onAdd: (link: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  compact?: boolean
  he?: boolean
}

const STATUS_ICONS: Record<GroupLink['status'], { icon: typeof Clock; color: string }> = {
  pending: { icon: Clock, color: 'text-amber-500' },
  joined: { icon: CheckCircle, color: 'text-green-500' },
  failed: { icon: XCircle, color: 'text-red-500' },
  left: { icon: XCircle, color: 'text-zinc-400' },
}

const SCANNER_PHONE = '+1 (754) 276-3406'
const SCANNER_PHONE_RAW = '17542763406'

function InviteScannerCard({ he }: { he?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  function copyNumber() {
    navigator.clipboard.writeText(SCANNER_PHONE_RAW)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-100/50 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <UserPlus className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-700">
            {he ? 'אין לי לינק? הזמן אותנו לקבוצה' : "No invite link? Add us to the group"}
          </p>
          <p className="text-xs text-zinc-400">
            {he ? 'בקש מהמנהל להוסיף את המספר שלנו' : 'Ask the admin to add our number'}
          </p>
        </div>
        <span className="text-zinc-300 text-lg">{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-100">
          {/* Scanner phone number */}
          <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-white border border-zinc-200">
            <div className="flex-1">
              <p className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
                {he ? 'המספר שלנו' : 'Our WhatsApp number'}
              </p>
              <p className="text-lg font-bold text-zinc-900 tracking-wide" dir="ltr">{SCANNER_PHONE}</p>
            </div>
            <button
              type="button"
              onClick={copyNumber}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ background: copied ? '#22c55e' : 'linear-gradient(135deg, #fe5b25, #e04d1c)', color: 'white' }}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? (he ? 'הועתק!' : 'Copied!') : (he ? 'העתק' : 'Copy')}
            </button>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-600">
              {he ? 'איך להוסיף אותנו:' : 'How to add us:'}
            </p>
            <div className="space-y-1.5">
              {(he ? [
                '1️⃣ העתק את המספר למעלה',
                '2️⃣ פתח את הקבוצה ב-WhatsApp',
                '3️⃣ הגדרות קבוצה → הוסף משתתפים',
                '4️⃣ הדבק את המספר והוסף',
                '💡 אם רק האדמין יכול להוסיף — שלח לו את המספר עם ההודעה:',
              ] : [
                '1️⃣ Copy the number above',
                '2️⃣ Open the group in WhatsApp',
                '3️⃣ Group settings → Add participants',
                '4️⃣ Paste the number and add',
                '💡 If only admin can add — send them the number with this message:',
              ]).map((step, i) => (
                <p key={i} className="text-xs text-zinc-500">{step}</p>
              ))}
            </div>

            {/* Pre-written message for admin */}
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <p className="text-xs text-emerald-800 leading-relaxed">
                {he
                  ? `"היי! אני משתמש ב-Lead Express — AI שמוצא לידים בקבוצות WhatsApp. אפשר להוסיף את המספר ${SCANNER_PHONE} לקבוצה? הבוט שקט לגמרי, רק קורא הודעות ומחבר קבלנים ללידים 🤝"`
                  : `"Hey! I use Lead Express — an AI that finds leads in WhatsApp groups. Can you add ${SCANNER_PHONE} to the group? The bot is completely silent, it just reads messages and matches contractors with leads 🤝"`
                }
              </p>
              <button
                type="button"
                onClick={() => {
                  const msg = he
                    ? `היי! תוכל להוסיף את המספר ${SCANNER_PHONE} לקבוצה? 🙏`
                    : `Hey! Can you add ${SCANNER_PHONE} to the group? 🙏`
                  navigator.clipboard.writeText(msg)
                }}
                className="mt-2 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                {he ? '📋 העתק הודעה' : '📋 Copy message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GroupLinksPanel({ links, onAdd, onRemove, compact, he }: GroupLinksPanelProps) {
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = input.startsWith('https://chat.whatsapp.com/')

  async function handleAdd() {
    if (!isValid) {
      setError(he ? 'הלינק חייב להתחיל ב-https://chat.whatsapp.com/' : 'Link must start with https://chat.whatsapp.com/')
      return
    }
    setError(null)
    setAdding(true)
    try {
      await onAdd(input.trim())
      setInput('')
    } catch (err: any) {
      setError(err.message || (he ? 'הוספה נכשלה' : 'Failed to add'))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="url"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(null) }}
            onKeyDown={(e) => e.key === 'Enter' && isValid && handleAdd()}
            placeholder={he ? 'https://chat.whatsapp.com/...' : 'https://chat.whatsapp.com/...'}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm outline-none focus:border-[#fe5b25] transition-colors"
            dir="ltr"
          />
        </div>
        <button
          type="button"
          disabled={!isValid || adding}
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
          style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
        >
          <Plus className="w-4 h-4" />
          {he ? 'הוסף' : 'Add'}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* Hint */}
      <p className="text-xs text-zinc-400 text-center">
        {he
          ? 'הדבק לינקים של קבוצות WhatsApp. נצטרף תוך 24 שעות ונתחיל לסרוק עבודות. +10 נקודות רשת לכל קבוצה!'
          : "Paste WhatsApp group invite links. We'll join within 24 hours and start scanning for jobs. +10 Network Points per group!"}
      </p>

      {/* Option B: No link? Invite our scanner */}
      <InviteScannerCard he={he} />

      {/* Links list */}
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link) => {
            const statusInfo = STATUS_ICONS[link.status]
            const StatusIcon = statusInfo.icon
            return (
              <div
                key={link.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-100 bg-zinc-50"
              >
                <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusInfo.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">
                    {link.group_name || link.invite_link}
                  </p>
                  {link.group_name && (
                    <p className="text-xs text-zinc-400 truncate">{link.invite_link}</p>
                  )}
                </div>
                <span className="text-[10px] font-medium text-zinc-400 uppercase flex-shrink-0">
                  {link.status}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(link.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
