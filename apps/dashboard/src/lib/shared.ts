import { PROFESSIONS } from './professions'

/* ─── Profession lookup (shared across pages) ─── */
export const PROF_LOOKUP = Object.fromEntries(
  PROFESSIONS.map((p) => [p.id, p])
)

/* ─── Currency formatter ─── */
export function formatCurrency(amount: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: decimals,
  }).format(amount)
}

/* ─── Relative time (e.g., "2h ago", "3d ago") ─── */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

/* ─── Status badge config ─── */
export type JobStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export const STATUS_CONFIG: Record<JobStatus, { label: string; labelHe: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   labelHe: 'ממתין',   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  accepted:  { label: 'Active',    labelHe: 'פעיל',    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  completed: { label: 'Completed', labelHe: 'הושלם',   color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  rejected:  { label: 'Rejected',  labelHe: 'נדחה',    color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  cancelled: { label: 'Cancelled', labelHe: 'בוטל',    color: 'text-stone-500',  bg: 'bg-stone-50 border-stone-200' },
}

export const PAYMENT_CONFIG: Record<PaymentStatus, { label: string; labelHe: string; color: string; bg: string }> = {
  paid:    { label: 'Paid',    labelHe: 'שולם',      color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  partial: { label: 'Partial', labelHe: 'חלקי',      color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  unpaid:  { label: 'Unpaid',  labelHe: 'לא שולם',   color: 'text-stone-500',  bg: 'bg-stone-50 border-stone-200' },
}
