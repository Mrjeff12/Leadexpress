import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import {
  LayoutDashboard,
  Zap,
  UserCheck,
  Users,
  Smartphone,
  MessageSquareText,
  CreditCard,
  TrendingUp,
  BarChart3,
  ClipboardList,
  Wrench,
  Map,
  MapPin,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useState, useEffect } from 'react'

type NavItem = {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

type NavCategory = {
  key: string
  label: string
  items: NavItem[]
}

export default function AdminSidebar() {
  const { profile, signOut } = useAuth()
  const { locale } = useI18n()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    business: true,
    channels: true,
    finance: true,
    reports: true,
    settings: true,
  })
  const isRtl = locale === 'he'

  useEffect(() => {
    if (collapsed) document.body.classList.add('sidebar-collapsed')
    else document.body.classList.remove('sidebar-collapsed')
  }, [collapsed])

  const he = locale === 'he'

  const categories: NavCategory[] = [
    {
      key: 'business',
      label: he ? 'ניהול עסקי' : 'Business',
      items: [
        { label: he ? 'חדר מלחמה' : 'War Room', to: '/admin/inbox', icon: MessageSquareText },
        { label: he ? 'לידים' : 'Leads', to: '/admin/leads', icon: Zap },
        { label: he ? 'פרוספקטים' : 'Prospects', to: '/admin/prospects', icon: UserCheck },
        { label: he ? 'קבלנים' : 'Contractors', to: '/admin/contractors', icon: Users },
        { label: he ? 'מפת לידים' : 'Leads Map', to: '/admin/leads-map', icon: MapPin },
      ],
    },
    {
      key: 'channels',
      label: he ? 'ערוצים' : 'Channels',
      items: [
        { label: he ? 'WhatsApp' : 'WhatsApp', to: '/admin/whatsapp', icon: Smartphone },
        { label: he ? 'קבוצות' : 'Groups', to: '/admin/groups', icon: BarChart3 },
        { label: he ? 'בקשות קבוצות' : 'Group Scan', to: '/admin/group-scan', icon: Users },
        { label: he ? 'תבניות הודעה' : 'Templates', to: '/admin/message-templates', icon: MessageSquareText },
      ],
    },
    {
      key: 'finance',
      label: he ? 'כספים' : 'Finance',
      items: [
        { label: he ? 'מנויים' : 'Subscriptions', to: '/admin/subscriptions', icon: CreditCard },
        { label: he ? 'הכנסות' : 'Revenue', to: '/admin/revenue', icon: TrendingUp },
      ],
    },
    {
      key: 'reports',
      label: he ? 'דוחות' : 'Reports',
      items: [
        { label: he ? 'אנליטיקס' : 'Analytics', to: '/admin/analytics', icon: BarChart3 },
        { label: he ? 'יומן פעילות' : 'Activity Log', to: '/admin/activity-log', icon: ClipboardList },
      ],
    },
    {
      key: 'settings',
      label: he ? 'הגדרות' : 'Settings',
      items: [
        { label: he ? 'מקצועות' : 'Professions', to: '/admin/professions', icon: Wrench },
        { label: he ? 'אזורי שירות' : 'Service Areas', to: '/admin/service-areas', icon: Map },
        { label: he ? 'מערכת' : 'System', to: '/admin/system-settings', icon: Settings },
      ],
    },
  ]

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const CollapseIcon = isRtl
    ? (collapsed ? ChevronLeft : ChevronRight)
    : (collapsed ? ChevronRight : ChevronLeft)

  return (
    <aside
      className={[
        'fixed top-0 h-screen z-40 flex flex-col',
        isRtl ? 'right-0' : 'left-0',
        collapsed ? 'w-[72px]' : 'w-[264px]',
      ].join(' ')}
      style={{
        background: 'hsl(0 0% 100% / 0.82)',
        backdropFilter: 'blur(24px) saturate(140%)',
        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
        borderRight: isRtl ? 'none' : '1px solid hsl(220 8% 93%)',
        borderLeft: isRtl ? '1px solid hsl(220 8% 93%)' : 'none',
        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '20px 0 80px rgba(0,0,0,0.02)',
  }}
>
  {/* Logo */}
  <div className={`flex items-center gap-3 py-8 border-b border-stone-50 ${collapsed ? 'px-4 justify-center' : 'px-6'}`}>
    <div
      className="w-10 h-10 rounded-[12px] flex items-center justify-center font-bold text-white text-[14px] shrink-0 shadow-lg"
      style={{
        background: 'linear-gradient(135deg, #007AFF 0%, #00C6FF 100%)',
      }}
    >
      LE
    </div>
    {!collapsed && (
      <div className="flex flex-col">
        <span className="text-[16px] font-bold tracking-tight text-black">
          Lead Express
        </span>
        <span className="text-[10px] font-bold text-stone-400 tracking-widest uppercase">
          {he ? 'פאנל ניהול' : 'Admin Panel'}
        </span>
      </div>
    )}
  </div>

  {/* Nav */}
  <nav className="flex-1 overflow-y-auto no-scrollbar px-4 py-6 space-y-1.5">
        {/* Dashboard standalone link */}
        <NavLink
          to="/admin"
          end
          className={() => {
            const isActive = location.pathname === '/admin'
            return [
              'sidebar-link',
              isActive ? 'active' : '',
              collapsed ? 'justify-center px-0' : '',
            ].join(' ')
          }}
          title={he ? 'דשבורד' : 'Dashboard'}
        >
          <LayoutDashboard className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span className="truncate">{he ? 'דשבורד' : 'Dashboard'}</span>}
        </NavLink>

        {/* Categories */}
        {categories.map((category) => {
          const isExpanded = expandedCategories[category.key] ?? true
          const CategoryChevron = isExpanded ? ChevronUp : ChevronDown

          return (
            <div key={category.key} className="pt-3">
              {/* Category header */}
              {!collapsed ? (
                <button
                  onClick={() => toggleCategory(category.key)}
                  className="flex items-center justify-between w-full px-3 mb-1 group cursor-pointer"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-300 group-hover:text-stone-400 transition-colors">
                    {category.label}
                  </span>
                  <CategoryChevron className="w-3 h-3 text-stone-300 group-hover:text-stone-400 transition-colors" />
                </button>
              ) : (
                <div className="w-full flex justify-center mb-1">
                  <div className="w-6 border-t border-stone-200" />
                </div>
              )}

              {/* Category items */}
              {(collapsed || isExpanded) && (
                <div className="space-y-0.5">
                  {category.items.map((item) => {
                    const isActive = location.pathname.startsWith(item.to)
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={() =>
                          [
                            'sidebar-link',
                            isActive ? 'active' : '',
                            collapsed ? 'justify-center px-0' : '',
                          ].join(' ')
                        }
                        title={item.label}
                      >
                        <item.icon className="w-[18px] h-[18px] shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-stone-100 space-y-2">
        {/* User info */}
        {!collapsed && profile && (
          <div className="px-3 pb-2">
            <div className="text-[13px] font-semibold text-stone-700 truncate">
              {profile.full_name ?? (he ? 'משתמש' : 'User')}
            </div>
            <div className="text-[11px] text-stone-400 capitalize">
              {profile.role === 'admin' ? (he ? 'מנהל' : 'Admin') : (he ? 'קבלן' : 'Contractor')}
            </div>
          </div>
        )}

        {/* Collapsed: show avatar placeholder */}
        {collapsed && profile && (
          <div className="flex justify-center pb-1">
            <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-[11px] font-bold text-stone-500">
              {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={signOut}
          className={[
            'sidebar-link w-full hover:text-red-500',
            collapsed ? 'justify-center px-0' : '',
          ].join(' ')}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span className="truncate">{he ? 'התנתק' : 'Log Out'}</span>}
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
