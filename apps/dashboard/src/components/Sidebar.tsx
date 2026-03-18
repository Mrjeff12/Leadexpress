import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import {
  LayoutDashboard,
  Zap,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  Settings,
  CreditCard,
} from 'lucide-react'
import { useState, useEffect } from 'react'

type NavItem = {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

export default function Sidebar() {
  const { signOut, profile } = useAuth()
  const { t, locale } = useI18n()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const isRtl = locale === 'he'

  useEffect(() => {
    if (collapsed) document.body.classList.add('contractor-sidebar-collapsed')
    else document.body.classList.remove('contractor-sidebar-collapsed')
  }, [collapsed])

  const contractorNav: NavItem[] = [
    { label: t('nav.dashboard'), to: '/', icon: LayoutDashboard },
    { label: t('nav.leads'), to: '/leads', icon: Zap },
    { label: locale === 'he' ? 'קבוצות לסריקה' : 'Group Scan', to: '/group-scan', icon: Users },
    { label: t('nav.subcontractors'), to: '/subcontractors', icon: Users },
  ]

  const CollapseIcon = isRtl
    ? (collapsed ? ChevronLeft : ChevronRight)
    : (collapsed ? ChevronRight : ChevronLeft)

  const userName = profile?.full_name || 'Contractor'
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const isProfileActive = location.pathname === '/profile' || location.pathname === '/subscription' || location.pathname === '/telegram'

  return (
    <aside
      className={[
        'fixed top-0 h-screen z-40 flex flex-col',
        isRtl ? 'right-0' : 'left-0',
        collapsed ? 'w-[72px]' : 'w-[252px]',
      ].join(' ')}
      style={{
        background: 'hsl(0 0% 100% / 0.82)',
        backdropFilter: 'blur(24px) saturate(140%)',
        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
        borderRight: isRtl ? 'none' : '1px solid hsl(220 8% 93%)',
        borderLeft: isRtl ? '1px solid hsl(220 8% 93%)' : 'none',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 py-6 border-b border-stone-100 ${collapsed ? 'px-4 justify-center' : 'px-5'}`}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-[13px] shrink-0 shadow-sm"
          style={{
            background: 'linear-gradient(135deg, #fe5b25 0%, #e04d1c 100%)',
          }}
        >
          LE
        </div>
        {!collapsed && (
          <span className="text-[15px] font-bold tracking-tight text-stone-800">
            Lead Express
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-5 space-y-0.5">
        {!collapsed && (
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] px-3 mb-3 text-stone-300">
            {locale === 'he' ? 'ראשי' : 'Main'}
          </div>
        )}
        {contractorNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={() => {
              const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
              return [
                'sidebar-link',
                isActive ? 'active' : '',
                collapsed ? 'justify-center px-0' : '',
              ].join(' ')
            }}
            title={item.label}
          >
            <item.icon className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer — Profile + Account */}
      <div className="px-3 py-3 border-t border-stone-100 space-y-1">
        {/* Profile Card */}
        <NavLink
          to="/profile"
          className={[
            'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
            isProfileActive
              ? 'bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white shadow-md'
              : 'hover:bg-stone-50',
            collapsed ? 'justify-center px-2' : '',
          ].join(' ')}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
              isProfileActive ? 'bg-white/20 text-white' : 'bg-[#fee8df] text-[#e04d1c]'
            }`}
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-semibold truncate ${isProfileActive ? 'text-white' : 'text-stone-800'}`}>
                {userName}
              </p>
              <p className={`text-[10px] truncate ${isProfileActive ? 'text-white/60' : 'text-stone-400'}`}>
                {locale === 'he' ? 'הגדרות חשבון' : 'Account Settings'}
              </p>
            </div>
          )}
        </NavLink>

        {/* Quick links under profile */}
        {!collapsed && (
          <div className="flex gap-1 px-1">
            <NavLink
              to="/subscription"
              className={() => {
                const active = location.pathname === '/subscription'
                return `flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all ${
                  active ? 'bg-[#fff4ef] text-[#fe5b25]' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
                }`
              }}
            >
              <CreditCard className="w-3.5 h-3.5" />
              {locale === 'he' ? 'תשלומים' : 'Billing'}
            </NavLink>
            <NavLink
              to="/profile"
              className={() => {
                const active = location.pathname === '/profile'
                return `flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all ${
                  active ? 'bg-[#fff4ef] text-[#fe5b25]' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
                }`
              }}
            >
              <Settings className="w-3.5 h-3.5" />
              {locale === 'he' ? 'פרופיל' : 'Profile'}
            </NavLink>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={signOut}
          className={[
            'sidebar-link w-full hover:text-red-500 mt-1',
            collapsed ? 'justify-center px-0' : '',
          ].join(' ')}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span className="truncate">{t('nav.logout')}</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-[76px] -end-3 w-6 h-6 rounded-full flex items-center justify-center
          bg-white shadow-md hover:shadow-lg border border-stone-100
          transition-all hover:scale-110 active:scale-95"
      >
        <CollapseIcon className="w-3 h-3 text-stone-400" />
      </button>
    </aside>
  )
}
