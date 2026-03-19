import { MapPin, Phone, Check, Pencil, Loader2 } from 'lucide-react'
import { PROFESSIONS } from '../lib/professions'

export interface ParsedLead {
  profession: string
  state: string
  city: string
  zip_code: string | null
  description: string
  urgency: string
  client_phone: string | null
  formatted_posting: string
  confidence: number
  missing_fields: string[]
}

interface JobCardPreviewProps {
  data: ParsedLead
  onPublish: () => void
  onEdit: () => void
  isPublishing?: boolean
}

const urgencyStyles: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

export default function JobCardPreview({ data, onPublish, onEdit, isPublishing }: JobCardPreviewProps) {
  const prof = PROFESSIONS.find((p) => p.id === data.profession)
  const hasMissing = data.missing_fields?.length > 0

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 max-w-md shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{prof?.emoji || '\u{1F527}'}</span>
          <span className="font-semibold text-stone-800 text-[15px]">
            {prof?.en || data.profession}
          </span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${urgencyStyles[data.urgency] || urgencyStyles.medium}`}>
          {data.urgency}
        </span>
      </div>

      {/* Location */}
      <div className="flex items-center gap-1.5 text-sm text-stone-500 mb-2">
        <MapPin className="w-3.5 h-3.5" />
        <span>{data.city}, {data.state} {data.zip_code || ''}</span>
      </div>

      {/* Description */}
      <p className="text-sm text-stone-600 mb-3 leading-relaxed">
        {data.formatted_posting}
      </p>

      {/* Client phone */}
      {data.client_phone && (
        <div className="flex items-center gap-1.5 text-sm text-stone-400 mb-3">
          <Phone className="w-3.5 h-3.5" />
          <span>{data.client_phone}</span>
        </div>
      )}

      {/* Warnings */}
      {data.confidence < 0.7 && !hasMissing && (
        <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
          Low confidence — please verify details before publishing
        </div>
      )}
      {hasMissing && (
        <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
          Missing: {data.missing_fields.join(', ')}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={onPublish}
          disabled={isPublishing || hasMissing}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5
                     bg-[#fe5b25] hover:bg-[#e04d1c] disabled:bg-stone-100
                     disabled:text-stone-400 rounded-xl text-sm font-semibold
                     transition-all text-white shadow-sm"
        >
          {isPublishing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {isPublishing ? 'Publishing...' : 'Publish'}
        </button>
        <button
          onClick={onEdit}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5
                     bg-stone-100 hover:bg-stone-200 rounded-xl text-sm
                     font-medium transition-all text-stone-600"
        >
          <Pencil className="w-4 h-4" />
          Edit
        </button>
      </div>
    </div>
  )
}
