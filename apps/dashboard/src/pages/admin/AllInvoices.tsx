import { useState, useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import { useAdminInvoices } from '../../hooks/useAdminBilling'
import { FileText, Download, ExternalLink, Search, Loader2 } from 'lucide-react'

function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const statusBadge: Record<string, string> = {
  paid: 'badge badge-green',
  open: 'badge badge-blue',
  void: 'badge badge-red',
  uncollectible: 'badge badge-orange',
  draft: 'badge badge-orange',
}

type StatusFilter = 'all' | 'paid' | 'open' | 'void' | 'uncollectible'

export default function AllInvoices() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { invoices, loading } = useAdminInvoices()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = invoices
    if (statusFilter !== 'all') {
      list = list.filter((inv) => inv.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (inv) =>
          (inv.customer_email || '').toLowerCase().includes(q) ||
          (inv.number || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [invoices, statusFilter, search])

  return (
    <div className="animate-fade-in" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#2d3a2e', margin: 0 }}>
          <FileText size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {he ? 'חשבוניות' : 'Invoices'}
        </h1>
        <p style={{ color: '#6b7c6e', marginTop: 4, fontSize: 14 }}>
          {he ? 'כל החשבוניות מכל הלקוחות' : 'All invoices across all customers'}
        </p>
      </div>

      {/* Filters */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          padding: '12px 16px',
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid #e0e4e0',
            fontSize: 14,
            color: '#2d3a2e',
            background: '#fff',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          <option value="all">{he ? 'הכל' : 'All'}</option>
          <option value="paid">{he ? 'שולם' : 'Paid'}</option>
          <option value="open">{he ? 'פתוח' : 'Open'}</option>
          <option value="void">{he ? 'בוטל' : 'Void'}</option>
          <option value="uncollectible">{he ? 'לא ניתן לגבייה' : 'Uncollectible'}</option>
        </select>

        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca89e',
            }}
          />
          <input
            type="text"
            placeholder={he ? 'חיפוש לפי אימייל או מספר חשבונית...' : 'Search by email or invoice number...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px 6px 32px',
              borderRadius: 8,
              border: '1px solid #e0e4e0',
              fontSize: 14,
              color: '#2d3a2e',
              fontFamily: 'Outfit, sans-serif',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ overflow: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader2 size={32} style={{ color: '#d97706', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <table className="table-sticky" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e0e4e0' }}>
                <th style={thStyle}>{he ? 'מס׳ חשבונית' : 'Invoice #'}</th>
                <th style={thStyle}>{he ? 'לקוח' : 'Customer'}</th>
                <th style={thStyle}>{he ? 'סכום' : 'Amount'}</th>
                <th style={thStyle}>{he ? 'סטטוס' : 'Status'}</th>
                <th style={thStyle}>{he ? 'תקופה' : 'Period'}</th>
                <th style={thStyle}>{he ? 'נוצר' : 'Created'}</th>
                <th style={thStyle}>{he ? 'פעולות' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#9ca89e' }}>
                    {he ? 'לא נמצאו חשבוניות' : 'No invoices found'}
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #e0e4e0' }}>
                    <td style={tdStyle}>{inv.number || '—'}</td>
                    <td style={tdStyle}>{inv.customer_email || '—'}</td>
                    <td style={tdStyle}>{formatCents(inv.amount_due, inv.currency)}</td>
                    <td style={tdStyle}>
                      <span className={statusBadge[inv.status] || 'badge'}>{inv.status}</span>
                    </td>
                    <td style={tdStyle}>
                      {formatDate(inv.period_start)} — {formatDate(inv.period_end)}
                    </td>
                    <td style={tdStyle}>{formatDate(inv.created)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {inv.invoice_pdf && (
                          <a
                            href={inv.invoice_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={he ? 'הורד PDF' : 'Download PDF'}
                            style={{ color: '#6b7c6e' }}
                          >
                            <Download size={16} />
                          </a>
                        )}
                        {inv.hosted_invoice_url && (
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={he ? 'צפה בחשבונית' : 'View invoice'}
                            style={{ color: '#6b7c6e' }}
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontWeight: 600,
  color: '#6b7c6e',
  fontSize: 13,
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: '#2d3a2e',
  whiteSpace: 'nowrap',
}
