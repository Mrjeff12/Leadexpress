import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Types ──────────────────────────────────────────────────

export interface PaymentRow {
  id: string
  amount: number
  currency: string
  status: string
  description: string | null
  created: number
  refunded: boolean
  amount_refunded: number
  receipt_url: string | null
  invoice: string | null
  payment_method_brand: string | null
  payment_method_last4: string | null
  payment_method_type: string | null
  customer_email: string | null
  customer_name: string | null
  failure_message: string | null
}

export interface InvoiceRow {
  id: string
  number: string | null
  status: string
  amount_due: number
  amount_paid: number
  currency: string
  created: number
  period_start: number
  period_end: number
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  customer_email: string | null
  customer_name: string | null
}

export interface BillingKPIs {
  total_collected: number
  succeeded_count: number
  failed_count: number
  refunded_count: number
  refunded_amount: number
  dispute_count: number
}

export interface AlertData {
  disputes: {
    id: string
    amount: number
    currency: string
    reason: string
    status: string
    created: number
    evidence_due: number | null
  }[]
  failed_payments: {
    id: string
    amount: number
    currency: string
    customer_email: string | null
    failure_message: string | null
    created: number
  }[]
  past_due: {
    user_id: string
    name: string
    plan: string
    current_period_end: string | null
  }[]
}

// ── API helper ─────────────────────────────────────────────

async function billingAction<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-billing', {
    body: { action, ...params },
  })
  if (error) throw error
  return data as T
}

// ── Payments hook ──────────────────────────────────────────

export function useAdminPayments() {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (params: Record<string, unknown> = {}) => {
    setLoading(true)
    try {
      const res = await billingAction<{ data: PaymentRow[]; has_more: boolean }>('payments', params)
      setPayments(res.data)
      setHasMore(res.has_more)
    } catch (err) {
      console.error('[payments] Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { payments, hasMore, loading, reload: load }
}

// ── Invoices hook ──────────────────────────────────────────

export function useAdminInvoices() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (params: Record<string, unknown> = {}) => {
    setLoading(true)
    try {
      const res = await billingAction<{ data: InvoiceRow[]; has_more: boolean }>('invoices', params)
      setInvoices(res.data)
      setHasMore(res.has_more)
    } catch (err) {
      console.error('[invoices] Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { invoices, hasMore, loading, reload: load }
}

// ── KPIs hook ──────────────────────────────────────────────

export function useAdminBillingKPIs() {
  const [kpis, setKpis] = useState<BillingKPIs | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    billingAction<BillingKPIs>('kpis')
      .then(setKpis)
      .catch((err) => console.error('[kpis] Failed to load:', err))
      .finally(() => setLoading(false))
  }, [])

  return { kpis, loading }
}

// ── Alerts hook ────────────────────────────────────────────

export function useAdminAlerts() {
  const [alerts, setAlerts] = useState<AlertData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    billingAction<AlertData>('alerts')
      .then(setAlerts)
      .catch((err) => console.error('[alerts] Failed to load:', err))
      .finally(() => setLoading(false))
  }, [])

  const totalCount = alerts
    ? alerts.disputes.length + alerts.failed_payments.length + alerts.past_due.length
    : 0

  return { alerts, loading, totalCount }
}

// ── Refund action ──────────────────────────────────────────

export async function issueRefund(chargeId: string, amount?: number) {
  return billingAction<{ id: string; status: string; amount: number }>('refund', {
    chargeId,
    ...(amount ? { amount } : {}),
  })
}

// ── Coupons ───────────────────────────────────────────────

export interface CouponRow {
  id: string
  name: string | null
  percent_off: number | null
  amount_off: number | null
  currency: string | null
  duration: string
  duration_in_months: number | null
  max_redemptions: number | null
  times_redeemed: number
  valid: boolean
  created: number
}

export function useAdminCoupons() {
  const [coupons, setCoupons] = useState<CouponRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await billingAction<{ data: CouponRow[] }>('coupons')
      setCoupons(res.data)
    } catch (err) {
      console.error('[coupons] Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { coupons, loading, reload: load }
}

export async function createCoupon(params: Record<string, unknown>) {
  return billingAction<{ id: string; name: string; valid: boolean }>('create_coupon', params)
}

export async function deleteCoupon(couponId: string) {
  return billingAction<{ id: string; deleted: boolean }>('delete_coupon', { couponId })
}

// ── Products & Prices ─────────────────────────────────────

export interface PriceRow {
  id: string
  unit_amount: number | null
  currency: string
  interval: string | null
  active: boolean
  nickname: string | null
}

export interface ProductRow {
  id: string
  name: string
  description: string | null
  active: boolean
  created: number
  images: string[]
  metadata: Record<string, string>
  prices: PriceRow[]
}

export function useAdminProducts() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await billingAction<{ data: ProductRow[] }>('products')
      setProducts(res.data)
    } catch (err) {
      console.error('[products] Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { products, loading, reload: load }
}

export async function createProduct(name: string, description?: string) {
  return billingAction<{ id: string; name: string }>('create_product', { name, description })
}

export async function createPrice(productId: string, unitAmount: number, interval?: string, nickname?: string) {
  return billingAction<{ id: string; unit_amount: number; active: boolean }>('create_price', {
    productId, unit_amount: unitAmount, interval, nickname,
  })
}

export async function toggleProduct(productId: string, active: boolean) {
  return billingAction<{ id: string; active: boolean }>('toggle_product', { productId, active })
}
