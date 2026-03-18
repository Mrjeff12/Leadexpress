import { useState } from 'react'
import { useI18n } from '../lib/i18n'
import { useAdminGroupScanData, type AdminGroupScanEntry } from '../hooks/useAdminGroupScanData'
import type { GroupScanStatus } from '../hooks/useContractorGroupScanLinks'
import { Plus, CheckCircle2, XCircle, Clock, ShieldAlert, Filter } from 'lucide-react'

const StatusBadge = ({ status, locale }: { status: GroupScanStatus; locale: string }) => {
  switch (status) {
    case 'pending':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[10px] font-bold"><Clock className="w-3 h-3" />{locale === 'he' ? 'ממתין' : 'Pending'}</span>
    case 'joined':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold"><CheckCircle2 className="w-3 h-3" />{locale === 'he' ? 'נכנסנו' : 'Joined'}</span>
    case 'failed':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-bold"><XCircle className="w-3 h-3" />{locale === 'he' ? 'נכשל' : 'Failed'}</span>
    case 'blocked_private':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-bold"><ShieldAlert className="w-3 h-3" />{locale === 'he' ? 'פרטי' : 'Private'}</span>
    case 'archived':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-500 text-[10px] font-bold">{locale === 'he' ? 'בארכיון' : 'Archived'}</span>
  }
}

export default function AdminGroupScanQueue() {
  const { locale } = useI18n()
  const { data, loading, addAdminLink, updateStatus } = useAdminGroupScanData()
  
  const [newLink, setNewLink] = useState('')
  const [groupName, setGroupName] = useState('')
  const [memberCount, setMemberCount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  const [filterStatus, setFilterStatus] = useState<GroupScanStatus | 'all'>('all')
  const [filterSource, setFilterSource] = useState<'all' | 'contractor' | 'admin'>('all')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLink.trim()) return

    setSubmitting(true)
    const res = await addAdminLink(newLink, groupName || undefined, memberCount ? parseInt(memberCount, 10) : undefined)
    if (res.success) {
      setNewLink('')
      setGroupName('')
      setMemberCount('')
    } else {
      alert(res.error)
    }
    setSubmitting(false)
  }

  const handleStatusChange = async (entry: AdminGroupScanEntry, newStatus: GroupScanStatus) => {
    await updateStatus(entry.id, entry.source, newStatus)
  }

  const filteredData = data.filter(entry => {
    if (filterStatus !== 'all' && entry.status !== filterStatus) return false
    if (filterSource !== 'all' && entry.source !== filterSource) return false
    return true
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
            {locale === 'he' ? 'בקשות סריקת קבוצות' : 'Group Scan Requests'}
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {locale === 'he' ? 'ניהול קישורי קבוצות מקבלנים והוספה ידנית למערכת' : 'Manage contractor group links and manually add system groups'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
            <h2 className="text-sm font-bold text-stone-800 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-500" />
              {locale === 'he' ? 'הוספת קבוצת מערכת' : 'Add System Group'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-500 mb-1">
                  {locale === 'he' ? 'קישור הזמנה' : 'Invite Link'}
                </label>
                <input
                  type="text"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50"
                  dir="ltr"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-500 mb-1">
                  {locale === 'he' ? 'שם קבוצה (אופציונלי)' : 'Group Name (Optional)'}
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-500 mb-1">
                  {locale === 'he' ? 'כמות חברים (אופציונלי)' : 'Member Count (Optional)'}
                </label>
                <input
                  type="number"
                  value={memberCount}
                  onChange={(e) => setMemberCount(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !newLink.trim()}
                className="w-full py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? '...' : (locale === 'he' ? 'הוסף למערכת' : 'Add to System')}
              </button>
            </form>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-stone-100 flex items-center gap-4 bg-stone-50/50">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-stone-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs font-medium text-stone-600 outline-none"
                >
                  <option value="all">{locale === 'he' ? 'כל הסטטוסים' : 'All Statuses'}</option>
                  <option value="pending">{locale === 'he' ? 'ממתין' : 'Pending'}</option>
                  <option value="joined">{locale === 'he' ? 'נכנסנו' : 'Joined'}</option>
                  <option value="failed">{locale === 'he' ? 'נכשל' : 'Failed'}</option>
                  <option value="blocked_private">{locale === 'he' ? 'פרטי' : 'Private'}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as any)}
                  className="bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs font-medium text-stone-600 outline-none"
                >
                  <option value="all">{locale === 'he' ? 'כל המקורות' : 'All Sources'}</option>
                  <option value="contractor">{locale === 'he' ? 'קבלנים' : 'Contractors'}</option>
                  <option value="admin">{locale === 'he' ? 'מערכת' : 'System'}</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading && data.length === 0 ? (
                <div className="text-center py-10 text-stone-400 text-sm">Loading...</div>
              ) : filteredData.length === 0 ? (
                <div className="text-center py-10 text-stone-400 text-sm">
                  {locale === 'he' ? 'אין תוצאות' : 'No results found'}
                </div>
              ) : (
                filteredData.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-xl border border-stone-100 bg-white hover:border-stone-200 transition-colors">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${entry.source === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                          {entry.source === 'admin' ? 'System' : 'Contractor'}
                        </span>
                        <span className="text-xs font-mono text-stone-600" dir="ltr">
                          {entry.invite_link_normalized}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-stone-400">
                        {entry.group_name && <span>{entry.group_name}</span>}
                        {entry.member_count && <span>{entry.member_count} members</span>}
                        <span>{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <StatusBadge status={entry.status} locale={locale} />
                      <select
                        value={entry.status}
                        onChange={(e) => handleStatusChange(entry, e.target.value as GroupScanStatus)}
                        className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-[10px] font-medium text-stone-600 outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="joined">Joined</option>
                        <option value="failed">Failed</option>
                        <option value="blocked_private">Private</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
