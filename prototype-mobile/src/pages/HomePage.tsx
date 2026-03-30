import { ChevronRight, Zap, Flame, Plus, Star, Clock, TrendingUp, MapPin, Menu, Bell, Scan } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function HomePage({ onMenuOpen }: { onMenuOpen: () => void }) {
  const nav = useNavigate()

  return (
    <div className="page-content">
      <div className="px-5 pt-3 pb-6">

        {/* Header - clean single row */}
        <div className="flex items-center justify-between mb-5 anim-up">
          <div className="flex items-center gap-2.5">
            <button onClick={onMenuOpen} className="w-10 h-10 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
              <Menu size={18} strokeWidth={1.8} />
            </button>
            <p className="text-[14px] font-bold tracking-tight">Master<span className="text-[var(--brand)]">leadflow</span></p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => nav('/notifications')} className="w-10 h-10 rounded-full bg-[var(--gray-50)] flex items-center justify-center press relative">
              <Bell size={17} strokeWidth={1.8} />
              <span className="absolute top-0.5 right-0.5 w-[15px] h-[15px] bg-[var(--brand)] text-white text-[8px] font-bold rounded-full flex items-center justify-center">2</span>
            </button>
            <div className="relative" onClick={() => nav('/profile')}>
              <div className="w-10 h-10 rounded-full bg-[var(--dark)] flex items-center justify-center text-white text-[12px] font-bold press">MJ</div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
            </div>
          </div>
        </div>

        {/* Greeting - compact */}
        <div className="mb-4 anim-up">
          <p className="text-[12px] text-muted">{getGreeting()}, Mike</p>
          <h1 className="text-[22px] font-bold tracking-tight mt-0.5"><span className="text-[var(--brand)]">12 new leads</span> waiting</h1>
        </div>

        {/* Urgent lead card */}
        <div className="card-dark p-4 mb-4 anim-up relative overflow-hidden" onClick={() => nav('/lead')}>
          <div className="absolute top-0 right-0 w-20 h-20 bg-[var(--brand)] rounded-full opacity-[0.1] -translate-y-6 translate-x-6" />

          <div className="flex items-center justify-between mb-2 relative">
            <div className="flex items-center gap-1.5 bg-[var(--brand)]/15 px-2 py-0.5 rounded-full">
              <Flame size={10} className="text-[var(--brand)]" />
              <span className="text-[9px] text-[var(--brand)] font-bold">URGENT · 2.3 mi</span>
            </div>
            <span className="text-[10px] text-white/25">5m</span>
          </div>

          <div className="flex items-center justify-between relative">
            <div>
              <h2 className="text-[16px] font-bold text-white">Lockout Service</h2>
              <p className="text-[11px] text-white/35">Sarah M. · Miami, FL</p>
            </div>
            <div className="text-right">
              <span className="text-[18px] font-bold text-green-400">$80-120</span>
            </div>
          </div>

          <button className="w-full mt-3 bg-[var(--brand)] text-white py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 press">
            <Zap size={14} /> Claim This Lead
          </button>
        </div>

        {/* KPIs + Schedule row */}
        <div className="flex gap-2 mb-4 anim-up">
          {/* KPIs compact */}
          <div className="flex-1 flex gap-2">
            <div className="card flex-1 p-3 text-center">
              <p className="text-[18px] font-bold tracking-tight">12</p>
              <div className="flex items-center justify-center gap-0.5">
                <TrendingUp size={8} className="text-green-500" />
                <span className="text-[8px] text-green-500 font-semibold">+28%</span>
              </div>
              <p className="text-[8px] text-faded mt-0.5">Leads</p>
            </div>
            <div className="card flex-1 p-3 text-center">
              <p className="text-[18px] font-bold tracking-tight">4.8</p>
              <Star size={8} className="text-amber-400 mx-auto" fill="#fbbf24" />
              <p className="text-[8px] text-faded mt-0.5">Rating</p>
            </div>
          </div>

          {/* Schedule mini */}
          <div className="flex-1 card p-3">
            <p className="text-[8px] text-faded font-medium mb-1.5">TODAY · 2 JOBS</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-0.5 h-5 rounded-full bg-[var(--brand)]" />
                <div>
                  <p className="text-[10px] font-semibold leading-tight">Lock Rekey</p>
                  <p className="text-[8px] text-faded">10:00 · Ft. Lauderdale</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-0.5 h-5 rounded-full bg-[var(--gray-200)]" />
                <div>
                  <p className="text-[10px] font-semibold leading-tight">Smart Lock</p>
                  <p className="text-[8px] text-faded">2:00 · Boca Raton</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Publish + Profile row */}
        <div className="flex gap-2 mb-5 anim-up">
          <button onClick={() => nav('/rebeca')} className="flex-1 bg-[var(--brand)] text-white py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 press">
            <Plus size={15} strokeWidth={2.5} /> Publish Job
          </button>
          <button onClick={() => nav('/profile')} className="card flex items-center justify-center gap-1.5 px-4 py-3 press">
            <div className="relative w-6 h-6">
              <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
                <circle cx="12" cy="12" r="9" fill="none" strokeWidth="2" className="ring-track" />
                <circle cx="12" cy="12" r="9" fill="none" strokeWidth="2" className="ring-fill" strokeLinecap="round"
                  strokeDasharray={`${2*Math.PI*9}`} strokeDashoffset={`${2*Math.PI*9*0.28}`} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-[var(--brand)]">72%</span>
            </div>
            <span className="text-[12px] font-semibold">Profile</span>
          </button>
        </div>

        {/* Notification banner - if not enabled */}
        <div className="card p-3.5 mb-4 flex items-center gap-3 bg-amber-50 border border-amber-100 anim-up press" style={{ borderRadius: 16 }}>
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Bell size={16} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-[12px] font-semibold text-amber-800">Enable notifications</p>
            <p className="text-[10px] text-amber-600">Don't miss new leads & job updates</p>
          </div>
          <button className="bg-amber-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg press">Enable</button>
        </div>

        {/* Profile completion - prominent */}
        <div className="card p-4 mb-4 anim-up press" onClick={() => nav('/profile')}>
          <div className="flex items-center gap-3.5 mb-3">
            <div className="relative w-12 h-12 flex-shrink-0">
              <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
                <circle cx="24" cy="24" r="20" fill="none" strokeWidth="3" className="ring-track" />
                <circle cx="24" cy="24" r="20" fill="none" strokeWidth="3" className="ring-fill" strokeLinecap="round"
                  strokeDasharray={`${2*Math.PI*20}`} strokeDashoffset={`${2*Math.PI*20*0.28}`} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold text-[var(--brand)]">72%</span>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold">Complete your profile</p>
              <p className="text-[10px] text-muted">Verified contractors get <strong className="text-[var(--brand)]">+30% more leads</strong></p>
            </div>
            <ChevronRight size={14} className="text-faded" />
          </div>
          <div className="flex gap-1.5">
            <span className="text-[9px] bg-[var(--brand-light)] text-[var(--brand)] px-2 py-0.5 rounded-full font-medium">+ Verify ID</span>
            <span className="text-[9px] bg-[var(--gray-100)] text-muted px-2 py-0.5 rounded-full font-medium">+ License</span>
          </div>
        </div>

        {/* My Professions - analytics */}
        <div className="anim-up">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[16px] font-bold tracking-tight">My Services</h3>
            <button onClick={() => nav('/professions')} className="text-[11px] text-[var(--brand)] font-semibold flex items-center press">
              Edit <ChevronRight size={13} />
            </button>
          </div>

          <div className="space-y-1.5">
            {[
              { name: 'Locksmith', leads: 8, trend: '+32%', hot: true },
              { name: 'Lock Rekey', leads: 3, trend: '+12%', hot: false },
              { name: 'Smart Locks', leads: 1, trend: '-5%', hot: false },
            ].map((p, i) => (
              <div key={i} className="card px-3.5 py-3 flex items-center gap-3 press">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  p.hot ? 'bg-[var(--brand-light)]' : 'bg-[var(--gray-100)]'
                }`}>
                  <Zap size={13} className={p.hot ? 'text-[var(--brand)]' : 'text-muted'} />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-semibold">{p.name}</p>
                  <p className="text-[9px] text-muted">{p.leads} leads this week</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold flex items-center gap-0.5 ${
                    p.trend.startsWith('+') ? 'text-green-600' : 'text-red-400'
                  }`}>
                    <TrendingUp size={9} className={p.trend.startsWith('+') ? '' : 'rotate-180'} />
                    {p.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* My Areas */}
        <div className="mt-4 anim-up">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[16px] font-bold tracking-tight">My Areas</h3>
            <button onClick={() => nav('/areas')} className="text-[11px] text-[var(--brand)] font-semibold flex items-center press">
              Edit <ChevronRight size={13} />
            </button>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {[
              { name: 'Miami', zip: '33130', leads: 6 },
              { name: 'Ft. Lauderdale', zip: '33301', leads: 3 },
              { name: 'Boca Raton', zip: '33431', leads: 2 },
              { name: 'Miami Downtown', zip: '33101', leads: 1 },
            ].map((a, i) => (
              <div key={i} className="card px-3 py-2 flex items-center gap-2 press">
                <MapPin size={10} className="text-[var(--brand)]" />
                <span className="text-[11px] font-medium">{a.name}</span>
                <span className="text-[9px] text-green-600 font-semibold">{a.leads}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
