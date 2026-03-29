import { useEffect, useRef, useState, useCallback } from 'react'
import { Search, Shield, Send } from 'lucide-react'

/* ─── Track which step is currently visible ─── */
function useCurrentStep() {
  const [step, setStep] = useState<{ num: string; label: string; color: string } | null>(null)

  useEffect(() => {
    const check = () => {
      const steps = document.querySelectorAll('[data-step]')
      let current: Element | null = null
      const viewMid = window.innerHeight / 2

      steps.forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.top < viewMid && rect.bottom > 100) {
          current = el
        }
      })

      if (current) {
        const el = current as HTMLElement
        setStep({
          num: el.dataset.step || '',
          label: el.dataset.stepLabel || '',
          color: el.dataset.stepColor || '#fe5b25',
        })
      } else {
        setStep(null)
      }
    }

    window.addEventListener('scroll', check, { passive: true })
    check()
    return () => window.removeEventListener('scroll', check)
  }, [])

  return step
}

export type TabId = 'find-jobs' | 'share-jobs' | 'protect'

interface Tab {
  id: TabId
  label: string
  shortLabel: string
  labelHe: string
  icon: typeof Search
}

const tabs: Tab[] = [
  { id: 'find-jobs', label: 'Find Jobs', shortLabel: 'Find', labelHe: 'מצא עבודות', icon: Search },
  { id: 'share-jobs', label: 'Share Jobs', shortLabel: 'Share', labelHe: 'שתף עבודות', icon: Send },
  { id: 'protect', label: 'How We Protect You', shortLabel: 'Protect', labelHe: 'איך אנחנו מגנים', icon: Shield },
]

interface Props {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  lang?: string
}

export default function TabNavigation({ activeTab, onTabChange, lang = 'en' }: Props) {
  const cardsRef = useRef<HTMLDivElement>(null)
  const [isSticky, setIsSticky] = useState(false)
  const currentStep = useCurrentStep()

  useEffect(() => {
    const el = cardsRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => setIsSticky(!e.isIntersecting),
      { threshold: 0, rootMargin: '-80px 0px 0px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const handleClick = useCallback((id: TabId) => {
    onTabChange(id)
    // Scroll to tab content area
    const content = document.getElementById('tab-content')
    if (content) {
      const isMobile = window.innerWidth < 1024
      const y = content.getBoundingClientRect().top + window.scrollY - (isMobile ? 80 : 120)
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }, [onTabChange])

  const isRtl = lang === 'he'

  return (
    <>
      {/* ─── Inline cards (visible in flow) ─── */}
      <div ref={cardsRef} id="tab-cards" className="relative bg-cream section-padding">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-4 md:gap-6">
            {tabs.map((tab) => {
              const active = tab.id === activeTab
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => handleClick(tab.id)}
                  className={`
                    relative flex flex-col items-center gap-2 md:gap-3 rounded-2xl px-4 py-5 md:px-6 md:py-7
                    transition-all duration-300 cursor-pointer border
                    ${active
                      ? 'bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] border-[#fe5b25]/30 shadow-xl shadow-[#fe5b25]/20 scale-[1.02]'
                      : 'bg-white/80 border-stone-200/60 hover:border-[#fe5b25]/40 hover:shadow-md'
                    }
                  `}
                >
                  <div className={`
                    w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all
                    ${active ? 'bg-white/20' : 'bg-[#fe5b25]/8'}
                  `}>
                    <Icon className={`w-5 h-5 md:w-6 md:h-6 ${active ? 'text-white' : 'text-[#fe5b25]'}`} />
                  </div>
                  <span className={`
                    text-xs md:text-base font-bold tracking-tight transition-colors text-center leading-tight
                    ${active ? 'text-white' : 'text-zinc-700'}
                  `}>
                    {isRtl ? tab.labelHe : tab.label}
                  </span>
                  {active && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[#e04d1c]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── Sticky sidebar (desktop) ─── */}
      <div
        className={`
          fixed top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col gap-2
          transition-all duration-500
          ${isRtl ? 'right-4' : 'left-4'}
          ${isSticky ? 'opacity-100 translate-x-0' : 'opacity-0 pointer-events-none'}
          ${isRtl ? (isSticky ? '' : 'translate-x-4') : (isSticky ? '' : '-translate-x-4')}
        `}
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTab
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => handleClick(tab.id)}
              className={`
                flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 transition-all duration-300 cursor-pointer border
                ${active
                  ? 'bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] border-[#fe5b25]/30 shadow-lg shadow-[#fe5b25]/25'
                  : 'bg-white/90 backdrop-blur-sm border-stone-200/60 hover:border-[#fe5b25]/40 hover:bg-white'
                }
              `}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-[#fe5b25]'}`} />
              <span className={`text-[10px] font-bold tracking-tight leading-none ${active ? 'text-white' : 'text-zinc-600'}`}>
                {tab.shortLabel}
              </span>
            </button>
          )
        })}

        {/* Current step indicator */}
        {currentStep && (
          <div className="mt-1 flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-white/90 backdrop-blur-sm border border-stone-200/60 transition-all duration-300">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
              style={{ background: currentStep.color }}
            >
              {currentStep.num}
            </div>
            <span className="text-[8px] font-bold text-zinc-500 leading-tight text-center max-w-[56px]">
              {currentStep.label}
            </span>
          </div>
        )}
      </div>

      {/* ─── Sticky bottom bar (mobile) ─── */}
      <div
        className={`
          fixed bottom-0 inset-x-0 z-50 lg:hidden
          transition-all duration-400
          ${isSticky ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}
        `}
      >
        {/* Gradient fade above the bar */}
        <div className="h-6 bg-gradient-to-t from-white/95 to-transparent pointer-events-none" />

        <div className="bg-white/95 backdrop-blur-xl border-t border-stone-200/60 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-3 max-w-lg mx-auto px-2">
            {tabs.map((tab) => {
              const active = tab.id === activeTab
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => handleClick(tab.id)}
                  className={`
                    flex flex-col items-center gap-1 py-3 transition-all cursor-pointer relative
                    ${active ? 'text-[#fe5b25]' : 'text-stone-400'}
                  `}
                >
                  {/* Active glow dot */}
                  {active && (
                    <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-[#fe5b25]" />
                  )}
                  <div className={`
                    w-9 h-9 rounded-xl flex items-center justify-center transition-all
                    ${active
                      ? 'bg-[#fe5b25]/10 scale-110'
                      : 'bg-transparent'
                    }
                  `}>
                    <Icon className={`w-5 h-5 transition-all ${active ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
                  </div>
                  <span className={`text-[11px] font-bold tracking-tight ${active ? '' : 'font-medium'}`}>
                    {tab.shortLabel}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
