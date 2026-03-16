import { useState, useEffect, useRef, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MapPin, Flame, Filter, ChevronDown } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

/* ───────────────────── Constants ───────────────────── */

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

type Urgency = 'hot' | 'warm' | 'cold'
type Profession = 'hvac' | 'renovation' | 'fencing' | 'cleaning'

interface MockLead {
  id: string
  lat: number
  lng: number
  profession: Profession
  urgency: Urgency
  city: string
  zip: string
  summary: string
  date: string
}

const URGENCY_COLORS: Record<Urgency, string> = {
  hot: '#ef4444',
  warm: '#f59e0b',
  cold: '#3b82f6',
}

const PROFESSION_COLORS: Record<Profession, string> = {
  hvac: 'hsl(205, 85%, 52%)',
  renovation: 'hsl(28, 90%, 56%)',
  fencing: 'hsl(262, 68%, 56%)',
  cleaning: 'hsl(160, 50%, 48%)',
}

const PROFESSION_LABELS: Record<Profession, { en: string; he: string }> = {
  hvac: { en: 'HVAC', he: 'מזגנים' },
  renovation: { en: 'Renovation', he: 'שיפוצים' },
  fencing: { en: 'Fencing', he: 'גדרות' },
  cleaning: { en: 'Cleaning', he: 'ניקיון' },
}

const URGENCY_LABELS: Record<Urgency, { en: string; he: string }> = {
  hot: { en: 'Hot', he: 'חם' },
  warm: { en: 'Warm', he: 'פושר' },
  cold: { en: 'Cold', he: 'קר' },
}

const mockLeads: MockLead[] = [
  { id: '1', lat: 32.0853, lng: 34.7818, profession: 'hvac', urgency: 'hot', city: 'Tel Aviv', zip: '62000', summary: 'AC installation needed urgently', date: '2026-03-16' },
  { id: '2', lat: 32.794, lng: 34.9896, profession: 'renovation', urgency: 'warm', city: 'Haifa', zip: '32000', summary: 'Kitchen renovation - this week', date: '2026-03-15' },
  { id: '3', lat: 31.2518, lng: 34.7913, profession: 'fencing', urgency: 'cold', city: 'Beer Sheva', zip: '84000', summary: 'Garden fence estimate', date: '2026-03-14' },
  { id: '4', lat: 32.1633, lng: 34.8458, profession: 'hvac', urgency: 'hot', city: 'Herzliya', zip: '46000', summary: 'Commercial AC repair', date: '2026-03-16' },
  { id: '5', lat: 32.3215, lng: 34.8532, profession: 'cleaning', urgency: 'warm', city: 'Netanya', zip: '48000', summary: 'Garage deep cleaning', date: '2026-03-15' },
  { id: '6', lat: 31.8928, lng: 34.8113, profession: 'renovation', urgency: 'hot', city: 'Rehovot', zip: '76000', summary: 'Bathroom renovation urgent', date: '2026-03-16' },
  { id: '7', lat: 31.8044, lng: 34.6553, profession: 'fencing', urgency: 'cold', city: 'Ashdod', zip: '71000', summary: 'Pool fence installation', date: '2026-03-13' },
  { id: '8', lat: 32.1842, lng: 34.8710, profession: 'hvac', urgency: 'warm', city: 'Ramat Gan', zip: '52000', summary: 'Split AC unit replacement', date: '2026-03-15' },
  { id: '9', lat: 32.0167, lng: 34.7500, profession: 'cleaning', urgency: 'hot', city: 'Bat Yam', zip: '59000', summary: 'Post-construction cleanup', date: '2026-03-16' },
  { id: '10', lat: 32.4340, lng: 34.9196, profession: 'renovation', urgency: 'warm', city: 'Hadera', zip: '38000', summary: 'Living room remodel', date: '2026-03-14' },
  { id: '11', lat: 32.0554, lng: 34.7554, profession: 'hvac', urgency: 'cold', city: 'Holon', zip: '58000', summary: 'Annual AC maintenance', date: '2026-03-12' },
  { id: '12', lat: 31.9522, lng: 34.8033, profession: 'fencing', urgency: 'hot', city: 'Rishon LeZion', zip: '75000', summary: 'Security fence urgent', date: '2026-03-16' },
]

const TODAY = '2026-03-16'

/* ───────────────────── Marker Helpers ───────────────────── */

function createLeadMarkerElement(lead: MockLead): HTMLDivElement {
  const el = document.createElement('div')
  const color = URGENCY_COLORS[lead.urgency]
  const isHot = lead.urgency === 'hot'

  el.style.cssText = `
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${color};
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    cursor: pointer;
    transition: transform 0.15s ease;
  `

  if (isHot) {
    el.style.animation = 'lead-pulse 2s ease-in-out infinite'
  }

  el.addEventListener('mouseenter', () => {
    el.style.transform = 'scale(1.4)'
  })
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'scale(1)'
  })

  return el
}

function buildPopupHtml(lead: MockLead, locale: string): string {
  const profLabel = locale === 'he' ? PROFESSION_LABELS[lead.profession].he : PROFESSION_LABELS[lead.profession].en
  const urgLabel = locale === 'he' ? URGENCY_LABELS[lead.urgency].he : URGENCY_LABELS[lead.urgency].en
  const urgColor = URGENCY_COLORS[lead.urgency]
  const profColor = PROFESSION_COLORS[lead.profession]

  return `
    <div style="font-family: 'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif; min-width: 200px;">
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${profColor};"></span>
        <span style="font-size: 12px; font-weight: 700; color: #1a1c20;">${profLabel}</span>
        <span style="margin-left: auto; font-size: 10px; font-weight: 600; color: ${urgColor}; background: ${urgColor}15; padding: 2px 8px; border-radius: 999px;">${urgLabel}</span>
      </div>
      <p style="font-size: 12px; color: #44474d; margin: 0 0 8px; line-height: 1.5;">${lead.summary}</p>
      <div style="display: flex; gap: 8px; font-size: 10px; color: #7c7f85;">
        <span>${lead.city}</span>
        <span>${lead.zip}</span>
        <span style="margin-left: auto;">${lead.date}</span>
      </div>
    </div>
  `
}

/* ───────────────────── Inject Pulse Keyframes ───────────────────── */

function injectPulseAnimation() {
  const id = 'lead-pulse-keyframes'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `
    @keyframes lead-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5), 0 2px 6px rgba(0,0,0,0.25); }
      50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0), 0 2px 6px rgba(0,0,0,0.25); }
    }
  `
  document.head.appendChild(style)
}

/* ───────────────────── Component ───────────────────── */

export default function LeadsMap() {
  const { locale } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])

  /* ── Filter State ── */
  const [activeUrgencies, setActiveUrgencies] = useState<Set<Urgency>>(
    new Set(['hot', 'warm', 'cold'])
  )
  const [professionFilter, setProfessionFilter] = useState<Profession | 'all'>('all')

  /* ── Derived ── */
  const filteredLeads = useMemo(() => {
    return mockLeads.filter((lead) => {
      if (!activeUrgencies.has(lead.urgency)) return false
      if (professionFilter !== 'all' && lead.profession !== professionFilter) return false
      return true
    })
  }, [activeUrgencies, professionFilter])

  const kpis = useMemo(() => {
    const total = filteredLeads.length
    const hot = filteredLeads.filter((l) => l.urgency === 'hot').length
    const today = filteredLeads.filter((l) => l.date === TODAY).length
    return { total, hot, today }
  }, [filteredLeads])

  /* ── Toggle urgency ── */
  function toggleUrgency(u: Urgency) {
    setActiveUrgencies((prev) => {
      const next = new Set(prev)
      if (next.has(u)) {
        // Don't allow deselecting all
        if (next.size > 1) next.delete(u)
      } else {
        next.add(u)
      }
      return next
    })
  }

  /* ── Init map ── */
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return

    injectPulseAnimation()
    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [34.82, 32.05],
      zoom: 9,
      attributionControl: false,
      interactive: true,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  /* ── Update markers when filters change ── */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    function renderMarkers() {
      // Clear existing markers
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      filteredLeads.forEach((lead) => {
        const el = createLeadMarkerElement(lead)
        const popup = new mapboxgl.Popup({ offset: 12, maxWidth: '260px' })
          .setHTML(buildPopupHtml(lead, locale))

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([lead.lng, lead.lat])
          .setPopup(popup)
          .addTo(map!)

        markersRef.current.push(marker)
      })
    }

    if (map.isStyleLoaded()) {
      renderMarkers()
    } else {
      map.once('load', renderMarkers)
    }
  }, [filteredLeads, locale])

  /* ── No-token fallback ── */
  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'hsl(40, 20%, 98%)' }}>
        <div className="floating-panel p-8 text-center" style={{ position: 'relative' }}>
          <div className="w-14 h-14 rounded-2xl bg-white/60 backdrop-blur flex items-center justify-center mx-auto mb-4 shadow-sm border border-white/80">
            <MapPin className="w-7 h-7 text-stone-400" />
          </div>
          <p className="text-sm text-stone-500 font-medium max-w-[280px]">
            {locale === 'he'
              ? 'המפה דורשת VITE_MAPBOX_TOKEN. הוסף אותו לקובץ .env שלך.'
              : 'Map requires VITE_MAPBOX_TOKEN. Add it to your .env file.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative" style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif", height: '100vh' }}>

      {/* ════════ FULL-SCREEN MAP ════════ */}
      <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* ════════ KPI STRIP (top-center) ════════ */}
      <div
        className="floating-panel px-5 py-3 animate-fade-in flex items-center gap-5"
        style={{ top: 20, left: '50%', transform: 'translateX(-50%)' }}
      >
        {/* Total */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-stone-100 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-stone-500" />
          </div>
          <div>
            <p className="text-lg font-extrabold text-stone-900 leading-none tracking-tight">{kpis.total}</p>
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">
              {locale === 'he' ? 'לידים' : 'Leads'}
            </p>
          </div>
        </div>

        <div className="w-px h-8 bg-stone-200/60" />

        {/* Hot */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: '#ef444418' }}>
            <Flame className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
          </div>
          <div>
            <p className="text-lg font-extrabold leading-none tracking-tight" style={{ color: '#ef4444' }}>{kpis.hot}</p>
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">
              {locale === 'he' ? 'חמים' : 'Hot'}
            </p>
          </div>
        </div>

        <div className="w-px h-8 bg-stone-200/60" />

        {/* Today */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center">
            <span className="text-xs font-bold text-emerald-600">T</span>
          </div>
          <div>
            <p className="text-lg font-extrabold text-emerald-700 leading-none tracking-tight">{kpis.today}</p>
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">
              {locale === 'he' ? 'היום' : 'Today'}
            </p>
          </div>
        </div>
      </div>

      {/* ════════ FILTER PANEL (top-left) ════════ */}
      <div
        className="floating-panel p-4 animate-fade-in"
        style={{ top: 20, left: 20, width: 240, animationDelay: '80ms' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em]">
            {locale === 'he' ? 'סינון' : 'Filters'}
          </span>
        </div>

        {/* Urgency toggles */}
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">
          {locale === 'he' ? 'דחיפות' : 'Urgency'}
        </p>
        <div className="flex gap-1.5 mb-3">
          {(['hot', 'warm', 'cold'] as Urgency[]).map((u) => {
            const active = activeUrgencies.has(u)
            const color = URGENCY_COLORS[u]
            const label = locale === 'he' ? URGENCY_LABELS[u].he : URGENCY_LABELS[u].en
            return (
              <button
                key={u}
                onClick={() => toggleUrgency(u)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
                style={{
                  background: active ? `${color}15` : 'transparent',
                  color: active ? color : '#a8a8a8',
                  border: `1.5px solid ${active ? `${color}40` : '#e5e5e5'}`,
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: active ? color : '#d4d4d4' }}
                />
                {label}
              </button>
            )
          })}
        </div>

        {/* Profession dropdown */}
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">
          {locale === 'he' ? 'מקצוע' : 'Profession'}
        </p>
        <div className="relative">
          <select
            value={professionFilter}
            onChange={(e) => setProfessionFilter(e.target.value as Profession | 'all')}
            className="w-full appearance-none rounded-xl bg-white/60 border border-stone-200 text-[12px] font-medium text-stone-700 py-2 pl-3 pr-8 cursor-pointer transition-all hover:border-stone-300 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="all">{locale === 'he' ? 'הכל' : 'All'}</option>
            {(['hvac', 'renovation', 'fencing', 'cleaning'] as Profession[]).map((p) => (
              <option key={p} value={p}>
                {locale === 'he' ? PROFESSION_LABELS[p].he : PROFESSION_LABELS[p].en}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
        </div>

        {/* Lead count */}
        <div className="mt-3 pt-3 border-t border-stone-200/60">
          <p className="text-[11px] text-stone-400 font-medium">
            {locale === 'he'
              ? `${filteredLeads.length} לידים מוצגים`
              : `${filteredLeads.length} leads shown`}
          </p>
        </div>
      </div>
    </div>
  )
}
