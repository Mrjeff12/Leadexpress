import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { usePartnerProfile } from '../../hooks/usePartnerProfile'
import { usePartnerCommissions } from '../../hooks/usePartnerCommissions'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/shadcn/ui/dialog'
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Loader2,
  DollarSign,
  XCircle,
  Clock,
  Banknote,
} from 'lucide-react'

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

type TypeFilter = '' | 'earning' | 'withdrawal' | 'credit' | 'refund_clawback'

const TYPE_CONFIG: Record<string, { icon: typeof DollarSign; color: string; label: string; he: string }> = {
  earning:         { icon: ArrowDownRight, color: '#16a34a', label: 'Commission',    he: 'עמלה' },
  withdrawal:      { icon: ArrowUpRight,   color: '#ef4444', label: 'Withdrawal',    he: 'משיכה' },
  credit:          { icon: CreditCard,     color: '#6366f1', label: 'Credit',        he: 'זיכוי' },
  refund_clawback: { icon: XCircle,        color: '#f59e0b', label: 'Clawback',      he: 'החזר' },
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; he: string }> = {
  pending:  { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Pending',  he: 'ממתין' },
  approved: { bg: 'bg-green-50', text: 'text-green-600', label: 'Approved', he: 'מאושר' },
  paid:     { bg: 'bg-blue-50',  text: 'text-blue-600',  label: 'Paid',     he: 'שולם' },
  rejected: { bg: 'bg-red-50',   text: 'text-red-500',   label: 'Rejected', he: 'נדחה' },
  reversed: { bg: 'bg-zinc-100', text: 'text-zinc-500',  label: 'Reversed', he: 'בוטל' },
}

export default function PartnerWallet() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { toast } = useToast()
  const { partner, refetch: refetchPartner } = usePartnerProfile()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('')
  const { commissions, loading, hasMore, loadMore, refetch } = usePartnerCommissions(typeFilter || undefined)

  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showCredit, setShowCredit] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const balance = partner?.balance_cache_cents ?? 0

  async function handleWithdraw() {
    const cents = Math.round(parseFloat(withdrawAmount) * 100)
    if (isNaN(cents) || cents < 5000) {
      toast({ title: he ? 'שגיאה' : 'Error', description: he ? 'מינימום $50 למשיכה' : 'Minimum withdrawal is $50', variant: 'destructive' })
      return
    }
    if (cents > balance) {
      toast({ title: he ? 'שגיאה' : 'Error', description: he ? 'אין מספיק יתרה' : 'Insufficient balance', variant: 'destructive' })
      return
    }

    setActionLoading(true)
    try {
      const { error } = await supabase.functions.invoke('partner-withdraw', {
        body: { amount_cents: cents },
      })
      if (error) throw error
      toast({ title: he ? 'בוצע' : 'Success', description: he ? 'בקשת המשיכה נשלחה' : 'Withdrawal request submitted' })
      setShowWithdraw(false)
      setWithdrawAmount('')
      refetch()
      refetchPartner()
    } catch (err: any) {
      toast({ title: he ? 'שגיאה' : 'Error', description: err?.message || 'Failed', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleApplyCredit() {
    const cents = Math.round(parseFloat(creditAmount) * 100)
    if (isNaN(cents) || cents <= 0) return
    if (cents > balance) {
      toast({ title: he ? 'שגיאה' : 'Error', description: he ? 'אין מספיק יתרה' : 'Insufficient balance', variant: 'destructive' })
      return
    }

    setActionLoading(true)
    try {
      const { error } = await supabase.functions.invoke('partner-apply-credit', {
        body: { amount_cents: cents },
      })
      if (error) throw error
      toast({ title: he ? 'בוצע' : 'Success', description: he ? 'הזיכוי הוחל על המנוי שלך' : 'Credit applied to your subscription' })
      setShowCredit(false)
      setCreditAmount('')
      refetch()
      refetchPartner()
    } catch (err: any) {
      toast({ title: he ? 'שגיאה' : 'Error', description: err?.message || 'Failed', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-8 pb-16 pt-2">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          {he ? 'הארנק שלי' : 'My Wallet'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {he ? 'יתרה, עסקאות ומשיכות' : 'Balance, transactions & withdrawals'}
        </p>
      </header>

      {/* Balance Hero Card */}
      <div
        className="relative overflow-hidden rounded-2xl p-8 text-white shadow-xl"
        style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c, #c43d10)' }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-white/60" />
            <span className="text-sm font-medium text-white/60 uppercase tracking-wider">
              {he ? 'יתרה זמינה' : 'Available Balance'}
            </span>
          </div>
          <p className="text-5xl font-bold tracking-tight mb-6">
            {formatCents(balance)}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowWithdraw(true)}
              disabled={balance < 5000}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-white text-[#e04d1c] hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <Banknote className="w-4 h-4" />
              {he ? 'משיכה' : 'Withdraw'}
            </button>
            <button
              onClick={() => setShowCredit(true)}
              disabled={balance <= 0}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-white/15 text-white hover:bg-white/25 transition-all border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CreditCard className="w-4 h-4" />
              {he ? 'החל על המנוי' : 'Apply to Subscription'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          {he ? 'סינון:' : 'Filter:'}
        </span>
        <div className="flex gap-1 bg-black/[0.03] p-1 rounded-xl">
          {[
            { key: '' as TypeFilter, label: he ? 'הכל' : 'All' },
            { key: 'earning' as TypeFilter, label: he ? 'עמלות' : 'Earnings' },
            { key: 'withdrawal' as TypeFilter, label: he ? 'משיכות' : 'Withdrawals' },
            { key: 'credit' as TypeFilter, label: he ? 'זיכויים' : 'Credits' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`text-[11px] font-bold uppercase tracking-wider rounded-lg px-4 py-2 transition-all ${
                typeFilter === f.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
        </div>
      ) : commissions.length > 0 ? (
        <div className="space-y-2">
          {commissions.map(c => {
            const typeConfig = TYPE_CONFIG[c.type] || TYPE_CONFIG.earning
            const statusConfig = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending
            const Icon = typeConfig.icon

            return (
              <div key={c.id} className="glass-panel p-4 border-none shadow-sm flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${typeConfig.color}10`, color: typeConfig.color }}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-800">
                    {he ? typeConfig.he : typeConfig.label}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {c.note && ` · ${c.note}`}
                  </p>
                </div>

                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                  {he ? statusConfig.he : statusConfig.label}
                </span>

                <span className={`text-sm font-bold shrink-0 ${c.amount_cents >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {c.amount_cents >= 0 ? '+' : ''}{formatCents(c.amount_cents)}
                </span>
              </div>
            )
          })}

          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full py-3 text-sm font-semibold text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              {he ? 'טען עוד...' : 'Load more...'}
            </button>
          )}
        </div>
      ) : (
        <div className="glass-panel py-20 flex flex-col items-center gap-4 border-none shadow-lg">
          <Clock className="w-10 h-10 text-zinc-200" />
          <p className="text-sm text-zinc-400">
            {he ? 'אין עסקאות עדיין' : 'No transactions yet'}
          </p>
        </div>
      )}

      {/* Withdraw Modal */}
      <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900">
              {he ? 'משיכת כספים' : 'Withdraw Funds'}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500">
              {he ? `יתרה זמינה: ${formatCents(balance)}. מינימום $50.` : `Available: ${formatCents(balance)}. Minimum $50.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="number"
                step="0.01"
                min="50"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder="50.00"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 text-lg font-bold outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdraw(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
              >
                {he ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={handleWithdraw}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                {he ? 'משוך' : 'Withdraw'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply Credit Modal */}
      <Dialog open={showCredit} onOpenChange={setShowCredit}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900">
              {he ? 'החל זיכוי על המנוי' : 'Apply Credit to Subscription'}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500">
              {he ? `יתרה זמינה: ${formatCents(balance)}. הסכום יקוזז מהתשלום הבא.` : `Available: ${formatCents(balance)}. Amount will be applied as credit to your next invoice.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="number"
                step="0.01"
                min="1"
                value={creditAmount}
                onChange={e => setCreditAmount(e.target.value)}
                placeholder="10.00"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 text-lg font-bold outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCredit(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
              >
                {he ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={handleApplyCredit}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {he ? 'החל זיכוי' : 'Apply Credit'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
