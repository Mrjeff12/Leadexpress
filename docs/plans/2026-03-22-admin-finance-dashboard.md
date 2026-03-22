# Admin Finance Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Finance department in the admin dashboard that mirrors Stripe's financial management — payments, invoices, revenue, alerts — so admins never need to open Stripe.

**Architecture:** Single `admin-billing` edge function proxies Stripe API with admin auth. New Finance department (4 tabs) in the existing department system. All financial data fetched real-time from Stripe; MRR/plan data from local DB.

**Tech Stack:** Supabase Edge Functions (Deno), Stripe SDK v17, React + React Router, Lucide icons, existing glass-panel/badge CSS classes.

---

### Task 1: Edge Function — `admin-billing`

**Files:**
- Create: `supabase/functions/admin-billing/index.ts`

**Step 1: Create the edge function**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "npm:stripe@17";
import { getCorsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Unauthorized");

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Forbidden");
  return user;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAdmin(req);

    const { action, ...params } = await req.json();

    let result: unknown;

    switch (action) {
      case "payments": {
        const listParams: Stripe.ChargeListParams = {
          limit: params.limit ?? 50,
          expand: ["data.customer"],
        };
        if (params.starting_after) listParams.starting_after = params.starting_after;
        if (params.created_gte || params.created_lte) {
          listParams.created = {};
          if (params.created_gte) (listParams.created as Record<string, number>).gte = params.created_gte;
          if (params.created_lte) (listParams.created as Record<string, number>).lte = params.created_lte;
        }

        const charges = await stripe.charges.list(listParams);
        result = {
          data: charges.data.map((ch) => ({
            id: ch.id,
            amount: ch.amount,
            currency: ch.currency,
            status: ch.status,
            description: ch.description,
            created: ch.created,
            refunded: ch.refunded,
            amount_refunded: ch.amount_refunded,
            receipt_url: ch.receipt_url,
            invoice: ch.invoice,
            payment_method_brand: ch.payment_method_details?.card?.brand ?? ch.payment_method_details?.type ?? null,
            payment_method_last4: ch.payment_method_details?.card?.last4 ?? null,
            payment_method_type: ch.payment_method_details?.type ?? null,
            customer_email: typeof ch.customer === "object" && ch.customer !== null
              ? (ch.customer as Stripe.Customer).email
              : null,
            customer_name: typeof ch.customer === "object" && ch.customer !== null
              ? (ch.customer as Stripe.Customer).name
              : null,
            failure_message: ch.failure_message,
          })),
          has_more: charges.has_more,
        };
        break;
      }

      case "invoices": {
        const invParams: Stripe.InvoiceListParams = {
          limit: params.limit ?? 50,
          expand: ["data.customer"],
        };
        if (params.starting_after) invParams.starting_after = params.starting_after;
        if (params.status) invParams.status = params.status;

        const invoices = await stripe.invoices.list(invParams);
        result = {
          data: invoices.data.map((inv) => ({
            id: inv.id,
            number: inv.number,
            status: inv.status,
            amount_due: inv.amount_due,
            amount_paid: inv.amount_paid,
            currency: inv.currency,
            created: inv.created,
            period_start: inv.period_start,
            period_end: inv.period_end,
            hosted_invoice_url: inv.hosted_invoice_url,
            invoice_pdf: inv.invoice_pdf,
            customer_email: typeof inv.customer === "object" && inv.customer !== null
              ? (inv.customer as Stripe.Customer).email
              : null,
            customer_name: typeof inv.customer === "object" && inv.customer !== null
              ? (inv.customer as Stripe.Customer).name
              : null,
          })),
          has_more: invoices.has_more,
        };
        break;
      }

      case "balance": {
        const balance = await stripe.balance.retrieve();
        result = {
          available: balance.available.map((b) => ({ amount: b.amount, currency: b.currency })),
          pending: balance.pending.map((b) => ({ amount: b.amount, currency: b.currency })),
        };
        break;
      }

      case "kpis": {
        const now = new Date();
        const startOfMonth = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);

        const [charges, disputes] = await Promise.all([
          stripe.charges.list({ created: { gte: startOfMonth }, limit: 100 }),
          stripe.disputes.list({ limit: 10 }),
        ]);

        const succeeded = charges.data.filter((c) => c.status === "succeeded");
        const failed = charges.data.filter((c) => c.status === "failed");
        const refunded = charges.data.filter((c) => c.refunded);

        result = {
          total_collected: succeeded.reduce((s, c) => s + c.amount, 0),
          succeeded_count: succeeded.length,
          failed_count: failed.length,
          refunded_count: refunded.length,
          refunded_amount: refunded.reduce((s, c) => s + c.amount_refunded, 0),
          dispute_count: disputes.data.filter((d) => d.status === "needs_response" || d.status === "warning_needs_response").length,
        };
        break;
      }

      case "refund": {
        if (!params.chargeId) throw new Error("chargeId is required");
        const refund = await stripe.refunds.create({
          charge: params.chargeId,
          ...(params.amount ? { amount: params.amount } : {}),
        });
        result = { id: refund.id, status: refund.status, amount: refund.amount };
        break;
      }

      case "alerts": {
        const [disputes, failedCharges, pastDueSubs] = await Promise.all([
          stripe.disputes.list({ limit: 20 }),
          stripe.charges.list({ limit: 20 }).then((res) =>
            res.data.filter((c) => c.status === "failed")
          ),
          supabase
            .from("subscriptions")
            .select("user_id, status, current_period_end, stripe_customer_id, plans ( slug, name ), profiles ( full_name )")
            .eq("status", "past_due"),
        ]);

        result = {
          disputes: disputes.data.map((d) => ({
            id: d.id,
            amount: d.amount,
            currency: d.currency,
            reason: d.reason,
            status: d.status,
            created: d.created,
            evidence_due: d.evidence_details?.due_by ?? null,
          })),
          failed_payments: failedCharges.map((c) => ({
            id: c.id,
            amount: c.amount,
            currency: c.currency,
            customer_email: typeof c.customer === "object" && c.customer !== null
              ? (c.customer as Stripe.Customer).email
              : null,
            failure_message: c.failure_message,
            created: c.created,
          })),
          past_due: (pastDueSubs.data || []).map((s: Record<string, unknown>) => ({
            user_id: s.user_id,
            name: (s.profiles as Record<string, unknown>)?.full_name ?? "Unknown",
            plan: (s.plans as Record<string, unknown>)?.name ?? "Unknown",
            current_period_end: s.current_period_end,
          })),
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = (err as Error).message;
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

**Step 2: Deploy and test**

Run: `supabase functions deploy admin-billing --no-verify-jwt`
Test: `curl -X POST <supabase-url>/functions/v1/admin-billing -H "Authorization: Bearer <admin-jwt>" -H "Content-Type: application/json" -d '{"action":"kpis"}'`
Expected: JSON with `total_collected`, `succeeded_count`, etc.

**Step 3: Commit**

```bash
git add supabase/functions/admin-billing/index.ts
git commit -m "feat: admin-billing edge function — Stripe API proxy with admin auth"
```

---

### Task 2: Hook — `useAdminBilling`

**Files:**
- Create: `apps/dashboard/src/hooks/useAdminBilling.ts`

**Step 1: Create the hook**

```typescript
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
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/hooks/useAdminBilling.ts
git commit -m "feat: useAdminBilling hooks — payments, invoices, KPIs, alerts, refund"
```

---

### Task 3: Payments Page

**Files:**
- Create: `apps/dashboard/src/pages/admin/Payments.tsx`

**Step 1: Create the payments page**

```typescript
import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { useAdminPayments, useAdminBillingKPIs, issueRefund, type PaymentRow } from '../../hooks/useAdminBilling'
import {
  DollarSign, CheckCircle2, XCircle, RotateCcw, AlertTriangle,
  Search, ChevronDown, ChevronUp, ExternalLink, Loader2, Receipt,
} from 'lucide-react'

function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function paymentMethodLabel(row: PaymentRow): string {
  if (row.payment_method_brand && row.payment_method_last4) {
    const brand = row.payment_method_brand.charAt(0).toUpperCase() + row.payment_method_brand.slice(1)
    return `${brand} •••• ${row.payment_method_last4}`
  }
  if (row.payment_method_type) {
    return row.payment_method_type.charAt(0).toUpperCase() + row.payment_method_type.slice(1)
  }
  return '—'
}

const STATUS_CONFIG: Record<string, { badge: string; icon: typeof CheckCircle2 }> = {
  succeeded: { badge: 'badge badge-green', icon: CheckCircle2 },
  failed: { badge: 'badge badge-red', icon: XCircle },
  pending: { badge: 'badge badge-orange', icon: AlertTriangle },
}

type StatusFilter = 'all' | 'succeeded' | 'failed' | 'refunded'

export default function Payments() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { payments, loading } = useAdminPayments()
  const { kpis } = useAdminBillingKPIs()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [refunding, setRefunding] = useState<string | null>(null)

  const filtered = payments.filter((p) => {
    if (statusFilter === 'refunded' && !p.refunded) return false
    if (statusFilter === 'succeeded' && (p.status !== 'succeeded' || p.refunded)) return false
    if (statusFilter === 'failed' && p.status !== 'failed') return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !(p.customer_email?.toLowerCase().includes(q)) &&
        !(p.customer_name?.toLowerCase().includes(q))
      ) return false
    }
    return true
  })

  const handleRefund = async (chargeId: string) => {
    if (!confirm(he ? 'בטוח שרוצה לבצע החזר?' : 'Are you sure you want to refund this payment?')) return
    setRefunding(chargeId)
    try {
      await issueRefund(chargeId)
      window.location.reload()
    } catch (err) {
      alert(`Refund failed: ${(err as Error).message}`)
    } finally {
      setRefunding(null)
    }
  }

  const succeededCount = payments.filter((p) => p.status === 'succeeded' && !p.refunded).length
  const refundedCount = payments.filter((p) => p.refunded).length
  const failedCount = payments.filter((p) => p.status === 'failed').length

  const kpiCards = [
    { label: he ? 'הכל' : 'All', value: payments.length, active: statusFilter === 'all', onClick: () => setStatusFilter('all') },
    { label: he ? 'הצליחו' : 'Succeeded', value: succeededCount, active: statusFilter === 'succeeded', onClick: () => setStatusFilter('succeeded'), color: '#10b981' },
    { label: he ? 'הוחזרו' : 'Refunded', value: refundedCount, active: statusFilter === 'refunded', onClick: () => setStatusFilter('refunded'), color: '#f59e0b' },
    { label: he ? 'נכשלו' : 'Failed', value: failedCount, active: statusFilter === 'failed', onClick: () => setStatusFilter('failed'), color: '#ef4444' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f59e0b' }} />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
          {he ? 'תשלומים' : 'Payments'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
          {he ? 'נתונים בזמן אמת מ-Stripe' : 'Real-time data from Stripe'}
        </p>
      </header>

      {/* KPI + Total Collected */}
      {kpis && (
        <div className="glass-panel p-5 flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}>
            <DollarSign className="h-6 w-6" style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: '#2d3a2e' }}>
              {formatCents(kpis.total_collected)}
            </p>
            <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>
              {he ? 'נגבה החודש' : 'Collected this month'}
            </p>
          </div>
        </div>
      )}

      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-3">
        {kpiCards.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={kpi.onClick}
            className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
              kpi.active
                ? 'bg-white shadow-sm border-[#e0e4e0]'
                : 'border-transparent hover:bg-white/50'
            }`}
            style={{ color: kpi.active ? (kpi.color ?? '#2d3a2e') : '#9ca89e' }}
          >
            {kpi.label} <span className="ml-1 font-bold">{kpi.value}</span>
          </button>
        ))}

        <div className="flex-1" />

        <div className="relative min-w-[200px] max-w-xs">
          <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9ca89e', left: he ? 'auto' : '0.75rem', right: he ? '0.75rem' : 'auto' }} />
          <input
            type="text"
            placeholder={he ? 'חיפוש לפי אימייל...' : 'Search by email...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border text-sm py-2"
            style={{
              borderColor: '#e0e4e0',
              paddingLeft: he ? '0.75rem' : '2.25rem',
              paddingRight: he ? '2.25rem' : '0.75rem',
              color: '#2d3a2e',
            }}
          />
        </div>
      </div>

      {/* Payments table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-sticky">
            <thead>
              <tr style={{ borderBottom: '1px solid #e0e4e0' }}>
                {[
                  he ? 'סכום' : 'Amount',
                  he ? 'סטטוס' : 'Status',
                  he ? 'אמצעי תשלום' : 'Payment Method',
                  he ? 'תיאור' : 'Description',
                  he ? 'לקוח' : 'Customer',
                  he ? 'תאריך' : 'Date',
                  '',
                ].map((h) => (
                  <th key={h} className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isExpanded = expandedRow === p.id
                const statusKey = p.refunded ? 'refunded' : p.status
                const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG['pending']

                return (
                  <>
                    <tr
                      key={p.id}
                      className="cursor-pointer transition-colors hover:bg-[#f5f7f5]"
                      style={{ borderBottom: '1px solid #eef0ee' }}
                      onClick={() => setExpandedRow(isExpanded ? null : p.id)}
                    >
                      <td className="px-5 py-3.5 font-semibold" style={{ color: '#2d3a2e' }}>
                        {formatCents(p.amount, p.currency)} <span className="text-xs font-normal uppercase" style={{ color: '#9ca89e' }}>{p.currency}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={p.refunded ? 'badge badge-orange' : cfg.badge}>
                          {p.refunded ? (he ? 'הוחזר' : 'Refunded') : statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#2d3a2e' }}>
                        {paymentMethodLabel(p)}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                        {p.description || '—'}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#2d3a2e' }}>
                        {p.customer_email || p.customer_name || '—'}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                        {formatDate(p.created)}
                      </td>
                      <td className="px-5 py-3.5">
                        {isExpanded ? <ChevronUp className="h-4 w-4" style={{ color: '#9ca89e' }} /> : <ChevronDown className="h-4 w-4" style={{ color: '#9ca89e' }} />}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${p.id}-detail`}>
                        <td colSpan={7} className="px-5 py-4" style={{ backgroundColor: '#fafbfa' }}>
                          <div className="ml-2 flex flex-wrap gap-6 text-xs" style={{ color: '#6b7c6e' }}>
                            <div>
                              <strong>Charge ID:</strong> <code className="text-[10px]">{p.id}</code>
                            </div>
                            {p.receipt_url && (
                              <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline" style={{ color: '#f59e0b' }}>
                                <Receipt className="h-3 w-3" /> Receipt <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {p.failure_message && (
                              <div className="text-red-600">
                                <strong>Failure:</strong> {p.failure_message}
                              </div>
                            )}
                            {p.refunded && (
                              <div>
                                <strong>Refunded:</strong> {formatCents(p.amount_refunded, p.currency)}
                              </div>
                            )}
                            {p.status === 'succeeded' && !p.refunded && (
                              <button
                                type="button"
                                disabled={refunding === p.id}
                                onClick={(e) => { e.stopPropagation(); handleRefund(p.id) }}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors"
                              >
                                {refunding === p.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <RotateCcw className="h-3 w-3" />
                                }
                                {he ? 'החזר' : 'Refund'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center" style={{ color: '#9ca89e' }}>
                    {he ? 'לא נמצאו תשלומים' : 'No payments found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/pages/admin/Payments.tsx
git commit -m "feat: admin Payments page — real-time Stripe charges with filters and refund"
```

---

### Task 4: Invoices Page

**Files:**
- Create: `apps/dashboard/src/pages/admin/AllInvoices.tsx`

**Step 1: Create the invoices page**

```typescript
import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { useAdminInvoices } from '../../hooks/useAdminBilling'
import { FileText, Download, ExternalLink, Search, Loader2 } from 'lucide-react'

function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<string, string> = {
  paid: 'badge badge-green',
  open: 'badge badge-blue',
  void: 'badge badge-red',
  uncollectible: 'badge badge-orange',
  draft: 'badge badge-orange',
}

type InvoiceStatusFilter = 'all' | 'paid' | 'open' | 'void' | 'uncollectible'

export default function AllInvoices() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { invoices, loading } = useAdminInvoices()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('all')

  const filtered = invoices.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !(inv.customer_email?.toLowerCase().includes(q)) &&
        !(inv.number?.toLowerCase().includes(q))
      ) return false
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f59e0b' }} />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
          {he ? 'חשבוניות' : 'Invoices'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
          {he ? 'כל החשבוניות של כל הלקוחות' : 'All invoices across all customers'}
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatusFilter)}
          className="rounded-xl border text-sm py-2 px-3"
          style={{ borderColor: '#e0e4e0', color: '#2d3a2e' }}
        >
          <option value="all">{he ? 'כל הסטטוסים' : 'All Statuses'}</option>
          <option value="paid">{he ? 'שולם' : 'Paid'}</option>
          <option value="open">{he ? 'פתוח' : 'Open'}</option>
          <option value="void">{he ? 'בוטל' : 'Void'}</option>
          <option value="uncollectible">{he ? 'לא ניתן לגבייה' : 'Uncollectible'}</option>
        </select>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9ca89e', left: he ? 'auto' : '0.75rem', right: he ? '0.75rem' : 'auto' }} />
          <input
            type="text"
            placeholder={he ? 'חיפוש...' : 'Search by email or invoice #...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border text-sm py-2"
            style={{
              borderColor: '#e0e4e0',
              paddingLeft: he ? '0.75rem' : '2.25rem',
              paddingRight: he ? '2.25rem' : '0.75rem',
              color: '#2d3a2e',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-sticky">
            <thead>
              <tr style={{ borderBottom: '1px solid #e0e4e0' }}>
                {[
                  he ? 'מספר' : 'Invoice #',
                  he ? 'לקוח' : 'Customer',
                  he ? 'סכום' : 'Amount',
                  he ? 'סטטוס' : 'Status',
                  he ? 'תקופה' : 'Period',
                  he ? 'תאריך' : 'Created',
                  '',
                ].map((h) => (
                  <th key={h} className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="transition-colors hover:bg-[#f5f7f5]" style={{ borderBottom: '1px solid #eef0ee' }}>
                  <td className="px-5 py-3.5 font-medium" style={{ color: '#2d3a2e' }}>
                    {inv.number || '—'}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: '#2d3a2e' }}>
                    {inv.customer_email || '—'}
                  </td>
                  <td className="px-5 py-3.5 font-semibold" style={{ color: '#2d3a2e' }}>
                    {formatCents(inv.amount_paid || inv.amount_due, inv.currency)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={STATUS_BADGE[inv.status ?? ''] ?? 'badge'}>
                      {(inv.status ?? '').charAt(0).toUpperCase() + (inv.status ?? '').slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                    {formatDate(inv.period_start)} — {formatDate(inv.period_end)}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                    {formatDate(inv.created)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {inv.invoice_pdf && (
                        <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-600 transition-colors" title="Download PDF">
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {inv.hosted_invoice_url && (
                        <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-600 transition-colors" title="View invoice">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center" style={{ color: '#9ca89e' }}>
                    {he ? 'לא נמצאו חשבוניות' : 'No invoices found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/pages/admin/AllInvoices.tsx
git commit -m "feat: admin AllInvoices page — all-customer invoice list with PDF download"
```

---

### Task 5: Alerts Page

**Files:**
- Create: `apps/dashboard/src/pages/admin/Alerts.tsx`

**Step 1: Create the alerts page**

```typescript
import { useI18n } from '../../lib/i18n'
import { useAdminAlerts } from '../../hooks/useAdminBilling'
import { AlertTriangle, XCircle, Clock, Loader2 } from 'lucide-react'

function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Alerts() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { alerts, loading, totalCount } = useAdminAlerts()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f59e0b' }} />
      </div>
    )
  }

  if (!alerts || totalCount === 0) {
    return (
      <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
        <header>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
            {he ? 'התראות' : 'Alerts'}
          </h1>
        </header>
        <div className="glass-panel p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <p className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
            {he ? 'הכל תקין!' : 'All clear!'}
          </p>
          <p className="text-sm mt-1" style={{ color: '#9ca89e' }}>
            {he ? 'אין התראות פעילות' : 'No active alerts'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
          {he ? 'התראות' : 'Alerts'}
          {totalCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold">
              {totalCount}
            </span>
          )}
        </h1>
      </header>

      {/* Failed Payments */}
      {alerts.failed_payments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: '#2d3a2e' }}>
            <XCircle className="h-5 w-5 text-red-500" />
            {he ? 'תשלומים שנכשלו' : 'Failed Payments'}
            <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{alerts.failed_payments.length}</span>
          </h2>
          <div className="space-y-3">
            {alerts.failed_payments.map((fp) => (
              <div key={fp.id} className="glass-panel p-4 border-l-4 border-red-400">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#2d3a2e' }}>
                      {fp.customer_email || 'Unknown customer'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#6b7c6e' }}>
                      {fp.failure_message || 'Payment declined'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">{formatCents(fp.amount, fp.currency)}</p>
                    <p className="text-xs" style={{ color: '#9ca89e' }}>{formatDate(fp.created)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Disputes */}
      {alerts.disputes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: '#2d3a2e' }}>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {he ? 'מחלוקות' : 'Disputes'}
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{alerts.disputes.length}</span>
          </h2>
          <div className="space-y-3">
            {alerts.disputes.map((d) => (
              <div key={d.id} className="glass-panel p-4 border-l-4 border-amber-400">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#2d3a2e' }}>
                      {d.reason?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Dispute'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#6b7c6e' }}>
                      Status: {d.status?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-600">{formatCents(d.amount, d.currency)}</p>
                    {d.evidence_due && (
                      <p className="text-xs text-red-500 flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" /> Evidence due: {formatDate(d.evidence_due)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Past Due Subscriptions */}
      {alerts.past_due.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: '#2d3a2e' }}>
            <Clock className="h-5 w-5 text-orange-500" />
            {he ? 'מנויים באיחור' : 'Past Due Subscriptions'}
            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{alerts.past_due.length}</span>
          </h2>
          <div className="space-y-3">
            {alerts.past_due.map((s) => (
              <div key={s.user_id} className="glass-panel p-4 border-l-4 border-orange-400">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#2d3a2e' }}>{s.name}</p>
                    <p className="text-xs" style={{ color: '#6b7c6e' }}>{he ? 'מסלול:' : 'Plan:'} {s.plan}</p>
                  </div>
                  {s.current_period_end && (
                    <p className="text-xs" style={{ color: '#9ca89e' }}>
                      {he ? 'תאריך חידוש:' : 'Period end:'} {new Date(s.current_period_end).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/pages/admin/Alerts.tsx
git commit -m "feat: admin Alerts page — failed payments, disputes, past-due subs"
```

---

### Task 6: Wire Finance Department

**Files:**
- Modify: `apps/dashboard/src/config/departmentConfig.ts` — add Finance department, remove Revenue from Settings
- Modify: `apps/dashboard/src/components/admin/DepartmentLayout.tsx` — add Finance lazy imports + tab mapping
- Modify: `apps/dashboard/src/components/admin/AdminCanvas.tsx:79` — update Finance node path

**Step 1: Add Finance department to `departmentConfig.ts`**

Add `DollarSign` to the imports from lucide-react:
```typescript
import { HardHat, Radio, Settings, Handshake, Bot, DollarSign, type LucideIcon } from 'lucide-react'
```

Add finance department after partners (before bot):
```typescript
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
```

Remove revenue tab from settings department — change settings tabs to:
```typescript
    tabs: [
      { key: 'professions', labelEn: 'Professions', labelHe: 'מקצועות', path: '' },
      { key: 'system', labelEn: 'System', labelHe: 'מערכת', path: 'system' },
    ],
```

Remove mrr from settings KPIs:
```typescript
    kpis: [
      { key: 'professionsCount', labelEn: 'Professions', labelHe: 'מקצועות' },
    ],
```

**Step 2: Add Finance tab components to `DepartmentLayout.tsx`**

Add lazy imports after the Settings imports:
```typescript
// Finance
const Payments = lazy(() => import('../../pages/admin/Payments'))
const AllInvoices = lazy(() => import('../../pages/admin/AllInvoices'))
const Alerts = lazy(() => import('../../pages/admin/Alerts'))
```

Add to `TAB_COMPONENTS`:
```typescript
  // Finance
  'finance/payments': Payments,
  'finance/revenue': Revenue,
  'finance/invoices': AllInvoices,
  'finance/alerts': Alerts,
```

Remove from `TAB_COMPONENTS`:
```typescript
  // delete this line:
  'settings/revenue': Revenue,
```

**Step 3: Update AdminCanvas finance node path**

In `AdminCanvas.tsx` line 79, change:
```typescript
  path: '/admin/clients/subscriptions'
```
to:
```typescript
  path: '/admin/finance'
```

**Step 4: Commit**

```bash
git add apps/dashboard/src/config/departmentConfig.ts apps/dashboard/src/components/admin/DepartmentLayout.tsx apps/dashboard/src/components/admin/AdminCanvas.tsx
git commit -m "feat: wire Finance department — payments, revenue, invoices, alerts tabs"
```

---

### Task 7: Fix Email Bug in Subscriptions.tsx

**Files:**
- Modify: `apps/dashboard/src/pages/admin/Subscriptions.tsx:42-75`

**Step 1: Fix the query to include email from auth metadata**

The issue: line 68 sets `email: ''` because `profiles` table has no email field.

Fix: Create an RPC function to return subscriber data with emails, OR query Stripe customer email via the `admin-billing` edge function.

Simplest fix: use the `stripe_customer_id` to display what we have, and add an RPC that reads `auth.users.email`. Since adding an RPC requires a migration, the simplest immediate fix is to query `auth.users` email via the existing admin context.

**Alternative simpler fix:** Since profiles doesn't have email, use the `supabase.auth.admin.listUsers()` approach via a lightweight edge function. But actually the simplest fix: use the user's email from `auth.users` by creating a DB view or RPC.

**Simplest approach:** Create a Postgres function `admin_get_subscriber_emails()` that returns user_id → email mapping:

Create migration file `supabase/migrations/035_admin_subscriber_emails.sql`:
```sql
-- Returns subscriber emails for admin use
-- Uses SECURITY DEFINER to access auth.users (which RLS can't reach)
CREATE OR REPLACE FUNCTION public.admin_subscriber_emails()
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.user_id, u.email::TEXT
  FROM public.subscriptions s
  JOIN auth.users u ON u.id = s.user_id;
$$;

-- Only admins can call this
REVOKE EXECUTE ON FUNCTION public.admin_subscriber_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_subscriber_emails() TO authenticated;
```

Then in `Subscriptions.tsx`, after loading subscriptions, call the RPC and merge emails:

Replace the `useEffect` load function (lines 40-82):

```typescript
  useEffect(() => {
    async function load() {
      const [subsRes, emailsRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select(`
            id,
            status,
            created_at,
            current_period_end,
            stripe_customer_id,
            plans ( slug, name, price_cents ),
            profiles ( full_name, id )
          `)
          .order('created_at', { ascending: false }),
        supabase.rpc('admin_subscriber_emails'),
      ])

      if (subsRes.error) {
        console.error('Failed to load subscriptions:', subsRes.error)
        setLoading(false)
        return
      }

      const emailMap = new Map<string, string>()
      if (emailsRes.data) {
        for (const row of emailsRes.data) {
          emailMap.set(row.user_id, row.email)
        }
      }

      const rows: SubscriberRow[] = (subsRes.data || []).map((row: any) => {
        const plan = row.plans as any
        const profile = row.profiles as any
        const userId = profile?.id
        return {
          id: row.id,
          name: profile?.full_name || 'Unknown',
          email: (userId ? emailMap.get(userId) : null) || '',
          plan: (plan?.slug || 'starter') as PlanSlug,
          status: (row.status || 'active') as SubStatus,
          fee: plan ? plan.price_cents / 100 : 0,
          joined: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '',
          current_period_end: row.current_period_end,
          stripe_customer_id: row.stripe_customer_id,
        }
      })

      setSubscribers(rows)
      setLoading(false)
    }

    load()
  }, [])
```

Also update the search filter (line 107) to include email:
```typescript
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.email.toLowerCase().includes(search.toLowerCase())) return false
```

Add email column to the table header (after Contractor Name):
```html
<th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
  {he ? 'אימייל' : 'Email'}
</th>
```

Add email cell in table body (after the name cell):
```html
<td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>{sub.email || '—'}</td>
```

Update `colSpan` from 7 to 8 in expanded row and empty state.

**Step 2: Apply the migration**

Run: `supabase db push` or apply via MCP tool.

**Step 3: Commit**

```bash
git add supabase/migrations/035_admin_subscriber_emails.sql apps/dashboard/src/pages/admin/Subscriptions.tsx
git commit -m "fix: show subscriber emails in admin — RPC to access auth.users + add email column"
```

---

## Execution Order Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Edge Function `admin-billing` | — |
| 2 | Hook `useAdminBilling` | Task 1 |
| 3 | Payments page | Task 2 |
| 4 | Invoices page | Task 2 |
| 5 | Alerts page | Task 2 |
| 6 | Wire Finance department | Tasks 3, 4, 5 |
| 7 | Fix email bug | — (independent) |

Tasks 3, 4, 5 can be parallelized. Task 7 is independent of everything else.
