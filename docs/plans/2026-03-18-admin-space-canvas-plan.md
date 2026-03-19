# Admin Space Canvas — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the sidebar-based admin navigation with a React Flow canvas of 6 department cards, each opening a full-page tabbed layout.

**Architecture:** Two-mode layout — Canvas Mode (`/admin` index) renders a React Flow canvas with 6 custom nodes showing live KPIs; Department Mode (`/admin/{dept}/*`) renders a full-page layout with a top bar (back button + tabs) wrapping existing page components unchanged. The sidebar is fully removed.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, `@xyflow/react` (React Flow v12), Supabase, react-router-dom v7, lucide-react

**Design Doc:** `docs/plans/2026-03-18-admin-space-canvas-design.md`

---

## Task 1: Install `@xyflow/react`

**Files:**
- Modify: `apps/dashboard/package.json`

**Step 1: Install the package**

Run from repo root:
```bash
cd apps/dashboard && pnpm add @xyflow/react
```

**Step 2: Verify installation**

Run: `pnpm ls @xyflow/react`
Expected: Shows `@xyflow/react` with version 12.x

**Step 3: Commit**

```bash
git add apps/dashboard/package.json pnpm-lock.yaml
git commit -m "chore: add @xyflow/react for admin space canvas"
```

---

## Task 2: Create department config (`departmentConfig.ts`)

This is the single source of truth for all 6 departments — their routes, colors, icons, tab definitions, and KPI labels. Every other component imports from here.

**Files:**
- Create: `apps/dashboard/src/config/departmentConfig.ts`

**Step 1: Create the config file**

```typescript
import {
  Target,
  HardHat,
  Radio,
  Coins,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface DepartmentTab {
  key: string
  labelEn: string
  labelHe: string
  /** Relative path appended to department base route. Empty string = default/index tab */
  path: string
  /** Set true if this tab's page needs full-bleed (no max-width container) */
  fullBleed?: boolean
}

export interface KpiDef {
  /** Supabase query key — resolved by useAdminKPIs hook */
  key: string
  labelEn: string
  labelHe: string
  /** Optional format: 'number' (default), 'currency', 'percent' */
  format?: 'number' | 'currency' | 'percent'
}

export interface DepartmentDef {
  id: string
  nameEn: string
  nameHe: string
  color: string
  icon: LucideIcon
  /** Base route under /admin, e.g. 'warroom' → /admin/warroom */
  basePath: string
  tabs: DepartmentTab[]
  kpis: KpiDef[]
}

export const departments: DepartmentDef[] = [
  {
    id: 'warroom',
    nameEn: 'War Room',
    nameHe: 'חדר מלחמה',
    color: '#ff6b35',
    icon: Target,
    basePath: 'warroom',
    tabs: [
      { key: 'inbox', labelEn: 'Inbox', labelHe: 'תיבת דואר', path: '', fullBleed: true },
      { key: 'leads', labelEn: 'Leads', labelHe: 'לידים', path: 'leads' },
      { key: 'prospects', labelEn: 'Prospects', labelHe: 'פרוספקטים', path: 'prospects' },
    ],
    kpis: [
      { key: 'hotLeads', labelEn: 'Hot Leads', labelHe: 'לידים חמים' },
      { key: 'prospectsWaiting', labelEn: 'Prospects Waiting', labelHe: 'ממתינים' },
      { key: 'unreadMessages', labelEn: 'Unread Messages', labelHe: 'לא נקראו' },
    ],
  },
  {
    id: 'clients',
    nameEn: 'Clients',
    nameHe: 'לקוחות',
    color: '#10b981',
    icon: HardHat,
    basePath: 'clients',
    tabs: [
      { key: 'contractors', labelEn: 'Contractors', labelHe: 'קבלנים', path: '' },
      { key: 'service-areas', labelEn: 'Service Areas', labelHe: 'אזורי שירות', path: 'service-areas' },
      { key: 'map', labelEn: 'Leads Map', labelHe: 'מפת לידים', path: 'map', fullBleed: true },
    ],
    kpis: [
      { key: 'activeContractors', labelEn: 'Active Contractors', labelHe: 'קבלנים פעילים' },
      { key: 'serviceAreas', labelEn: 'Service Areas', labelHe: 'אזורי שירות' },
      { key: 'leadsOnMap', labelEn: 'Leads on Map', labelHe: 'לידים במפה' },
    ],
  },
  {
    id: 'channels',
    nameEn: 'Channels',
    nameHe: 'ערוצים',
    color: '#8b5cf6',
    icon: Radio,
    basePath: 'channels',
    tabs: [
      { key: 'whatsapp', labelEn: 'WhatsApp', labelHe: 'WhatsApp', path: '' },
      { key: 'groups', labelEn: 'Groups', labelHe: 'קבוצות', path: 'groups' },
      { key: 'scan', labelEn: 'Group Scan', labelHe: 'סריקה', path: 'scan' },
      { key: 'templates', labelEn: 'Templates', labelHe: 'תבניות', path: 'templates' },
    ],
    kpis: [
      { key: 'waConnected', labelEn: 'WA Connected', labelHe: 'חיבורי WA' },
      { key: 'activeGroups', labelEn: 'Active Groups', labelHe: 'קבוצות פעילות' },
      { key: 'scansPending', labelEn: 'Scans Pending', labelHe: 'סריקות ממתינות' },
    ],
  },
  {
    id: 'finance',
    nameEn: 'Finance',
    nameHe: 'כספים',
    color: '#f59e0b',
    icon: Coins,
    basePath: 'finance',
    tabs: [
      { key: 'subscriptions', labelEn: 'Subscriptions', labelHe: 'מנויים', path: '' },
      { key: 'revenue', labelEn: 'Revenue', labelHe: 'הכנסות', path: 'revenue' },
    ],
    kpis: [
      { key: 'activeSubs', labelEn: 'Active Subs', labelHe: 'מנויים פעילים' },
      { key: 'mrr', labelEn: 'MRR', labelHe: 'MRR', format: 'currency' },
    ],
  },
  {
    id: 'intel',
    nameEn: 'Intelligence',
    nameHe: 'מודיעין',
    color: '#3b82f6',
    icon: BarChart3,
    basePath: 'intel',
    tabs: [
      { key: 'analytics', labelEn: 'Analytics', labelHe: 'אנליטיקס', path: '' },
      { key: 'activity', labelEn: 'Activity Log', labelHe: 'יומן פעילות', path: 'activity' },
    ],
    kpis: [
      { key: 'leadsToday', labelEn: 'Leads Today', labelHe: 'לידים היום' },
      { key: 'conversionRate', labelEn: 'Conversion', labelHe: 'המרה', format: 'percent' },
    ],
  },
  {
    id: 'settings',
    nameEn: 'Settings',
    nameHe: 'הגדרות',
    color: '#6b7280',
    icon: Settings,
    basePath: 'settings',
    tabs: [
      { key: 'professions', labelEn: 'Professions', labelHe: 'מקצועות', path: '' },
      { key: 'system', labelEn: 'System', labelHe: 'מערכת', path: 'system' },
    ],
    kpis: [
      { key: 'professionsCount', labelEn: 'Professions', labelHe: 'מקצועות' },
      { key: 'systemConfig', labelEn: 'System Config', labelHe: 'הגדרות מערכת' },
    ],
  },
]

/** Lookup a department by its basePath segment */
export function getDepartment(basePath: string): DepartmentDef | undefined {
  return departments.find(d => d.basePath === basePath)
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/config/departmentConfig.ts
git commit -m "feat: add department config for admin space canvas"
```

---

## Task 3: Create `useAdminKPIs` hook

Fetches live KPI data for all 6 department cards. Returns a `Record<string, number | string>` keyed by the `kpi.key` values in departmentConfig.

**Files:**
- Create: `apps/dashboard/src/hooks/useAdminKPIs.ts`

**Step 1: Create the hook**

```typescript
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface AdminKPIs {
  /** keyed by KpiDef.key from departmentConfig */
  [key: string]: number | string
}

/**
 * Fetches KPI data for the admin canvas department cards.
 * Re-fetches every 30 seconds via polling + Supabase realtime for leads.
 */
export function useAdminKPIs() {
  const [data, setData] = useState<AdminKPIs>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const [
        leadsRes,
        groupsRes,
        contractorsRes,
        subsRes,
        professionsRes,
        scanQueueRes,
        waRes,
        serviceAreasRes,
      ] = await Promise.all([
        supabase.from('leads').select('urgency, status, created_at'),
        supabase.from('groups').select('id, status'),
        supabase.from('profiles').select('id, subscription_status').eq('role', 'contractor'),
        supabase.from('subscriptions').select('id, status'),
        supabase.from('professions').select('id'),
        supabase.from('group_scan_requests').select('id, status').eq('status', 'pending'),
        supabase.from('whatsapp_connections').select('id, status').eq('status', 'connected'),
        supabase.from('service_areas').select('id'),
      ])

      const leads = leadsRes.data ?? []
      const groups = groupsRes.data ?? []
      const contractors = contractorsRes.data ?? []
      const subs = subsRes.data ?? []

      const today = new Date().toISOString().slice(0, 10)
      const leadsToday = leads.filter(l => l.created_at?.startsWith(today)).length
      const hotLeads = leads.filter(l => l.urgency === 'hot').length
      const activeGroups = groups.filter(g => g.status === 'active').length
      const activeSubs = subs.filter(s => s.status === 'active').length
      const activeContractors = contractors.filter(c => c.subscription_status === 'active').length
      const totalLeads = leads.length
      const sent = leads.filter(l => l.status === 'sent').length
      const convRate = totalLeads > 0 ? Math.round((sent / totalLeads) * 1000) / 10 : 0

      setData({
        // War Room
        hotLeads,
        prospectsWaiting: 0, // TODO: count from prospects table if exists
        unreadMessages: 0,   // TODO: count from messages table if exists
        // Clients
        activeContractors,
        serviceAreas: serviceAreasRes.data?.length ?? 0,
        leadsOnMap: leads.filter(l => l.status !== 'archived').length,
        // Channels
        waConnected: waRes.data?.length ?? 0,
        activeGroups,
        scansPending: scanQueueRes.data?.length ?? 0,
        // Finance
        activeSubs,
        mrr: activeSubs * 49, // TODO: replace with real MRR calculation
        // Intelligence
        leadsToday,
        conversionRate: convRate,
        // Settings
        professionsCount: professionsRes.data?.length ?? 0,
        systemConfig: 'Active',
      })
      setLoading(false)
    }

    fetch()
    const interval = setInterval(fetch, 30_000)
    return () => clearInterval(interval)
  }, [])

  return { data, loading }
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/hooks/useAdminKPIs.ts
git commit -m "feat: add useAdminKPIs hook for canvas department cards"
```

---

## Task 4: Create `DepartmentNode` (custom React Flow node)

**Files:**
- Create: `apps/dashboard/src/components/admin/DepartmentNode.tsx`

**Step 1: Create the component**

This is the visual card rendered for each department on the canvas. It receives department data + KPI values via React Flow `data` prop.

```tsx
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import type { DepartmentDef, AdminKPIs } from '../../config/departmentConfig'

// Re-export AdminKPIs so it can be used elsewhere
export type { AdminKPIs }

interface DepartmentNodeData {
  department: DepartmentDef
  kpis: AdminKPIs
  locale: 'en' | 'he'
}

function DepartmentNodeComponent({ data }: NodeProps) {
  const { department: dept, kpis, locale } = data as unknown as DepartmentNodeData
  const navigate = useNavigate()
  const he = locale === 'he'
  const Icon = dept.icon

  return (
    <>
      {/* Hidden handles so React Flow doesn't warn — edges connect to these */}
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0" />

      <div
        onClick={() => navigate(`/admin/${dept.basePath}`)}
        className="group cursor-pointer transition-all duration-300 hover:scale-[1.03] rounded-2xl p-5 w-[280px]"
        style={{
          background: `${dept.color}12`,
          border: `2px solid ${dept.color}`,
          backdropFilter: 'blur(12px)',
          boxShadow: `0 0 20px ${dept.color}15`,
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 40px ${dept.color}35`
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${dept.color}15`
        }}
        dir={he ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5" style={{ color: dept.color }} />
          <span className="text-[20px] font-bold" style={{ color: dept.color }}>
            {he ? dept.nameHe : dept.nameEn}
          </span>
        </div>

        {/* KPIs */}
        <div className="space-y-2">
          {dept.kpis.map((kpi, i) => {
            const val = kpis[kpi.key]
            let display: string
            if (kpi.format === 'currency') display = `$${Number(val ?? 0).toLocaleString()}`
            else if (kpi.format === 'percent') display = `${val ?? 0}%`
            else display = String(val ?? 0)

            return (
              <div key={kpi.key} className="flex items-baseline gap-2">
                <span className={`text-[16px] font-semibold tabular-nums ${i === 0 ? 'text-white' : 'text-white/60'}`}>
                  {display}
                </span>
                <span className="text-[13px] text-white/40">
                  {he ? kpi.labelHe : kpi.labelEn}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

export default memo(DepartmentNodeComponent)
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/components/admin/DepartmentNode.tsx
git commit -m "feat: add DepartmentNode custom React Flow node"
```

---

## Task 5: Create `AdminCanvas` (the canvas view)

**Files:**
- Create: `apps/dashboard/src/components/admin/AdminCanvas.tsx`

**Step 1: Create the canvas component**

```tsx
import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useAdminKPIs } from '../../hooks/useAdminKPIs'
import { departments } from '../../config/departmentConfig'
import DepartmentNode from './DepartmentNode'
import { LogOut } from 'lucide-react'

const nodeTypes = { department: DepartmentNode }

/** 3×2 grid layout positions */
const GRID_POSITIONS: [number, number][] = [
  [0, 0],     [350, 0],     [700, 0],
  [0, 260],   [350, 260],   [700, 260],
]

/** Decorative dashed arrows between related departments */
const EDGES: Edge[] = [
  { id: 'e-wr-cl', source: 'warroom', target: 'clients', style: { stroke: '#ff6b3530', strokeDasharray: '6 4' }, animated: false },
  { id: 'e-ch-wr', source: 'channels', target: 'warroom', style: { stroke: '#8b5cf630', strokeDasharray: '6 4' }, animated: false },
  { id: 'e-cl-fi', source: 'clients', target: 'finance', style: { stroke: '#10b98130', strokeDasharray: '6 4' }, animated: false },
]

export default function AdminCanvas() {
  const { profile, signOut } = useAuth()
  const { locale } = useI18n()
  const { data: kpis, loading } = useAdminKPIs()
  const he = locale === 'he'

  const nodes: Node[] = useMemo(
    () =>
      departments.map((dept, i) => ({
        id: dept.id,
        type: 'department',
        position: { x: GRID_POSITIONS[i][0], y: GRID_POSITIONS[i][1] },
        draggable: false,
        selectable: false,
        data: { department: dept, kpis, locale },
      })),
    [kpis, locale],
  )

  const onNodeClick = useCallback(() => {
    // Navigation is handled inside DepartmentNode via useNavigate
  }, [])

  return (
    <div className="h-screen w-screen" style={{ background: '#0f0f1a' }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <img src="/icon.png" alt="Lead Express" className="w-9 h-9 rounded-xl shadow-lg" />
          <div>
            <div className="text-white font-bold text-[15px]">Lead Express</div>
            <div className="text-white/30 text-[10px] font-bold tracking-widest uppercase">
              {he ? 'מרכז שליטה' : 'Control Center'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {profile && (
            <span className="text-white/50 text-[13px]">
              {profile.full_name}
            </span>
          )}
          <button
            onClick={signOut}
            className="text-white/30 hover:text-white/60 transition-colors"
            title={he ? 'התנתק' : 'Log Out'}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={EDGES}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="!bg-transparent"
          zoomOnScroll
          panOnScroll={false}
          panOnDrag
        >
          <Background color="#ffffff08" gap={40} size={1} />
          <Controls
            showInteractive={false}
            className="!bg-white/5 !border-white/10 !rounded-xl [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-white/40 [&>button:hover]:!bg-white/10"
          />
        </ReactFlow>
      </ReactFlowProvider>

      {/* Bottom hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/20 text-[13px]">
        {he
          ? 'לחץ על כרטיס להיכנס | גלול לזום | גרור להזיז'
          : 'Click a card to enter | Scroll to zoom | Drag to pan'}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f1a]/80 z-20">
          <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/components/admin/AdminCanvas.tsx
git commit -m "feat: add AdminCanvas with React Flow department nodes"
```

---

## Task 6: Create `DepartmentLayout` (tabbed full-page layout)

**Files:**
- Create: `apps/dashboard/src/components/admin/DepartmentLayout.tsx`

**Step 1: Create the layout component**

This wraps each department's sub-pages with a top bar (back button + tabs) and renders the active tab's content.

```tsx
import { lazy, Suspense, useMemo } from 'react'
import { Routes, Route, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { getDepartment } from '../../config/departmentConfig'
import { ArrowRight, ArrowLeft } from 'lucide-react'

/* ─── Lazy-loaded admin pages (same imports as old AdminLayout) ─── */
const AdminInbox = lazy(() => import('../../pages/AdminInbox'))
const AdminLeads = lazy(() => import('../../pages/AdminLeads'))
const AdminProspects = lazy(() => import('../../pages/AdminProspects'))
const ProspectDetail = lazy(() => import('../../pages/ProspectDetail'))
const AdminContractors = lazy(() => import('../../pages/AdminContractors'))
const ContractorDetail = lazy(() => import('../../pages/admin/ContractorDetail'))
const ServiceAreas = lazy(() => import('../../pages/admin/ServiceAreas'))
const LeadsMap = lazy(() => import('../../pages/admin/LeadsMap'))
const AdminWhatsApp = lazy(() => import('../../pages/AdminWhatsApp'))
const AdminGroups = lazy(() => import('../../pages/AdminGroups'))
const AdminGroupDetail = lazy(() => import('../../pages/AdminGroupDetail'))
const AdminGroupScanQueue = lazy(() => import('../../pages/AdminGroupScanQueue'))
const MessageTemplates = lazy(() => import('../../pages/admin/MessageTemplates'))
const Subscriptions = lazy(() => import('../../pages/admin/Subscriptions'))
const Revenue = lazy(() => import('../../pages/admin/Revenue'))
const Analytics = lazy(() => import('../../pages/admin/Analytics'))
const ActivityLog = lazy(() => import('../../pages/admin/ActivityLog'))
const Professions = lazy(() => import('../../pages/admin/Professions'))
const SystemSettings = lazy(() => import('../../pages/admin/SystemSettings'))

/**
 * Maps department tab keys to their lazy components.
 * The key format is `{deptId}/{tabKey}`.
 */
const TAB_COMPONENTS: Record<string, React.LazyExoticComponent<() => JSX.Element>> = {
  'warroom/inbox': AdminInbox,
  'warroom/leads': AdminLeads,
  'warroom/prospects': AdminProspects,
  'clients/contractors': AdminContractors,
  'clients/service-areas': ServiceAreas,
  'clients/map': LeadsMap,
  'channels/whatsapp': AdminWhatsApp,
  'channels/groups': AdminGroups,
  'channels/scan': AdminGroupScanQueue,
  'channels/templates': MessageTemplates,
  'finance/subscriptions': Subscriptions,
  'finance/revenue': Revenue,
  'intel/analytics': Analytics,
  'intel/activity': ActivityLog,
  'settings/professions': Professions,
  'settings/system': SystemSettings,
}

/**
 * Renders a department's tabbed layout.
 * Expects to be mounted at `/admin/:deptId/*`.
 */
export default function DepartmentLayout() {
  const { deptId } = useParams<{ deptId: string }>()
  const navigate = useNavigate()
  const { locale } = useI18n()
  const he = locale === 'he'

  const dept = useMemo(() => getDepartment(deptId ?? ''), [deptId])

  if (!dept) return <Navigate to="/admin" replace />

  const BackArrow = he ? ArrowRight : ArrowLeft
  const basePath = `/admin/${dept.basePath}`

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden" style={{ background: '#0f0f1a' }}>
      {/* Top bar */}
      <div
        className="flex items-center gap-4 px-6 h-14 shrink-0"
        style={{ borderBottom: `1px solid ${dept.color}20` }}
      >
        {/* Back button */}
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 text-[14px] transition-colors hover:opacity-80"
          style={{ color: dept.color }}
        >
          <BackArrow className="w-4 h-4" />
          <span>{he ? 'חזרה למפה' : 'Back to Map'}</span>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-white/10" />

        {/* Tabs */}
        <nav className="flex items-center gap-1" dir={he ? 'rtl' : 'ltr'}>
          {dept.tabs.map((tab) => {
            const to = tab.path ? `${basePath}/${tab.path}` : basePath
            return (
              <NavLink
                key={tab.key}
                to={to}
                end={!tab.path}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                    isActive
                      ? 'text-white'
                      : 'text-white/40 hover:text-white/70'
                  }`
                }
                style={({ isActive }) =>
                  isActive ? { background: `${dept.color}25` } : {}
                }
              >
                {he ? tab.labelHe : tab.labelEn}
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <div
                className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full"
                style={{ borderColor: dept.color, borderTopColor: 'transparent' }}
              />
            </div>
          }
        >
          <Routes>
            {dept.tabs.map((tab) => {
              const Comp = TAB_COMPONENTS[`${dept.id}/${tab.key}`]
              if (!Comp) return null
              return (
                <Route
                  key={tab.key}
                  path={tab.path || '/'}
                  element={
                    <div
                      className={
                        tab.fullBleed
                          ? 'h-full overflow-hidden'
                          : 'max-w-6xl mx-auto w-full px-6 py-8 h-full overflow-y-auto'
                      }
                    >
                      <Comp />
                    </div>
                  }
                />
              )
            })}

            {/* Sub-routes for detail pages */}
            {dept.id === 'warroom' && (
              <Route path="prospects/:id" element={<div className="max-w-6xl mx-auto w-full px-6 py-8 h-full overflow-y-auto"><ProspectDetail /></div>} />
            )}
            {dept.id === 'clients' && (
              <Route path="contractors/:id" element={<div className="max-w-6xl mx-auto w-full px-6 py-8 h-full overflow-y-auto"><ContractorDetail /></div>} />
            )}
            {dept.id === 'channels' && (
              <Route path="groups/:id" element={<div className="max-w-6xl mx-auto w-full px-6 py-8 h-full overflow-y-auto"><AdminGroupDetail /></div>} />
            )}

            <Route path="*" element={<Navigate to={basePath} replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/components/admin/DepartmentLayout.tsx
git commit -m "feat: add DepartmentLayout with tabbed navigation"
```

---

## Task 7: Rewrite `AdminLayout` to use Canvas + Department routing

**Files:**
- Modify: `apps/dashboard/src/components/AdminLayout.tsx`
- Modify: `apps/dashboard/src/index.css` (remove sidebar padding rules)

**Step 1: Replace AdminLayout.tsx**

Replace the entire file with:

```tsx
import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

const AdminCanvas = lazy(() => import('./admin/AdminCanvas'))
const DepartmentLayout = lazy(() => import('./admin/DepartmentLayout'))

export default function AdminLayout() {
  // Remove sidebar body classes on mount (cleanup from old layout)
  useEffect(() => {
    document.body.classList.remove('sidebar-collapsed')
  }, [])

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-[#0f0f1a]">
          <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<AdminCanvas />} />
        <Route path="/:deptId/*" element={<DepartmentLayout />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  )
}
```

**Step 2: Remove sidebar CSS from index.css**

In `apps/dashboard/src/index.css`, remove or comment out these lines (around line 452-454):

```css
/* REMOVE these lines: */
.admin-main-content { padding-inline-start: 264px; }
body.sidebar-collapsed .admin-main-content { padding-inline-start: 72px; }
```

Also remove all `.sidebar-link` styles (lines 268-294) since they are no longer used by admin. **IMPORTANT:** Check if the contractor sidebar also uses `.sidebar-link` — if yes, keep them. If only admin used them, remove.

**Step 3: Verify the dev server compiles**

Run: `cd apps/dashboard && pnpm dev`
Expected: Vite compiles without errors. Navigating to `/admin` should show the canvas.

**Step 4: Commit**

```bash
git add apps/dashboard/src/components/AdminLayout.tsx apps/dashboard/src/index.css
git commit -m "feat: rewire AdminLayout to canvas + department routing"
```

---

## Task 8: Add Escape key handler for department → canvas navigation

**Files:**
- Modify: `apps/dashboard/src/components/admin/DepartmentLayout.tsx`

**Step 1: Add useEffect for keydown**

Inside the `DepartmentLayout` component, add after the existing hooks:

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') navigate('/admin')
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [navigate])
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/components/admin/DepartmentLayout.tsx
git commit -m "feat: add Escape key to return to canvas from department"
```

---

## Task 9: Import React Flow CSS in the app entrypoint

React Flow requires its CSS to be imported. Since we already import it inside AdminCanvas.tsx, verify it works. If Vite tree-shakes it away because it's lazy-loaded, add it to the main CSS or the AdminCanvas file.

**Files:**
- Verify: `apps/dashboard/src/components/admin/AdminCanvas.tsx` has `import '@xyflow/react/dist/style.css'`

**Step 1: Verify import exists**

The import is already in AdminCanvas.tsx from Task 5. No additional action needed.

**Step 2: Test visually**

Run: `pnpm dev`
Navigate to `/admin`. Verify:
- 6 cards visible on dark background
- Zoom with scroll wheel works
- Pan with click-drag works
- Click on a card navigates to department
- Back button returns to canvas

**Step 3: Commit (if any fix was needed)**

```bash
git commit -m "fix: ensure React Flow CSS loaded correctly"
```

---

## Task 10: Clean up — remove `AdminSidebar` references

**Files:**
- Modify: `apps/dashboard/src/components/AdminSidebar.tsx` — keep the file but it's no longer imported by AdminLayout
- Verify: No other files import `AdminSidebar`

**Step 1: Check for imports**

Run: `grep -r "AdminSidebar" apps/dashboard/src/ --include="*.tsx" --include="*.ts"`

Expected: Only the file itself and the old AdminLayout import (which we already removed in Task 7).

**Step 2: Optionally delete AdminSidebar.tsx**

If no other component imports it, delete:
```bash
rm apps/dashboard/src/components/AdminSidebar.tsx
```

**Step 3: Commit**

```bash
git add -A apps/dashboard/src/components/AdminSidebar.tsx
git commit -m "chore: remove AdminSidebar (replaced by canvas)"
```

---

## Task 11: Visual polish and RTL testing

**Files:**
- Potentially modify: `apps/dashboard/src/components/admin/DepartmentNode.tsx`
- Potentially modify: `apps/dashboard/src/components/admin/AdminCanvas.tsx`

**Step 1: Test RTL mode**

Switch locale to Hebrew and verify:
- Canvas top bar is RTL
- Department cards show Hebrew labels
- Department layout tabs are RTL
- Back button shows right arrow (→) in Hebrew

**Step 2: Test zoom behavior**

- Scroll to zoom in/out
- Verify cards remain legible at all zoom levels
- Verify Controls widget works

**Step 3: Test navigation flow**

- `/admin` → shows canvas
- Click "War Room" → `/admin/warroom` with Inbox tab active
- Click "Leads" tab → `/admin/warroom/leads`
- Press Escape → back to `/admin`
- Click "Channels" → `/admin/channels` with WhatsApp tab active
- Navigate to Groups tab → `/admin/channels/groups`
- Click group row → `/admin/channels/groups/:id` (group detail)
- "Back to Map" button → `/admin`

**Step 4: Fix any issues found**

Apply fixes to the relevant components.

**Step 5: Commit**

```bash
git add -A
git commit -m "fix: visual polish and RTL corrections for admin canvas"
```

---

## Summary

| Task | Creates/Modifies | Description |
|------|-----------------|-------------|
| 1 | package.json | Install `@xyflow/react` |
| 2 | config/departmentConfig.ts | Department definitions (routes, tabs, KPIs, colors) |
| 3 | hooks/useAdminKPIs.ts | Live KPI data hook |
| 4 | components/admin/DepartmentNode.tsx | Custom React Flow node card |
| 5 | components/admin/AdminCanvas.tsx | React Flow canvas with 6 nodes |
| 6 | components/admin/DepartmentLayout.tsx | Full-page tabbed layout |
| 7 | components/AdminLayout.tsx + index.css | Rewire routing, remove sidebar CSS |
| 8 | DepartmentLayout.tsx | Escape key handler |
| 9 | (verification) | Verify React Flow CSS |
| 10 | AdminSidebar.tsx | Remove unused sidebar |
| 11 | (polish) | RTL + visual testing |
