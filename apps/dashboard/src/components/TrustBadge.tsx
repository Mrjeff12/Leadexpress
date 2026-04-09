import { Sparkles, ShieldCheck, Award, Crown, Building2, BadgeCheck } from 'lucide-react'

type ContractorTier = 'new' | 'verified' | 'trusted' | 'elite'
type PublisherTier = 'new' | 'verified' | 'established' | 'premium'

interface TrustBadgeProps {
  tier: ContractorTier | PublisherTier
  role?: 'contractor' | 'publisher'
  size?: 'sm' | 'md' | 'lg'
}

const CONTRACTOR_TIERS = {
  new: {
    icon: Sparkles,
    label: 'New Pro',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    iconColor: '#9ca3af',
  },
  verified: {
    icon: ShieldCheck,
    label: 'Verified',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    iconColor: '#3b82f6',
  },
  trusted: {
    icon: Award,
    label: 'Trusted',
    bg: 'bg-green-50',
    text: 'text-green-700',
    iconColor: '#22c55e',
  },
  elite: {
    icon: Crown,
    label: 'Elite',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    iconColor: '#f59e0b',
  },
} as const

const PUBLISHER_TIERS = {
  new: {
    icon: Sparkles,
    label: 'New',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    iconColor: '#9ca3af',
  },
  verified: {
    icon: BadgeCheck,
    label: 'Verified',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    iconColor: '#3b82f6',
  },
  established: {
    icon: Building2,
    label: 'Established',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    iconColor: '#10b981',
  },
  premium: {
    icon: Crown,
    label: 'Premium',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    iconColor: '#f59e0b',
  },
} as const

const SIZE_CONFIG = {
  sm: { iconSize: 14, className: 'text-xs px-2 py-0.5 gap-1' },
  md: { iconSize: 16, className: 'text-sm px-3 py-1 gap-1.5' },
  lg: { iconSize: 20, className: 'text-base px-4 py-1.5 gap-2' },
} as const

export default function TrustBadge({ tier, role = 'contractor', size = 'md' }: TrustBadgeProps) {
  const tiers = role === 'publisher' ? PUBLISHER_TIERS : CONTRACTOR_TIERS
  const cfg = (tiers as Record<string, (typeof CONTRACTOR_TIERS)['new']>)[tier] ?? tiers.new
  const sz = SIZE_CONFIG[size]
  const Icon = cfg.icon

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${cfg.bg} ${cfg.text} ${sz.className}`}
    >
      <Icon size={sz.iconSize} color={cfg.iconColor} />
      {cfg.label}
    </span>
  )
}
