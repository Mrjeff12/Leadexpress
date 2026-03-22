import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { useAdminCoupons, createCoupon, deleteCoupon, type CouponRow } from '../../hooks/useAdminBilling'
import { Ticket, Plus, Trash2, Loader2, Percent, DollarSign } from 'lucide-react'

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function durationLabel(c: CouponRow, he: boolean): string {
  if (c.duration === 'forever') return he ? 'לתמיד' : 'Forever'
  if (c.duration === 'once') return he ? 'פעם אחת' : 'Once'
  if (c.duration === 'repeating' && c.duration_in_months) {
    return he ? `${c.duration_in_months} חודשים` : `${c.duration_in_months} months`
  }
  return c.duration
}

function discountDisplay(c: CouponRow): string {
  if (c.percent_off) return `${c.percent_off}%`
  if (c.amount_off) return `$${(c.amount_off / 100).toFixed(0)}`
  return '—'
}

export default function Coupons() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { coupons, loading, reload } = useAdminCoupons()

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Create form state
  const [name, setName] = useState('')
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent')
  const [value, setValue] = useState('')
  const [duration, setDuration] = useState<'once' | 'repeating' | 'forever'>('once')
  const [months, setMonths] = useState('')
  const [maxRedemptions, setMaxRedemptions] = useState('')

  const handleCreate = async () => {
    if (!name || !value) return
    setCreating(true)
    try {
      const params: Record<string, unknown> = {
        name,
        duration,
        ...(discountType === 'percent'
          ? { percent_off: parseFloat(value) }
          : { amount_off: Math.round(parseFloat(value) * 100) }),
      }
      if (duration === 'repeating' && months) params.duration_in_months = parseInt(months)
      if (maxRedemptions) params.max_redemptions = parseInt(maxRedemptions)
      await createCoupon(params)
      setShowCreate(false)
      setName(''); setValue(''); setMonths(''); setMaxRedemptions('')
      reload()
    } catch (err) {
      alert(`Failed: ${(err as Error).message}`)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(he ? 'למחוק קופון זה?' : 'Delete this coupon?')) return
    setDeleting(id)
    try {
      await deleteCoupon(id)
      reload()
    } catch (err) {
      alert(`Failed: ${(err as Error).message}`)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 border-2 rounded-full" style={{ borderColor: 'rgba(245,158,11,0.15)' }} />
            <div className="absolute inset-0 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#f59e0b', borderTopColor: 'transparent' }} />
          </div>
          <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: '#9ca89e' }}>Loading coupons...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1a1a1a' }}>
            {he ? 'קופונים והנחות' : 'Coupons & Discounts'}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#9ca89e' }}>
            {he ? 'ניהול קופונים ב-Stripe' : 'Manage Stripe coupons'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}
        >
          <Plus className="w-4 h-4" />
          {he ? 'קופון חדש' : 'New Coupon'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="glass-panel p-6 space-y-4" style={{ borderLeft: '3px solid #f59e0b' }}>
          <h3 className="text-sm font-bold" style={{ color: '#1a1a1a' }}>{he ? 'יצירת קופון' : 'Create Coupon'}</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: '#9ca89e' }}>{he ? 'שם' : 'Name'}</label>
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder={he ? 'למשל: השקה 20%' : 'e.g. Launch 20%'}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: '#e5e7eb', fontFamily: 'Outfit' }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: '#9ca89e' }}>{he ? 'סוג הנחה' : 'Discount type'}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDiscountType('percent')}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all"
                  style={{
                    background: discountType === 'percent' ? 'rgba(245,158,11,0.1)' : '#f9fafb',
                    border: discountType === 'percent' ? '1px solid rgba(245,158,11,0.3)' : '1px solid #e5e7eb',
                    color: discountType === 'percent' ? '#d97706' : '#6b7280',
                  }}
                >
                  <Percent className="w-3.5 h-3.5" /> %
                </button>
                <button
                  onClick={() => setDiscountType('amount')}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all"
                  style={{
                    background: discountType === 'amount' ? 'rgba(245,158,11,0.1)' : '#f9fafb',
                    border: discountType === 'amount' ? '1px solid rgba(245,158,11,0.3)' : '1px solid #e5e7eb',
                    color: discountType === 'amount' ? '#d97706' : '#6b7280',
                  }}
                >
                  <DollarSign className="w-3.5 h-3.5" /> $
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: '#9ca89e' }}>
                {discountType === 'percent' ? (he ? 'אחוז הנחה' : 'Percent off') : (he ? 'סכום הנחה ($)' : 'Amount off ($)')}
              </label>
              <input
                type="number" value={value} onChange={(e) => setValue(e.target.value)}
                placeholder={discountType === 'percent' ? '20' : '50'}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: '#e5e7eb', fontFamily: 'Outfit' }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: '#9ca89e' }}>{he ? 'משך' : 'Duration'}</label>
              <select
                value={duration} onChange={(e) => setDuration(e.target.value as 'once' | 'repeating' | 'forever')}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: '#e5e7eb', fontFamily: 'Outfit' }}
              >
                <option value="once">{he ? 'פעם אחת' : 'Once'}</option>
                <option value="repeating">{he ? 'חוזר' : 'Repeating'}</option>
                <option value="forever">{he ? 'לתמיד' : 'Forever'}</option>
              </select>
            </div>
            {duration === 'repeating' && (
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#9ca89e' }}>{he ? 'חודשים' : 'Months'}</label>
                <input
                  type="number" value={months} onChange={(e) => setMonths(e.target.value)}
                  placeholder="3"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: '#e5e7eb', fontFamily: 'Outfit' }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={creating || !name || !value}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all"
              style={{
                background: creating || !name || !value ? '#d1d5db' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {he ? 'צור קופון' : 'Create'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-100"
              style={{ color: '#6b7280' }}
            >
              {he ? 'ביטול' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Coupons grid */}
      {coupons.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(245,158,11,0.08)' }}>
            <Ticket className="w-7 h-7" style={{ color: '#f59e0b' }} />
          </div>
          <p className="text-base font-semibold" style={{ color: '#1a1a1a' }}>
            {he ? 'אין קופונים עדיין' : 'No coupons yet'}
          </p>
          <p className="mt-1 text-sm" style={{ color: '#9ca89e' }}>
            {he ? 'צור קופון ראשון' : 'Create your first coupon'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
          {coupons.map((c) => (
            <div key={c.id} className="glass-panel p-5 relative overflow-hidden group">
              {/* Top accent */}
              <div
                className="absolute top-0 left-0 right-0 h-1 rounded-t-[24px]"
                style={{ background: c.valid ? '#f59e0b' : '#d1d5db' }}
              />

              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: c.percent_off ? 'rgba(139,92,246,0.08)' : 'rgba(59,130,246,0.08)' }}
                  >
                    {c.percent_off
                      ? <Percent className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                      : <DollarSign className="w-4 h-4" style={{ color: '#3b82f6' }} />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#1a1a1a' }}>{c.name || c.id}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: c.valid ? '#16a34a' : '#9ca89e' }}>
                      {c.valid ? (he ? 'פעיל' : 'Active') : (he ? 'לא פעיל' : 'Inactive')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deleting === c.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50"
                >
                  {deleting === c.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                    : <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  }
                </button>
              </div>

              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-extrabold tracking-tight" style={{ color: '#1a1a1a' }}>
                  {discountDisplay(c)}
                </span>
                <span className="text-sm font-medium" style={{ color: '#9ca89e' }}>
                  {he ? 'הנחה' : 'off'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs" style={{ color: '#9ca89e' }}>
                <span>{durationLabel(c, he)}</span>
                <span>·</span>
                <span>{c.times_redeemed} {he ? 'שימושים' : 'used'}</span>
                {c.max_redemptions && (
                  <>
                    <span>·</span>
                    <span>{he ? `מקס ${c.max_redemptions}` : `max ${c.max_redemptions}`}</span>
                  </>
                )}
              </div>

              <p className="text-[10px] mt-2" style={{ color: '#c4c4c4' }}>{formatDate(c.created)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
