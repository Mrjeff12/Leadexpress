import { Download, X } from 'lucide-react'

export interface BulkAction {
  key: string
  label: string
  icon: React.ElementType
  variant?: 'default' | 'danger'
  onClick: () => void
}

interface BulkActionBarProps {
  selectedCount: number
  onClearSelection: () => void
  onExport?: () => void
  exportLabel?: string
  actions?: BulkAction[]
}

/**
 * Sticky bottom bar that appears when items are selected in an admin list.
 * Slides up via CSS transition. Shows selected count + action buttons.
 */
export default function BulkActionBar({
  selectedCount,
  onClearSelection,
  onExport,
  exportLabel = 'Export CSV',
  actions = [],
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-4 px-6 py-3.5 animate-in slide-in-from-bottom duration-300"
      style={{
        background: 'rgba(28, 28, 30, 0.97)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.2)',
      }}
    >
      {/* Left: count + clear */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-white">
          {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={onClearSelection}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
          >
            <Download className="w-3.5 h-3.5" />
            {exportLabel}
          </button>
        )}
        {actions.map((action) => {
          const Icon = action.icon
          const isDanger = action.variant === 'danger'
          return (
            <button
              key={action.key}
              onClick={action.onClick}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: isDanger ? 'rgba(220, 38, 38, 0.85)' : 'rgba(255,255,255,0.12)',
                color: 'white',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {action.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
