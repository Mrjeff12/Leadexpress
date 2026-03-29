import { useEffect, useState } from 'react'
import { Search, Send, Shield, ArrowRight } from 'lucide-react'

const solutions = [
  { id: 'solution-find', label: 'Find Jobs', icon: Search, color: '#25D366' },
  { id: 'solution-share', label: 'Share Jobs', icon: Send, color: '#fe5b25' },
  { id: 'solution-protect', label: 'Protection', icon: Shield, color: '#3b82f6' },
]

function useActiveSolution() {
  const [active, setActive] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const check = () => {
      const viewMid = window.innerHeight * 0.45
      let found: string | null = null

      for (const s of solutions) {
        const el = document.getElementById(s.id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top < viewMid && rect.bottom > 100) {
          found = s.id
        }
      }

      setActive(found)

      // Visible when any solution section is on screen
      const first = document.getElementById(solutions[0].id)
      const last = document.getElementById(solutions[solutions.length - 1].id)
      if (first && last) {
        const firstRect = first.getBoundingClientRect()
        const lastRect = last.getBoundingClientRect()
        setVisible(firstRect.top < window.innerHeight && lastRect.bottom > 0)
      }
    }

    window.addEventListener('scroll', check, { passive: true })
    check()
    return () => window.removeEventListener('scroll', check)
  }, [])

  return { active, visible }
}

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) {
    const y = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top: y, behavior: 'smooth' })
  }
}

export default function SolutionProgress() {
  const { active, visible } = useActiveSolution()

  // Mobile: show CTA after scrolling past hero
  const [showMobileCTA, setShowMobileCTA] = useState(false)
  useEffect(() => {
    const check = () => setShowMobileCTA(window.scrollY > 600)
    window.addEventListener('scroll', check, { passive: true })
    check()
    return () => window.removeEventListener('scroll', check)
  }, [])

  const activeIdx = solutions.findIndex(s => s.id === active)

  return (
    <>
      {/* ─── Desktop sidebar ─── */}
      <div
        className={`
          fixed left-8 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col
          transition-all duration-500
          ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8 pointer-events-none'}
        `}
      >
        {/* Track line */}
        <div className="relative ml-[11px]">
          {/* Background track */}
          <div className="absolute left-0 top-0 w-[2px] h-full bg-stone-200/60 rounded-full" />

          {/* Active fill */}
          <div
            className="absolute left-0 top-0 w-[2px] rounded-full transition-all duration-500 ease-out"
            style={{
              height: activeIdx >= 0 ? `${((activeIdx + 0.5) / solutions.length) * 100}%` : '0%',
              background: active ? solutions[activeIdx]?.color || '#ccc' : '#ccc',
            }}
          />

          {/* Nodes */}
          <div className="flex flex-col gap-14 relative">
            {solutions.map((s, i) => {
              const isActive = s.id === active
              const isPast = activeIdx > i
              const Icon = s.icon

              return (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className="flex items-center gap-4 group cursor-pointer -ml-[11px]"
                >
                  {/* Dot */}
                  <div
                    className={`
                      w-6 h-6 rounded-full border-[3px] flex items-center justify-center
                      transition-all duration-400 flex-shrink-0
                      ${isActive
                        ? 'scale-110'
                        : isPast
                          ? 'border-stone-300 bg-stone-300'
                          : 'border-stone-200 bg-white'
                      }
                    `}
                    style={isActive ? {
                      borderColor: s.color,
                      background: s.color,
                      boxShadow: `0 0 12px ${s.color}50`,
                    } : isPast ? {
                      borderColor: s.color,
                      background: s.color,
                    } : {}}
                  >
                    {(isActive || isPast) && (
                      <Icon className="w-3 h-3 text-white" strokeWidth={2.5} />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`
                      text-[11px] font-extrabold tracking-[0.08em] uppercase whitespace-nowrap
                      transition-all duration-400
                      ${isActive
                        ? ''
                        : isPast
                          ? 'text-stone-400'
                          : 'text-stone-300 group-hover:text-stone-400'
                      }
                    `}
                    style={isActive ? { color: s.color } : {}}
                  >
                    {isPast && !isActive ? '✓ ' : ''}{s.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── Mobile bottom bar: progress + CTA ─── */}
      <div
        className={`
          fixed bottom-0 inset-x-0 z-50 xl:hidden
          transition-all duration-400
          ${showMobileCTA ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}
        `}
      >
        <div className="h-4 bg-gradient-to-t from-white/95 to-transparent pointer-events-none" />
        <div className="bg-white/95 backdrop-blur-xl border-t border-stone-200/60 px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
          {/* Mini solution progress — only visible when in solutions area */}
          {active && (
            <div className="flex items-center gap-1 mb-2.5">
              {solutions.map((s, i) => {
                const isActive = s.id === active
                const isPast = activeIdx > i
                const Icon = s.icon
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={`
                      flex items-center gap-1.5 flex-1 rounded-xl px-2.5 py-2 transition-all duration-300 cursor-pointer relative overflow-hidden
                      ${isActive
                        ? 'shadow-sm'
                        : ''
                      }
                    `}
                    style={isActive ? {
                      background: `${s.color}12`,
                      border: `1.5px solid ${s.color}30`,
                    } : {
                      border: '1.5px solid transparent',
                    }}
                  >
                    {/* Active pulse ring */}
                    {isActive && (
                      <span
                        className="absolute inset-0 rounded-xl animate-[solution-ping_2s_ease-in-out_infinite]"
                        style={{ border: `2px solid ${s.color}`, opacity: 0 }}
                      />
                    )}
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                        isActive || isPast ? '' : 'bg-stone-100'
                      }`}
                      style={(isActive || isPast) ? { background: s.color } : {}}
                    >
                      <Icon className={`w-3 h-3 ${isActive || isPast ? 'text-white' : 'text-stone-300'}`} strokeWidth={2.5} />
                    </div>
                    <span
                      className={`text-[10px] font-bold tracking-tight whitespace-nowrap transition-colors ${
                        isActive ? 'text-zinc-900' : isPast ? 'text-stone-400' : 'text-stone-300'
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Pulse animation */}
          <style>{`
            @keyframes solution-ping {
              0% { opacity: 0.5; transform: scale(1); }
              50% { opacity: 0; transform: scale(1.04); }
              100% { opacity: 0; transform: scale(1.04); }
            }
          `}</style>

          {/* CTA button */}
          <a
            href="https://app.masterleadflow.com/login"
            className="flex items-center justify-center gap-2 w-full rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white px-6 py-3.5 text-sm font-bold transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-[#fe5b25]/25 active:scale-95"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </>
  )
}
