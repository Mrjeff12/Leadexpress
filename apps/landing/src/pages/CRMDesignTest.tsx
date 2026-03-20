import { useState, useEffect, useRef } from 'react'
import {
  MessageCircle, Users, DollarSign, TrendingUp, Zap,
  Send, Search, Phone, Video, MoreVertical, Smile, Paperclip, Mic,
  UserCheck, ArrowRight, QrCode, Scan, Smartphone, Monitor,
  Sparkles, Target, Brain, ChevronRight, Star, Shield, Pin, CheckCheck
} from 'lucide-react'

/* ─── Shared mock data ─── */
const MEMBERS = [
  { name: 'Mike Rodriguez', id: 33, status: 'interested', heat: 85, msg: 'Sounds interesting, how do I sign up?', time: '10:44', online: true },
  { name: 'Carlos Martinez', id: 15, status: 'trial', heat: 60, msg: 'Thanks bro, I signed up! 🔥', time: '10:30', online: true },
  { name: 'James Thompson', id: 60, status: 'subscribed', heat: 95, msg: 'Getting leads every day now 💪', time: '9:15', online: false },
  { name: 'David Kim', id: 51, status: 'interested', heat: 70, msg: 'What areas does it cover?', time: 'Yesterday', online: false },
  { name: 'Robert Johnson', id: 11, status: null, heat: 20, msg: "I'll check it out this weekend", time: 'Yesterday', online: false },
  { name: 'Alex Rivera', id: 22, status: 'subscribed', heat: 90, msg: 'Been using it for a week, love it', time: 'Tuesday', online: false },
  { name: 'Tony Martinez', id: 47, status: 'trial', heat: 55, msg: '👍', time: 'Monday', online: false },
  { name: 'Josh Williams', id: 54, status: null, heat: 15, msg: 'Is it free?', time: 'Monday', online: true },
  { name: 'Sam Davis', id: 36, status: 'subscribed', heat: 92, msg: 'Sent you a lead', time: 'Mar 15', online: false },
]

const statusLabel = (s: string | null) =>
  s === 'subscribed' ? '✓ Subscribed' : s === 'trial' ? '⏳ Trial' : s === 'interested' ? '🔥 Interested' : 'Not signed up'
const statusColor = (s: string | null) =>
  s === 'subscribed' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
  s === 'trial' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' :
  s === 'interested' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
  'text-white/30 bg-white/5 border-white/10'

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ═══════════════════════════════════════════════════════════
   APPROACH A: "WhatsApp Web+" (Evolutionary)
   ═══════════════════════════════════════════════════════════ */
function ApproachA() {
  const { ref, visible } = useInView()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!visible) return
    const t1 = setTimeout(() => setStep(1), 800)
    const t2 = setTimeout(() => setStep(2), 2000)
    const t3 = setTimeout(() => setStep(3), 3200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [visible])

  return (
    <section ref={ref as any} className="py-20 bg-cream overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-500 text-xs font-bold mb-4">APPROACH A</span>
          <p className="text-[#25D366] text-[11px] font-semibold tracking-widest uppercase mb-3">WhatsApp Web+ (Evolutionary)</p>
          <h2 className="text-3xl md:text-5xl font-medium text-dark mb-4">
            Connect. See. <span className="bg-[#25D366] text-white px-3 py-1 rounded-lg">Convert.</span>
          </h2>
        </div>

        {/* 3-step connection flow */}
        <div className={`flex items-center justify-center gap-6 mb-10 transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
          {[
            { icon: <QrCode className="w-6 h-6" />, label: 'Scan QR Code', active: step >= 1 },
            { icon: <Users className="w-6 h-6" />, label: 'Members Loaded', active: step >= 2 },
            { icon: <Send className="w-6 h-6" />, label: 'Start Messaging', active: step >= 3 },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-500 ${
                s.active ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 scale-105' : 'bg-gray-100 text-gray-400'
              }`}>
                {s.icon}
                <span className="text-sm font-semibold">{s.label}</span>
              </div>
              {i < 2 && <ChevronRight className={`w-5 h-5 transition-colors duration-500 ${s.active ? 'text-[#25D366]' : 'text-gray-300'}`} />}
            </div>
          ))}
        </div>

        {/* Enhanced WhatsApp mockup with animated messages */}
        <div className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_8px_60px_rgba(0,0,0,0.08)] overflow-hidden">
            {/* KPI bar */}
            <div className="px-6 pt-5 pb-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-[#25D366]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-dark">NJ Contractors Network</h3>
                  <p className="text-xs text-dark/40">Connected via QR scan</p>
                </div>
              </div>
              <div className="flex gap-2">
                {[
                  { icon: <UserCheck className="w-3.5 h-3.5" />, text: '48 members', color: 'emerald' },
                  { icon: <TrendingUp className="w-3.5 h-3.5" />, text: '72% response', color: 'blue' },
                  { icon: <DollarSign className="w-3.5 h-3.5" />, text: '12 referrals', color: 'amber' },
                ].map((pill, i) => (
                  <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-${pill.color}-50 border border-${pill.color}-100`}>
                    <span className={`text-${pill.color}-600`}>{pill.icon}</span>
                    <span className={`text-[11px] font-bold text-${pill.color}-600`}>{pill.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* WhatsApp layout */}
            <div className="flex border-t border-gray-200" style={{ height: 420 }}>
              {/* Contacts */}
              <div className="w-[280px] border-r border-gray-200 flex flex-col bg-white shrink-0">
                <div className="px-3 py-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                    <div className="w-full pl-10 pr-3 py-2 rounded-lg bg-gray-50 text-xs text-gray-400">Search members...</div>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  {MEMBERS.slice(0, 7).map((m, i) => (
                    <div key={i} className={`flex items-center gap-2.5 px-3 py-2 transition-all duration-500 ${
                      i === 0 ? 'bg-gray-50' : ''
                    } ${step >= 2 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                      style={{ transitionDelay: `${1800 + i * 100}ms` }}>
                      <div className="relative shrink-0">
                        <img src={`https://i.pravatar.cc/80?img=${m.id}`} alt="" className="w-9 h-9 rounded-full object-cover" />
                        {m.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#25D366] border-2 border-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <span className="text-[11px] font-semibold text-dark truncate">{m.name}</span>
                          <span className="text-[9px] text-dark/30">{m.time}</span>
                        </div>
                        <span className="text-[10px] text-dark/40 truncate block">{m.msg}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat */}
              <div className="flex-1 flex flex-col bg-[#efeae2]">
                <div className="px-4 py-2.5 bg-white border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src="https://i.pravatar.cc/80?img=33" alt="" className="w-9 h-9 rounded-full" />
                    <div>
                      <p className="text-[12px] font-semibold text-dark">Mike Rodriguez</p>
                      <p className="text-[10px] text-[#25D366]">online</p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-gray-400">
                    <Phone className="w-4 h-4" /><Video className="w-4 h-4" /><MoreVertical className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex-1 px-5 py-3 space-y-2 overflow-hidden">
                  {/* AI banner */}
                  <div className={`flex justify-center mb-2 transition-all duration-500 ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
                    style={{ transitionDelay: '3000ms' }}>
                    <div className="px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur shadow-sm flex items-center gap-2">
                      <Zap className="w-3 h-3 text-[#fe5b25]" />
                      <span className="text-[10px] font-medium text-dark/60">Mike hasn't signed up — nudge with 7-day trial</span>
                      <button className="px-2 py-0.5 rounded-md bg-[#fe5b25] text-white text-[9px] font-bold">Send</button>
                    </div>
                  </div>
                  <div className="flex gap-2 max-w-[65%]">
                    <div className="rounded-xl rounded-tl-sm px-3 py-1.5 text-[11px] bg-white shadow-sm">
                      Hey, what's Lead Express? <span className="text-[9px] text-gray-400 ml-1">10:41</span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[65%] rounded-xl rounded-tr-sm px-3 py-1.5 text-[11px] shadow-sm" style={{ background: '#dcf8c6' }}>
                      It scans WhatsApp groups and sends you leads. Free 7-day trial!
                      <span className="text-[9px] text-gray-400 ml-1">10:42</span>
                    </div>
                  </div>
                  <div className="flex gap-2 max-w-[65%]">
                    <div className="rounded-xl rounded-tl-sm px-3 py-1.5 text-[11px] bg-white shadow-sm">
                      How do I sign up? <span className="text-[9px] text-gray-400 ml-1">10:43</span>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2.5 bg-white border-t border-gray-100 flex items-center gap-3">
                  <Smile className="w-4 h-4 text-gray-400" />
                  <div className="flex-1 px-3 py-2 rounded-lg bg-gray-50 text-[11px] text-gray-400">Type a message...</div>
                  <div className="w-8 h-8 rounded-full bg-[#fe5b25] flex items-center justify-center">
                    <Send className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════
   APPROACH B: "The Split Screen Transform" (Apple Keynote)
   ═══════════════════════════════════════════════════════════ */
function ApproachB() {
  const { ref, visible } = useInView(0.1)
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (!visible) return
    const t1 = setTimeout(() => setPhase(1), 600)
    const t2 = setTimeout(() => setPhase(2), 1800)
    const t3 = setTimeout(() => setPhase(3), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [visible])

  return (
    <section ref={ref as any} className="py-24 bg-[#0a0a0a] overflow-hidden relative">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#25D366]/5 rounded-full blur-[150px]" />

      <div className="max-w-7xl mx-auto px-6 relative">
        <div className="text-center mb-4">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold mb-4">APPROACH B</span>
        </div>

        {/* Hero text */}
        <div className={`text-center mb-16 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-[#25D366] text-[11px] font-semibold tracking-[0.3em] uppercase mb-4">One Scan Changes Everything</p>
          <h2 className="text-4xl md:text-6xl font-medium text-white mb-5 tracking-[-0.04em]">
            From Chaos to{' '}
            <span className="bg-gradient-to-r from-[#25D366] to-[#128C7E] bg-clip-text text-transparent">Command Center</span>
          </h2>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            Scan your QR. See every member. Reach them personally. All from one screen.
          </p>
        </div>

        {/* The Split Screen */}
        <div className="relative flex items-stretch gap-0 rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(37,211,102,0.08)]" style={{ height: 520 }}>

          {/* LEFT: Chaos (Phone) */}
          <div className={`relative flex items-center justify-center transition-all duration-1000 ease-in-out ${
            phase >= 3 ? 'w-0 opacity-0' : phase >= 2 ? 'w-[30%]' : 'w-1/2'
          } bg-gradient-to-br from-[#111] to-[#1a1a1a] overflow-hidden`}>
            <div className={`transition-all duration-700 ${phase >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
              {/* Phone mockup */}
              <div className="w-[220px] bg-[#0C1317] rounded-[28px] border border-white/10 shadow-2xl overflow-hidden"
                style={{ transform: phase >= 2 ? 'scale(0.85) rotate(-3deg)' : 'scale(1) rotate(0deg)', transition: 'transform 1s ease' }}>
                {/* Phone header */}
                <div className="bg-[#1F2C33] px-3 py-2 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-[#25D366]" />
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-white">NJ Contractors</p>
                    <p className="text-[7px] text-white/30">48 members</p>
                  </div>
                  <div className="ml-auto flex gap-2 text-white/30">
                    <Phone className="w-3 h-3" />
                    <MoreVertical className="w-3 h-3" />
                  </div>
                </div>
                {/* Chaotic messages */}
                <div className="p-2 space-y-1 bg-[#0B141A]" style={{ minHeight: 280 }}>
                  {[
                    { name: '~ Dan', msg: 'Anyone free for Miami?', color: '#e17076' },
                    { name: '~ Mike', msg: 'Me!!', color: '#7eb5e0' },
                    { name: '~ Joe', msg: "I'm free too", color: '#d4a76a' },
                    { name: '~ Dan', msg: 'Plumbing, 33101', color: '#e17076' },
                    { name: '~ Alex', msg: 'I can do tomorrow', color: '#96c472' },
                    { name: '~ Ron', msg: "What's the budget?", color: '#c9a9e6' },
                    { name: '~ Sam', msg: 'Already taken?', color: '#6ec6d6' },
                    { name: '~ Tom', msg: 'Need help in Queens', color: '#e0a86e' },
                  ].map((m, i) => (
                    <div key={i} className="bg-[#1F2C33] rounded-lg px-2 py-1 max-w-[85%]">
                      <p className="text-[7px] font-bold" style={{ color: m.color }}>{m.name}</p>
                      <p className="text-[8px] text-white/70">{m.msg}</p>
                    </div>
                  ))}
                  {/* Unread badge */}
                  <div className="flex justify-center pt-1">
                    <span className="px-2 py-0.5 rounded-full bg-[#25D366]/20 text-[#25D366] text-[7px] font-bold">
                      47 UNREAD MESSAGES
                    </span>
                  </div>
                </div>
                {/* Label */}
                <div className="bg-[#1F2C33] px-3 py-2 text-center">
                  <p className="text-[8px] text-white/20 uppercase tracking-wider">Your group today</p>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: QR Code Bridge */}
          <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-1000 ${
            phase >= 3 ? 'opacity-0 scale-50' : phase >= 2 ? 'opacity-100 scale-100' : phase >= 1 ? 'opacity-100 scale-110' : 'opacity-0 scale-75'
          }`}>
            <div className="relative">
              {/* Scanning beam animation */}
              <div className={`absolute inset-0 rounded-2xl overflow-hidden ${phase === 1 ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}>
                <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-[#25D366] to-transparent animate-pulse"
                  style={{ top: '30%', boxShadow: '0 0 20px #25D366, 0 0 40px #25D366' }} />
              </div>
              <div className="w-32 h-32 rounded-2xl bg-white p-3 shadow-[0_0_60px_rgba(37,211,102,0.3)]">
                <div className="w-full h-full rounded-lg border-2 border-[#25D366] flex items-center justify-center relative overflow-hidden">
                  <QrCode className="w-14 h-14 text-dark" />
                  {/* Scan line */}
                  {phase === 1 && (
                    <div className="absolute inset-x-0 h-0.5 bg-[#25D366] shadow-[0_0_8px_#25D366]"
                      style={{ animation: 'scanLine 1.5s ease-in-out infinite', top: '20%' }} />
                  )}
                </div>
              </div>
              <p className={`text-center mt-3 text-[10px] font-bold tracking-wider uppercase transition-all duration-500 ${
                phase >= 2 ? 'text-[#25D366]' : 'text-white/50'
              }`}>
                {phase >= 2 ? '✓ Connected' : 'Scan to Connect'}
              </p>
            </div>
          </div>

          {/* RIGHT: Command Center (Dashboard) */}
          <div className={`relative flex flex-col transition-all duration-1000 ease-in-out ${
            phase >= 3 ? 'w-full' : phase >= 2 ? 'w-[70%]' : 'w-1/2'
          } bg-gradient-to-br from-[#0d1117] to-[#161b22] overflow-hidden`}>

            {/* Dashboard header */}
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-[#25D366]" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white">Member Intelligence</p>
                  <p className="text-[9px] text-white/30">NJ Contractors Network • 48 members</p>
                </div>
              </div>
              <div className="flex gap-2">
                {[
                  { val: '12', label: 'Converted', color: '#25D366' },
                  { val: '8', label: 'In Trial', color: '#3b82f6' },
                  { val: '28', label: 'To Reach', color: '#f59e0b' },
                ].map((kpi, i) => (
                  <div key={i} className="text-center px-3 py-1 rounded-lg" style={{ background: kpi.color + '10' }}>
                    <p className="text-sm font-bold" style={{ color: kpi.color }}>{kpi.val}</p>
                    <p className="text-[8px] text-white/30">{kpi.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Suggestion Bar */}
            <div className={`mx-4 mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-[#fe5b25]/10 to-[#fe5b25]/5 border border-[#fe5b25]/20 flex items-center gap-3 transition-all duration-700 ${
              phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`} style={{ transitionDelay: '600ms' }}>
              <Brain className="w-4 h-4 text-[#fe5b25] shrink-0" />
              <span className="text-[10px] text-white/60 flex-1">
                <strong className="text-[#fe5b25]">AI Insight:</strong> 5 members showed interest this week — send personalized trial invites to boost conversion by ~40%
              </span>
              <button className="px-3 py-1 rounded-lg bg-[#fe5b25] text-white text-[9px] font-bold shrink-0">
                Send All
              </button>
            </div>

            {/* Member cards grid */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="grid grid-cols-3 gap-2.5">
                {MEMBERS.map((m, i) => (
                  <div key={i} className={`group relative rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] p-3 transition-all duration-500 cursor-pointer hover:border-[#25D366]/30 ${
                    phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`} style={{ transitionDelay: `${2000 + i * 120}ms` }}>
                    {/* Heat indicator */}
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{
                      background: m.heat > 80 ? '#25D366' : m.heat > 50 ? '#f59e0b' : '#6b7280',
                      boxShadow: m.heat > 80 ? '0 0 8px #25D366' : 'none'
                    }} />

                    <div className="flex items-center gap-2 mb-2">
                      <img src={`https://i.pravatar.cc/80?img=${m.id}`} alt="" className="w-8 h-8 rounded-full" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-white truncate">{m.name}</p>
                        <span className={`inline-block text-[7px] font-bold uppercase px-1.5 py-0.5 rounded border ${statusColor(m.status)}`}>
                          {statusLabel(m.status)}
                        </span>
                      </div>
                    </div>

                    {/* Quick message */}
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex-1 px-2 py-1 rounded-md bg-white/5 text-[8px] text-white/30">
                        Quick message...
                      </div>
                      <div className="w-5 h-5 rounded-md bg-[#25D366] flex items-center justify-center shrink-0">
                        <Send className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom bar */}
            <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  {[11, 33, 51, 15].map(id => (
                    <img key={id} src={`https://i.pravatar.cc/40?img=${id}`} alt="" className="w-5 h-5 rounded-full border border-[#0d1117]" />
                  ))}
                </div>
                <span className="text-[9px] text-white/30">48 members • $4,485 potential/mo</span>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                <Scan className="w-3.5 h-3.5" />
                Connect My WhatsApp
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 15%; }
          50% { top: 80%; }
        }
      `}</style>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════
   APPROACH C: "The Connection Web" (Spatial Computing)
   ═══════════════════════════════════════════════════════════ */
function ApproachC() {
  const { ref, visible } = useInView(0.1)
  const [active, setActive] = useState<number | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setConnected(true), 1200)
    return () => clearTimeout(t)
  }, [visible])

  // Position members in a circle
  const radius = 200
  const centerX = 400
  const centerY = 260

  return (
    <section ref={ref as any} className="py-24 bg-[#050505] overflow-hidden relative">
      <div className="max-w-6xl mx-auto px-6 relative">
        <div className="text-center mb-4">
          <span className="inline-block px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold mb-4">APPROACH C</span>
        </div>

        <div className={`text-center mb-16 transition-all duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-purple-400 text-[11px] font-semibold tracking-[0.3em] uppercase mb-4">Spatial Intelligence</p>
          <h2 className="text-4xl md:text-6xl font-medium text-white mb-5 tracking-[-0.04em]">
            See Your Community as a{' '}
            <span className="bg-gradient-to-r from-purple-400 to-[#25D366] bg-clip-text text-transparent">Living Network</span>
          </h2>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            Every node is a person. Every connection is an opportunity.
          </p>
        </div>

        {/* The Spatial Canvas */}
        <div className="relative mx-auto" style={{ width: 800, height: 520 }}>
          {/* SVG connection lines */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 520">
            {MEMBERS.map((m, i) => {
              const angle = (i / MEMBERS.length) * Math.PI * 2 - Math.PI / 2
              const x = centerX + radius * Math.cos(angle)
              const y = centerY + radius * Math.sin(angle)
              return (
                <line key={i}
                  x1={centerX} y1={centerY} x2={x} y2={y}
                  className={`transition-all duration-1000 ${connected ? 'opacity-100' : 'opacity-0'}`}
                  style={{ transitionDelay: `${1200 + i * 150}ms` }}
                  stroke={m.status === 'subscribed' ? '#25D366' : m.status === 'trial' ? '#3b82f6' : m.status === 'interested' ? '#f59e0b' : '#333'}
                  strokeWidth={active === i ? 2 : 0.5}
                  strokeDasharray={m.status ? 'none' : '4 4'}
                />
              )
            })}
            {/* Pulse rings */}
            {connected && (
              <>
                <circle cx={centerX} cy={centerY} r="60" fill="none" stroke="#25D366" strokeWidth="0.3" opacity="0.3">
                  <animate attributeName="r" values="60;120;60" dur="4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0;0.3" dur="4s" repeatCount="indefinite" />
                </circle>
                <circle cx={centerX} cy={centerY} r="100" fill="none" stroke="#25D366" strokeWidth="0.2" opacity="0.2">
                  <animate attributeName="r" values="100;180;100" dur="5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.2;0;0.2" dur="5s" repeatCount="indefinite" />
                </circle>
              </>
            )}
          </svg>

          {/* Center QR / Hub */}
          <div className={`absolute z-10 transition-all duration-1000 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
            style={{ left: centerX - 48, top: centerY - 48 }}>
            <div className={`w-24 h-24 rounded-2xl flex items-center justify-center transition-all duration-700 ${
              connected
                ? 'bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-[0_0_60px_rgba(37,211,102,0.4)]'
                : 'bg-white shadow-[0_0_40px_rgba(255,255,255,0.1)]'
            }`}>
              {connected ? (
                <div className="text-center">
                  <Users className="w-7 h-7 text-white mx-auto mb-1" />
                  <p className="text-[8px] font-bold text-white/80">CONNECTED</p>
                </div>
              ) : (
                <QrCode className="w-10 h-10 text-dark" />
              )}
            </div>
          </div>

          {/* Member nodes */}
          {MEMBERS.map((m, i) => {
            const angle = (i / MEMBERS.length) * Math.PI * 2 - Math.PI / 2
            const x = centerX + radius * Math.cos(angle)
            const y = centerY + radius * Math.sin(angle)
            const isActive = active === i

            return (
              <div key={i}
                className={`absolute z-10 transition-all duration-700 cursor-pointer ${
                  connected ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                }`}
                style={{
                  left: x - 28,
                  top: y - 28,
                  transitionDelay: `${1400 + i * 150}ms`,
                }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                {/* Node */}
                <div className={`relative w-14 h-14 rounded-full transition-all duration-300 ${
                  isActive ? 'scale-125 z-20' : 'scale-100'
                }`}>
                  {/* Glow ring */}
                  <div className="absolute -inset-1 rounded-full transition-all duration-300" style={{
                    background: m.status === 'subscribed' ? 'rgba(37,211,102,0.3)' :
                      m.status === 'trial' ? 'rgba(59,130,246,0.3)' :
                      m.status === 'interested' ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.05)',
                    boxShadow: isActive ? `0 0 20px ${
                      m.status === 'subscribed' ? '#25D366' : m.status === 'trial' ? '#3b82f6' : m.status === 'interested' ? '#f59e0b' : '#333'
                    }` : 'none',
                  }} />
                  <img
                    src={`https://i.pravatar.cc/112?img=${m.id}`}
                    alt=""
                    className="absolute inset-0 w-full h-full rounded-full object-cover border-2"
                    style={{
                      borderColor: m.status === 'subscribed' ? '#25D366' : m.status === 'trial' ? '#3b82f6' : m.status === 'interested' ? '#f59e0b' : '#333'
                    }}
                  />
                  {m.online && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25D366] border-2 border-[#050505]" />
                  )}
                </div>

                {/* Hover card */}
                {isActive && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 rounded-xl bg-[#1a1a2e] border border-white/10 p-3 shadow-2xl z-30"
                    style={{ animation: 'fadeInUp 0.2s ease-out' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <img src={`https://i.pravatar.cc/80?img=${m.id}`} alt="" className="w-8 h-8 rounded-full" />
                      <div>
                        <p className="text-[10px] font-bold text-white">{m.name}</p>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${statusColor(m.status)}`}>
                          {statusLabel(m.status)}
                        </span>
                      </div>
                    </div>
                    {/* Heat bar */}
                    <div className="mb-2">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[8px] text-white/30">Engagement</span>
                        <span className="text-[8px] font-bold text-white/50">{m.heat}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${m.heat}%`,
                            background: m.heat > 80 ? '#25D366' : m.heat > 50 ? '#f59e0b' : '#6b7280'
                          }} />
                      </div>
                    </div>
                    <p className="text-[9px] text-white/40 mb-2 italic">"{m.msg}"</p>
                    <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold text-white transition-all hover:scale-105"
                      style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                      <Send className="w-3 h-3" /> Send Personal Message
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Legend */}
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-5 transition-all duration-700 ${
            connected ? 'opacity-100' : 'opacity-0'
          }`} style={{ transitionDelay: '3000ms' }}>
            {[
              { color: '#25D366', label: 'Subscribed' },
              { color: '#3b82f6', label: 'Trial' },
              { color: '#f59e0b', label: 'Interested' },
              { color: '#333', label: 'Not yet reached' },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                <span className="text-[9px] text-white/30">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className={`text-center mt-10 transition-all duration-700 ${connected ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          style={{ transitionDelay: '3500ms' }}>
          <button className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold text-white transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(37,211,102,0.3)]"
            style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
            <Scan className="w-5 h-5" />
            Connect My WhatsApp
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════
   APPROACH D: "Hybrid" — A's WhatsApp Web design + B's animation
   Real WA QR, fast anim, premium KPIs, status tags, profile panel
   ═══════════════════════════════════════════════════════════ */

const D_MEMBERS = [
  { name: 'Mike Rodriguez', id: 33, status: 'interested', profession: 'Plumber', location: 'Newark, NJ', msg: 'Sounds interesting, how do I sign up?', time: '10:44', online: true, joined: 'Jan 2024', jobs: 34, unread: 3 },
  { name: 'Carlos Martinez', id: 15, status: 'trial', profession: 'Electrician', location: 'Jersey City, NJ', msg: 'Thanks bro, I signed up! 🔥', time: '10:30', online: true, joined: 'Feb 2024', jobs: 12, unread: 1 },
  { name: 'James Thompson', id: 60, status: 'subscribed', profession: 'General Contractor', location: 'Hoboken, NJ', msg: 'Getting leads every day now 💪', time: '9:15', online: false, joined: 'Nov 2023', jobs: 87, unread: 0 },
  { name: 'David Kim', id: 51, status: 'interested', profession: 'HVAC Tech', location: 'Paterson, NJ', msg: 'What areas does it cover?', time: 'Yesterday', online: false, joined: 'Mar 2024', jobs: 5, unread: 2 },
  { name: 'Robert Johnson', id: 11, status: null, profession: 'Painter', location: 'Elizabeth, NJ', msg: "I'll check it out this weekend", time: 'Yesterday', online: false, joined: 'Mar 2024', jobs: 0, unread: 0 },
  { name: 'Alex Rivera', id: 22, status: 'subscribed', profession: 'Roofer', location: 'Trenton, NJ', msg: 'Been using it for a week, love it', time: 'Tuesday', online: false, joined: 'Dec 2023', jobs: 62, unread: 0 },
  { name: 'Tony Martinez', id: 47, status: 'trial', profession: 'Landscaper', location: 'Camden, NJ', msg: '👍', time: 'Monday', online: false, joined: 'Feb 2024', jobs: 8, unread: 0 },
]

const statusTag = (s: string | null) =>
  s === 'subscribed' ? { label: 'Subscribed', bg: 'bg-gray-900', text: 'text-white' } :
  s === 'trial' ? { label: 'Trial', bg: 'bg-gray-100', text: 'text-gray-600' } :
  s === 'interested' ? { label: 'Interested', bg: 'bg-gray-100', text: 'text-gray-500' } :
  { label: 'Not reached', bg: 'bg-gray-50', text: 'text-gray-300' }

function ApproachD() {
  const { ref, visible } = useInView(0.1)
  const [phase, setPhase] = useState(0)
  const [selectedView, setSelectedView] = useState<'group' | number>('group')

  useEffect(() => {
    if (!visible) return
    const t1 = setTimeout(() => setPhase(1), 300)
    const t2 = setTimeout(() => setPhase(2), 1100)
    const t3 = setTimeout(() => setPhase(3), 1700)
    const t4 = setTimeout(() => setPhase(4), 2200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [visible])

  const selectedMember = typeof selectedView === 'number' ? D_MEMBERS[selectedView] : D_MEMBERS[0]

  return (
    <section ref={ref as any} className="py-24 bg-[#f8f9fa] overflow-hidden relative">
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-[#25D366]/5 rounded-full blur-[180px]" />

      <div className="max-w-7xl mx-auto px-6 relative">
        <div className="text-center mb-4">
          <span className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-red-500/10 to-blue-500/10 text-orange-500 text-xs font-bold mb-4 border border-orange-200">
            APPROACH D — HYBRID (A + B)
          </span>
        </div>

        <div className={`text-center mb-14 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-[#25D366] text-[11px] font-semibold tracking-[0.3em] uppercase mb-4">One Scan Changes Everything</p>
          <h2 className="text-4xl md:text-6xl font-medium text-gray-900 mb-5 tracking-[-0.04em]">
            From Chaos to{' '}
            <span className="bg-gradient-to-r from-[#25D366] to-[#128C7E] bg-clip-text text-transparent">Command Center</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Scan your QR. See every member. Reach them personally. All from one screen.
          </p>
        </div>

        {/* 3-step flow indicator — orange */}
        <div className={`flex items-center justify-center gap-6 mb-10 transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
          {[
            { icon: <QrCode className="w-6 h-6" />, label: 'Scan QR Code', active: phase >= 1 },
            { icon: <Users className="w-6 h-6" />, label: 'Members Loaded', active: phase >= 2 },
            { icon: <Send className="w-6 h-6" />, label: 'Start Messaging', active: phase >= 3 },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all duration-500 ${
                s.active ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 scale-105' : 'bg-gray-100 text-gray-400'
              }`}>
                {s.icon}
                <span className="text-sm font-semibold">{s.label}</span>
              </div>
              {i < 2 && <ChevronRight className={`w-5 h-5 transition-colors duration-500 ${s.active ? 'text-orange-500' : 'text-gray-300'}`} />}
            </div>
          ))}
        </div>

        {/* The Transform Container */}
        <div className="relative flex items-stretch gap-0 rounded-3xl overflow-hidden border border-gray-200 shadow-[0_8px_60px_rgba(0,0,0,0.08)]"
          style={{ height: 580 }}>

          {/* ─── LEFT: iPhone with real WhatsApp ─── */}
          <div className={`relative flex items-center justify-center transition-all duration-600 ease-in-out overflow-hidden ${
            phase >= 3 ? 'w-0 opacity-0 p-0' : phase >= 2 ? 'w-[26%]' : 'w-[36%]'
          } bg-gradient-to-br from-gray-50 to-gray-100`}>
            <div className={`transition-all duration-400 ${phase >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
              <div className="relative w-[230px]"
                style={{
                  transform: phase >= 2 ? 'scale(0.8) rotate(-5deg)' : 'scale(1)',
                  transition: 'transform 0.6s ease',
                  opacity: phase >= 3 ? 0 : 1,
                }}>
                <div className="rounded-[40px] p-[2px] bg-black shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
                  <div className="rounded-[38px] overflow-hidden bg-white">
                    {/* Green header */}
                    <div className="relative bg-[#075E54] pt-2 pb-0">
                      <div className="flex justify-center mb-1"><div className="w-[76px] h-[20px] rounded-full bg-black" /></div>
                      <div className="flex justify-between px-5 mb-2">
                        <span className="text-[9px] font-semibold text-white">9:41</span>
                        <div className="flex items-center gap-1">
                          <div className="flex gap-[1px]">{[3,4,5,6].map(h => <div key={h} className="w-[2px] rounded-sm bg-white" style={{height:h}} />)}</div>
                          <span className="text-[7px] text-white ml-0.5">5G</span>
                        </div>
                      </div>
                      <div className="px-3 pb-2.5 flex items-center gap-2">
                        <span className="text-[10px] text-white/70">‹</span>
                        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                          <Users className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-semibold text-white">NJ Contractors</p>
                          <p className="text-[7px] text-white/50 truncate">Dan, Mike, Joe, Alex, Ron...</p>
                        </div>
                        <Video className="w-3.5 h-3.5 text-white/70" />
                      </div>
                    </div>
                    {/* Beige chat */}
                    <div className="px-2 py-1.5 space-y-1" style={{ background: '#ECE5DD', minHeight: 290 }}>
                      <div className="flex justify-center mb-0.5">
                        <span className="px-2 py-0.5 rounded-md bg-white/80 text-[6px] text-gray-500 font-medium shadow-sm">TODAY</span>
                      </div>
                      {[
                        { name: 'Dan', msg: 'Anyone free for Miami?', color: '#e17076' },
                        { name: 'Mike', msg: 'Me!! Where exactly?', color: '#35a0d4' },
                        { name: 'Joe', msg: "I'm free too", color: '#d4a76a' },
                        { name: 'Dan', msg: 'Plumbing, 33101, Monday', color: '#e17076' },
                        { name: 'Alex', msg: 'I can do tomorrow', color: '#6eb55a' },
                        { name: 'Ron', msg: "What's the budget?", color: '#b07ce8' },
                        { name: 'Sam', msg: 'Already taken?', color: '#35a0d4' },
                        { name: 'Tom', msg: 'Need help in Queens', color: '#e0a86e' },
                        { name: 'Chris', msg: 'How much per sq ft?', color: '#e17076' },
                      ].map((m, i) => (
                        <div key={i} className="max-w-[88%]">
                          <div className="bg-white rounded-lg rounded-tl-sm px-2 py-1 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
                            <p className="text-[6.5px] font-bold" style={{ color: m.color }}>~{m.name}</p>
                            <p className="text-[8px] text-gray-800">{m.msg}</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-center pt-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#25D366] text-white text-[6.5px] font-bold">47 UNREAD</span>
                      </div>
                    </div>
                    {/* Input */}
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#ECE5DD]">
                      <div className="flex-1 bg-white rounded-full px-2 py-1.5 text-[7px] text-gray-400 shadow-sm">Message</div>
                      <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center">
                        <Mic className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>
                    <div className="bg-[#ECE5DD] pb-1 flex justify-center">
                      <div className="w-[70px] h-[3px] rounded-full bg-black/15" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── CENTER: WhatsApp Web QR page ─── */}
          <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-600 ${
            phase >= 3 ? 'opacity-0 scale-50' : phase >= 2 ? 'opacity-100 scale-100' : phase >= 1 ? 'opacity-100 scale-105' : 'opacity-0 scale-75'
          }`}>
            <div className="w-[260px] bg-white rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.15)] p-5 border border-gray-100">
              {/* WhatsApp Web header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-[11px] font-bold text-gray-800">WhatsApp Web</span>
              </div>
              {/* QR Code area */}
              <div className="relative w-full aspect-square rounded-xl border-2 border-[#25D366]/30 flex items-center justify-center bg-gray-50 mb-3 overflow-hidden">
                {/* QR grid pattern */}
                <div className="grid grid-cols-7 gap-[3px] w-[70%]">
                  {Array.from({ length: 49 }).map((_, i) => {
                    const isCorner = (i < 3 || (i >= 4 && i < 7)) && (i % 7 < 3 || i % 7 >= 4) ||
                      (i >= 42 && i < 45) || (i >= 0 && i < 3 && (Math.floor(i/7) < 3));
                    return (
                      <div key={i} className="aspect-square rounded-[2px]"
                        style={{ background: [0,1,2,6,7,8,14,35,36,42,43,44,48].includes(i) ? '#2d2d2d' :
                          Math.random() > 0.45 ? '#2d2d2d' : 'transparent' }} />
                    )
                  })}
                </div>
                {/* WhatsApp logo center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <MessageCircle className="w-6 h-6 text-[#25D366]" />
                  </div>
                </div>
                {/* Scan line */}
                {phase === 1 && (
                  <div className="absolute inset-x-0 h-[2px] bg-[#25D366] shadow-[0_0_12px_#25D366]"
                    style={{ animation: 'scanLineD 1.2s ease-in-out infinite', top: '20%' }} />
                )}
              </div>
              <p className={`text-center text-[10px] font-medium transition-all duration-300 ${
                phase >= 2 ? 'text-[#25D366]' : 'text-gray-400'
              }`}>
                {phase >= 2 ? '✓ Connected successfully' : 'Point your phone at this screen to scan'}
              </p>
              {/* Steps */}
              <div className="mt-3 space-y-1.5">
                {['Open WhatsApp on your phone', 'Go to Settings > Linked Devices', 'Tap "Link a Device"'].map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-400">{i+1}</span>
                    <span className="text-[9px] text-gray-400">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── RIGHT: WhatsApp Web Dashboard ─── */}
          <div className={`relative flex flex-col transition-all duration-600 ease-in-out ${
            phase >= 3 ? 'w-full' : phase >= 2 ? 'w-[74%]' : 'w-[64%]'
          } bg-white overflow-hidden`}>

            {/* KPI Strip — "12/48" typography */}
            <div className={`px-4 py-3 bg-white border-b border-gray-100 transition-all duration-400 ${
              phase >= 3 ? 'opacity-100' : 'opacity-0'
            }`} style={{ transitionDelay: '100ms' }}>
              <div className="flex items-center">
                <div className="flex items-center gap-2.5 pr-4 border-r border-gray-100 shrink-0">
                  <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center">
                    <MessageCircle className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-bold text-gray-900 leading-tight">NJ Contractors</h3>
                    <p className="text-[8px] text-gray-400">583 members</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 pl-4 flex-1">
                  {[
                    { num: '127', total: '/583', label: 'Subscribed' },
                    { num: '84', total: '/583', label: 'In Trial' },
                    { num: '211', total: '/583', label: 'Paying' },
                  ].map((kpi, i) => (
                    <div key={i} className={`transition-all duration-400 ${
                      phase >= 4 ? 'opacity-100' : 'opacity-0'
                    }`} style={{ transitionDelay: `${2200 + i * 50}ms` }}>
                      <div className="flex items-baseline gap-0">
                        <span className="text-[20px] font-black text-gray-900 leading-none tracking-tight">{kpi.num}</span>
                        <span className="text-[11px] font-medium text-gray-300">{kpi.total}</span>
                      </div>
                      <p className="text-[7px] font-semibold text-gray-400 uppercase tracking-wider">{kpi.label}</p>
                    </div>
                  ))}
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 shrink-0 transition-all duration-400 ${
                  phase >= 4 ? 'opacity-100' : 'opacity-0'
                }`} style={{ transitionDelay: '2400ms' }}>
                  <div>
                    <p className="text-[7px] font-semibold text-gray-500 uppercase tracking-wider">Earnings</p>
                    <p className="text-[20px] font-black text-white leading-none tracking-tight">$18,240</p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-[#25D366]" />
                </div>
              </div>
            </div>

            {/* 3-column: Contacts | Chat | Profile */}
            <div className="flex flex-1 overflow-hidden">

              {/* Contacts sidebar with status tags */}
              <div className={`border-r border-gray-100 flex flex-col bg-white shrink-0 transition-all duration-400 ${
                phase >= 3 ? 'w-[220px] opacity-100' : 'w-0 opacity-0'
              }`}>
                <div className="px-2.5 py-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                    <div className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-gray-50 text-[9px] text-gray-400">Search...</div>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  {/* Pinned group chat — always on top, orange with left border */}
                  <div className={`flex items-center gap-2 px-2.5 py-2.5 cursor-pointer border-b border-orange-100 border-l-[3px] border-l-orange-500 transition-all duration-300 ${
                    selectedView === 'group' ? 'bg-orange-50' : 'hover:bg-orange-50/50'
                  } ${phase >= 4 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                    style={{ transitionDelay: '2150ms' }}
                    onClick={() => setSelectedView('group')}>
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center shadow-sm">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-orange-400 border-[1.5px] border-white flex items-center justify-center">
                        <Pin className="w-2 h-2 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold text-orange-600">NJ Contractors</span>
                        <span className="text-[7px] font-bold px-1.5 py-[1px] rounded-full bg-orange-500 text-white">583</span>
                      </div>
                      <p className="text-[8px] text-gray-400 truncate">Mike: Sounds interesting, how do I...</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[7px] text-orange-400">10:44</span>
                      <span className="w-4 h-4 rounded-full bg-[#25D366] text-white text-[7px] font-bold flex items-center justify-center">12</span>
                    </div>
                  </div>

                  {/* Individual members */}
                  {D_MEMBERS.map((m, i) => {
                    const tag = statusTag(m.status)
                    return (
                      <div key={i} className={`flex items-center gap-2 px-2.5 py-2 transition-all duration-300 cursor-pointer ${
                        selectedView === i ? 'bg-gray-50' : 'hover:bg-gray-50'
                      } ${phase >= 4 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                        style={{ transitionDelay: `${2200 + i * 50}ms` }}
                        onClick={() => setSelectedView(i)}>
                        <div className="relative shrink-0">
                          <img src={`https://i.pravatar.cc/80?img=${m.id}`} alt="" className="w-9 h-9 rounded-full object-cover" />
                          {m.online && <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#25D366] border-[1.5px] border-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-semibold text-gray-800 truncate">{m.name.split(' ')[0]}</span>
                            <span className={`text-[7px] font-bold px-1.5 py-[1px] rounded-full ${tag.bg} ${tag.text}`}>
                              {tag.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <CheckCheck className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                            <p className="text-[8px] text-gray-400 truncate">{m.msg}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[7px] text-gray-300">{m.time}</span>
                          {m.unread > 0 && (
                            <span className="w-3.5 h-3.5 rounded-full bg-[#25D366] text-white text-[6px] font-bold flex items-center justify-center">{m.unread}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Chat area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Chat header — group or member */}
                <div className={`px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-white transition-all duration-300 ${
                  phase >= 3 ? 'opacity-100' : 'opacity-0'
                }`} style={{ transitionDelay: '200ms' }}>
                  {selectedView === 'group' ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-gray-800">NJ Contractors</p>
                        <p className="text-[8px] text-gray-400 truncate">583 participants · Mike, Carlos, James, David...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <img src={`https://i.pravatar.cc/80?img=${selectedMember.id}`} alt="" className="w-9 h-9 rounded-full" />
                      <div>
                        <p className="text-[11px] font-semibold text-gray-800">{selectedMember.name}</p>
                        <p className="text-[9px] text-[#25D366]">{selectedMember.online ? 'online' : 'last seen today'}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3 text-gray-300">
                    <Phone className="w-3.5 h-3.5" /><Video className="w-3.5 h-3.5" /><MoreVertical className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* AI nudge */}
                <div className={`mx-3 mt-2 px-3 py-2 rounded-lg bg-orange-50/80 border border-orange-100 flex items-center gap-2 transition-all duration-400 ${
                  phase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'
                }`} style={{ transitionDelay: '2600ms' }}>
                  <Zap className="w-3.5 h-3.5 text-[#fe5b25] shrink-0" />
                  <span className="text-[9px] text-gray-500 flex-1">
                    {selectedView === 'group'
                      ? <><strong className="text-[#fe5b25]">AI:</strong> 161 members haven't been contacted yet</>
                      : <><strong className="text-[#fe5b25]">AI:</strong> Nudge with 7-day trial</>
                    }
                  </span>
                  <button className={`px-2.5 py-0.5 rounded-md bg-[#fe5b25] text-white text-[8px] font-bold ${phase >= 4 ? 'animate-pulse' : ''}`}>
                    {selectedView === 'group' ? 'Reach Out' : 'Send'}
                  </button>
                </div>

                {/* Messages — group or 1:1 */}
                <div className="flex-1 px-4 py-3 space-y-2 overflow-hidden relative"
                  style={{
                    backgroundColor: '#efeae2',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='wa' patternUnits='userSpaceOnUse' width='50' height='50'%3E%3Cpath d='M25 0v10M0 25h10M40 25h10M25 40v10' stroke='%23d4cfc6' stroke-width='0.5' fill='none' opacity='0.4'/%3E%3Ccircle cx='25' cy='25' r='1' fill='%23d4cfc6' opacity='0.3'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23wa)'/%3E%3C/svg%3E")`,
                  }}>
                  {selectedView === 'group' ? (
                    /* Group chat — multiple members talking with status tags */
                    <>
                      {[
                        { sender: 'Carlos', avatar: 15, status: 'trial', text: 'Anyone know a good tile guy in Newark?', time: '10:20', color: 'text-purple-600', delay: '2300ms' },
                        { sender: 'James', avatar: 60, status: 'subscribed', text: 'Yeah try Danny, he did my bathroom last month 👌', time: '10:22', color: 'text-blue-600', delay: '2400ms' },
                        { sender: 'Mike', avatar: 33, status: 'interested', text: 'I need help with a plumbing job in Jersey City, 2-story house', time: '10:31', color: 'text-orange-600', delay: '2500ms' },
                        { sender: 'David', avatar: 51, status: 'interested', text: 'How big is the job? I might be able to take it', time: '10:35', color: 'text-teal-600', delay: '2600ms' },
                        { sender: 'Mike', avatar: 33, status: 'interested', text: 'Full bathroom remodel, copper to PEX repipe', time: '10:38', color: 'text-orange-600', delay: '2700ms' },
                        { sender: 'Alex', avatar: 22, status: 'subscribed', text: 'I just finished a similar job, DM me if you want pics 📸', time: '10:41', color: 'text-green-600', delay: '2800ms' },
                        { sender: 'Robert', avatar: 11, status: null, text: "What's everyone charging for exterior paint these days?", time: '10:44', color: 'text-rose-600', delay: '2900ms' },
                      ].map((msg, i) => {
                        const tag = statusTag(msg.status)
                        return (
                          <div key={i} className={`flex gap-1.5 transition-all duration-300 ${
                            phase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                          }`} style={{ transitionDelay: msg.delay }}>
                            <img src={`https://i.pravatar.cc/40?img=${msg.avatar}`} alt="" className="w-5 h-5 rounded-full mt-0.5 shrink-0" />
                            <div className="max-w-[75%] rounded-lg rounded-tl-sm bg-white px-2.5 py-1.5 text-[10px] shadow-sm text-gray-700">
                              <span className="flex items-center gap-1">
                                <span className={`font-bold text-[9px] ${msg.color}`}>{msg.sender}</span>
                                <span className={`text-[6px] font-bold px-1 py-[0.5px] rounded-full ${tag.bg} ${tag.text}`}>{tag.label}</span>
                              </span>
                              {msg.text}
                              <span className="text-[7px] text-gray-400 ml-1.5">{msg.time}</span>
                            </div>
                          </div>
                        )
                      })}
                      {/* Typing indicator */}
                      <div className={`flex gap-1.5 transition-all duration-300 ${
                        phase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                      }`} style={{ transitionDelay: '3100ms' }}>
                        <img src="https://i.pravatar.cc/40?img=47" alt="" className="w-5 h-5 rounded-full mt-0.5 shrink-0" />
                        <div className="rounded-lg rounded-tl-sm bg-white px-3 py-2 shadow-sm flex items-center gap-1">
                          <span className="text-[9px] text-teal-600 font-bold mr-1">Tony</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    /* 1:1 private chat with blue ticks */
                    <>
                      {[
                        { from: 'them', text: "Hey, what's Lead Express?", time: '10:41', delay: '2300ms', read: true },
                        { from: 'me', text: 'It scans WhatsApp groups and sends you job leads. Free 7-day trial!', time: '10:42', delay: '2500ms', read: true },
                        { from: 'them', text: 'Sounds interesting, how do I sign up?', time: '10:44', delay: '2700ms', read: false },
                      ].map((msg, i) => (
                        <div key={i} className={`flex ${msg.from === 'me' ? 'justify-end' : ''} transition-all duration-300 ${
                          phase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                        }`} style={{ transitionDelay: msg.delay }}>
                          <div className={`max-w-[70%] rounded-lg px-2.5 py-1.5 text-[10px] shadow-sm ${
                            msg.from === 'me'
                              ? 'rounded-tr-sm bg-[#dcf8c6] text-gray-800'
                              : 'rounded-tl-sm bg-white text-gray-700'
                          }`}>
                            {msg.text}
                            <span className="inline-flex items-center gap-0.5 ml-1.5">
                              <span className="text-[7px] text-gray-400">{msg.time}</span>
                              {msg.from === 'me' && <CheckCheck className={`w-3 h-3 ${msg.read ? 'text-blue-500' : 'text-gray-400'}`} />}
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Input */}
                <div className={`px-3 py-2 border-t border-gray-100 flex items-center gap-2 bg-white transition-all duration-300 ${
                  phase >= 3 ? 'opacity-100' : 'opacity-0'
                }`} style={{ transitionDelay: '300ms' }}>
                  <Smile className="w-3.5 h-3.5 text-gray-300" />
                  <Paperclip className="w-3.5 h-3.5 text-gray-300" />
                  <div className="flex-1 px-3 py-1.5 rounded-lg bg-gray-50 text-[10px] text-gray-400">Type a message...</div>
                  <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center">
                    <Mic className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>

              {/* Profile panel — right side */}
              <div className={`border-l border-gray-100 bg-gray-50/50 flex flex-col shrink-0 transition-all duration-500 ${
                phase >= 4 ? 'w-[200px] opacity-100' : 'w-0 opacity-0'
              }`} style={{ transitionDelay: '2800ms' }}>
                {selectedView === 'group' ? (
                  /* Group info panel */
                  <>
                    <div className="p-4 flex flex-col items-center text-center border-b border-gray-100">
                      <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center mb-2 shadow-sm">
                        <Users className="w-7 h-7 text-white" />
                      </div>
                      <p className="text-[12px] font-bold text-gray-900">NJ Contractors</p>
                      <p className="text-[9px] text-gray-400">WhatsApp Group</p>
                      <span className="mt-1.5 text-[8px] font-bold px-2.5 py-0.5 rounded-full bg-orange-500 text-white">
                        583 members
                      </span>
                    </div>
                    <div className="px-4 py-3 space-y-3 flex-1">
                      {[
                        { label: 'Subscribed', value: '127' },
                        { label: 'In Trial', value: '84' },
                        { label: 'Interested', value: '211' },
                        { label: 'Not Reached', value: '161' },
                        { label: 'Created', value: 'Sep 2023' },
                      ].map((item, i) => (
                        <div key={i}>
                          <p className="text-[7px] font-semibold text-gray-400 uppercase tracking-wider">{item.label}</p>
                          <p className="text-[10px] font-medium text-gray-800">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-gray-100">
                      <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[9px] font-bold text-white bg-orange-500">
                        <Send className="w-3 h-3" />
                        Broadcast Message
                      </button>
                    </div>
                  </>
                ) : (
                  /* Member profile panel */
                  <>
                    <div className="p-4 flex flex-col items-center text-center border-b border-gray-100">
                      <img src={`https://i.pravatar.cc/120?img=${selectedMember.id}`} alt=""
                        className="w-16 h-16 rounded-full object-cover mb-2 shadow-sm" />
                      <p className="text-[12px] font-bold text-gray-900">{selectedMember.name}</p>
                      <p className="text-[9px] text-gray-400">{selectedMember.profession}</p>
                      <span className={`mt-1.5 text-[8px] font-bold px-2.5 py-0.5 rounded-full ${statusTag(selectedMember.status).bg} ${statusTag(selectedMember.status).text}`}>
                        {statusTag(selectedMember.status).label}
                      </span>
                    </div>
                    <div className="px-4 py-3 space-y-3 flex-1">
                      {[
                        { label: 'Location', value: selectedMember.location },
                        { label: 'Joined Group', value: selectedMember.joined },
                        { label: 'Jobs Completed', value: String(selectedMember.jobs) },
                      ].map((item, i) => (
                        <div key={i}>
                          <p className="text-[7px] font-semibold text-gray-400 uppercase tracking-wider">{item.label}</p>
                          <p className="text-[10px] font-medium text-gray-800">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-gray-100">
                      <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[9px] font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                        <Send className="w-3 h-3" />
                        Send Private Message
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bottom CTA */}
            <div className={`px-4 py-2.5 border-t border-gray-100 bg-white flex items-center justify-between transition-all duration-400 ${
              phase >= 4 ? 'opacity-100' : 'opacity-0'
            }`} style={{ transitionDelay: '3000ms' }}>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  {[11, 33, 51, 15].map(id => (
                    <img key={id} src={`https://i.pravatar.cc/40?img=${id}`} alt="" className="w-5 h-5 rounded-full border-2 border-white" />
                  ))}
                </div>
                <span className="text-[8px] text-gray-400">583 members • $18,240/mo potential</span>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-bold text-white shadow-lg shadow-[#25D366]/20"
                style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                <Scan className="w-3.5 h-3.5" />
                Connect My WhatsApp
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scanLineD {
          0%, 100% { top: 15%; }
          50% { top: 80%; }
        }
      `}</style>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════
   TEST PAGE
   ═══════════════════════════════════════════════════════════ */
export default function CRMDesignTest() {
  return (
    <div>
      {/* Nav */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <h1 className="text-white text-sm font-bold">WhatsApp CRM — Design Comparison</h1>
        <div className="flex gap-3">
          <a href="#approach-a" className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors">A: Evolutionary</a>
          <a href="#approach-b" className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/30 transition-colors">B: Split Screen</a>
          <a href="#approach-c" className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-bold hover:bg-purple-500/30 transition-colors">C: Connection Web</a>
          <a href="#approach-d" className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500/20 to-blue-500/20 text-orange-400 text-xs font-bold hover:from-red-500/30 hover:to-blue-500/30 transition-colors">D: Hybrid (A+B)</a>
        </div>
      </div>

      <div className="pt-14">
        <div id="approach-a"><ApproachA /></div>
        <div id="approach-b"><ApproachB /></div>
        <div id="approach-c"><ApproachC /></div>
        <div id="approach-d"><ApproachD /></div>
      </div>
    </div>
  )
}
