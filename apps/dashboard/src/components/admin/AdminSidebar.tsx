import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { departments } from '../../config/departmentConfig'
import { ChevronLeft, ChevronRight, LayoutDashboard, ChevronDown } from 'lucide-react'

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { locale } = useI18n()
  const he = locale === 'he'
  const isRtl = he
  const location = useLocation()

  const width = collapsed ? 72 : 252

  return (
    <aside
      className="h-full shrink-0 flex flex-col overflow-hidden relative"
      style={{
        width,
        minWidth: width,
        background: 'rgba(255, 255, 255, 0.82)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: isRtl ? 'none' : '1px solid hsl(220 8% 93%)',
        borderLeft: isRtl ? '1px solid hsl(220 8% 93%)' : 'none',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: "'Plus Jakarta Sans', 'Outfit', sans-serif",
      }}
    >
      {/* ─── Collapse toggle ─── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-4 z-10 w-6 h-6 rounded-full bg-white border border-stone-200 flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 hover:scale-110"
        style={{
          [isRtl ? 'left' : 'right']: -12,
        }}
      >
        {collapsed
          ? (isRtl ? <ChevronLeft className="w-3 h-3 text-stone-500" /> : <ChevronRight className="w-3 h-3 text-stone-500" />)
          : (isRtl ? <ChevronRight className="w-3 h-3 text-stone-500" /> : <ChevronLeft className="w-3 h-3 text-stone-500" />)
        }
      </button>

      {/* ─── Logo ─── */}
      <div
        className="flex items-center gap-2.5 shrink-0"
        style={{
          padding: collapsed ? '24px 0' : '24px 20px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid hsl(220 8% 93%)',
        }}
      >
        <img src="/icon.png" alt="Lead Express" className="w-8 h-8 rounded-xl shrink-0" />
        {!collapsed && (
          <div className="flex flex-col leading-none overflow-hidden">
            <span className="text-[13px] font-extrabold text-stone-800 tracking-tight">Lead Express</span>
            <span className="text-[9px] text-stone-400 uppercase tracking-[0.15em]">Admin Panel</span>
          </div>
        )}
      </div>

      {/* ─── Navigation ─── */}
      <div className="flex-1 overflow-y-auto py-4 px-3" style={{ scrollbarWidth: 'thin' }}>
        {/* Dashboard home */}
        <NavLink
          to="/admin"
          end
          className={({ isActive }) =>
            `sidebar-link flex items-center gap-3 px-4 py-3 rounded-[14px] text-[14px] font-medium mb-1 transition-all duration-200 ${
              isActive
                ? 'text-white font-semibold'
                : 'text-[#666] hover:text-[#000] hover:bg-black/[0.03]'
            }`
          }
          style={({ isActive }) =>
            isActive
              ? {
                  background: 'linear-gradient(135deg, #fe5b25, #e04d1c)',
                  boxShadow: '0 8px 20px rgba(254, 91, 37, 0.25)',
                }
              : {}
          }
          title={he ? 'דשבורד' : 'Dashboard'}
        >
          <LayoutDashboard className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span className="truncate">{he ? 'דשבורד' : 'Dashboard'}</span>}
        </NavLink>

        {/* Separator */}
        <div className="h-px bg-stone-100 my-3 mx-2" />

        {/* Department sections */}
        {departments.map((dept) => {
          const Icon = dept.icon
          const deptPath = `/admin/${dept.basePath}`
          const isActive = location.pathname.startsWith(`/admin/${dept.basePath}`)

          return (
            <div key={dept.id} className="mb-0.5">
              {/* Department link */}
              <NavLink
                to={deptPath}
                className={`sidebar-link flex items-center gap-3 px-4 py-3 rounded-[14px] text-[14px] font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-[#666] hover:text-[#000] hover:bg-black/[0.03]'
                }`}
                style={
                  isActive
                    ? {
                        background: `linear-gradient(135deg, ${dept.color}, ${dept.color}dd)`,
                        boxShadow: `0 8px 20px ${dept.color}40`,
                      }
                    : {}
                }
                title={he ? dept.nameHe : dept.nameEn}
              >
                <Icon
                  className="w-[18px] h-[18px] shrink-0 transition-transform duration-200"
                  style={!isActive ? { color: dept.color } : {}}
                />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{he ? dept.nameHe : dept.nameEn}</span>
                    {dept.tabs.length > 0 && (
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isActive ? 'rotate-180 opacity-70' : 'opacity-30'
                        }`}
                      />
                    )}
                  </>
                )}
              </NavLink>

              {/* Sub-tabs (expanded + active only) */}
              {!collapsed && isActive && dept.tabs.length > 0 && (
                <div className="mt-1 mb-2 ml-5 pl-3 border-l-2 border-stone-100">
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
              )}
            </div>
          )
        })}
      </div>

      {/* ─── Footer ─── */}
      <div
        className="shrink-0 px-3 py-4"
        style={{ borderTop: '1px solid hsl(220 8% 93%)' }}
      >
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-stone-50/80"
          style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-[12px] font-bold shrink-0 shadow-sm">
            A
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none overflow-hidden">
              <span className="text-[12px] font-semibold text-stone-700 truncate">Admin</span>
              <span className="text-[10px] text-stone-400">Lead Express</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
