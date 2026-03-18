import { useState, useEffect } from 'react'

const GROUPS = [
  { name: 'Plumbers Florida', unread: 47, lastMsg: 'Anyone available for a job in Miami?' },
  { name: 'HVAC Techs Miami', unread: 23, lastMsg: 'Need AC repair ASAP, unit not cooling' },
  { name: 'Electricians Tampa', unread: 61, lastMsg: 'Panel upgrade needed in Orlando area' },
  { name: 'Handyman Orlando', unread: 38, lastMsg: 'Looking for someone to fix a leak' },
  { name: 'Contractors South FL', unread: 52, lastMsg: 'Kitchen remodel, who does tile?' },
]

export default function PipelineSection() {
  const [activeGroup, setActiveGroup] = useState(0)
  const [leadCount, setLeadCount] = useState(247)
  const [groupsScanned, setGroupsScanned] = useState(20)
  const [messagesRead, setMessagesRead] = useState(1847)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveGroup(prev => (prev + 1) % GROUPS.length)
      setLeadCount(prev => prev + 1)
      setMessagesRead(prev => prev + Math.floor(Math.random() * 12) + 5)
    }, 2400)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="py-20 md:py-28 bg-cream-dark overflow-hidden">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14 md:mb-20">
          <p className="text-[#fe5b25] text-xs font-semibold tracking-widest uppercase mb-4">
            How It Works
          </p>
          <h2 className="text-3xl md:text-[44px] md:leading-[1.15] font-medium text-dark mb-4">
            From group noise to qualified leads.
          </h2>
          <p className="text-dark/40 max-w-md mx-auto text-[15px]">
            We scan every message, extract real jobs, and send you only the ones worth your time.
          </p>
        </div>

        {/* 3-step flow */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 items-start">

          {/* STEP 1 — WhatsApp groups (looks like actual WhatsApp) */}
          <div className="relative">
            <div className="text-center mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#fe5b25] text-white text-xs font-bold">1</span>
              <p className="text-[11px] font-semibold text-dark/40 mt-1.5 uppercase tracking-wider">Your Groups</p>
            </div>

            {/* WhatsApp-style chat list */}
            <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
              {/* WhatsApp header bar */}
              <div className="bg-[#008069] px-3 py-2">
                <p className="text-white/90 text-[11px] font-semibold">WhatsApp</p>
              </div>

              {/* Chat rows */}
              <div className="divide-y divide-black/[0.04]">
                {GROUPS.map((group, i) => {
                  const isActive = activeGroup === i
                  return (
                    <div
                      key={group.name}
                      className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors duration-500 ${
                        isActive ? 'bg-[#fe5b25]/[0.06]' : ''
                      }`}
                    >
                      {/* Group avatar */}
                      <div className="w-8 h-8 rounded-full bg-[#D9FDD3] flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4">
                          <path d="M16.5 13c-.75 0-1.5.13-2.19.38l-1.44-1.44A6.95 6.95 0 0014 8c0-3.87-3.13-7-7-7S0 4.13 0 8s3.13 7 7 7c1.48 0 2.85-.46 3.97-1.24l1.44 1.44A5.48 5.48 0 0016.5 24c3.04 0 5.5-2.46 5.5-5.5S19.54 13 16.5 13z"/>
                        </svg>
                      </div>

                      {/* Name + last message */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-dark/80 truncate">{group.name}</span>
                        </div>
                        <p className="text-[9px] text-dark/35 truncate">{group.lastMsg}</p>
                      </div>

                      {/* Unread badge */}
                      <div className={`flex-shrink-0 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-500 ${
                        isActive
                          ? 'bg-[#25D366] text-white scale-110'
                          : 'bg-[#25D366]/70 text-white'
                      }`}>
                        {group.unread}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* More groups indicator */}
              <div className="text-center py-1.5 border-t border-black/[0.04]">
                <p className="text-[9px] text-dark/25">+15 more groups</p>
              </div>
            </div>
          </div>

          {/* STEP 2 — AI Filter */}
          <div className="relative flex flex-col items-center">
            <div className="text-center mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#fe5b25] text-white text-xs font-bold">2</span>
              <p className="text-[11px] font-semibold text-dark/40 mt-1.5 uppercase tracking-wider">AI Filters</p>
            </div>

            {/* Flow arrows — visible on mobile between steps */}
            <div className="hidden md:flex absolute left-[-18px] top-1/2 -translate-y-1/2 items-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="#fe5b25"><polygon points="0,2 0,12 10,7"/></svg>
            </div>
            <div className="hidden md:flex absolute right-[-18px] top-1/2 -translate-y-1/2 items-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="#fe5b25"><polygon points="0,2 0,12 10,7"/></svg>
            </div>

            {/* Mobile arrows */}
            <div className="md:hidden flex justify-center my-0 -mt-1 mb-2">
              <svg width="14" height="10" viewBox="0 0 14 10" fill="#fe5b25"><polygon points="2,0 12,0 7,10"/></svg>
            </div>

            {/* Filter card */}
            <div className="w-full bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden">
              {/* Animated scan bar */}
              <div className="h-[3px] bg-[#fe5b25]/10 relative overflow-hidden">
                <div className="absolute inset-y-0 w-1/3 bg-[#fe5b25]/40 rounded-full animate-[shimmer_2s_ease-in-out_infinite]"
                  style={{ animation: 'shimmer 2s ease-in-out infinite' }}
                />
              </div>

              <div className="p-4 space-y-3">
                {/* Filter icon + title */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#fe5b25]/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#fe5b25]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-dark">AI Filter</p>
                    <p className="text-[9px] text-dark/30">Scanning in real-time</p>
                  </div>
                </div>

                {/* Filter criteria */}
                <div className="space-y-1.5">
                  {[
                    { label: 'Trade', value: 'Plumbing', icon: '🔧' },
                    { label: 'Location', value: 'Miami, FL', icon: '📍' },
                    { label: 'Radius', value: '25 miles', icon: '📏' },
                  ].map(f => (
                    <div key={f.label} className="flex items-center justify-between bg-cream/60 rounded-lg px-2.5 py-1.5">
                      <span className="text-[10px] text-dark/40">{f.icon} {f.label}</span>
                      <span className="text-[10px] font-semibold text-dark/70">{f.value}</span>
                    </div>
                  ))}
                </div>

                {/* Scan counter */}
                <div className="text-center pt-1 border-t border-black/[0.04]">
                  <p className="text-[18px] font-bold text-[#fe5b25] tabular-nums">{messagesRead.toLocaleString()}</p>
                  <p className="text-[9px] text-dark/25 -mt-0.5">messages scanned</p>
                </div>
              </div>
            </div>

            {/* Mobile arrow down to step 3 */}
            <div className="md:hidden flex justify-center mt-2">
              <svg width="14" height="10" viewBox="0 0 14 10" fill="#fe5b25"><polygon points="2,0 12,0 7,10"/></svg>
            </div>
          </div>

          {/* STEP 3 — Results (numbers only) */}
          <div className="relative">
            <div className="text-center mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#fe5b25] text-white text-xs font-bold">3</span>
              <p className="text-[11px] font-semibold text-dark/40 mt-1.5 uppercase tracking-wider">Your Leads</p>
            </div>

            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_16px_rgba(0,0,0,0.04)] p-6 text-center">
              {/* Big number */}
              <div className="text-5xl md:text-6xl font-bold text-dark tracking-tight tabular-nums mb-1">
                {leadCount}
              </div>
              <p className="text-dark/30 text-sm mb-6">leads this month</p>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-cream/60 rounded-xl p-3">
                  <p className="text-lg font-bold text-dark tabular-nums">{groupsScanned}</p>
                  <p className="text-[9px] text-dark/30 mt-0.5">groups scanned</p>
                </div>
                <div className="bg-cream/60 rounded-xl p-3">
                  <p className="text-lg font-bold text-[#fe5b25] tabular-nums">97%</p>
                  <p className="text-[9px] text-dark/30 mt-0.5">match accuracy</p>
                </div>
                <div className="bg-cream/60 rounded-xl p-3">
                  <p className="text-lg font-bold text-dark tabular-nums">24/7</p>
                  <p className="text-[9px] text-dark/30 mt-0.5">monitoring</p>
                </div>
                <div className="bg-cream/60 rounded-xl p-3">
                  <p className="text-lg font-bold text-dark tabular-nums">&lt;30s</p>
                  <p className="text-[9px] text-dark/30 mt-0.5">delivery time</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </section>
  )
}
