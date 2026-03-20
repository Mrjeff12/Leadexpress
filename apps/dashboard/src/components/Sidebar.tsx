import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard,
  Zap,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  Briefcase,
  Settings,
  CreditCard,
  Lock,
  Handshake,
  UserPlus,
  MessageSquare,
  Wallet,
  Share2,
  ArrowLeftRight,
  MessageSquarePlus,
  FileText,
  Plus,
  ChevronDown,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

type NavItem = {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
  locked?: boolean
}

export default function Sidebar() {
  const { signOut, profile, effectiveUserId, activeRole, switchRole, isPublisher, addPublisherRole } = useAuth()
  const { t, locale } = useI18n()
  const { canManageSubs } = useSubscriptionAccess()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [isPartner, setIsPartner] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const roleRef = useRef<HTMLDivElement>(null)
  const isRtl = locale === 'he'
  const inPartnerView = location.pathname.startsWith('/partner')

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) setRoleOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Check if user is an active partner
  useEffect(() => {
    if (!effectiveUserId) return
    supabase
      .from('community_partners')
      .select('status')
      .eq('user_id', effectiveUserId)
      .maybeSingle()
      .then(({ data }) => {
        setIsPartner(data?.status === 'active')
      })
  }, [effectiveUserId])

  useEffect(() => {
    if (collapsed) document.body.classList.add('contractor-sidebar-collapsed')
    else document.body.classList.remove('contractor-sidebar-collapsed')
  }, [collapsed])

  const contractorNav: NavItem[] = [
    { label: t('nav.dashboard'), to: '/', icon: LayoutDashboard },
    { label: t('nav.leads'), to: '/leads', icon: Zap },
    { label: locale === 'he' ? 'קבוצות לסריקה' : 'Group Scan', to: '/group-scan', icon: Users },
    { label: t('nav.subcontractors'), to: '/subcontractors', icon: Users, locked: !canManageSubs },
    { label: locale === 'he' ? 'עבודות' : 'Jobs', to: '/jobs', icon: Briefcase, locked: !canManageSubs },
  ]

  const publisherNav: NavItem[] = [
    { label: locale === 'he' ? 'פרסם עבודה' : 'Publish Job', to: '/publish', icon: MessageSquarePlus },
    { label: locale === 'he' ? 'העבודות שלי' : 'My Published', to: '/my-published', icon: FileText },
  ]

  const partnerNav: NavItem[] = [
    { label: locale === 'he' ? 'דף הבית' : 'Home', to: '/partner', icon: LayoutDashboard },
    { label: locale === 'he' ? 'הקבוצות שלי' : 'My Groups', to: '/partner/communities', icon: Users },
    { label: locale === 'he' ? 'הפניות' : 'Referrals', to: '/partner/referrals', icon: UserPlus },
    { label: locale === 'he' ? 'ארנק' : 'Wallet', to: '/partner/wallet', icon: Wallet },
  ]

  const activeNav = inPartnerView ? partnerNav : activeRole === 'publisher' ? publisherNav : contractorNav

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
        <img src="/icon.png" alt="Lead Express" className="w-9 h-9 rounded-xl shrink-0 shadow-sm" />
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
            {inPartnerView
              ? (locale === 'he' ? 'שותף' : 'Partner')
              : activeRole === 'publisher'
                ? (locale === 'he' ? 'מפרסם' : 'Publisher')
                : (locale === 'he' ? 'ראשי' : 'Main')}
          </div>
        )}
        {activeNav.map((item) => (
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
                item.locked ? 'opacity-70' : '',
              ].join(' ')
            }}
            title={item.label}
          >
            <item.icon className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && (
              <span className="truncate flex items-center gap-1.5">
                {item.label}
                {item.locked && <Lock className="w-3 h-3 text-stone-400" />}
              </span>
            )}
          </NavLink>
        ))}

        {/* Role Dropdown */}
        {!collapsed && (
          <div className="mt-4 mb-2 px-1 relative" ref={roleRef}>
            <button
              onClick={() => setRoleOpen(!roleOpen)}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-[11px] font-semibold
                         bg-gradient-to-r from-stone-50 to-stone-100 hover:from-stone-100 hover:to-stone-150
                         border border-stone-200 transition-all text-stone-600"
            >
              {inPartnerView
                ? <><Handshake className="w-3.5 h-3.5 text-[#fe5b25]" />{locale === 'he' ? 'שותף' : 'Partner'}</>
                : activeRole === 'publisher'
                  ? <><FileText className="w-3.5 h-3.5 text-emerald-500" />{locale === 'he' ? 'מפרסם' : 'Publisher'}</>
                  : <><Zap className="w-3.5 h-3.5 text-[#fe5b25]" />{locale === 'he' ? 'קבלן' : 'Contractor'}</>
              }
              <ChevronDown className={`w-3.5 h-3.5 text-stone-400 ms-auto transition-transform ${roleOpen ? 'rotate-180' : ''}`} />
            </button>

            {roleOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl border border-stone-200 shadow-lg z-50 overflow-hidden">
                {/* Contractor */}
                {!(activeRole === 'contractor' && !inPartnerView) && (
                  <button
                    onClick={() => { setRoleOpen(false); if (inPartnerView) navigate('/'); else switchRole('contractor'); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5 text-[#fe5b25]" />
                    {locale === 'he' ? 'קבלן' : 'Contractor'}
                  </button>
                )}

                {/* Publisher */}
                {isPublisher && !(activeRole === 'publisher' && !inPartnerView) && (
                  <button
                    onClick={() => { setRoleOpen(false); if (inPartnerView) { switchRole('publisher'); navigate('/'); } else switchRole('publisher'); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    {locale === 'he' ? 'מפרסם' : 'Publisher'}
                  </button>
                )}

                {/* Partner */}
                {isPartner && !inPartnerView && (
                  <button
                    onClick={() => { setRoleOpen(false); navigate('/partner'); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    <Handshake className="w-3.5 h-3.5 text-[#fe5b25]" />
                    {locale === 'he' ? 'שותף' : 'Partner'}
                  </button>
                )}

                {/* Become options */}
                {!isPublisher && (
                  <button
                    onClick={() => { setRoleOpen(false); addPublisherRole(); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[11px] font-medium text-emerald-500 hover:bg-emerald-50 transition-colors border-t border-stone-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {locale === 'he' ? 'הפוך למפרסם' : 'Become a Publisher'}
                  </button>
                )}
                {!isPartner && (
                  <button
                    onClick={() => { setRoleOpen(false); navigate('/partner/join'); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[11px] font-medium text-[#fe5b25] hover:bg-[#fff4ef] transition-colors border-t border-stone-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {locale === 'he' ? 'הפוך לשותף' : 'Become a Partner'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
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
            {!inPartnerView && (
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
            )}
            <NavLink
              to={inPartnerView ? '/partner/settings' : '/profile'}
              className={() => {
                const active = inPartnerView ? location.pathname === '/partner/settings' : location.pathname === '/profile'
                return `flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all ${
                  active ? 'bg-[#fff4ef] text-[#fe5b25]' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
                }`
              }}
            >
              <Settings className="w-3.5 h-3.5" />
              {locale === 'he' ? (inPartnerView ? 'הגדרות' : 'פרופיל') : (inPartnerView ? 'Settings' : 'Profile')}
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
