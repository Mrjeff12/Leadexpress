# Admin Dashboard Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate admin and contractor experiences completely, with a new grouped admin sidebar and 8 new admin pages.

**Architecture:** Role-based layout routing — admin users get `AdminLayout` + `AdminSidebar`, contractors keep existing `AppShell` + `Sidebar`. New pages for finance, reports, settings, and channel management.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Lucide icons, react-router-dom v6

---

## Task 1: Create AdminSidebar Component

**Files:**
- Create: `apps/dashboard/src/components/AdminSidebar.tsx`

**Step 1: Create the AdminSidebar component with grouped navigation**

```tsx
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { useState } from 'react'
import {
  LayoutDashboard,
  Zap,
  UserCheck,
  Users,
  Smartphone,
  Radio,
  MessageSquareText,
  CreditCard,
  TrendingUp,
  BarChart3,
  ClipboardList,
  Wrench,
  Map,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

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
  const { t, locale } = useI18n()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const isRtl = locale === 'he'

  const categories: NavCategory[] = [
    {
      key: 'business',
      label: locale === 'he' ? 'ניהול עסקי' : 'Business',
      items: [
        { label: locale === 'he' ? 'לידים' : 'Leads', to: '/admin/leads', icon: Zap },
        { label: locale === 'he' ? 'פרוספקטים' : 'Prospects', to: '/admin/prospects', icon: UserCheck },
        { label: locale === 'he' ? 'קבלנים' : 'Contractors', to: '/admin/contractors', icon: Users },
      ],
    },
    {
      key: 'channels',
      label: locale === 'he' ? 'ערוצים' : 'Channels',
      items: [
        { label: 'WhatsApp', to: '/admin/whatsapp', icon: Smartphone },
        { label: locale === 'he' ? 'קבוצות' : 'Groups', to: '/admin/groups', icon: Radio },
        { label: locale === 'he' ? 'תבניות הודעות' : 'Templates', to: '/admin/message-templates', icon: MessageSquareText },
      ],
    },
    {
      key: 'finance',
      label: locale === 'he' ? 'כספים' : 'Finance',
      items: [
        { label: locale === 'he' ? 'מנויים וחיובים' : 'Subscriptions', to: '/admin/subscriptions', icon: CreditCard },
        { label: locale === 'he' ? 'הכנסות' : 'Revenue', to: '/admin/revenue', icon: TrendingUp },
      ],
    },
    {
      key: 'reports',
      label: locale === 'he' ? 'דוחות' : 'Reports',
      items: [
        { label: locale === 'he' ? 'אנליטיקס' : 'Analytics', to: '/admin/analytics', icon: BarChart3 },
        { label: locale === 'he' ? 'לוג פעילות' : 'Activity Log', to: '/admin/activity-log', icon: ClipboardList },
      ],
    },
    {
      key: 'settings',
      label: locale === 'he' ? 'הגדרות' : 'Settings',
      items: [
        { label: locale === 'he' ? 'מקצועות' : 'Professions', to: '/admin/professions', icon: Wrench },
        { label: locale === 'he' ? 'אזורי שירות' : 'Service Areas', to: '/admin/service-areas', icon: Map },
        { label: locale === 'he' ? 'מערכת' : 'System', to: '/admin/system-settings', icon: Settings },
      ],
    },
  ]

  const toggleCategory = (key: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const CollapseIcon = isRtl
    ? (collapsed ? ChevronLeft : ChevronRight)
    : (collapsed ? ChevronRight : ChevronLeft)

  const isActive = (to: string) => {
    if (to === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(to)
  }

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
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 py-6 border-b border-stone-100 ${collapsed ? 'px-4 justify-center' : 'px-5'}`}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-[13px] shrink-0 shadow-sm"
          style={{
            background: 'linear-gradient(135deg, hsl(155 44% 30%) 0%, hsl(155 50% 38%) 100%)',
          }}
        >
          LE
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-[15px] font-bold tracking-tight text-stone-800">
              Lead Express
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
              {locale === 'he' ? 'פאנל ניהול' : 'Admin Panel'}
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-0.5">
        {/* Dashboard - standalone */}
        <NavLink
          to="/admin"
          end
          className={() => [
            'sidebar-link',
            isActive('/admin') && location.pathname === '/admin' ? 'active' : '',
            collapsed ? 'justify-center px-0' : '',
          ].join(' ')}
          title={locale === 'he' ? 'דשבורד' : 'Dashboard'}
        >
          <LayoutDashboard className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span className="truncate">{locale === 'he' ? 'דשבורד' : 'Dashboard'}</span>}
        </NavLink>

        {/* Grouped categories */}
        {categories.map((cat) => (
          <div key={cat.key} className="pt-4">
            {!collapsed && (
              <button
                onClick={() => toggleCategory(cat.key)}
                className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-[0.12em] px-3 mb-2 text-stone-400 hover:text-stone-500 transition-colors"
              >
                <span>{cat.label}</span>
                {collapsedCategories.has(cat.key)
                  ? <ChevronDown className="w-3 h-3" />
                  : <ChevronUp className="w-3 h-3" />
                }
              </button>
            )}
            {!collapsedCategories.has(cat.key) && cat.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={() => [
                  'sidebar-link',
                  isActive(item.to) ? 'active' : '',
                  collapsed ? 'justify-center px-0' : '',
                ].join(' ')}
                title={item.label}
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer - user info + logout */}
      <div className="px-3 py-4 border-t border-stone-100 space-y-0.5">
        {!collapsed && profile && (
          <div className="px-3 pb-2">
            <p className="text-sm font-medium text-stone-700 truncate">{profile.full_name}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
              {locale === 'he' ? 'מנהל' : 'Admin'}
            </p>
          </div>
        )}
        <button
          onClick={signOut}
          className={[
            'sidebar-link w-full hover:text-red-500',
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
```

**Step 2: Verify no TypeScript errors**

Run: `cd apps/dashboard && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to AdminSidebar

**Step 3: Commit**

```bash
git add apps/dashboard/src/components/AdminSidebar.tsx
git commit -m "feat: add AdminSidebar component with grouped navigation categories"
```

---

## Task 2: Create AdminLayout and Update App.tsx Routing

**Files:**
- Create: `apps/dashboard/src/components/AdminLayout.tsx`
- Modify: `apps/dashboard/src/App.tsx`

**Step 1: Create AdminLayout component**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'
import AdminDashboard from '../pages/AdminDashboard'
import AdminContractors from '../pages/AdminContractors'
import AdminGroups from '../pages/AdminGroups'
import AdminWhatsApp from '../pages/AdminWhatsApp'
import AdminLeads from '../pages/AdminLeads'
import AdminProspects from '../pages/AdminProspects'
import ProspectDetail from '../pages/ProspectDetail'
import MessageTemplates from '../pages/admin/MessageTemplates'
import Subscriptions from '../pages/admin/Subscriptions'
import Revenue from '../pages/admin/Revenue'
import Analytics from '../pages/admin/Analytics'
import ActivityLog from '../pages/admin/ActivityLog'
import Professions from '../pages/admin/Professions'
import ServiceAreas from '../pages/admin/ServiceAreas'
import SystemSettings from '../pages/admin/SystemSettings'

export default function AdminLayout() {
  return (
    <div className="min-h-screen">
      <div className="le-bg" />
      <div className="le-grain" />
      <AdminSidebar />
      <main
        className="relative transition-all duration-300"
        style={{ paddingInlineStart: 264 }}
      >
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/leads" element={<AdminLeads />} />
            <Route path="/prospects" element={<AdminProspects />} />
            <Route path="/prospects/:id" element={<ProspectDetail />} />
            <Route path="/contractors" element={<AdminContractors />} />
            <Route path="/whatsapp" element={<AdminWhatsApp />} />
            <Route path="/groups" element={<AdminGroups />} />
            <Route path="/message-templates" element={<MessageTemplates />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/revenue" element={<Revenue />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/activity-log" element={<ActivityLog />} />
            <Route path="/professions" element={<Professions />} />
            <Route path="/service-areas" element={<ServiceAreas />} />
            <Route path="/system-settings" element={<SystemSettings />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
```

**Step 2: Update App.tsx to route by role**

Replace the `AppShell` function and routing in `App.tsx`:

- Keep `AppShell` for contractors only (remove admin routes from it)
- Add `AdminLayout` import
- Update the main `<Routes>` to split by role:

```tsx
// In the main App Routes:
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/admin/*" element={
    <RequireAuth>
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    </RequireAuth>
  } />
  <Route path="/*" element={<RequireAuth><AppShell /></RequireAuth>} />
</Routes>
```

- In `AppShell`, remove all `/admin/*` routes
- In `AppShell`, add a redirect: if user isAdmin and hits `/`, redirect to `/admin`

**Step 3: Verify routing works**

Run: `cd apps/dashboard && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (aside from missing new page files, which we create next)

**Step 4: Commit**

```bash
git add apps/dashboard/src/components/AdminLayout.tsx apps/dashboard/src/App.tsx
git commit -m "feat: split routing - AdminLayout for admins, AppShell for contractors"
```

---

## Task 3: Create Stub Pages for All New Admin Routes

**Files:**
- Create: `apps/dashboard/src/pages/admin/MessageTemplates.tsx`
- Create: `apps/dashboard/src/pages/admin/Subscriptions.tsx`
- Create: `apps/dashboard/src/pages/admin/Revenue.tsx`
- Create: `apps/dashboard/src/pages/admin/Analytics.tsx`
- Create: `apps/dashboard/src/pages/admin/ActivityLog.tsx`
- Create: `apps/dashboard/src/pages/admin/Professions.tsx`
- Create: `apps/dashboard/src/pages/admin/ServiceAreas.tsx`
- Create: `apps/dashboard/src/pages/admin/SystemSettings.tsx`

**Step 1: Create all 8 stub pages**

Each stub follows the same pattern (using MessageTemplates as example):

```tsx
import { useI18n } from '../../lib/i18n'
import { MessageSquareText } from 'lucide-react'

export default function MessageTemplates() {
  const { locale } = useI18n()

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
          {locale === 'he' ? 'תבניות הודעות' : 'Message Templates'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
          {locale === 'he' ? 'ניהול תבניות הודעות WhatsApp וטלגרם' : 'Manage WhatsApp & Telegram message templates'}
        </p>
      </header>

      <div className="glass-panel p-12 flex flex-col items-center justify-center text-center">
        <MessageSquareText className="h-12 w-12 mb-4" style={{ color: '#b0b8b1' }} />
        <h2 className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
          {locale === 'he' ? 'בקרוב' : 'Coming Soon'}
        </h2>
        <p className="text-sm mt-1" style={{ color: '#6b7c6e' }}>
          {locale === 'he' ? 'הדף הזה בפיתוח' : 'This page is under development'}
        </p>
      </div>
    </div>
  )
}
```

Create all 8 with appropriate titles, icons, and descriptions:
- `MessageTemplates` - MessageSquareText icon - "Message Templates" / "תבניות הודעות"
- `Subscriptions` - CreditCard icon - "Subscriptions & Billing" / "מנויים וחיובים"
- `Revenue` - TrendingUp icon - "Revenue" / "הכנסות"
- `Analytics` - BarChart3 icon - "Analytics" / "אנליטיקס"
- `ActivityLog` - ClipboardList icon - "Activity Log" / "לוג פעילות"
- `Professions` - Wrench icon - "Professions" / "מקצועות"
- `ServiceAreas` - Map icon - "Service Areas" / "אזורי שירות"
- `SystemSettings` - Settings icon - "System Settings" / "הגדרות מערכת"

**Step 2: Verify TypeScript compiles**

Run: `cd apps/dashboard && npx tsc --noEmit 2>&1 | head -20`
Expected: Clean compilation

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/admin/
git commit -m "feat: add 8 new admin page stubs (templates, finance, reports, settings)"
```

---

## Task 4: Update i18n Translations

**Files:**
- Modify: `apps/dashboard/src/lib/i18n.ts`

**Step 1: Add all new translation keys**

Add to both `en` and `he` objects:

```typescript
// Navigation - Admin categories
'nav.admin.category.business': 'Business',        // 'ניהול עסקי'
'nav.admin.category.channels': 'Channels',         // 'ערוצים'
'nav.admin.category.finance': 'Finance',            // 'כספים'
'nav.admin.category.reports': 'Reports',            // 'דוחות'
'nav.admin.category.settings': 'Settings',          // 'הגדרות'

// Navigation - New pages
'nav.admin.whatsapp': 'WhatsApp',                   // 'WhatsApp'
'nav.admin.prospects': 'Prospects',                  // 'פרוספקטים'
'nav.admin.message_templates': 'Templates',          // 'תבניות הודעות'
'nav.admin.subscriptions': 'Subscriptions',          // 'מנויים וחיובים'
'nav.admin.revenue': 'Revenue',                      // 'הכנסות'
'nav.admin.analytics': 'Analytics',                  // 'אנליטיקס'
'nav.admin.activity_log': 'Activity Log',            // 'לוג פעילות'
'nav.admin.professions': 'Professions',              // 'מקצועות'
'nav.admin.service_areas': 'Service Areas',          // 'אזורי שירות'
'nav.admin.system_settings': 'System',               // 'מערכת'

// Page titles & subtitles for each new page
'admin.templates.title': 'Message Templates',        // 'תבניות הודעות'
'admin.templates.subtitle': 'Manage WhatsApp & Telegram templates', // 'ניהול תבניות הודעות'
'admin.subscriptions.title': 'Subscriptions & Billing', // 'מנויים וחיובים'
'admin.subscriptions.subtitle': 'Manage contractor plans and payments', // 'ניהול מנויים ותשלומים'
'admin.revenue.title': 'Revenue',                    // 'הכנסות'
'admin.revenue.subtitle': 'Monthly recurring revenue and trends', // 'הכנסה חודשית ומגמות'
'admin.analytics.title': 'Analytics',                // 'אנליטיקס'
'admin.analytics.subtitle': 'Leads, conversions & performance', // 'לידים, המרות וביצועים'
'admin.activity.title': 'Activity Log',              // 'לוג פעילות'
'admin.activity.subtitle': 'System events and user actions', // 'אירועי מערכת ופעולות משתמשים'
'admin.professions.title': 'Professions',            // 'מקצועות'
'admin.professions.subtitle': 'Manage available professions', // 'ניהול מקצועות זמינים'
'admin.areas.title': 'Service Areas',                // 'אזורי שירות'
'admin.areas.subtitle': 'Manage ZIP codes and coverage', // 'ניהול מיקודים וכיסוי'
'admin.system.title': 'System Settings',             // 'הגדרות מערכת'
'admin.system.subtitle': 'Platform configuration',   // 'הגדרות פלטפורמה'
```

**Step 2: Update AdminSidebar to use t() instead of inline locale checks**

Replace all `locale === 'he' ? ... : ...` in AdminSidebar with `t('nav.admin.xxx')` calls.

**Step 3: Update stub pages to use t() for titles and subtitles**

**Step 4: Verify TypeScript compiles**

Run: `cd apps/dashboard && npx tsc --noEmit 2>&1 | head -20`
Expected: Clean compilation

**Step 5: Commit**

```bash
git add apps/dashboard/src/lib/i18n.ts apps/dashboard/src/components/AdminSidebar.tsx apps/dashboard/src/pages/admin/
git commit -m "feat: add i18n translations for all new admin pages and categories"
```

---

## Task 5: Clean Up Contractor Sidebar

**Files:**
- Modify: `apps/dashboard/src/components/Sidebar.tsx`

**Step 1: Remove admin navigation section from contractor Sidebar**

Remove the entire `isAdmin && (...)` block and the `adminNav` array from `Sidebar.tsx`. The contractor sidebar should only show:
- Dashboard, My Leads, Profile, Subscription, Telegram
- Settings + Logout in footer

**Step 2: Verify the contractor sidebar renders correctly**

Run: `cd apps/dashboard && npx tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add apps/dashboard/src/components/Sidebar.tsx
git commit -m "refactor: remove admin nav from contractor sidebar - admin has its own layout"
```

---

## Task 6: Add Admin Redirect Logic

**Files:**
- Modify: `apps/dashboard/src/App.tsx`

**Step 1: Add redirect for admin users hitting contractor routes**

In `AppShell`, add at the top:

```tsx
const { isAdmin } = useAuth()
if (isAdmin) return <Navigate to="/admin" replace />
```

This ensures:
- Admin landing on `/` gets redirected to `/admin`
- Admin can't accidentally access contractor pages
- Contractor can't access `/admin/*` (existing RequireAdmin guard)

**Step 2: Verify the redirect works by checking TypeScript**

Run: `cd apps/dashboard && npx tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add apps/dashboard/src/App.tsx
git commit -m "feat: redirect admin users from contractor routes to admin dashboard"
```

---

## Task 7: Build Full Admin Dashboard Page (Enhanced)

**Files:**
- Modify: `apps/dashboard/src/pages/AdminDashboard.tsx`

**Step 1: Enhance AdminDashboard with system alerts and quick actions**

Add to the existing AdminDashboard:
- **System Alerts section** below KPIs: cards showing issues (e.g., "2 failed payments", "WhatsApp disconnected", "3 inactive contractors")
- **Quick Actions bar**: buttons for "Add Contractor" (link to QR page), "View Latest Leads", "Export Report"
- Keep existing KPI cards and recent leads table
- Keep existing real-time subscriptions

**Step 2: Verify compiles**

Run: `cd apps/dashboard && npx tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/AdminDashboard.tsx
git commit -m "feat: enhance admin dashboard with alerts and quick actions"
```

---

## Task 8: Build Message Templates Page

**Files:**
- Modify: `apps/dashboard/src/pages/admin/MessageTemplates.tsx`

**Step 1: Implement full Message Templates page**

Features:
- Table showing existing templates (name, channel, status, last edited)
- "New Template" button opening a dialog/form
- Template editor with:
  - Name field
  - Channel select (WhatsApp / Telegram)
  - Message body textarea with variable insertion buttons (`{{contractor_name}}`, `{{lead_type}}`, `{{lead_location}}`)
  - Preview panel showing rendered template
  - Active/inactive toggle
- For now, use local state (no Supabase table yet — mark with TODO comment)

**Step 2: Verify compiles**

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/admin/MessageTemplates.tsx
git commit -m "feat: build message templates page with editor and preview"
```

---

## Task 9: Build Subscriptions & Billing Page

**Files:**
- Modify: `apps/dashboard/src/pages/admin/Subscriptions.tsx`

**Step 1: Implement Subscriptions page**

Features:
- Summary bar: total subscribers, by plan (Starter/Pro/Unlimited), MRR
- Filterable table: contractor name, plan, status (active/past_due/cancelled), joined date
- Expandable rows showing payment history
- Badge colors for status (green=active, orange=past_due, red=cancelled)
- Use mock data array for now, with TODO to connect to Supabase

**Step 2: Verify compiles**

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/admin/Subscriptions.tsx
git commit -m "feat: build subscriptions page with contractor plans table"
```

---

## Task 10: Build Revenue Page

**Files:**
- Modify: `apps/dashboard/src/pages/admin/Revenue.tsx`

**Step 1: Implement Revenue page**

Features:
- KPI cards: MRR, total revenue, growth rate, avg revenue per contractor
- Revenue over time chart (use a simple SVG bar chart or CSS-based chart — no external chart library)
- Breakdown by plan table
- Use mock data with TODO to connect to Supabase

**Step 2: Verify compiles**

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/admin/Revenue.tsx
git commit -m "feat: build revenue page with MRR and breakdown"
```

---

## Task 11: Build Analytics Page

**Files:**
- Modify: `apps/dashboard/src/pages/admin/Analytics.tsx`

**Step 1: Implement Analytics page**

Features:
- Leads per day/week toggle with simple bar chart
- Conversion funnel: leads → assigned → completed (horizontal bar visualization)
- Top contractors table (name, leads received, completion rate)
- Profession distribution (horizontal bars showing lead count per profession)
- Use mock data with TODO

**Step 2: Verify compiles**

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/admin/Analytics.tsx
git commit -m "feat: build analytics page with charts and performance metrics"
```

---

## Task 12: Build Activity Log Page

**Files:**
- Modify: `apps/dashboard/src/pages/admin/ActivityLog.tsx`

**Step 1: Implement Activity Log page**

Features:
- Chronological event list with timestamp, user avatar, action description
- Filter bar: by event type (dropdown), by user (search), by date range
- Event types with icons and colors: login, lead_created, lead_assigned, contractor_registered, payment_received, settings_changed
- Pagination (show 25 per page)
- Use mock data with TODO

**Step 2: Verify compiles**

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/admin/ActivityLog.tsx
git commit -m "feat: build activity log page with filters and pagination"
```

---

## Task 13: Build Professions Management Page

**Files:**
- Modify: `apps/dashboard/src/pages/admin/Professions.tsx`

**Step 1: Implement Professions page**

Features:
- Table of professions: icon, color swatch, name (EN), name (HE), status toggle
- "Add Profession" button opening a form dialog
- Edit inline or via dialog
- Enable/disable toggle per profession
- Read initial data from existing `professions.ts` constants, with TODO for Supabase CRUD

**Step 2: Verify compiles**

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/admin/Professions.tsx
git commit -m "feat: build professions management page with CRUD"
```

---

## Task 14: Build Service Areas Page

**Files:**
- Modify: `apps/dashboard/src/pages/admin/ServiceAreas.tsx`

**Step 1: Implement Service Areas page**

Features:
- Table view: ZIP code, area name, contractor count, status
- Add ZIP code form (input + add button)
- Bulk import textarea (paste comma-separated ZIPs)
- Map visualization (reuse existing Mapbox setup from CoverageMap component if token available, otherwise show table-only with note)
- Use mock data with TODO

**Step 2: Verify compiles**

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/admin/ServiceAreas.tsx
git commit -m "feat: build service areas page with ZIP management"
```

---

## Task 15: Build System Settings Page

**Files:**
- Modify: `apps/dashboard/src/pages/admin/SystemSettings.tsx`

**Step 1: Implement System Settings page**

Features:
- Sections with glass-panel cards:
  - **General**: Business name input, logo upload placeholder, default language toggle
  - **Notifications**: checkboxes for email/WhatsApp/Telegram notification channels
  - **API Keys**: read-only display of Mapbox token (masked), Supabase URL
  - **Timezone**: dropdown selector
- Save button with success toast
- Use local state with TODO for Supabase persistence

**Step 2: Verify compiles**

**Step 3: Commit**

```bash
git add apps/dashboard/src/pages/admin/SystemSettings.tsx
git commit -m "feat: build system settings page with general, notifications, and API sections"
```

---

## Task 16: Full Build Verification

**Step 1: Run TypeScript check**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: 0 errors

**Step 2: Run Vite build**

Run: `cd apps/dashboard && npx vite build`
Expected: Build succeeds

**Step 3: Run dev server and verify visually**

Run: `cd apps/dashboard && npx vite dev`
- Login as admin → should see new AdminSidebar with all categories
- Click through each nav item → each page should load
- Login as contractor → should see original sidebar without admin items
- Try accessing `/admin` as contractor → should redirect to `/`

**Step 4: Final commit**

```bash
git commit -m "chore: verify full admin dashboard redesign build"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | AdminSidebar component | 1 | 0 |
| 2 | AdminLayout + routing split | 1 | 1 |
| 3 | 8 stub pages | 8 | 0 |
| 4 | i18n translations | 0 | 3 |
| 5 | Clean contractor sidebar | 0 | 1 |
| 6 | Admin redirect logic | 0 | 1 |
| 7 | Enhanced AdminDashboard | 0 | 1 |
| 8-15 | Full page implementations | 0 | 8 |
| 16 | Build verification | 0 | 0 |

**Total: 10 new files, ~6 modified files, 16 tasks**
