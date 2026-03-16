import { useState } from 'react'
import { Plus, X, MapPin } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

interface Props {
  zipCodes: string[]
  onAdd: (zip: string) => boolean
  onRemove: (zip: string) => void
}

export default function ZipManager({ zipCodes, onAdd, onRemove }: Props) {
  const { locale } = useI18n()
  const [input, setInput] = useState('')

  function handleAdd() {
    if (onAdd(input)) setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-700">
        {locale === 'he' ? 'אזורי שירות (מיקוד)' : 'Service Areas (ZIP)'}
      </h3>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={locale === 'he' ? 'הזן מיקוד...' : 'Enter ZIP code...'}
          maxLength={10}
          className="flex-1 rounded-xl border border-zinc-200 bg-white/80 py-2 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim()}
          className="btn-primary rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {zipCodes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {zipCodes.map((zip) => (
            <span
              key={zip}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700"
            >
              <MapPin className="h-3 w-3" />
              {zip}
              <button
                type="button"
                onClick={() => onRemove(zip)}
                className="rounded-full p-0.5 hover:bg-emerald-200 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-400 italic">
          {locale === 'he' ? 'לא נוספו אזורים עדיין' : 'No ZIP codes added yet.'}
        </p>
      )}
    </div>
  )
}
