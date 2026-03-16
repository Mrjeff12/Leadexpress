import type { ReactNode } from 'react'

type Props = {
  title?: string
  headerExtra?: ReactNode
  className?: string
  children: ReactNode
}

export default function GlassCard({ title, headerExtra, className, children }: Props) {
  return (
    <div className={['glass-panel', className ?? ''].join(' ')}>
      {(title || headerExtra) && (
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
          <h3 className="text-[15px] font-medium" style={{ color: 'hsl(40 8% 10%)' }}>
            {title}
          </h3>
          {headerExtra}
        </div>
      )}
      <div className={title ? 'pt-4' : ''}>{children}</div>
    </div>
  )
}
