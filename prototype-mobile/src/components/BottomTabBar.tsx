import { useLocation, useNavigate } from 'react-router-dom'
import { Home, MessageCircle, Zap, Briefcase, User } from 'lucide-react'

const tabs = [
  { path: '/', icon: Home, label: 'Home', badge: 0 },
  { path: '/rebeca', icon: MessageCircle, label: 'Rebeca', badge: 3 },
  { path: '/leads', icon: Zap, label: 'Leads', badge: 5 },
  { path: '/jobs', icon: Briefcase, label: 'Jobs', badge: 0 },
  { path: '/profile', icon: User, label: 'Profile', badge: 0 },
]

export default function BottomTabBar() {
  const { pathname } = useLocation()
  const nav = useNavigate()
  return (
    <nav className="float-nav max-w-[390px]">
      {tabs.map(t => {
        const on = pathname === t.path
        const I = t.icon
        return (
          <button key={t.path} onClick={() => nav(t.path)} className={`nav-btn flex-col gap-0.5 ${on ? 'active' : ''}`}
            style={{ width: 46, height: 46 }}>
            <div className="relative">
              <I size={18} strokeWidth={on ? 2.2 : 1.5} className={on ? 'text-[var(--dark)]' : 'text-white/50'} />
              {t.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] bg-[var(--brand)] text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 border-[1.5px] border-[var(--dark)]">
                  {t.badge}
                </span>
              )}
            </div>
            <span className={`text-[9px] font-medium ${on ? 'text-[var(--dark)]' : 'text-white/35'}`}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
