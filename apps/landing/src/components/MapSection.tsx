import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, BarChart3, DollarSign } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'
import USMap from './USMap'

/* ─── Heatmap tiers ─── */
const BRIGHT_STATES = ['FL', 'TX', 'CA']
const MEDIUM_STATES = ['NY', 'IL', 'GA']
const LIGHT_STATES  = ['OH', 'NC', 'AZ', 'PA']

const ACCENT = '#fe5b25'

function buildStateStyles(): Record<string, { fill: string; opacity?: number; stroke?: string }> {
  const styles: Record<string, { fill: string; opacity?: number; stroke?: string }> = {}
  BRIGHT_STATES.forEach(s => { styles[s] = { fill: ACCENT, opacity: 0.6, stroke: ACCENT } })
  MEDIUM_STATES.forEach(s => { styles[s] = { fill: ACCENT, opacity: 0.35, stroke: ACCENT } })
  LIGHT_STATES.forEach(s =>  { styles[s] = { fill: ACCENT, opacity: 0.2, stroke: ACCENT } })
  return styles
}

const STATE_STYLES = buildStateStyles()

/* ─── Dot centroids (% of map container) ─── */
interface DotConfig {
  state: string
  x: number
  y: number
  size: number
}

const DOTS: DotConfig[] = [
  { state: 'FL', x: 81, y: 82, size: 12 },
  { state: 'TX', x: 42, y: 78, size: 12 },
  { state: 'CA', x: 8,  y: 48, size: 10 },
  { state: 'NY', x: 82, y: 28, size: 10 },
  { state: 'IL', x: 60, y: 38, size: 7 },
  { state: 'GA', x: 74, y: 65, size: 7 },
  { state: 'OH', x: 70, y: 35, size: 7 },
  { state: 'NC', x: 78, y: 55, size: 7 },
  { state: 'AZ', x: 18, y: 62, size: 7 },
  { state: 'PA', x: 78, y: 32, size: 7 },
]

/* ─── Inline keyframes (injected once) ─── */
const STYLE_ID = 'map-section-anims'

function ensureStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes pulse-dot {
      0%, 100% { transform: scale(1); opacity: 0.7; }
      50% { transform: scale(1.4); opacity: 1; }
    }
    @keyframes spawn-dot {
      0% { transform: scale(0); opacity: 0.9; }
      60% { transform: scale(1.2); opacity: 0.8; }
      100% { transform: scale(0.8); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

/* ─── KPI Counter ─── */
function useCountUp(target: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration, active])

  return value
}

/* ─── Spawned dot type ─── */
interface SpawnedDot {
  id: number
  x: number
  y: number
}

export default function MapSection() {
  const { lang } = useLang()
  const isHe = lang === 'he'
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [spawnedDots, setSpawnedDots] = useState<SpawnedDot[]>([])
  const spawnIdRef = useRef(0)

  // Inject CSS keyframes
  useEffect(() => { ensureStyles() }, [])

  // IntersectionObserver
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Spawn random dots every 2.5s
  const spawnDot = useCallback(() => {
    const base = DOTS[Math.floor(Math.random() * DOTS.length)]
    const offsetX = (Math.random() - 0.5) * 6
    const offsetY = (Math.random() - 0.5) * 6
    const id = ++spawnIdRef.current
    const dot: SpawnedDot = {
      id,
      x: base.x + offsetX,
      y: base.y + offsetY,
    }
    setSpawnedDots(prev => [...prev, dot])
    // Remove after 2s
    setTimeout(() => {
      setSpawnedDots(prev => prev.filter(d => d.id !== id))
    }, 2000)
  }, [])

  useEffect(() => {
    if (!isVisible) return
    const interval = setInterval(spawnDot, 2500)
    // Spawn one immediately
    spawnDot()
    return () => clearInterval(interval)
  }, [isVisible, spawnDot])

  // KPI count-ups
  const leadsCount = useCountUp(12847, 1500, isVisible)
  const statesCount = useCountUp(50, 1500, isVisible)
  const valueCount = useCountUp(342, 1500, isVisible)

  return (
    <section ref={sectionRef} className="section-padding bg-cream overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-medium mb-4">
            {isHe
              ? 'תראה לידים נכנסים — מכל 50 המדינות'
              : 'See leads flow in — across all 50 states'}
          </h2>
          <p className="text-gray-subtle/70 max-w-2xl mx-auto text-lg">
            {isHe
              ? 'הבינה המלאכותית שלנו סורקת אלפי קבוצות וואטסאפ 24/7'
              : 'Our AI monitors thousands of WhatsApp groups 24/7'}
          </p>
        </div>

        {/* Map with dot overlay */}
        <div className="relative mx-auto max-w-4xl">
          <div style={{ filter: 'drop-shadow(0 0 20px rgba(254,91,37,0.15))' }}>
            <USMap
              defaultFill="#f1f5f9"
              defaultStroke="#e2e8f0"
              stateStyles={STATE_STYLES}
              className="w-full"
            />
          </div>

          {/* Persistent pulsing dots */}
          {isVisible && DOTS.map((dot, i) => (
            <span
              key={dot.state}
              style={{
                position: 'absolute',
                left: `${dot.x}%`,
                top: `${dot.y}%`,
                width: dot.size,
                height: dot.size,
                borderRadius: '50%',
                backgroundColor: ACCENT,
                transform: 'translate(-50%, -50%)',
                animation: `pulse-dot 2.4s ease-in-out ${i * 0.3}s infinite`,
                pointerEvents: 'none',
                boxShadow: `0 0 ${dot.size}px ${ACCENT}60`,
              }}
            />
          ))}

          {/* Spawned temporary dots */}
          {spawnedDots.map(dot => (
            <span
              key={dot.id}
              style={{
                position: 'absolute',
                left: `${dot.x}%`,
                top: `${dot.y}%`,
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: ACCENT,
                transform: 'translate(-50%, -50%)',
                animation: 'spawn-dot 2s ease-out forwards',
                pointerEvents: 'none',
                boxShadow: `0 0 12px ${ACCENT}80`,
              }}
            />
          ))}
        </div>

        {/* Stats bar */}
        <div className="mt-10 rounded-2xl bg-[#0b0707] text-white p-6 md:p-8 flex flex-wrap items-center justify-around gap-6 md:gap-10">
          {/* Leads extracted */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#fe5b25]">
              <BarChart3 size={20} />
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold tabular-nums">
                {leadsCount.toLocaleString()}
              </div>
              <div className="text-xs text-white/50 font-medium">
                {isHe ? 'לידים חולצו' : 'leads extracted'}
              </div>
            </div>
          </div>

          {/* States covered */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#fe5b25]">
              <MapPin size={20} />
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold tabular-nums">
                {statesCount}
              </div>
              <div className="text-xs text-white/50 font-medium">
                {isHe ? 'מדינות' : 'states covered'}
              </div>
            </div>
          </div>

          {/* Estimated value */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#fe5b25]">
              <DollarSign size={20} />
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold tabular-nums">
                ${(valueCount / 10).toFixed(1)}M
              </div>
              <div className="text-xs text-white/50 font-medium">
                {isHe ? 'ערך משוער' : 'estimated value'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
