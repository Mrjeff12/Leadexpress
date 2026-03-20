import {
  Target,
  HardHat,
  Radio,
  Coins,
  BarChart3,
  Settings,
  Handshake,
  Bot,
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
    id: 'partners',
    nameEn: 'Partners',
    nameHe: 'שותפים',
    color: '#ec4899',
    icon: Handshake,
    basePath: 'partners',
    tabs: [
      { key: 'overview', labelEn: 'Overview', labelHe: 'סקירה', path: '' },
      { key: 'list', labelEn: 'Partners', labelHe: 'שותפים', path: 'list' },
      { key: 'withdrawals', labelEn: 'Withdrawals', labelHe: 'משיכות', path: 'withdrawals' },
      { key: 'commissions', labelEn: 'Commissions', labelHe: 'עמלות', path: 'commissions' },
    ],
    kpis: [
      { key: 'activePartners', labelEn: 'Active Partners', labelHe: 'שותפים פעילים' },
      { key: 'pendingPartners', labelEn: 'Pending Approval', labelHe: 'ממתינים לאישור' },
      { key: 'partnerCommissions', labelEn: 'Commissions', labelHe: 'עמלות', format: 'currency' },
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
      { key: 'systemConfig', labelEn: 'System Config', labelHe: 'הגדרות מערכת' },
    ],
  },
]

export function getDepartment(basePath: string): DepartmentDef | undefined {
  return departments.find(d => d.basePath === basePath)
}
