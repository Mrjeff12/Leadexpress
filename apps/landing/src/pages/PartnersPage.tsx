import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Users, DollarSign, TrendingUp, Share2,
  BadgeCheck, LayoutDashboard, ChevronDown, ChevronRight,
  MessageCircle, Eye, Zap, Gift, Shield, Clock, CreditCard,
  BarChart3, UserPlus, Link2, Sparkles,
  Send, Search, Phone, Video, MoreVertical, Smile, Paperclip, Mic, UserCheck,
  Pin, CheckCheck, QrCode, Scan
} from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { genericAvatar } from '../utils/avatars'

/* ─── Intersection Observer hook ─── */
function useInView(threshold = 0.2) {
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

/* ─── Animated counter ─── */
function useCountUp(target: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, active])
  return value
}

/* ─── CRM Data (shared by Hero + CRM Section) ─── */
const CRM_MEMBERS = [
  { name: 'Mike Rodriguez', id: 33, status: 'interested' as string | null, profession: 'Plumber', location: 'Newark, NJ', msg: 'Sounds interesting, how do I sign up?', time: '10:44', online: true, joined: 'Jan 2024', jobs: 34, unread: 3 },
  { name: 'Carlos Martinez', id: 15, status: 'trial' as string | null, profession: 'Electrician', location: 'Jersey City, NJ', msg: 'Thanks bro, I signed up! 🔥', time: '10:30', online: true, joined: 'Feb 2024', jobs: 12, unread: 1 },
  { name: 'James Thompson', id: 60, status: 'subscribed' as string | null, profession: 'General Contractor', location: 'Hoboken, NJ', msg: 'Getting leads every day now 💪', time: '9:15', online: false, joined: 'Nov 2023', jobs: 87, unread: 0 },
  { name: 'David Kim', id: 51, status: 'interested' as string | null, profession: 'HVAC Tech', location: 'Paterson, NJ', msg: 'What areas does it cover?', time: 'Yesterday', online: false, joined: 'Mar 2024', jobs: 5, unread: 2 },
  { name: 'Robert Johnson', id: 11, status: null as string | null, profession: 'Painter', location: 'Elizabeth, NJ', msg: "I'll check it out this weekend", time: 'Yesterday', online: false, joined: 'Mar 2024', jobs: 0, unread: 0 },
  { name: 'Alex Rivera', id: 22, status: 'subscribed' as string | null, profession: 'Roofer', location: 'Trenton, NJ', msg: 'Been using it for a week, love it', time: 'Tuesday', online: false, joined: 'Dec 2023', jobs: 62, unread: 0 },
  { name: 'Tony Martinez', id: 47, status: 'trial' as string | null, profession: 'Landscaper', location: 'Camden, NJ', msg: '👍', time: 'Monday', online: false, joined: 'Feb 2024', jobs: 8, unread: 0 },
]

const crmStatusTag = (s: string | null) =>
  s === 'subscribed' ? { label: 'Subscribed', bg: 'bg-gray-900', text: 'text-white' } :
  s === 'trial' ? { label: 'Trial', bg: 'bg-gray-100', text: 'text-gray-600' } :
  s === 'interested' ? { label: 'Interested', bg: 'bg-gray-100', text: 'text-gray-500' } :
  { label: 'Not reached', bg: 'bg-gray-50', text: 'text-gray-300' }

/* ═══════════════════════════════════════════
   SECTION 1: Partner Hero
   ═══════════════════════════════════════════ */
function PartnerHero() {
  const [heroView, setHeroView] = useState<'group' | number>('group')
  const [heroAutoPaused, setHeroAutoPaused] = useState(false)
  const heroMember = typeof heroView === 'number' ? CRM_MEMBERS[heroView] : CRM_MEMBERS[0]

  // Auto-cycle: group → member views
  useEffect(() => {
    if (heroAutoPaused) return
    const sequence: ('group' | number)[] = ['group', 0, 'group', 1, 'group', 2]
    let idx = 0
    const interval = setInterval(() => {
      idx = (idx + 1) % sequence.length
      setHeroView(sequence[idx])
    }, 3500)
    return () => clearInterval(interval)
  }, [heroAutoPaused])

  const heroSelect = (view: 'group' | number) => {
    setHeroAutoPaused(true)
    setHeroView(view)
  }

  return (
    <section className="relative pt-28 pb-12 md:pt-36 md:pb-16 overflow-hidden bg-cream">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#fe5b25]/8 rounded-full blur-[120px]" />

      <div className="max-w-7xl mx-auto px-6 relative w-full">
        {/* Text — centered */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 bg-[#fe5b25]/10 border border-[#fe5b25]/20 text-[#fe5b25] rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
            <Users className="w-3.5 h-3.5" />
            Community Partner Program
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium leading-[1.15] tracking-[-0.04em] mb-6 text-dark">
            Your Group Makes Money.{' '}
            <span className="highlight-box">Just Not for You.</span>
          </h1>

          <p className="text-base md:text-lg text-gray-subtle/70 max-w-lg mx-auto mb-8 leading-relaxed">
            Every day, job leads flow through your WhatsApp group. Contractors get work. You get nothing. That changes today.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <a
              href="https://app.leadexpress.co.il/partner/join"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white px-8 py-4 text-base font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#fe5b25]/25 active:scale-95"
            >
              <Zap size={16} />
              Start in 5 Minutes — It's Free
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-dark/20 text-dark/70 px-8 py-4 text-base font-semibold transition-all duration-300 hover:border-dark/40 hover:text-dark hover:scale-105 active:scale-95"
            >
              <Eye size={16} />
              See How It Works
            </a>
          </div>

          <div className="flex items-center gap-3 justify-center">
            <div className="flex -space-x-2">
              {['bg-blue-400', 'bg-amber-400', 'bg-orange-400', 'bg-green-400'].map((bg, i) => (
                <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-cream flex items-center justify-center text-[10px] font-bold text-white`}>
                  {['Y', 'M', 'D', 'A'][i]}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-subtle/50">127 group owners already earning</p>
          </div>
        </div>

        {/* Full CRM Dashboard */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-br from-[#fe5b25]/15 via-orange-300/8 to-amber-200/10 rounded-3xl blur-2xl" />

          <div className="relative rounded-3xl overflow-hidden border border-gray-200 shadow-[0_8px_60px_rgba(254,91,37,0.12),0_2px_20px_rgba(0,0,0,0.06)]">

            {/* KPI strip */}
            <div className="px-5 py-3.5 flex items-center bg-white border-b border-gray-100">
              <div className="flex items-center w-full">
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
                    <div key={i}>
                      <div className="flex items-baseline gap-0">
                        <span className="text-[20px] font-black text-gray-900 leading-none tracking-tight">{kpi.num}</span>
                        <span className="text-[11px] font-medium text-gray-300">{kpi.total}</span>
                      </div>
                      <p className="text-[7px] font-semibold text-gray-400 uppercase tracking-wider">{kpi.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 shrink-0">
                  <div>
                    <p className="text-[7px] font-semibold text-gray-500 uppercase tracking-wider">Earnings</p>
                    <p className="text-[20px] font-black text-white leading-none tracking-tight">$18,240</p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-[#25D366]" />
                </div>
              </div>
            </div>

            {/* 3-column: Contacts | Chat | Profile */}
            <div className="flex" style={{ height: 480 }}>

              {/* Contacts sidebar */}
              <div className="w-[240px] border-r border-gray-100 flex flex-col bg-white shrink-0">
                <div className="px-2.5 py-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                    <div className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-gray-50 text-[10px] text-gray-400">Search...</div>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  {/* Pinned group chat */}
                  <div className={`flex items-center gap-2 px-2.5 py-2.5 cursor-pointer border-b border-[#fe5b25]/15 border-l-[3px] border-l-[#fe5b25] transition-all duration-300 ${
                    heroView === 'group' ? 'bg-[#fe5b25]/5' : 'hover:bg-[#fe5b25]/[0.03]'
                  }`}
                    onClick={() => heroSelect('group')}>
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-[#fe5b25] flex items-center justify-center shadow-sm">
                        <Users className="w-4.5 h-4.5 text-white" />
                      </div>
                      <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#fe5b25] border-[1.5px] border-white flex items-center justify-center">
                        <Pin className="w-2 h-2 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-bold text-[#fe5b25]">NJ Contractors</span>
                        <span className="text-[7px] font-bold px-1.5 py-[1px] rounded-full bg-[#fe5b25] text-white">583</span>
                      </div>
                      <p className="text-[9px] text-gray-400 truncate">Mike: Sounds interesting, how do I...</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[7px] text-[#fe5b25]/60">10:44</span>
                      <span className="w-4 h-4 rounded-full bg-[#25D366] text-white text-[7px] font-bold flex items-center justify-center">12</span>
                    </div>
                  </div>

                  {/* Individual members */}
                  {CRM_MEMBERS.map((m, i) => {
                    const tag = crmStatusTag(m.status)
                    return (
                      <div key={i} className={`flex items-center gap-2 px-2.5 py-2 transition-all duration-300 cursor-pointer ${
                        heroView === i ? 'bg-gray-50' : 'hover:bg-gray-50'
                      }`}
                        onClick={() => heroSelect(i)}>
                        <div className="relative shrink-0">
                          <img src={genericAvatar(m.id)} alt="" className="w-10 h-10 rounded-full object-cover" />
                          {m.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#25D366] border-[1.5px] border-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[11px] font-semibold text-gray-800 truncate">{m.name.split(' ')[0]}</span>
                            <span className={`text-[7px] font-bold px-1.5 py-[1px] rounded-full ${tag.bg} ${tag.text}`}>
                              {tag.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <CheckCheck className="w-3 h-3 text-blue-500 shrink-0" />
                            <p className="text-[9px] text-gray-400 truncate">{m.msg}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[8px] text-gray-300">{m.time}</span>
                          {m.unread > 0 && (
                            <span className="w-4 h-4 rounded-full bg-[#25D366] text-white text-[7px] font-bold flex items-center justify-center">{m.unread}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Chat area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Chat header */}
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-white">
                  {heroView === 'group' ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-[#fe5b25] flex items-center justify-center">
                        <Users className="w-4.5 h-4.5 text-white" />
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-gray-800">NJ Contractors</p>
                        <p className="text-[9px] text-gray-400 truncate">583 participants · Mike, Carlos, James, David...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <img src={genericAvatar(heroMember.id)} alt="" className="w-10 h-10 rounded-full" />
                      <div>
                        <p className="text-[12px] font-semibold text-gray-800">{heroMember.name}</p>
                        <p className="text-[10px] text-[#25D366]">{heroMember.online ? 'online' : 'last seen today'}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-4 text-gray-300">
                    <Phone className="w-4 h-4" /><Video className="w-4 h-4" /><MoreVertical className="w-4 h-4" />
                  </div>
                </div>

                {/* AI nudge */}
                <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-[#fe5b25]/5 border border-[#fe5b25]/15 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[#fe5b25] shrink-0" />
                  <span className="text-[10px] text-gray-500 flex-1">
                    {heroView === 'group'
                      ? <><strong className="text-[#fe5b25]">AI:</strong> 161 members haven't been contacted yet</>
                      : <><strong className="text-[#fe5b25]">AI:</strong> Nudge with 7-day trial</>
                    }
                  </span>
                  <button className="px-2.5 py-1 rounded-md bg-[#fe5b25] text-white text-[9px] font-bold animate-pulse">
                    {heroView === 'group' ? 'Reach Out' : 'Send'}
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 px-5 py-3 space-y-2.5 overflow-hidden relative"
                  style={{
                    backgroundColor: '#efeae2',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='waHero' patternUnits='userSpaceOnUse' width='50' height='50'%3E%3Cpath d='M25 0v10M0 25h10M40 25h10M25 40v10' stroke='%23d4cfc6' stroke-width='0.5' fill='none' opacity='0.4'/%3E%3Ccircle cx='25' cy='25' r='1' fill='%23d4cfc6' opacity='0.3'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23waHero)'/%3E%3C/svg%3E")`,
                  }}>
                  {heroView === 'group' ? (
                    <>
                      {[
                        { sender: 'Carlos', avatar: 15, status: 'trial' as string | null, text: 'Anyone know a good tile guy in Newark?', time: '10:20', color: 'text-purple-600' },
                        { sender: 'James', avatar: 60, status: 'subscribed' as string | null, text: 'Yeah try Danny, he did my bathroom last month 👌', time: '10:22', color: 'text-blue-600' },
                        { sender: 'Mike', avatar: 33, status: 'interested' as string | null, text: 'I need help with a plumbing job in Jersey City, 2-story house', time: '10:31', color: 'text-orange-600' },
                        { sender: 'David', avatar: 51, status: 'interested' as string | null, text: 'How big is the job? I might be able to take it', time: '10:35', color: 'text-teal-600' },
                        { sender: 'Mike', avatar: 33, status: 'interested' as string | null, text: 'Full bathroom remodel, copper to PEX repipe', time: '10:38', color: 'text-orange-600' },
                        { sender: 'Alex', avatar: 22, status: 'subscribed' as string | null, text: 'I just finished a similar job, DM me if you want pics 📸', time: '10:41', color: 'text-green-600' },
                        { sender: 'Robert', avatar: 11, status: null as string | null, text: "What's everyone charging for exterior paint these days?", time: '10:44', color: 'text-rose-600' },
                      ].map((msg, i) => {
                        const tag = crmStatusTag(msg.status)
                        return (
                          <div key={i} className="flex gap-2">
                            <img src={genericAvatar(msg.avatar)} alt="" className="w-6 h-6 rounded-full mt-0.5 shrink-0" />
                            <div className="max-w-[75%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-[11px] shadow-sm text-gray-700">
                              <span className="flex items-center gap-1">
                                <span className={`font-bold text-[10px] ${msg.color}`}>{msg.sender}</span>
                                <span className={`text-[7px] font-bold px-1 py-[0.5px] rounded-full ${tag.bg} ${tag.text}`}>{tag.label}</span>
                              </span>
                              {msg.text}
                              <span className="text-[8px] text-gray-400 ml-1.5">{msg.time}</span>
                            </div>
                          </div>
                        )
                      })}
                      {/* Typing indicator */}
                      <div className="flex gap-2">
                        <img src={genericAvatar(47)} alt="" className="w-6 h-6 rounded-full mt-0.5 shrink-0" />
                        <div className="rounded-lg rounded-tl-sm bg-white px-3 py-2 shadow-sm flex items-center gap-1">
                          <span className="text-[10px] text-teal-600 font-bold mr-1">Tony</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {[
                        { from: 'me', text: 'Hey! Want to subscribe and get only leads that match your trade, straight from the group? Plus access to a network of 2,000+ different job groups 🔥', time: '10:41', read: true },
                        { from: 'them', text: 'That sounds amazing, how does it work?', time: '10:43', read: true },
                        { from: 'me', text: 'Free 7-day trial — we filter leads by your profession and area. You only see what matters to you 🎯', time: '10:44', read: true },
                        { from: 'them', text: 'Sign me up! 💪', time: '10:45', read: false },
                      ].map((msg, i) => (
                        <div key={i} className={`flex ${msg.from === 'me' ? 'justify-end' : ''}`}>
                          <div className={`max-w-[70%] rounded-lg px-3 py-2 text-[11px] shadow-sm ${
                            msg.from === 'me'
                              ? 'rounded-tr-sm bg-[#dcf8c6] text-gray-800'
                              : 'rounded-tl-sm bg-white text-gray-700'
                          }`}>
                            {msg.text}
                            <span className="inline-flex items-center gap-0.5 ml-1.5">
                              <span className="text-[8px] text-gray-400">{msg.time}</span>
                              {msg.from === 'me' && <CheckCheck className={`w-3.5 h-3.5 ${msg.read ? 'text-blue-500' : 'text-gray-400'}`} />}
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Input */}
                <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-3 bg-white">
                  <Smile className="w-4 h-4 text-gray-300" />
                  <Paperclip className="w-4 h-4 text-gray-300" />
                  <div className="flex-1 px-3 py-2 rounded-lg bg-gray-50 text-[11px] text-gray-400">Type a message...</div>
                  <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center">
                    <Mic className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
              </div>

              {/* Profile panel — right side */}
              <div className="w-[220px] border-l border-gray-100 bg-gray-50/50 flex flex-col shrink-0">
                {heroView === 'group' ? (
                  <>
                    <div className="p-4 flex flex-col items-center text-center border-b border-gray-100">
                      <div className="w-16 h-16 rounded-full bg-[#fe5b25] flex items-center justify-center mb-2 shadow-sm">
                        <Users className="w-7 h-7 text-white" />
                      </div>
                      <p className="text-[13px] font-bold text-gray-900">NJ Contractors</p>
                      <p className="text-[10px] text-gray-400">WhatsApp Group</p>
                      <span className="mt-1.5 text-[8px] font-bold px-2.5 py-0.5 rounded-full bg-[#fe5b25] text-white">
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
                          <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider">{item.label}</p>
                          <p className="text-[11px] font-medium text-gray-800">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-gray-100">
                      <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold text-white bg-[#fe5b25]">
                        <Send className="w-3 h-3" />
                        Broadcast Message
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 flex flex-col items-center text-center border-b border-gray-100">
                      <img src={genericAvatar(heroMember.id)} alt=""
                        className="w-16 h-16 rounded-full object-cover mb-2 shadow-sm" />
                      <p className="text-[13px] font-bold text-gray-900">{heroMember.name}</p>
                      <p className="text-[10px] text-gray-400">{heroMember.profession}</p>
                      <span className={`mt-1.5 text-[8px] font-bold px-2.5 py-0.5 rounded-full ${crmStatusTag(heroMember.status).bg} ${crmStatusTag(heroMember.status).text}`}>
                        {crmStatusTag(heroMember.status).label}
                      </span>
                    </div>
                    <div className="px-4 py-3 space-y-3 flex-1">
                      {[
                        { label: 'Location', value: heroMember.location },
                        { label: 'Joined Group', value: heroMember.joined },
                        { label: 'Jobs Completed', value: String(heroMember.jobs) },
                      ].map((item, i) => (
                        <div key={i}>
                          <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider">{item.label}</p>
                          <p className="text-[11px] font-medium text-gray-800">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-gray-100">
                      <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                        <Send className="w-3 h-3" />
                        Send Private Message
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bottom CTA bar */}
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {[11, 33, 51, 15, 60].map(id => (
                    <img key={id} src={genericAvatar(id)} alt="" className="w-7 h-7 rounded-full border-2 border-white object-cover" />
                  ))}
                  <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-500">+578</div>
                </div>
                <span className="text-xs text-dark/40">
                  583 members • 127 subscribed • 84 on trial
                </span>
              </div>
              <Link
                to="/partners/apply"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all hover:shadow-lg hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
              >
                <Scan className="w-4 h-4" />
                Connect My WhatsApp
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   SECTION 2: The Loss Section
   ═══════════════════════════════════════════ */
function TheLossSection() {
  const { ref, visible } = useInView()
  const leadsCount = useCountUp(47, 1200, visible)
  const earningsCount = useCountUp(0, 1200, visible)
  const potentialCount = useCountUp(2618, 1200, visible)

  return (
    <section ref={ref as any} className="section-padding bg-[#0b0707] overflow-hidden">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-[#fe5b25] text-[11px] font-semibold tracking-widest uppercase mb-3">
            The Problem
          </p>
          <h2 className="text-3xl md:text-5xl font-medium text-white mb-4">
            Every Day, Leads Leave Your Group.{' '}
            <span className="gradient-text">You Get Nothing.</span>
          </h2>
          <p className="text-white/40 max-w-2xl mx-auto text-lg">
            Everyone is on mute. Jobs get buried. Contractors find work through your community, and you see zero dollars for it.
          </p>
        </div>

        <div className={`grid md:grid-cols-3 gap-4 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {[
            {
              icon: <MessageCircle size={24} />,
              stat: `~${leadsCount}`,
              unit: 'leads/week',
              desc: 'Job requests flowing through your group right now',
              accent: false,
            },
            {
              icon: <DollarSign size={24} />,
              stat: `$${earningsCount}`,
              unit: 'your earnings',
              desc: 'What you currently make from all that activity',
              accent: false,
            },
            {
              icon: <TrendingUp size={24} />,
              stat: `$${potentialCount}/mo`,
              unit: 'potential',
              desc: 'What you could be earning as a Community Partner',
              accent: true,
            },
          ].map((card, i) => (
            <div
              key={i}
              className={`rounded-2xl p-6 border transition-all duration-500 ${
                card.accent
                  ? 'bg-gradient-to-br from-[#fe5b25]/10 to-[#fe5b25]/5 border-[#fe5b25]/20'
                  : 'bg-white/5 border-white/10'
              }`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                card.accent ? 'bg-[#fe5b25]/20 text-[#fe5b25]' : 'bg-white/10 text-white/60'
              }`}>
                {card.icon}
              </div>
              <div className={`text-4xl font-bold mb-1 ${card.accent ? 'text-[#fe5b25]' : 'text-white'}`}>
                {card.stat}
              </div>
              <div className={`text-sm font-medium mb-2 ${card.accent ? 'text-[#fe5b25]/70' : 'text-white/40'}`}>
                {card.unit}
              </div>
              <p className="text-white/30 text-sm">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   SECTION 3: Partner Identity
   ═══════════════════════════════════════════ */
function PartnerIdentitySection() {
  const { ref, visible } = useInView()

  const features = [
    {
      icon: <Share2 size={24} />,
      title: 'Your Branded Page',
      desc: 'A custom partner profile page at leadexpress.co/community/your-name. Share it, own it.',
    },
    {
      icon: <BadgeCheck size={24} />,
      title: 'Verified Partner Badge',
      desc: 'Stand out with a verified badge that shows your community trusts Lead Express.',
    },
    {
      icon: <LayoutDashboard size={24} />,
      title: 'Partner Dashboard',
      desc: 'Track every referral, every subscription, every dollar. Real-time analytics just for you.',
    },
  ]

  return (
    <section ref={ref as any} className="section-padding bg-cream overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-[#fe5b25] text-[11px] font-semibold tracking-widest uppercase mb-3">
            Not an Affiliate
          </p>
          <h2 className="text-3xl md:text-5xl font-medium text-dark mb-4">
            You're Not an Affiliate.{' '}
            <span className="highlight-box">You're a Community Partner.</span>
          </h2>
          <p className="text-gray-subtle/60 max-w-2xl mx-auto text-lg">
            Affiliates get a link. Partners get a platform.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={i}
              className={`bg-white/60 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_4px_40px_rgba(0,0,0,0.04)] p-6 transition-all duration-700 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-[#fe5b25]/10 flex items-center justify-center text-[#fe5b25] mb-4">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-dark mb-2">{f.title}</h3>
              <p className="text-sm text-gray-subtle/60 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Partner profile mockup card */}
        <div className={`mt-10 transition-all duration-700 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="relative mx-auto max-w-lg">
            <div className="absolute -inset-3 bg-gradient-to-br from-[#fe5b25]/15 via-orange-200/10 to-transparent rounded-3xl blur-xl" />
            <div className="relative bg-white/60 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_8px_60px_rgba(254,91,37,0.1)] p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] flex items-center justify-center text-white text-lg font-bold">
                  YG
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-dark">Yossi Goldberg</h4>
                    <BadgeCheck size={16} className="text-[#fe5b25]" />
                  </div>
                  <p className="text-xs text-dark/40">New Jersey Contractors Network</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Members', value: '2,340' },
                  { label: 'Active Leads', value: '189' },
                  { label: 'Subscribers', value: '47' },
                ].map(s => (
                  <div key={s.label} className="bg-white/70 rounded-lg border border-white/50 py-2 text-center">
                    <p className="text-sm font-bold text-dark">{s.value}</p>
                    <p className="text-[9px] text-dark/30">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   SECTION 4: Earnings Calculator
   ═══════════════════════════════════════════ */
function EarningsCalculator() {
  const { ref, visible } = useInView()
  const [groupSize, setGroupSize] = useState(500)
  const [convRate, setConvRate] = useState(15)
  const [planPrice, setPlanPrice] = useState(249)

  const subscribers = Math.round(groupSize * (convRate / 100))
  const monthlyEarnings = Math.round(subscribers * planPrice * 0.15)
  const annualEarnings = monthlyEarnings * 12
  const freeThreshold = 5
  const progressToFree = Math.min((subscribers / freeThreshold) * 100, 100)

  return (
    <section
      ref={ref as any}
      id="earnings-calculator"
      className="section-padding bg-cream-dark overflow-hidden"
    >
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-[#fe5b25] text-[11px] font-semibold tracking-widest uppercase mb-3">
            Earnings Calculator
          </p>
          <h2 className="text-3xl md:text-5xl font-medium text-dark mb-4">
            See What Your Community Is{' '}
            <span className="highlight-box">Worth</span>
          </h2>
        </div>

        <div className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-[#fe5b25]/15 via-orange-200/10 to-transparent rounded-3xl blur-2xl" />

            <div className="relative bg-white/60 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_8px_60px_rgba(254,91,37,0.12)] p-6 md:p-10">
              <div className="grid md:grid-cols-2 gap-8 md:gap-12">
                {/* Controls */}
                <div className="space-y-8">
                  {/* Group Size */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-semibold text-dark">Group Size</label>
                      <span className="bg-[#fe5b25]/10 text-[#fe5b25] text-sm font-bold px-3 py-0.5 rounded-full">
                        {groupSize.toLocaleString()} members
                      </span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={5000}
                      step={50}
                      value={groupSize}
                      onChange={e => setGroupSize(Number(e.target.value))}
                      className="w-full h-2 bg-dark/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#fe5b25] [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-[#fe5b25]/30 [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-dark/30 mt-1">
                      <span>100</span>
                      <span>5,000</span>
                    </div>
                  </div>

                  {/* Conversion Rate */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-semibold text-dark">Conversion Rate</label>
                      <span className="bg-[#fe5b25]/10 text-[#fe5b25] text-sm font-bold px-3 py-0.5 rounded-full">
                        {convRate}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={1}
                      value={convRate}
                      onChange={e => setConvRate(Number(e.target.value))}
                      className="w-full h-2 bg-dark/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#fe5b25] [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-[#fe5b25]/30 [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-dark/30 mt-1">
                      <span>0%</span>
                      <span>30%</span>
                    </div>
                  </div>

                  {/* Plan Selector */}
                  <div>
                    <label className="text-sm font-semibold text-dark mb-3 block">Average Plan</label>
                    <div className="flex gap-2">
                      {[
                        { label: 'Starter', price: 149 },
                        { label: 'Pro', price: 249 },
                        { label: 'Unlimited', price: 399 },
                      ].map(plan => (
                        <button
                          key={plan.price}
                          onClick={() => setPlanPrice(plan.price)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                            planPrice === plan.price
                              ? 'bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white shadow-lg shadow-[#fe5b25]/20'
                              : 'bg-white/70 text-dark/60 border border-dark/10 hover:border-[#fe5b25]/30'
                          }`}
                        >
                          {plan.label}
                          <br />
                          <span className="text-xs opacity-70">${plan.price}/mo</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Results */}
                <div className="flex flex-col justify-center">
                  <div className="bg-[#0b0707] rounded-2xl p-6 text-center">
                    <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">Your Monthly Earnings</p>
                    <div className="text-5xl md:text-6xl font-bold text-white mb-1">
                      ${monthlyEarnings.toLocaleString()}
                    </div>
                    <p className="text-[#fe5b25] text-sm font-medium mb-6">
                      from {subscribers} subscribers x 15% commission
                    </p>

                    <div className="bg-white/5 rounded-xl p-4 mb-5">
                      <p className="text-white/40 text-xs mb-1">Annual Projection</p>
                      <p className="text-2xl font-bold text-[#fe5b25]">
                        ${annualEarnings.toLocaleString()}/year
                      </p>
                    </div>

                    {/* Progress to free */}
                    <div>
                      <div className="flex justify-between text-xs text-white/40 mb-2">
                        <span>{Math.min(subscribers, freeThreshold)} of {freeThreshold} referrals</span>
                        <span>{subscribers >= freeThreshold ? 'FREE subscription!' : 'to FREE subscription'}</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#fe5b25] to-[#ff8a5c] rounded-full transition-all duration-500"
                          style={{ width: `${progressToFree}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-white/30 mt-2">
                        {subscribers >= freeThreshold
                          ? 'Your Lead Express subscription is completely FREE'
                          : `${freeThreshold - Math.min(subscribers, freeThreshold)} more referrals until your subscription is FREE`
                        }
                      </p>
                    </div>
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

/* ═══════════════════════════════════════════
   SECTION 5: How Partnership Works
   ═══════════════════════════════════════════ */
function HowPartnershipWorks() {
  const { ref, visible } = useInView()

  const steps = [
    {
      num: '01',
      icon: <Link2 size={24} />,
      title: 'Get Your Link',
      desc: 'Sign up as a partner and get your unique referral link and branded page.',
    },
    {
      num: '02',
      icon: <Share2 size={24} />,
      title: 'Share With Your Group',
      desc: 'Post your link in your WhatsApp group. One message is all it takes.',
    },
    {
      num: '03',
      icon: <UserPlus size={24} />,
      title: 'Members Subscribe',
      desc: 'Group members sign up through your link and start getting leads.',
    },
    {
      num: '04',
      icon: <DollarSign size={24} />,
      title: 'Earn 15% Recurring',
      desc: 'Every month they pay, you earn. For as long as they stay subscribed.',
    },
  ]

  return (
    <section ref={ref as any} id="how-it-works" className="section-padding bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-[#fe5b25] text-[11px] font-semibold tracking-widest uppercase mb-3">
            How It Works
          </p>
          <h2 className="text-3xl md:text-5xl font-medium text-dark mb-4">
            You Provide the Arena.{' '}
            <span className="highlight-box">We Provide the Technology.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-12">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`relative transition-all duration-700 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+32px)] w-[calc(100%-64px)] h-px bg-gradient-to-r from-[#fe5b25]/30 to-[#fe5b25]/10" />
              )}

              <div className="text-center">
                <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#fe5b25]/10 text-[#fe5b25] mb-4">
                  {step.icon}
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] text-white text-[10px] font-bold flex items-center justify-center">
                    {step.num}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-dark mb-2">{step.title}</h3>
                <p className="text-sm text-gray-subtle/60">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* WhatsApp message mockup */}
        <div className={`max-w-sm mx-auto transition-all duration-700 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="bg-[#ECE5DD] rounded-2xl p-4 shadow-lg">
            <div className="bg-[#dcf8c6] rounded-lg px-3 py-2 ml-auto max-w-[85%] relative shadow-sm">
              <p className="text-[13px] text-[#303030] leading-snug">
                Hey everyone! I've been using Lead Express to get job leads straight to my WhatsApp. Game changer. If you want to try it, here's my link:
              </p>
              <p className="text-[13px] text-blue-600 underline mt-1">
                leadexpress.co/join/yossi
              </p>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className="text-[10px] text-[#8c8c8c]">10:42</span>
                <svg width="16" height="10" viewBox="0 0 16 10" fill="#53bdeb">
                  <path d="M15.01 0.99l-6.36 6.36L5.99 4.7l-1.41 1.41 4.07 4.07 7.78-7.78-1.42-1.41zM10.59 7.35L4.94 1.7 3.53 3.11l5.65 5.66 1.41-1.42zM0 5.54l1.41-1.41 4.24 4.24-1.41 1.41L0 5.54z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   SECTION 6: Partner Visibility / Dashboard
   ═══════════════════════════════════════════ */
function PartnerVisibilitySection() {
  const { ref, visible } = useInView()

  return (
    <section ref={ref as any} className="section-padding bg-[#0b0707] overflow-hidden">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-[#fe5b25] text-[11px] font-semibold tracking-widest uppercase mb-3">
            Full Transparency
          </p>
          <h2 className="text-3xl md:text-5xl font-medium text-white mb-4">
            See Every Lead. Every Subscriber.{' '}
            <span className="gradient-text">Every Dollar.</span>
          </h2>
          <p className="text-white/40 max-w-2xl mx-auto text-lg">
            Your partner dashboard gives you complete visibility into your community's performance.
          </p>
        </div>

        <div className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Earnings', value: '$12,480', icon: <DollarSign size={18} />, trend: '+18%' },
                { label: 'Active Referrals', value: '47', icon: <Users size={18} />, trend: '+5' },
                { label: 'This Month', value: '$4,485', icon: <TrendingUp size={18} />, trend: '+$820' },
                { label: 'Commission Rate', value: '15%', icon: <BarChart3 size={18} />, trend: '' },
              ].map((kpi, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#fe5b25]/10 flex items-center justify-center text-[#fe5b25]">
                      {kpi.icon}
                    </div>
                    {kpi.trend && (
                      <span className="text-[10px] font-semibold text-green-400">{kpi.trend}</span>
                    )}
                  </div>
                  <p className="text-xl font-bold text-white">{kpi.value}</p>
                  <p className="text-[10px] text-white/30">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Activity feed mockup */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-xs font-semibold text-white/50 mb-3">Recent Activity</p>
              <div className="space-y-2">
                {[
                  { text: 'Mike R. subscribed to Pro plan', amount: '+$37.35', time: '2 min ago', type: 'earning' },
                  { text: 'Withdrawal processed to PayPal', amount: '-$2,500', time: '1 day ago', type: 'withdrawal' },
                  { text: 'Dan K. renewed Pro subscription', amount: '+$37.35', time: '2 days ago', type: 'earning' },
                  { text: 'Alex P. subscribed to Unlimited', amount: '+$59.85', time: '3 days ago', type: 'earning' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${item.type === 'earning' ? 'bg-green-400' : 'bg-orange-400'}`} />
                      <div>
                        <p className="text-xs text-white/70">{item.text}</p>
                        <p className="text-[10px] text-white/30">{item.time}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold ${item.type === 'earning' ? 'text-green-400' : 'text-orange-400'}`}>
                      {item.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   SECTION 7: Social Proof
   ═══════════════════════════════════════════ */
function PartnerSocialProof() {
  const { ref, visible } = useInView()

  return (
    <section ref={ref as any} className="section-padding bg-cream overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-[#fe5b25] text-[11px] font-semibold tracking-widest uppercase mb-3">
            Real Partners, Real Earnings
          </p>
          <h2 className="text-3xl md:text-5xl font-medium text-dark mb-4">
            Yossi from NJ Already Makes{' '}
            <span className="highlight-box">$2,800/Month</span>
          </h2>
        </div>

        <div className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Featured testimonial */}
          <div className="relative mb-6">
            <div className="absolute -inset-3 bg-gradient-to-br from-[#fe5b25]/15 via-orange-200/10 to-transparent rounded-3xl blur-xl" />
            <div className="relative bg-white/60 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_8px_60px_rgba(254,91,37,0.1)] p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] flex items-center justify-center text-white text-xl font-bold">
                    YG
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-lg font-bold text-dark">Yossi Goldberg</h4>
                    <BadgeCheck size={18} className="text-[#fe5b25]" />
                  </div>
                  <p className="text-sm text-dark/40 mb-4">NJ Contractors Network - 2,340 members</p>
                  <blockquote className="text-base md:text-lg text-dark/80 leading-relaxed italic">
                    "I've been running this group for 3 years. Zero income from it. Lead Express gave me a partner link, I posted it once, and within a month 23 guys signed up on Pro. That's $2,800 every single month hitting my account — and I didn't change a thing about how I run the group."
                  </blockquote>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="bg-[#fe5b25]/10 text-[#fe5b25] text-sm font-bold px-3 py-1 rounded-full">
                      $2,800/mo earnings
                    </div>
                    <div className="bg-green-50 text-green-600 text-sm font-bold px-3 py-1 rounded-full">
                      23 referrals on Pro
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Smaller testimonials */}
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                name: 'Marco Diaz',
                initials: 'MD',
                location: 'FL Contractors Hub - 870 members',
                quote: "Posted the link on Monday, had 12 signups by Friday. That's $1,800/month passive income from a single WhatsApp post.",
                earnings: '$1,800/mo',
                color: 'bg-blue-400',
              },
              {
                name: 'Dave Thompson',
                initials: 'DT',
                location: 'TX Trade Workers - 1,200 members',
                quote: "My group was just for sharing jobs. Now it generates $3,500/month for me. No extra work at all.",
                earnings: '$3,500/mo',
                color: 'bg-amber-400',
              },
              {
                name: 'Ahmed Hassan',
                initials: 'AH',
                location: 'CA Handyman Network - 650 members',
                quote: "5 referrals and my own subscription is free. The other 30 referrals earn me $4,485 every month.",
                earnings: '$4,485/mo',
                color: 'bg-green-400',
              },
            ].map((t, i) => (
              <div
                key={i}
                className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_4px_40px_rgba(0,0,0,0.04)] p-5 transition-all duration-500"
                style={{ transitionDelay: `${300 + i * 150}ms` }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-xs font-bold`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-dark">{t.name}</p>
                    <p className="text-[10px] text-dark/40">{t.location}</p>
                  </div>
                </div>
                <p className="text-sm text-dark/60 leading-relaxed italic mb-3">"{t.quote}"</p>
                <div className="bg-[#fe5b25]/10 text-[#fe5b25] text-xs font-bold px-2.5 py-1 rounded-full inline-block">
                  {t.earnings}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   SECTION 8: Become a Partner CTA
   ═══════════════════════════════════════════ */
function PartnerTiersSection() {
  const { ref, visible } = useInView()

  return (
    <section ref={ref as any} className="section-padding bg-cream-dark overflow-hidden">
      <div className="max-w-4xl mx-auto px-6">
        <div className={`relative rounded-3xl overflow-hidden transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0b0707] via-[#1a0f0a] to-[#0b0707]" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#fe5b25]/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#fe5b25]/5 rounded-full blur-[100px]" />

          <div className="relative px-8 py-14 md:px-16 md:py-20 text-center">
            {/* FREE badge */}
            <div className="inline-flex items-center gap-2 bg-[#25D366]/15 border border-[#25D366]/25 text-[#25D366] rounded-full px-5 py-2 text-sm font-bold mb-8">
              <Gift className="w-4 h-4" />
              100% Free — No Catch
            </div>

            <h2 className="text-3xl md:text-5xl lg:text-[56px] font-medium text-white mb-5 leading-tight tracking-[-0.03em]">
              Become a Partner{' '}
              <span className="gradient-text">in 5 Minutes</span>
            </h2>

            <p className="text-white/45 max-w-xl mx-auto text-lg mb-10 leading-relaxed">
              No fees. No commitments. Connect your WhatsApp group, share your link, and start earning 15% recurring commission on every contractor who subscribes.
            </p>

            {/* Speed steps */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-8 mb-10">
              {[
                { step: '1', label: 'Sign up', time: '30 sec' },
                { step: '2', label: 'Connect group', time: '2 min' },
                { step: '3', label: 'Start earning', time: 'Instant' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#fe5b25]/15 border border-[#fe5b25]/25 flex items-center justify-center text-[#fe5b25] text-sm font-bold">
                    {s.step}
                  </div>
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold">{s.label}</p>
                    <p className="text-white/30 text-xs">{s.time}</p>
                  </div>
                  {i < 2 && (
                    <ArrowRight className="w-4 h-4 text-white/15 hidden sm:block ml-2" />
                  )}
                </div>
              ))}
            </div>

            {/* CTA button */}
            <a
              href="https://app.leadexpress.co.il/partner/join"
              className="group inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white px-12 py-5 text-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_40px_rgba(254,91,37,0.35)] active:scale-95"
            >
              Start Earning Now — It's Free
              <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
            </a>

            {/* Trust signals */}
            <div className="flex items-center justify-center gap-6 mt-8 text-white/25 text-xs">
              <span className="flex items-center gap-1.5"><Shield size={13} /> No fees ever</span>
              <span className="flex items-center gap-1.5"><Clock size={13} /> 5-minute setup</span>
              <span className="flex items-center gap-1.5"><DollarSign size={13} /> 15% recurring</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   SECTION 9: FAQ
   ═══════════════════════════════════════════ */
function PartnerFAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const faqs = [
    {
      q: 'How much can I actually earn?',
      a: 'You earn 15% of every subscription payment made by someone you referred. If you refer 10 people on the $49/mo plan, that\'s $73.50/month in recurring income. And it keeps coming as long as they stay subscribed.',
    },
    {
      q: 'Do I need to do anything after sharing my link?',
      a: 'Nope. Share your link once, and the system handles everything. Tracking, attribution, payments - it\'s all automatic. You just watch the dashboard.',
    },
    {
      q: 'When do I get paid?',
      a: 'Commissions enter a 14-day pending period after each payment. Once approved, they\'re added to your balance. You can withdraw anytime once you hit $50.',
    },
    {
      q: 'Can I be a partner if I\'m already a Lead Express subscriber?',
      a: 'Absolutely! In fact, most partners are. You can use your commission to offset your own subscription, or once you hit 5 referrals, your subscription becomes completely FREE.',
    },
    {
      q: 'What if someone I referred gets a refund?',
      a: 'If a referred subscriber gets a refund, the corresponding commission is reversed (clawed back). This keeps everything fair for both sides.',
    },
    {
      q: 'Can I link multiple WhatsApp groups?',
      a: 'Yes! You can link as many groups as you want. Each group shows separate analytics in your partner dashboard so you can see which communities perform best.',
    },
    {
      q: 'Is there a limit to how much I can earn?',
      a: 'No cap. The more people you refer, the more you earn. Some of our top partners make over $1,000/month from their communities.',
    },
    {
      q: 'How is this different from a regular affiliate program?',
      a: 'You\'re not just an affiliate with a link. You get a branded partner page, verified badge, full analytics dashboard, wallet system, and you\'re featured in our community directory. You\'re a partner, not a promoter.',
    },
  ]

  return (
    <section className="section-padding bg-white overflow-hidden">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-[#fe5b25] text-[11px] font-semibold tracking-widest uppercase mb-3">
            FAQ
          </p>
          <h2 className="text-3xl md:text-5xl font-medium text-dark mb-4">
            Common Questions
          </h2>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white/60 backdrop-blur-xl rounded-xl border border-dark/5 overflow-hidden transition-all duration-300 hover:shadow-md"
            >
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-dark pr-4">{faq.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-dark/40 flex-shrink-0 transition-transform duration-300 ${
                    openIdx === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div className={`faq-answer ${openIdx === i ? 'open' : ''}`}>
                <div className="px-5 pb-4">
                  <p className="text-sm text-gray-subtle/60 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   SECTION 10: Final CTA
   ═══════════════════════════════════════════ */
function PartnerCTA() {
  return (
    <section className="section-padding bg-[#0b0707] overflow-hidden">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-[#fe5b25]/10 border border-[#fe5b25]/20 text-[#fe5b25] rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
          <Zap className="w-3.5 h-3.5" />
          Start Earning Today
        </div>

        <h2 className="text-3xl md:text-5xl lg:text-6xl font-medium text-white mb-6 leading-tight">
          Your Community.{' '}
          <span className="gradient-text">Your Revenue.</span>
        </h2>

        <p className="text-white/40 max-w-xl mx-auto text-lg mb-10 leading-relaxed">
          Your WhatsApp group is already generating value. Sign up in 5 minutes, share your link, and start earning 15% on every referral — forever.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <a
            href="https://app.leadexpress.co.il/partner/join"
            className="group inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white px-10 py-4 text-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#fe5b25]/25 active:scale-95"
          >
            <Zap size={18} />
            Start Earning Now — It's Free
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </a>
          <Link
            to="/community"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 text-white/70 px-8 py-4 text-base font-semibold transition-all duration-300 hover:border-white/40 hover:text-white hover:scale-105 active:scale-95"
          >
            View Partner Directory
          </Link>
        </div>

        <div className="flex items-center justify-center gap-6 text-white/30 text-xs">
          <span className="flex items-center gap-1"><Shield size={12} /> No fees ever</span>
          <span className="flex items-center gap-1"><Clock size={12} /> 5-minute setup</span>
          <span className="flex items-center gap-1"><CreditCard size={12} /> 15% recurring</span>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   SECTION: Our Team
   ═══════════════════════════════════════════ */
function OurTeamSection() {
  return (
    <section className="relative bg-cream-dark overflow-hidden">
      <div className="max-w-4xl mx-auto px-6 py-14 md:py-20">
        <div className="text-center mb-6 md:mb-8">
          <p className="text-[#fe5b25] text-[11px] font-semibold tracking-widest uppercase mb-2">
            The People Behind Lead Express
          </p>
          <h2 className="text-2xl md:text-[32px] md:leading-[1.2] font-medium text-dark mb-2">
            A team obsessed with helping contractors grow.
          </h2>
          <p className="text-dark/40 max-w-md mx-auto text-sm">
            We build the technology. You build the community. Together, everyone wins.
          </p>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 md:-inset-6 bg-gradient-to-br from-[#fe5b25]/20 via-orange-300/10 to-amber-200/15 rounded-3xl blur-2xl" />
          <div className="relative bg-white/60 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_8px_60px_rgba(254,91,37,0.12),0_2px_20px_rgba(0,0,0,0.06)] p-2 md:p-3">
            <div className="relative rounded-xl overflow-hidden">
              <img
                src="/ourteam.jpg"
                alt="The Lead Express team"
                className="w-full h-auto block"
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-4 py-3 md:px-6 md:py-4">
                <p className="text-white/90 text-xs md:text-sm font-medium tracking-wide">
                  Your partners in growth — from Tel Aviv to every US state.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function PartnersPage() {
  return (
    <div className="grain">
      <Navbar />
      <PartnerHero />
      <TheLossSection />
      <PartnerIdentitySection />
      <EarningsCalculator />
      <HowPartnershipWorks />
      <PartnerVisibilitySection />
      <PartnerSocialProof />
      <OurTeamSection />
      <PartnerTiersSection />
      <PartnerFAQ />
      <PartnerCTA />
      <Footer />
    </div>
  )
}
