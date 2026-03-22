import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { useAdminProducts, createProduct, createPrice, toggleProduct, type ProductRow } from '../../hooks/useAdminBilling'
import { Package, Plus, Loader2, DollarSign, ToggleLeft, ToggleRight, Tag } from 'lucide-react'

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPrice(cents: number | null, currency: string): string {
  if (cents === null) return '—'
  return `$${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`
}

function intervalLabel(interval: string | null, he: boolean): string {
  if (!interval) return he ? 'חד פעמי' : 'One-time'
  const labels: Record<string, { en: string; he: string }> = {
    month: { en: '/mo', he: '/חודש' },
    year: { en: '/yr', he: '/שנה' },
    week: { en: '/wk', he: '/שבוע' },
    day: { en: '/day', he: '/יום' },
  }
  return he ? (labels[interval]?.he ?? `/${interval}`) : (labels[interval]?.en ?? `/${interval}`)
}

export default function Products() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { products, loading, reload } = useAdminProducts()

  const [showCreateProduct, setShowCreateProduct] = useState(false)
  const [creating, setCreating] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  // Create product form
  const [prodName, setProdName] = useState('')
  const [prodDesc, setProdDesc] = useState('')

  // Add price form (per product)
  const [addPriceTo, setAddPriceTo] = useState<string | null>(null)
  const [priceAmount, setPriceAmount] = useState('')
  const [priceInterval, setPriceInterval] = useState<string>('month')
  const [priceName, setPriceName] = useState('')
  const [addingPrice, setAddingPrice] = useState(false)

  const handleCreateProduct = async () => {
    if (!prodName) return
    setCreating(true)
    try {
      await createProduct(prodName, prodDesc || undefined)
      setShowCreateProduct(false)
      setProdName(''); setProdDesc('')
      reload()
    } catch (err) {
      alert(`Failed: ${(err as Error).message}`)
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (prod: ProductRow) => {
    setToggling(prod.id)
    try {
      await toggleProduct(prod.id, !prod.active)
      reload()
    } catch (err) {
      alert(`Failed: ${(err as Error).message}`)
    } finally {
      setToggling(null)
    }
  }

  const handleAddPrice = async (productId: string) => {
    if (!priceAmount) return
    setAddingPrice(true)
    try {
      const cents = Math.round(parseFloat(priceAmount) * 100)
      await createPrice(productId, cents, priceInterval || undefined, priceName || undefined)
      setAddPriceTo(null)
      setPriceAmount(''); setPriceName(''); setPriceInterval('month')
      reload()
    } catch (err) {
      alert(`Failed: ${(err as Error).message}`)
    } finally {
      setAddingPrice(false)
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
          <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: '#9ca89e' }}>Loading products...</span>
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
            {he ? 'מוצרים ומסלולים' : 'Products & Plans'}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#9ca89e' }}>
            {he ? 'ניהול מוצרים ומחירים ב-Stripe' : 'Manage Stripe products and pricing'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateProduct(!showCreateProduct)}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}
        >
          <Plus className="w-4 h-4" />
          {he ? 'מוצר חדש' : 'New Product'}
        </button>
      </div>

      {/* Create product form */}
      {showCreateProduct && (
        <div className="glass-panel p-6 space-y-4" style={{ borderLeft: '3px solid #f59e0b' }}>
          <h3 className="text-sm font-bold" style={{ color: '#1a1a1a' }}>{he ? 'יצירת מוצר' : 'Create Product'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: '#9ca89e' }}>{he ? 'שם' : 'Name'}</label>
              <input
                value={prodName} onChange={(e) => setProdName(e.target.value)}
                placeholder={he ? 'למשל: מנוי Pro' : 'e.g. Pro Plan'}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: '#e5e7eb', fontFamily: 'Outfit' }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: '#9ca89e' }}>{he ? 'תיאור' : 'Description'}</label>
              <input
                value={prodDesc} onChange={(e) => setProdDesc(e.target.value)}
                placeholder={he ? 'אופציונלי' : 'Optional'}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: '#e5e7eb', fontFamily: 'Outfit' }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreateProduct}
              disabled={creating || !prodName}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all"
              style={{ background: creating || !prodName ? '#d1d5db' : 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {he ? 'צור מוצר' : 'Create'}
            </button>
            <button
              onClick={() => setShowCreateProduct(false)}
              className="rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-100"
              style={{ color: '#6b7280' }}
            >
              {he ? 'ביטול' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Products list */}
      {products.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(245,158,11,0.08)' }}>
            <Package className="w-7 h-7" style={{ color: '#f59e0b' }} />
          </div>
          <p className="text-base font-semibold" style={{ color: '#1a1a1a' }}>
            {he ? 'אין מוצרים עדיין' : 'No products yet'}
          </p>
          <p className="mt-1 text-sm" style={{ color: '#9ca89e' }}>
            {he ? 'צור מוצר ראשון' : 'Create your first product'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 stagger-children">
          {products.map((prod) => {
            const activePrices = prod.prices.filter((p) => p.active)
            const mainPrice = activePrices[0]

            return (
              <div key={prod.id} className="glass-panel overflow-hidden">
                {/* Product header */}
                <div className="p-5 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: prod.active ? 'rgba(245,158,11,0.08)' : 'rgba(0,0,0,0.04)' }}
                    >
                      <Package className="w-5 h-5" style={{ color: prod.active ? '#f59e0b' : '#9ca89e' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold" style={{ color: prod.active ? '#1a1a1a' : '#9ca89e' }}>
                          {prod.name}
                        </h3>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{
                            background: prod.active ? 'rgba(22,163,74,0.08)' : 'rgba(0,0,0,0.04)',
                            color: prod.active ? '#16a34a' : '#9ca89e',
                          }}
                        >
                          {prod.active ? (he ? 'פעיל' : 'Active') : (he ? 'לא פעיל' : 'Archived')}
                        </span>
                      </div>
                      {prod.description && (
                        <p className="text-xs mt-0.5" style={{ color: '#9ca89e' }}>{prod.description}</p>
                      )}
                      <p className="text-[10px] mt-1" style={{ color: '#c4c4c4' }}>
                        {prod.id} · {formatDate(prod.created)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAddPriceTo(addPriceTo === prod.id ? null : prod.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:scale-[1.02]"
                      style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706' }}
                    >
                      <Tag className="w-3 h-3" />
                      {he ? 'מחיר חדש' : 'Add Price'}
                    </button>
                    <button
                      onClick={() => handleToggle(prod)}
                      disabled={toggling === prod.id}
                      className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                      title={prod.active ? 'Archive' : 'Activate'}
                    >
                      {toggling === prod.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#9ca89e' }} />
                      ) : prod.active ? (
                        <ToggleRight className="w-5 h-5" style={{ color: '#16a34a' }} />
                      ) : (
                        <ToggleLeft className="w-5 h-5" style={{ color: '#9ca89e' }} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Add price form */}
                {addPriceTo === prod.id && (
                  <div className="px-5 pb-4 pt-0">
                    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-semibold block mb-1" style={{ color: '#9ca89e' }}>{he ? 'מחיר ($)' : 'Price ($)'}</label>
                          <input
                            type="number" value={priceAmount} onChange={(e) => setPriceAmount(e.target.value)}
                            placeholder="249"
                            className="w-full rounded-lg border px-3 py-1.5 text-sm"
                            style={{ borderColor: '#e5e7eb', fontFamily: 'Outfit' }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold block mb-1" style={{ color: '#9ca89e' }}>{he ? 'מחזור' : 'Billing'}</label>
                          <select
                            value={priceInterval} onChange={(e) => setPriceInterval(e.target.value)}
                            className="w-full rounded-lg border px-3 py-1.5 text-sm"
                            style={{ borderColor: '#e5e7eb', fontFamily: 'Outfit' }}
                          >
                            <option value="month">{he ? 'חודשי' : 'Monthly'}</option>
                            <option value="year">{he ? 'שנתי' : 'Yearly'}</option>
                            <option value="">{he ? 'חד פעמי' : 'One-time'}</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold block mb-1" style={{ color: '#9ca89e' }}>{he ? 'כינוי' : 'Nickname'}</label>
                          <input
                            value={priceName} onChange={(e) => setPriceName(e.target.value)}
                            placeholder={he ? 'אופציונלי' : 'Optional'}
                            className="w-full rounded-lg border px-3 py-1.5 text-sm"
                            style={{ borderColor: '#e5e7eb', fontFamily: 'Outfit' }}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddPrice(prod.id)}
                          disabled={addingPrice || !priceAmount}
                          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white"
                          style={{ background: addingPrice || !priceAmount ? '#d1d5db' : '#f59e0b' }}
                        >
                          {addingPrice && <Loader2 className="w-3 h-3 animate-spin" />}
                          {he ? 'הוסף' : 'Add'}
                        </button>
                        <button
                          onClick={() => setAddPriceTo(null)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-100"
                          style={{ color: '#6b7280' }}
                        >
                          {he ? 'ביטול' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Prices */}
                {activePrices.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <div className="px-5 py-3 flex flex-wrap gap-3">
                      {activePrices.map((price) => (
                        <div
                          key={price.id}
                          className="flex items-center gap-2 rounded-xl px-3.5 py-2"
                          style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}
                        >
                          <DollarSign className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
                          <span className="text-sm font-bold" style={{ color: '#1a1a1a' }}>
                            {formatPrice(price.unit_amount, price.currency)}
                          </span>
                          <span className="text-xs" style={{ color: '#9ca89e' }}>
                            {intervalLabel(price.interval, he)}
                          </span>
                          {price.nickname && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706' }}>
                              {price.nickname}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activePrices.length === 0 && !mainPrice && (
                  <div className="px-5 py-3 text-xs" style={{ color: '#9ca89e', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    {he ? 'אין מחירים — הוסף מחיר' : 'No prices — add one'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
