import {
  HardHat,
  Radio,
  Settings,
  Handshake,
  Bot,
  DollarSign,
  type LucideIcon,
} from 'lucide-react'

export interface DepartmentTab {
  key: string
  labelEn: string
  labelHe: string
  path: string
  fullBleed?: boolean
}

export interface KpiDef {
  key: string
  labelEn: string
  labelHe: string
  format?: 'number' | 'currency' | 'percent'
}

export interface DepartmentDef {
  id: string
  nameEn: string
  nameHe: string
  color: string
  icon: LucideIcon
  basePath: string
  tabs: DepartmentTab[]
  kpis: KpiDef[]
}

/* ═══════════════════════════════════════════════════════════
   6 Clean Departments
   ═══════════════════════════════════════════════════════════
   1. Channels — WHERE leads come from (WhatsApp groups)
   2. Clients  — WHO receives them (contractors, prospects, subs)
   3. Partners — WHO refers new clients (affiliate program)
   4. Finance  — MONEY (payments, revenue, invoices, alerts)
   5. Bot      — HOW we process them (AI agents)
   6. Settings — Config (professions, system)
   ═══════════════════════════════════════════════════════════ */

export const departments: DepartmentDef[] = [
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
      { key: 'leads', labelEn: 'Leads', labelHe: 'לידים', path: 'leads' },
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
    id: 'clients',
    nameEn: 'Clients',
    nameHe: 'לקוחות',
    color: '#10b981',
    icon: HardHat,
    basePath: 'clients',
    tabs: [
      { key: 'contractors', labelEn: 'Contractors', labelHe: 'קבלנים', path: '' },
      { key: 'prospects', labelEn: 'Prospects', labelHe: 'פרוספקטים', path: 'prospects' },
      { key: 'subscriptions', labelEn: 'Subscriptions', labelHe: 'מנויים', path: 'subscriptions' },
      { key: 'service-areas', labelEn: 'Service Areas', labelHe: 'אזורי שירות', path: 'service-areas' },
    ],
    kpis: [
      { key: 'activeContractors', labelEn: 'Active Contractors', labelHe: 'קבלנים פעילים' },
      { key: 'hotLeads', labelEn: 'Hot Leads', labelHe: 'לידים חמים' },
      { key: 'activeSubs', labelEn: 'Active Subs', labelHe: 'מנויים פעילים' },
    ],
  },
  {
    id: 'partners',
    nameEn: 'Partners',
    nameHe: 'שותפים',
    color: '#ec4899',
    icon: Handshake,
    basePath: 'partners',
    tabs: [
      { key: 'overview', labelEn: 'Overview', labelHe: 'סקירה', path: '' },
      { key: 'commissions', labelEn: 'Commissions', labelHe: 'עמלות', path: 'commissions' },
      { key: 'withdrawals', labelEn: 'Withdrawals', labelHe: 'משיכות', path: 'withdrawals' },
    ],
    kpis: [
      { key: 'activePartners', labelEn: 'Active Partners', labelHe: 'שותפים פעילים' },
      { key: 'pendingPartners', labelEn: 'Pending Approval', labelHe: 'ממתינים לאישור' },
      { key: 'partnerCommissions', labelEn: 'Commissions', labelHe: 'עמלות', format: 'currency' },
    ],
  },
  {
    id: 'finance',
    nameEn: 'Finance',
    nameHe: 'פיננסים',
    color: '#f59e0b',
    icon: DollarSign,
    basePath: 'finance',
    tabs: [
      { key: 'payments', labelEn: 'Payments', labelHe: 'תשלומים', path: '' },
      { key: 'revenue', labelEn: 'Revenue', labelHe: 'הכנסות', path: 'revenue' },
      { key: 'invoices', labelEn: 'Invoices', labelHe: 'חשבוניות', path: 'invoices' },
      { key: 'alerts', labelEn: 'Alerts', labelHe: 'התראות', path: 'alerts' },
    ],
    kpis: [
      { key: 'mrr', labelEn: 'MRR', labelHe: 'MRR', format: 'currency' },
      { key: 'totalCollected', labelEn: 'Collected', labelHe: 'נגבה', format: 'currency' },
      { key: 'failedPayments', labelEn: 'Failed', labelHe: 'נכשלו' },
    ],
  },
  {
    id: 'bot',
    nameEn: 'Bot Control',
    nameHe: 'בוט',
    color: '#8b5cf6',
    icon: Bot,
    basePath: 'bot',
    tabs: [],
    kpis: [
      { key: 'activeAgents', labelEn: 'Agents', labelHe: 'סוכנים' },
      { key: 'activeTools', labelEn: 'Tools', labelHe: 'כלים' },
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
    ],
  },
]

export function getDepartment(basePath: string): DepartmentDef | undefined {
  return departments.find(d => d.basePath === basePath)
}
