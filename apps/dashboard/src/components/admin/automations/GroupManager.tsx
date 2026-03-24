import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  Users, Loader2, RefreshCw, AlertCircle, Plus, X,
  ExternalLink, ChevronRight, ArrowLeft, Search, UserCheck,
  Link2, Clock,
} from 'lucide-react'

interface WhatsAppGroup {
  id: string
  name: string
  wa_group_id: string | null
  status: string
  total_members: number
  message_count: number
  last_message_at: string | null
  last_synced_at: string | null
  created_at: string
  member_count?: number
}

interface GroupMember {
  id: string
  phone: string
  display_name: string | null
  is_admin: boolean
  joined_at: string | null
}

export default function GroupManager() {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Add group
  const [showAdd, setShowAdd] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [adding, setAdding] = useState(false)

  // Selected group detail
  const [selectedGroup, setSelectedGroup] = useState<WhatsAppGroup | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  async function fetchGroups() {
    setError(null)
    const { data, error: err } = await supabase
      .from('groups')
      .select('id, name, wa_group_id, status, total_members, message_count, last_message_at, last_synced_at, created_at')
      .order('created_at', { ascending: false })

    if (err) {
      setError(`Failed to load groups: ${err.message}`)
      setLoading(false)
      return
    }

    // Get member counts
    const groupIds = (data || []).map(g => g.id)
    let counts: Record<string, number> = {}
    if (groupIds.length > 0) {
      const { data: countData } = await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds)

      if (countData) {
        for (const row of countData) {
          counts[row.group_id] = (counts[row.group_id] || 0) + 1
        }
      }
    }

    setGroups(
      (data || []).map(g => ({
        ...g,
        member_count: counts[g.id] || g.total_members || 0,
      })) as WhatsAppGroup[]
    )
    setLoading(false)
  }

  useEffect(() => { fetchGroups() }, [])

  async function fetchMembers(groupId: string) {
    setMembersLoading(true)
    const { data, error: err } = await supabase
      .from('group_members')
      .select('id, phone, display_name, is_admin, joined_at')
      .eq('group_id', groupId)
      .order('is_admin', { ascending: false })
      .order('display_name')

    if (err) {
      setError(`Failed to load members: ${err.message}`)
    } else {
      setMembers((data || []) as GroupMember[])
    }
    setMembersLoading(false)
  }

  function selectGroup(group: WhatsAppGroup) {
    setSelectedGroup(group)
    fetchMembers(group.id)
  }

  async function handleAddGroup() {
    if (!inviteLink.trim()) return
    setAdding(true)
    const { error: err } = await supabase
      .from('groups')
      .insert({ wa_group_id: inviteLink.trim(), status: 'pending' })

    if (err) {
      setError(`Failed to add group: ${err.message}`)
    } else {
      setInviteLink('')
      setShowAdd(false)
      fetchGroups()
    }
    setAdding(false)
  }

  const filteredGroups = groups.filter(g =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase())
  )

  function statusBadge(status: string) {
    const map: Record<string, { color: string; label: string }> = {
      active: { color: '#34C759', label: 'Active' },
      inactive: { color: '#8E8E93', label: 'Inactive' },
      pending: { color: '#FF9500', label: 'Pending' },
      error: { color: '#FF3B30', label: 'Error' },
    }
    const def = map[status] || { color: '#8E8E93', label: status }
    return (
      <span
        className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
        style={{ background: `${def.color}15`, color: def.color }}
      >
        {def.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-[#5856D6]" />
      </div>
    )
  }

  // Detail view
  if (selectedGroup) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedGroup(null); setMembers([]) }}
            className="flex items-center gap-1 text-[10px] text-[#007AFF] hover:text-[#007AFF]/80 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#5856D6]" />
            <h3 className="text-sm font-bold text-[#0b0707]/80">{selectedGroup.name || 'Unnamed Group'}</h3>
            {statusBadge(selectedGroup.status)}
          </div>
        </div>

        {/* Group info */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <span className="text-[9px] uppercase tracking-wider text-[#3b3b3b]/40 font-semibold">Members</span>
            <div className="text-xl font-black text-[#0b0707]/80 mt-1 tabular-nums">{selectedGroup.member_count}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <span className="text-[9px] uppercase tracking-wider text-[#3b3b3b]/40 font-semibold">Last Scanned</span>
            <div className="text-xs text-[#0b0707]/60 mt-1">
              {selectedGroup.last_synced_at
                ? new Date(selectedGroup.last_synced_at).toLocaleString()
                : 'Never'}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <span className="text-[9px] uppercase tracking-wider text-[#3b3b3b]/40 font-semibold">Invite Link</span>
            <div className="text-xs text-[#007AFF] mt-1 truncate">
              {selectedGroup.wa_group_id ? (
                <a href={selectedGroup.wa_group_id} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{selectedGroup.wa_group_id}</span>
                </a>
              ) : (
                <span className="text-[#3b3b3b]/30">No link</span>
              )}
            </div>
          </div>
        </div>

        {/* Members list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <span className="text-xs font-bold text-[#0b0707]/70">Members ({members.length})</span>
          </div>
          {membersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-[#5856D6]" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-[#3b3b3b]/30 text-xs">No members found</div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-50">
                    <th className="text-left text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Name</th>
                    <th className="text-left text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Phone</th>
                    <th className="text-left text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Role</th>
                    <th className="text-left text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-gray-50 last:border-b-0">
                      <td className="px-4 py-2 text-xs text-[#0b0707]/70 font-medium">
                        {m.display_name || '--'}
                      </td>
                      <td className="px-4 py-2 text-xs text-[#0b0707]/50 font-mono">
                        {m.phone}
                      </td>
                      <td className="px-4 py-2">
                        {m.is_admin ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#FF9500] bg-[#FF9500]/10 px-1.5 py-0.5 rounded-full">
                            <UserCheck className="w-2.5 h-2.5" />
                            Admin
                          </span>
                        ) : (
                          <span className="text-[9px] text-[#3b3b3b]/30">Member</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-[10px] text-[#3b3b3b]/40">
                        {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#5856D6]" />
          <h3 className="text-sm font-bold text-[#0b0707]/80">WhatsApp Groups</h3>
          <span className="text-[9px] text-[#3b3b3b]/40 bg-[#f5f2ed] px-2 py-0.5 rounded-full">
            {groups.length} groups
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5856D6] text-white text-[10px] font-semibold
              rounded-lg hover:bg-[#4a48c4] transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Group
          </button>
          <button
            onClick={() => { setLoading(true); fetchGroups() }}
            className="flex items-center gap-1 text-[10px] text-[#3b3b3b]/50 hover:text-[#3b3b3b]/80 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-xs text-red-600">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-3 h-3 text-red-400" />
          </button>
        </div>
      )}

      {/* Add Group */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-[#5856D6]/20 shadow-sm p-4 space-y-3">
          <h4 className="text-xs font-bold text-[#0b0707]/70 flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-[#5856D6]" />
            Add WhatsApp Group
          </h4>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inviteLink}
              onChange={(e) => setInviteLink(e.target.value)}
              placeholder="Paste WhatsApp group invite link..."
              className="flex-1 px-3 py-2 text-sm bg-[#f5f2ed] border border-[#efeff1] rounded-lg
                focus:outline-none focus:ring-2 focus:ring-[#5856D6]/30 focus:border-[#5856D6]/50
                text-[#0b0707]/70 placeholder:text-[#3b3b3b]/25"
            />
            <button
              onClick={handleAddGroup}
              disabled={adding || !inviteLink.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#34C759] text-white text-xs font-semibold
                rounded-lg hover:bg-[#2db14e] transition-colors disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-2 bg-gray-100 text-[#3b3b3b]/60 text-xs rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#3b3b3b]/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search groups..."
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-100 rounded-lg shadow-sm
            focus:outline-none focus:ring-2 focus:ring-[#5856D6]/20 focus:border-[#5856D6]/30
            text-[#0b0707]/70 placeholder:text-[#3b3b3b]/25"
        />
      </div>

      {/* Groups table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-8 text-[#3b3b3b]/30 text-xs">
            {search ? 'No groups match your search.' : 'No groups found.'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Group Name</th>
                <th className="text-right text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Members</th>
                <th className="text-left text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Status</th>
                <th className="text-left text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Last Scanned</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => selectGroup(g)}
                  className="border-b border-gray-50 last:border-b-0 hover:bg-[#f5f2ed]/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#5856D6]/10 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5 text-[#5856D6]" />
                      </div>
                      <span className="text-xs font-semibold text-[#0b0707]/70 truncate">
                        {g.name || 'Unnamed Group'}
                      </span>
                    </div>
                  </td>
                  <td className="text-right px-4 py-2.5 text-xs tabular-nums text-[#0b0707]/60 font-medium">
                    {g.member_count}
                  </td>
                  <td className="px-4 py-2.5">{statusBadge(g.status)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-[#3b3b3b]/40">
                      <Clock className="w-3 h-3" />
                      {g.last_synced_at
                        ? new Date(g.last_synced_at).toLocaleDateString()
                        : 'Never'}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <ChevronRight className="w-3.5 h-3.5 text-[#3b3b3b]/20" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
