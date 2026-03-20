import { useState, useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import { usePartnerReferrals } from '../../hooks/usePartnerReferrals'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  UserPlus,
  Share2,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
} from 'lucide-react'

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

type StatusFilter = 'all' | 'active' | 'trial' | 'churned'

export default function PartnerReferrals() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const navigate = useNavigate()
  const { referrals, loading, totalCount } = usePartnerReferrals()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filtered = useMemo(() => {
    return referrals.filter(r => {
      // Search
      if (search) {
        const q = search.toLowerCase()
        const name = (r.user_name || '').toLowerCase()
        if (!name.includes(q)) return false
      }
      // Status filter
      if (statusFilter === 'all') return true
      if (statusFilter === 'active') return r.subscription_status === 'active'
      if (statusFilter === 'trial') return r.subscription_status === 'trialing'
      if (statusFilter === 'churned') return !r.subscription_status || r.subscription_status === 'canceled' || r.subscription_status === 'past_due'
      return true
    })
  }, [referrals, search, statusFilter])

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: he ? 'הכל' : 'All' },
    { key: 'active', label: he ? 'פעילים' : 'Active' },
    { key: 'trial', label: he ? 'ניסיון' : 'Trial' },
    { key: 'churned', label: he ? 'עזבו' : 'Churned' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-[#fe5b25] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-8 pb-16 pt-2">
      {/* Header */}
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            {he ? 'ההפניות שלי' : 'My Referrals'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {he ? `${totalCount} הפניות סה"כ` : `${totalCount} total referrals`}
          </p>
        </div>
        <button
          onClick={() => navigate('/partner/share')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md shadow-[#fe5b25]/20 transition-all hover:shadow-lg"
          style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
        >
          <Share2 className="w-4 h-4" />
          {he ? 'שתף קישור' : 'Share Link'}
        </button>
      </header>

      {/* Search + Filters */}
      <div className="glass-panel p-4 border-none shadow-lg flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 text-zinc-400"
            style={{ left: he ? 'auto' : 16, right: he ? 16 : 'auto' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={he ? 'חפש לפי שם...' : 'Search by name...'}
            className="w-full text-sm rounded-xl border-none px-6 py-3 outline-none bg-black/[0.03] focus:bg-black/[0.05] focus:ring-2 focus:ring-black/5 transition-all"
            style={{ paddingLeft: he ? 16 : 44, paddingRight: he ? 44 : 16 }}
          />
        </div>

        <div className="flex gap-1 bg-black/[0.03] p-1 rounded-xl">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`text-[11px] font-bold uppercase tracking-wider rounded-lg px-4 py-2 transition-all ${
                statusFilter === tab.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-[#fff4ef] border border-[#fee8df]">
          <span className="text-[10px] font-bold text-[#e04d1c] uppercase tracking-wider">
            {filtered.length} {he ? 'תוצאות' : 'Results'}
          </span>
        </div>
      </div>

      {/* Referral Cards */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(referral => {
            const statusConfig = referral.subscription_status === 'active'
              ? { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-100', label: he ? 'פעיל' : 'Active', icon: CheckCircle2 }
              : referral.subscription_status === 'trialing'
              ? { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', label: he ? 'ניסיון' : 'Trial', icon: Clock }
              : { bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-100', label: he ? 'לא פעיל' : 'Inactive', icon: XCircle }

            const StatusIcon = statusConfig.icon
            const initials = (referral.user_name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

            return (
              <div key={referral.id} className="glass-panel p-5 border-none shadow-lg flex items-center gap-4">
                {/* Avatar */}
                <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0">
                  <img
                    src={`https://i.pravatar.cc/88?u=${referral.id}`}
                    alt={referral.user_name || ''}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget
                      target.style.display = 'none'
                      target.parentElement!.classList.add('bg-[#fee8df]', 'text-[#e04d1c]', 'flex', 'items-center', 'justify-center', 'text-sm', 'font-bold')
                      target.parentElement!.textContent = initials
                    }}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-800 truncate">
                    {referral.user_name || (he ? 'משתמש' : 'User')}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-zinc-400">
                      {he ? 'הצטרף' : 'Joined'} {new Date(referral.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    {referral.plan_name && (
                      <span className="text-[11px] font-semibold text-zinc-500 px-2 py-0.5 rounded-md bg-zinc-100">
                        {referral.plan_name}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400 capitalize">
                      via {referral.referral_source}
                    </span>
                  </div>
                </div>

                {/* Commission */}
                {referral.monthly_commission_cents > 0 && (
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-green-600">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="text-sm font-bold">{formatCents(referral.monthly_commission_cents)}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400">{he ? '/חודש' : '/mo'}</span>
                  </div>
                )}

                {/* Status Badge */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border} shrink-0`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusConfig.label}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="glass-panel py-24 flex flex-col items-center gap-5 border-none shadow-lg">
          <div className="w-16 h-16 rounded-2xl bg-zinc-50 flex items-center justify-center">
            <UserPlus className="w-7 h-7 text-zinc-300" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-zinc-800 mb-1">
              {he ? 'אין הפניות עדיין' : 'No referrals yet'}
            </h3>
            <p className="text-sm text-zinc-400 max-w-sm">
              {he ? 'שתף את הקישור שלך כדי להתחיל להרוויח' : 'Share your referral link to start earning commissions'}
            </p>
          </div>
          <button
            onClick={() => navigate('/partner/share')}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md shadow-[#fe5b25]/20"
            style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
          >
            <Share2 className="w-4 h-4" />
            {he ? 'שתף קישור הפניה' : 'Share Referral Link'}
          </button>
        </div>
      )}
    </div>
  )
}
