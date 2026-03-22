import { useState } from 'react'
import { Plus, Trash2, Clock, CheckCircle, XCircle, Link as LinkIcon } from 'lucide-react'
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
