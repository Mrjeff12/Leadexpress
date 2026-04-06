import { useState, useMemo } from 'react'
import { useI18n } from '../../../lib/i18n'
import { supabase } from '../../../lib/supabase'
import {
  useArmyAccounts,
  useArmyAssignments,
  type ArmyAccount,
  type ArmyAssignment,
} from '../../../hooks/useArmyData'
import {
  Loader2, Plus, X, Users, Megaphone, MessageCircleReply, HardHat, Trash2,
} from 'lucide-react'

const ROLE_ICONS: Record<string, typeof Megaphone> = {
  publisher: Megaphone,
  responder: MessageCircleReply,
  contractor: HardHat,
}
const ROLE_COLORS: Record<string, string> = {
  publisher: '#2563eb',
  responder: '#f59e0b',
  contractor: '#10b981',
}

export default function ArmyAssignments() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { accounts, loading: accLoading } = useArmyAccounts()
  const { assignments, loading: assLoading, refetch } = useArmyAssignments()

  const [addOpen, setAddOpen] = useState(false)
  const [formGroupId, setFormGroupId] = useState('')
  const [formGroupName, setFormGroupName] = useState('')
  const [formAccountId, setFormAccountId] = useState('')
  const [formRole, setFormRole] = useState<'publisher' | 'responder' | 'contractor'>('publisher')
  const [saving, setSaving] = useState(false)

  // Group assignments by group
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: ArmyAssignment[] }>()
    for (const a of assignments) {
      if (!map.has(a.group_wa_id)) map.set(a.group_wa_id, { name: a.group_name ?? a.group_wa_id, items: [] })
      map.get(a.group_wa_id)!.items.push(a)
    }
    return [...map.entries()]
  }, [assignments])

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])

  async function handleAdd() {
    if (!formGroupId || !formAccountId) return
    setSaving(true)
    await supabase.from('army_assignments').upsert({
      wa_account_id: formAccountId,
      group_wa_id: formGroupId,
      group_name: formGroupName || formGroupId,
      role_in_group: formRole,
      is_active: true,
    }, { onConflict: 'wa_account_id,group_wa_id,role_in_group' })
    setSaving(false)
    setAddOpen(false)
    setFormGroupId(''); setFormGroupName('')
    refetch()
  }

  async function handleRemove(id: string) {
    await supabase.from('army_assignments').delete().eq('id', id)
    refetch()
  }

  if (accLoading || assLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0b0707]">
            {he ? 'הקצאות לקבוצות' : 'Group Assignments'}
          </h1>
          <p className="text-xs text-[#3b3b3b]/50 mt-0.5">
            {he ? `${grouped.length} קבוצות מכוסות` : `${grouped.length} groups covered`}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          {he ? 'הוסף הקצאה' : 'Add Assignment'}
        </button>
      </div>

      {/* Groups list */}
      <div className="space-y-4">
        {grouped.map(([groupId, { name, items }]) => (
          <div key={groupId} className="rounded-2xl border border-[#efeff1] bg-white p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#3b3b3b]/40" />
              <span className="text-sm font-bold text-[#0b0707]">{name}</span>
              <span className="text-[10px] text-[#3b3b3b]/30 font-mono">{groupId}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {items.map((item) => {
                const acc = accountMap.get(item.wa_account_id)
                const Icon = ROLE_ICONS[item.role_in_group] ?? Megaphone
                const color = ROLE_COLORS[item.role_in_group] ?? '#666'
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold"
                    style={{
                      background: `${color}10`,
                      color,
                      border: `1px solid ${color}25`,
                    }}
                  >
                    <Icon className="w-3 h-3" />
                    {acc?.army_alias ?? acc?.phone_number ?? 'Unknown'}
                    <button onClick={() => handleRemove(item.id)} className="ml-1 opacity-40 hover:opacity-100">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {grouped.length === 0 && (
          <div className="text-center py-12 text-sm text-[#3b3b3b]/30">
            {he ? 'אין הקצאות עדיין' : 'No assignments yet'}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">{he ? 'הקצאה חדשה' : 'New Assignment'}</h2>
              <button onClick={() => setAddOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  {he ? 'מזהה קבוצה (Group JID)' : 'Group WhatsApp ID'}
                </label>
                <input
                  value={formGroupId}
                  onChange={(e) => setFormGroupId(e.target.value)}
                  placeholder="120363012345@g.us"
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm font-mono focus:outline-none focus:border-red-300"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  {he ? 'שם קבוצה' : 'Group Name'}
                </label>
                <input
                  value={formGroupName}
                  onChange={(e) => setFormGroupName(e.target.value)}
                  placeholder="Miami Renovations"
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm focus:outline-none focus:border-red-300"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  {he ? 'חשבון' : 'Account'}
                </label>
                <select
                  value={formAccountId}
                  onChange={(e) => setFormAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm focus:outline-none focus:border-red-300"
                >
                  <option value="">{he ? 'בחר חשבון...' : 'Select account...'}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.army_alias ?? a.phone_number ?? a.green_api_id} ({a.army_role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  {he ? 'תפקיד בקבוצה' : 'Role in Group'}
                </label>
                <div className="flex gap-2">
                  {(['publisher', 'responder', 'contractor'] as const).map((r) => {
                    const Icon = ROLE_ICONS[r]
                    const color = ROLE_COLORS[r]
                    const active = formRole === r
                    return (
                      <button
                        key={r}
                        onClick={() => setFormRole(r)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-[11px] font-semibold transition-all"
                        style={{
                          background: active ? `${color}15` : '#f9f9f9',
                          color: active ? color : '#3b3b3b80',
                          border: `1px solid ${active ? `${color}30` : '#efeff1'}`,
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {r}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={saving || !formGroupId || !formAccountId}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (he ? 'הוסף' : 'Add Assignment')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
