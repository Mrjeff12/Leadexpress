import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { departments } from '../../config/departmentConfig'
import { ChevronLeft, ChevronRight, LayoutDashboard, ChevronDown, Menu, X as XIcon } from 'lucide-react'

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { locale } = useI18n()
  const he = locale === 'he'
  const isRtl = he
  const location = useLocation()
  const navigate = useNavigate()

  // Track which sections are open — initialize from current route
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    departments.forEach((dept) => {
      if (location.pathname.startsWith(`/admin/${dept.basePath}`)) {
        initial[dept.id] = true
      }
    })
    return initial
  })

  // Auto-open section when navigating to it
  useEffect(() => {
    departments.forEach((dept) => {
      if (location.pathname.startsWith(`/admin/${dept.basePath}`)) {
        setOpenSections((prev) => ({ ...prev, [dept.id]: true }))
      }
    })
  }, [location.pathname])

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  useEffect(() => {
    if (collapsed) document.body.classList.add('sidebar-collapsed')
    else document.body.classList.remove('sidebar-collapsed')
  }, [collapsed])

  const toggleSection = (deptId: string) => {
    setOpenSections((prev) => ({ ...prev, [deptId]: !prev[deptId] }))
  }

  const CollapseIcon = isRtl
    ? (collapsed ? ChevronLeft : ChevronRight)
    : (collapsed ? ChevronRight : ChevronLeft)

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl bg-white/90 backdrop-blur-lg border border-stone-200 shadow-lg flex items-center justify-center"
        style={isRtl ? { left: 'auto', right: 16 } : {}}
      >
        <Menu className="w-5 h-5 text-stone-600" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40 animate-fade-in" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={[
          'fixed top-0 h-screen z-50 flex flex-col',
          isRtl ? 'right-0' : 'left-0',
          collapsed ? 'w-[72px]' : 'w-[252px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        style={{
          background: 'hsl(0 0% 100% / 0.95)',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
          borderRight: isRtl ? 'none' : '1px solid hsl(220 8% 93%)',
          borderLeft: isRtl ? '1px solid hsl(220 8% 93%)' : 'none',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
              {he ? 'ניהול' : 'Admin'}
            </div>
          )}

          {/* Dashboard */}
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              [
                'sidebar-link',
                isActive ? 'active' : '',
                collapsed ? 'justify-center px-0' : '',
              ].join(' ')
            }
            title={he ? 'דשבורד' : 'Dashboard'}
          >
            <LayoutDashboard className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span className="truncate">{he ? 'דשבורד' : 'Dashboard'}</span>}
          </NavLink>

          {/* Department sections */}
          {departments.map((dept) => {
            const Icon = dept.icon
            const deptPath = `/admin/${dept.basePath}`
            const isActive = location.pathname.startsWith(deptPath)
            const isOpen = openSections[dept.id] ?? false
            const hasTabs = dept.tabs.length > 0

            return (
              <div key={dept.id}>
                {/* Department header */}
                <button
                  onClick={() => {
                    if (collapsed || !hasTabs) {
                      navigate(deptPath)
                    } else {
                      toggleSection(dept.id)
                      if (!isActive) navigate(deptPath)
                    }
                  }}
                  className={[
                    'sidebar-link w-full',
                    isActive ? 'active' : '',
                    collapsed ? 'justify-center px-0' : '',
                  ].join(' ')}
                  title={he ? dept.nameHe : dept.nameEn}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1 text-left">{he ? dept.nameHe : dept.nameEn}</span>
                      {hasTabs && (
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          } ${isActive ? 'opacity-70' : 'opacity-30'}`}
                        />
                      )}
                    </>
                  )}
                </button>

                {/* Sub-tabs */}
                {!collapsed && isOpen && hasTabs && (
                  <div className="mt-1 mb-2 space-y-0.5" style={{ paddingInlineStart: 20 }}>
                    <div className="border-s-2 border-stone-100 ps-3 space-y-0.5">
                      {dept.tabs.map((tab) => {
                        const tabPath = tab.path
                          ? `/admin/${dept.basePath}/${tab.path}`
                          : `/admin/${dept.basePath}`
                        const tabActive = tab.path
                          ? location.pathname === tabPath
                          : location.pathname === `/admin/${dept.basePath}`

                        return (
                          <NavLink
                            key={tab.key}
                            to={tabPath}
                            end
                            className={`block px-3 py-[7px] rounded-lg text-[12px] transition-all duration-150 ${
                              tabActive
                                ? 'text-stone-900 font-semibold bg-stone-100/80'
                                : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            {he ? tab.labelHe : tab.labelEn}
                          </NavLink>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-stone-100">
          <div
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-stone-50/80 ${collapsed ? 'justify-center' : ''}`}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm">
              A
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-stone-800 truncate">Admin</p>
                <p className="text-[10px] text-stone-400">Lead Express</p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute top-[76px] -end-3 w-6 h-6 rounded-full items-center justify-center
            bg-white shadow-md hover:shadow-lg border border-stone-100
            transition-all hover:scale-110 active:scale-95"
        >
          <CollapseIcon className="w-3 h-3 text-stone-400" />
        </button>

        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden absolute top-4 w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center"
          style={isRtl ? { left: 16 } : { right: 16 }}
        >
          <XIcon className="w-4 h-4 text-stone-500" />
        </button>
      </aside>
    </>
  )
}
