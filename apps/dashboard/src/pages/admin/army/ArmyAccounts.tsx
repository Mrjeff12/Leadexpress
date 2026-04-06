import { useState } from 'react'
import { useI18n } from '../../../lib/i18n'
import { supabase } from '../../../lib/supabase'
import { useArmyAccounts, type ArmyAccount } from '../../../hooks/useArmyData'
import {
  Plus, Loader2, Wifi, WifiOff, QrCode, Trash2, X,
  Megaphone, MessageCircleReply, HardHat,
} from 'lucide-react'

const ROLE_META: Record<string, { label: string; labelHe: string; color: string; icon: typeof Megaphone }> = {
  publisher: { label: 'Publisher', labelHe: 'מפרסם', color: '#2563eb', icon: Megaphone },
  responder: { label: 'Responder', labelHe: 'מגיב', color: '#f59e0b', icon: MessageCircleReply },
  contractor: { label: 'Contractor', labelHe: 'קבלן', color: '#10b981', icon: HardHat },
}

export default function ArmyAccounts() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const { accounts, loading, refetch } = useArmyAccounts()

  const [addOpen, setAddOpen] = useState(false)
  const [formId, setFormId] = useState('')
  const [formToken, setFormToken] = useState('')
  const [formUrl, setFormUrl] = useState('https://api.green-api.com')
  const [formAlias, setFormAlias] = useState('')
  const [formRole, setFormRole] = useState<'publisher' | 'responder' | 'contractor'>('publisher')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!formId || !formToken) return
    setSaving(true)
    await supabase.from('wa_accounts').insert({
      green_api_id: formId,
      green_api_token: formToken,
      green_api_url: formUrl,
      is_army: true,
      army_role: formRole,
      army_alias: formAlias || `Slave-${accounts.length + 1}`,
      status: 'disconnected',
    })
    setSaving(false)
    setAddOpen(false)
    setFormId(''); setFormToken(''); setFormAlias('')
    refetch()
  }

  async function handleDelete(id: string) {
    if (!confirm(he ? 'למחוק חשבון?' : 'Delete account?')) return
    await supabase.from('wa_accounts').delete().eq('id', id)
    refetch()
  }

  async function handleRoleChange(id: string, role: string) {
    await supabase.from('wa_accounts').update({ army_role: role }).eq('id', id)
    refetch()
  }

  async function fetchQr(account: ArmyAccount) {
    try {
      const url = `${account.green_api_url}/waInstance${account.green_api_id}/qr/${account.green_api_token}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.type === 'qrCode' && data.message) {
        await supabase.from('wa_accounts').update({ qr_code: data.message, status: 'waiting_qr' }).eq('id', account.id)
        refetch()
      }
    } catch { /* ignore */ }
  }

  if (loading) {
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
            {he ? 'חשבונות צבא' : 'Army Accounts'}
          </h1>
          <p className="text-xs text-[#3b3b3b]/50 mt-0.5">
            {he ? `${accounts.length} חשבונות מחוברים` : `${accounts.length} accounts connected`}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          {he ? 'הוסף Slave' : 'Add Slave'}
        </button>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          const role = ROLE_META[acc.army_role ?? 'publisher']
          const connected = acc.status === 'connected'
          return (
            <div
              key={acc.id}
              className="rounded-2xl border p-4 space-y-3 transition-all hover:shadow-md"
              style={{
                background: '#fff',
                borderColor: connected ? `${role.color}30` : '#efeff1',
              }}
            >
              {/* Top row: alias + status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {connected ? (
                    <Wifi className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span className="text-sm font-bold text-[#0b0707]">
                    {acc.army_alias || acc.phone_number || acc.green_api_id}
                  </span>
                </div>
                <button onClick={() => handleDelete(acc.id)} className="p-1 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Phone */}
              {acc.phone_number && (
                <p className="text-[11px] text-[#3b3b3b]/50 font-mono">{acc.phone_number}</p>
              )}

              {/* Role selector */}
              <div className="flex gap-1">
                {Object.entries(ROLE_META).map(([key, meta]) => {
                  const Icon = meta.icon
                  const active = acc.army_role === key
                  return (
                    <button
                      key={key}
                      onClick={() => handleRoleChange(acc.id, key)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                      style={{
                        background: active ? `${meta.color}15` : 'transparent',
                        color: active ? meta.color : '#3b3b3b60',
                        border: `1px solid ${active ? `${meta.color}30` : 'transparent'}`,
                      }}
                    >
                      <Icon className="w-3 h-3" />
                      {he ? meta.labelHe : meta.label}
                    </button>
                  )
                })}
              </div>

              {/* QR Code area */}
              {!connected && (
                <div className="flex flex-col items-center gap-2 py-2">
                  {acc.qr_code ? (
                    <img
                      src={`data:image/png;base64,${acc.qr_code}`}
                      alt="QR"
                      width={140}
                      height={140}
                      className="rounded-xl"
                    />
                  ) : (
                    <button
                      onClick={() => fetchQr(acc)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-all"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      {he ? 'סרוק QR' : 'Get QR Code'}
                    </button>
                  )}
                  <span className="text-[10px] text-[#3b3b3b]/40">
                    {acc.status === 'waiting_qr'
                      ? (he ? 'ממתין לסריקה...' : 'Waiting for scan...')
                      : (he ? 'לא מחובר' : 'Disconnected')}
                  </span>
                </div>
              )}

              {/* Connected since */}
              {connected && acc.connected_since && (
                <p className="text-[10px] text-green-600/60">
                  {he ? 'מחובר מאז' : 'Connected since'}{' '}
                  {new Date(acc.connected_since).toLocaleDateString()}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">{he ? 'הוסף חשבון חדש' : 'Add New Slave'}</h2>
              <button onClick={() => setAddOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  {he ? 'כינוי' : 'Alias'}
                </label>
                <input
                  value={formAlias}
                  onChange={(e) => setFormAlias(e.target.value)}
                  placeholder="e.g. Slave-Miami-01"
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm focus:outline-none focus:border-red-300"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  Green API Instance ID *
                </label>
                <input
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  placeholder="1101234567"
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm font-mono focus:outline-none focus:border-red-300"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  Green API Token *
                </label>
                <input
                  value={formToken}
                  onChange={(e) => setFormToken(e.target.value)}
                  placeholder="abc123..."
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm font-mono focus:outline-none focus:border-red-300"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#3b3b3b]/60 block mb-1">
                  {he ? 'תפקיד' : 'Role'}
                </label>
                <div className="flex gap-2">
                  {Object.entries(ROLE_META).map(([key, meta]) => {
                    const Icon = meta.icon
                    const active = formRole === key
                    return (
                      <button
                        key={key}
                        onClick={() => setFormRole(key as typeof formRole)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-[11px] font-semibold transition-all"
                        style={{
                          background: active ? `${meta.color}15` : '#f9f9f9',
                          color: active ? meta.color : '#3b3b3b80',
                          border: `1px solid ${active ? `${meta.color}30` : '#efeff1'}`,
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {he ? meta.labelHe : meta.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={saving || !formId || !formToken}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (he ? 'הוסף' : 'Add Account')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
