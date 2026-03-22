# Admin Finance Dashboard — Design Document

**Date:** 2026-03-22
**Status:** Approved
**Goal:** Replace Stripe dashboard with in-app financial management — payments, invoices, revenue, and alerts.

---

## Architecture

### New Department: Finance

- **Color:** `#f59e0b` (amber)
- **Icon:** `DollarSign`
- **Base path:** `/admin/finance`

### Tabs

| Tab | Path | Source | Description |
|-----|------|--------|-------------|
| Payments | `/admin/finance` | Stripe API (real-time) | All charges — amount, customer, payment method, status, date |
| Revenue | `/admin/finance/revenue` | Local DB | Moved from Settings. MRR, ARR, plan breakdown |
| Invoices | `/admin/finance/invoices` | Stripe API (real-time) | All invoices across all customers. PDF download |
| Alerts | `/admin/finance/alerts` | Stripe API + local DB | Failed payments, disputes, past_due subs. Badge count |

### Department KPIs (header bar)

- **MRR** (currency) — from local DB subscriptions
- **Total Collected** (currency) — sum of succeeded charges this month from Stripe
- **Failed Payments** (number) — red badge if > 0

---

## Edge Function: `admin-billing`

Single edge function with action routing.

```
POST /functions/v1/admin-billing
Authorization: Bearer <jwt>
Body: { "action": "...", ...params }
```

### Actions

| Action | Stripe API Call | Key Response Fields |
|--------|----------------|---------------------|
| `payments` | `charges.list({ limit: 50, expand: ['data.customer'] })` | amount, status, customer (email, name), payment_method_details (brand, last4), created, receipt_url, refunded |
| `invoices` | `invoices.list({ limit: 50, expand: ['data.customer'] })` | number, status, amount_due, amount_paid, customer, period_start, period_end, invoice_pdf, hosted_invoice_url |
| `balance` | `balance.retrieve()` | available, pending (by currency) |
| `kpis` | `charges.list({ created: { gte: startOfMonth } })` | total_collected, succeeded_count, failed_count, refunded_count, refunded_amount |
| `refund` | `refunds.create({ charge: chargeId })` | refund id, status, amount |
| `alerts` | `disputes.list({ limit: 20 })` + `charges.list({ status: 'failed', limit: 20 })` | disputes (reason, amount, deadline, status) + failed charges (customer, amount, failure_message) |

### Security

- JWT auth required
- Admin role check: query `profiles.role = 'admin'`
- `refund` action requires explicit `chargeId` parameter
- All Stripe calls use server-side secret key (never exposed to client)

### Filters (passed as params)

- `payments`: `status` (all/succeeded/refunded/failed), `startDate`, `endDate`, `limit`, `starting_after` (pagination)
- `invoices`: `status` (all/paid/open/void/uncollectible), `limit`, `starting_after`
- `alerts`: no filters needed

---

## UI Components

### Payments Page (default tab)

**KPI Summary Bar:**
- All | Succeeded | Refunded | Failed | Disputed (with counts, clickable to filter)

**Filter Bar:**
- Search by customer email/name
- Status filter dropdown
- Date range picker (last 7d / 30d / 90d / custom)

**Payments Table:**

| Column | Source |
|--------|--------|
| Amount | charge.amount (formatted with currency) |
| Currency | charge.currency |
| Status | charge.status — badge (green=succeeded, red=failed, orange=refunded) |
| Payment Method | charge.payment_method_details — "Visa •••• 4242" or "Link" |
| Description | charge.description |
| Customer | charge.customer.email |
| Date | charge.created (formatted) |
| Actions | View details, Refund button |

**Expandable Row:**
- Charge ID (copyable)
- Receipt URL (link)
- Related Invoice (link)
- Refund history (if partially/fully refunded)
- Refund button with confirmation dialog

### Invoices Page

**Table:**

| Column | Source |
|--------|--------|
| Invoice # | invoice.number |
| Customer | invoice.customer.email |
| Amount | invoice.amount_paid or amount_due |
| Status | badge (paid/open/void/uncollectible) |
| Period | period_start — period_end |
| Actions | Download PDF, View hosted invoice |

### Alerts Page

Three sections:

1. **Failed Payments** — red accent cards
   - Customer, amount, failure message, date
   - Link to customer in Stripe

2. **Active Disputes** — yellow accent cards
   - Customer, amount, reason, evidence deadline
   - Status badge (needs_response, under_review, won, lost)

3. **Past Due Subscriptions** — orange accent cards
   - From local DB (subscriptions WHERE status = 'past_due')
   - Customer name, plan, last payment date

**Tab badge:** total count of failed + disputes + past_due

### Revenue Page

Existing `Revenue.tsx` moved as-is from Settings → Finance.

---

## Files

### Create

| File | Purpose |
|------|---------|
| `supabase/functions/admin-billing/index.ts` | Edge function — Stripe API proxy with admin auth |
| `apps/dashboard/src/pages/admin/Payments.tsx` | Payments table + KPIs + filters |
| `apps/dashboard/src/pages/admin/Invoices.tsx` | All-customer invoice list |
| `apps/dashboard/src/pages/admin/Alerts.tsx` | Failed payments, disputes, past_due |
| `apps/dashboard/src/hooks/useAdminBilling.ts` | Shared hook for finance data fetching |

### Modify

| File | Change |
|------|--------|
| `departmentConfig.ts` | Add Finance department, remove Revenue tab from Settings |
| `DepartmentLayout.tsx` | Add Finance tab component mappings |
| `AdminSidebar.tsx` | Add Finance nav item (DollarSign icon, amber color) |
| `AdminCanvas.tsx` | Wire existing Finance node to `/admin/finance` |
| `Subscriptions.tsx` | Fix email bug — join with profiles or auth to get email |

### No Changes Needed

- No DB migration — all financial data from Stripe API real-time
- Webhook handler unchanged — existing sync continues as-is
- User-facing Subscription page unchanged

---

## Design Decisions

1. **Real-time Stripe API** over DB sync — always accurate, less code, no migration
2. **Single edge function** with action routing — one deploy, one auth check, DRY
3. **Finance as its own department** — not buried under Settings
4. **Revenue stays DB-based** — MRR/plan breakdown doesn't need Stripe API
5. **Subscriptions stays in Clients** — logically belongs with contractor management
6. **Alerts tab with badge** — proactive visibility into payment issues
