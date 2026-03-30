import { useState, useRef } from 'react'
import { CheckCircle2, ChevronRight } from 'lucide-react'

interface SwipeToCompleteProps {
  label: string
  sublabel?: string
  onComplete?: () => void
}

export default function SwipeToComplete({ label, sublabel, onComplete }: SwipeToCompleteProps) {
  const [dragX, setDragX] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const maxDrag = 250 // approx container width minus button width

  const progress = Math.min(dragX / maxDrag, 1)

  const handleStart = (clientX: number) => {
    if (completed) return
    setIsDragging(true)
    startX.current = clientX
  }

  const handleMove = (clientX: number) => {
    if (!isDragging || completed) return
    const diff = clientX - startX.current
    setDragX(Math.max(0, Math.min(diff, maxDrag)))
  }

  const handleEnd = () => {
    if (!isDragging || completed) return
    setIsDragging(false)
    if (progress >= 0.85) {
      setDragX(maxDrag)
      setCompleted(true)
      onComplete?.()
    } else {
      setDragX(0)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative rounded-2xl overflow-hidden ${completed ? 'bg-green-500' : 'bg-[var(--dark)]'}`}
      style={{ transition: completed ? 'background-color 0.3s' : undefined }}
    >
      {/* Background text */}
      <div className="flex items-center justify-center py-4 px-16">
        <div className="text-center">
          <p className={`text-[14px] font-semibold ${completed ? 'text-white' : 'text-white/50'}`}>
            {completed ? 'Completed! ✅' : label}
          </p>
          {sublabel && !completed && (
            <p className="text-[10px] text-white/25 mt-0.5">{sublabel}</p>
          )}
        </div>
      </div>

      {/* Animated chevrons hint */}
      {!completed && !isDragging && (
        <div className="absolute right-16 top-1/2 -translate-y-1/2 flex items-center gap-0">
          {[0,1,2].map(i => (
            <ChevronRight key={i} size={14} className="text-white/20" style={{
              animation: 'slideHint 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </div>
      )}

      {/* Draggable button */}
      {!completed && (
        <div
          className="absolute top-1 bottom-1 left-1 touch-none"
          style={{
            transform: `translateX(${dragX}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
          }}
          onTouchStart={(e) => handleStart(e.touches[0].clientX)}
          onTouchMove={(e) => handleMove(e.touches[0].clientX)}
          onTouchEnd={handleEnd}
          onMouseDown={(e) => handleStart(e.clientX)}
          onMouseMove={(e) => { if (isDragging) handleMove(e.clientX) }}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
        >
          <div className={`w-14 h-full rounded-xl flex items-center justify-center ${
            progress > 0.5 ? 'bg-green-500' : 'bg-[var(--brand)]'
          }`} style={{ transition: 'background-color 0.2s' }}>
            {progress > 0.5 ? (
              <CheckCircle2 size={20} className="text-white" />
            ) : (
              <ChevronRight size={20} className="text-white" />
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideHint {
          0%, 100% { opacity: 0.2; transform: translateX(0); }
          50% { opacity: 0.5; transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}
