import { useState, useEffect } from 'react'
import { MapPin, Filter, Zap } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'
import USMap from './USMap'

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
]
const HIGHLIGHT_STATES = ['FL', 'TX', 'CA']

const DEMO_LEADS = [
  { state: 'FL', city: 'Miami', zip: '33101', trade: 'Plumbing', tradeHe: 'אינסטלציה', est: '$300-500' },
  { state: 'TX', city: 'Houston', zip: '77001', trade: 'HVAC', tradeHe: 'מיזוג', est: '$400-800' },
  { state: 'CA', city: 'Los Angeles', zip: '90001', trade: 'Electrical', tradeHe: 'חשמל', est: '$200-400' },
  { state: 'FL', city: 'Orlando', zip: '32801', trade: 'Roofing', tradeHe: 'איטום', est: '$500-1,200' },
  { state: 'TX', city: 'Dallas', zip: '75201', trade: 'Plumbing', tradeHe: 'אינסטלציה', est: '$150-350' },
]

const FILTER_STEPS_EN = ['All States', 'Florida, Texas, California', 'Miami, FL — Zip 33101']
const FILTER_STEPS_HE = ['כל המדינות', 'פלורידה, טקסס, קליפורניה', 'מיאמי, FL — מיקוד 33101']

export default function MapSection() {
  const { lang } = useLang()
  const [step, setStep] = useState(0)
  const [visibleLeads, setVisibleLeads] = useState(0)

  // Auto-cycle through filter steps
  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => (prev + 1) % 3)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Animate leads appearing when on step 2
  useEffect(() => {
    if (step === 2) {
      setVisibleLeads(0)
      const timeouts = DEMO_LEADS.filter(l => l.state === 'FL').map((_, i) =>
        setTimeout(() => setVisibleLeads(i + 1), (i + 1) * 400)
      )
      return () => timeouts.forEach(clearTimeout)
    } else {
      setVisibleLeads(0)
    }
  }, [step])

  const stateStyles: Record<string, { fill: string; opacity?: number }> = {}

  if (step === 0) {
    ALL_STATES.forEach(s => { stateStyles[s] = { fill: '#fe5b25', opacity: 0.4 } })
  } else if (step === 1) {
    ALL_STATES.forEach(s => { stateStyles[s] = { fill: '#fe5b25', opacity: 0.15 } })
    HIGHLIGHT_STATES.forEach(s => { stateStyles[s] = { fill: '#fe5b25', opacity: 0.8 } })
  } else {
    ALL_STATES.forEach(s => { stateStyles[s] = { fill: '#fe5b25', opacity: 0.1 } })
    stateStyles['FL'] = { fill: '#fe5b25', opacity: 1 }
  }

  const filterSteps = lang === 'he' ? FILTER_STEPS_HE : FILTER_STEPS_EN
  const matchedLeads = step === 2 ? DEMO_LEADS.filter(l => l.state === 'FL') : []

  return (
    <section className="section-padding bg-cream overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-medium mb-4">
            {lang === 'he' ? 'לידים בכל ארה״ב. בדיוק איפה שאתה עובד.' : 'Leads across all 50 states. Right where you work.'}
          </h2>
          <p className="text-gray-subtle/70 max-w-2xl mx-auto">
            {lang === 'he'
              ? 'אנחנו פעילים בכל 50 המדינות. בחר מדינה, עיר או מיקוד — וקבל רק לידים מהאזור שלך.'
              : 'We cover all 50 states. Choose a state, city, or zip code — and get only leads from your area.'}
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-center">
          {/* Map — 3 columns */}
          <div className="lg:col-span-3 relative">
            {/* Filter progress bar */}
            <div className="flex items-center gap-2 mb-6 justify-center">
              {filterSteps.map((label, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-500 ${
                    step === i
                      ? 'bg-[#fe5b25] text-white shadow-lg shadow-[#fe5b25]/25 scale-105'
                      : 'bg-dark/5 text-dark/50 hover:bg-dark/10'
                  }`}
                >
                  {i === 0 && <MapPin size={12} />}
                  {i === 1 && <Filter size={12} />}
                  {i === 2 && <Zap size={12} />}
                  {label}
                </button>
              ))}
            </div>

            {/* The Map */}
            <div className="relative">
              <USMap
                defaultFill="#f1f5f9"
                defaultStroke="#e2e8f0"
                stateStyles={stateStyles}
                className="w-full transition-all duration-700"
              />

              {/* Animated pins on Florida when step 2 */}
              {step === 2 && (
                <>
                  {/* Miami pin */}
                  <div className="absolute map-pin-drop" style={{ top: '78%', left: '78%' }}>
                    <div className="relative">
                      <div className="w-3 h-3 bg-[#fe5b25] rounded-full animate-pulse" />
                      <div className="absolute -top-1 -left-1 w-5 h-5 bg-[#fe5b25]/30 rounded-full animate-ping" />
                    </div>
                  </div>
                  {/* Orlando pin */}
                  <div className="absolute map-pin-drop" style={{ top: '73%', left: '76%', animationDelay: '0.3s' }}>
                    <div className="w-2.5 h-2.5 bg-[#fe5b25] rounded-full" />
                  </div>
                  {/* Tampa pin */}
                  <div className="absolute map-pin-drop" style={{ top: '75%', left: '74%', animationDelay: '0.6s' }}>
                    <div className="w-2.5 h-2.5 bg-[#fe5b25] rounded-full" />
                  </div>
                </>
              )}

              {/* Glow effect on active region */}
              {step === 2 && (
                <div className="absolute top-[65%] left-[72%] w-32 h-32 bg-[#fe5b25]/20 rounded-full blur-3xl animate-pulse" />
              )}
            </div>
          </div>

          {/* Lead feed — 2 columns */}
          <div className="lg:col-span-2">
            <div className="bg-cream rounded-2xl p-6 border border-dark/5 min-h-[320px]">
              {/* Feed header */}
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-dark/5">
                <div className="w-8 h-8 rounded-lg bg-[#fe5b25]/10 flex items-center justify-center">
                  <Zap size={16} className="text-[#fe5b25]" />
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {lang === 'he' ? 'לידים בזמן אמת' : 'Live Lead Feed'}
                  </div>
                  <div className="text-[10px] text-gray-subtle/50">
                    {step === 0 && (lang === 'he' ? 'בחר אזור כדי לסנן...' : 'Select a region to filter...')}
                    {step === 1 && (lang === 'he' ? 'מצמצם ל-3 מדינות...' : 'Narrowing to 3 states...')}
                    {step === 2 && (lang === 'he' ? '2 לידים מתאימים במיאמי!' : '2 matching leads in Miami!')}
                  </div>
                </div>
              </div>

              {/* Lead cards */}
              {step < 2 ? (
                <div className="space-y-3">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-dark/5">
                      <div className={`w-2 h-2 rounded-full ${step === 0 ? 'bg-dark/20' : 'bg-[#fe5b25]/40'} transition-colors duration-500`} />
                      <div className="flex-1">
                        <div className="h-3 bg-dark/10 rounded w-3/4 mb-1.5" />
                        <div className="h-2 bg-dark/5 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                  <div className="text-center text-xs text-gray-subtle/40 pt-2">
                    {lang === 'he' ? 'ממתין לסינון...' : 'Waiting for filter...'}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchedLeads.map((lead, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl bg-white border border-dark/5 shadow-sm transition-all duration-500 ${
                        i < visibleLeads ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#fe5b25]" />
                          <span className="text-xs font-semibold">{lang === 'he' ? lead.tradeHe : lead.trade}</span>
                        </div>
                        <span className="text-[10px] text-primary font-semibold">{lead.est}</span>
                      </div>
                      <div className="text-[11px] text-gray-subtle/60 ms-4">
                        📍 {lead.city}, {lead.state} {lead.zip}
                      </div>
                    </div>
                  ))}
                  {visibleLeads >= matchedLeads.length && (
                    <div className="text-center pt-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#fe5b25]">
                        <Zap size={12} />
                        {lang === 'he' ? 'תגיב ראשון, תסגור את העבודה!' : 'Respond first, close the deal!'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
