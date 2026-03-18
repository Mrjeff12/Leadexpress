import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { PROFESSIONS } from '../lib/professions'
import { Plus, Search, User, Phone, Briefcase, Trash2, Edit2, ArrowRight, Clock, CheckCircle2, XCircle, Send as SendIcon } from 'lucide-react'
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'
import FeatureTeaser from '../components/FeatureTeaser'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/shadcn/ui/dialog'
import { Button } from '../components/shadcn/ui/button'
import { Input } from '../components/shadcn/ui/input'
import { useToast } from '../components/hooks/use-toast'

interface Subcontractor {
  id: string
  full_name: string
  phone: string
  profession_tags: string[]
  notes: string | null
  created_at: string
}

interface JobStats {
  [subId: string]: { active: number; completed: number }
}

interface ForwardedJob {
  id: string
  status: string
  deal_type: string
  deal_value: string
  created_at: string
  viewed_at: string | null
  responded_at: string | null
  sub_name: string
  sub_phone: string
  lead_city: string | null
  lead_zip: string | null
}

export default function Subcontractors() {
  const { effectiveUserId } = useAuth()
  const { locale } = useI18n()
  const { toast } = useToast()

  const [subs, setSubs] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [jobStats, setJobStats] = useState<JobStats>({})

  // Modal state
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    profession_tags: [] as string[],
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [forwardedJobs, setForwardedJobs] = useState<ForwardedJob[]>([])

  const fetchSubs = async (showLoading = true) => {
    if (!effectiveUserId) return
    if (showLoading) setLoading(true)
    try {
      const [subsRes, jobsRes, fwdRes] = await Promise.all([
        supabase
          .from('subcontractors')
          .select('*')
          .eq('contractor_id', effectiveUserId)
          .order('created_at', { ascending: false }),
        supabase
          .from('job_orders')
          .select('subcontractor_id, status')
          .eq('contractor_id', effectiveUserId)
          .not('subcontractor_id', 'is', null),
        supabase
          .from('job_orders')
          .select('id, status, deal_type, deal_value, created_at, viewed_at, responded_at, subcontractors ( full_name, phone ), leads ( city, zip_code )')
          .eq('contractor_id', effectiveUserId)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      if (subsRes.error) throw subsRes.error
      if (subsRes.data) setSubs(subsRes.data)

      // Build stats map
      if (jobsRes.data) {
        const stats: JobStats = {}
        for (const jo of jobsRes.data) {
          if (!jo.subcontractor_id) continue
          if (!stats[jo.subcontractor_id]) stats[jo.subcontractor_id] = { active: 0, completed: 0 }
          if (jo.status === 'accepted' || jo.status === 'pending') stats[jo.subcontractor_id].active++
          if (jo.status === 'completed') stats[jo.subcontractor_id].completed++
        }
        setJobStats(stats)
      }

      // Build forwarded jobs list
      if (fwdRes.data) {
        setForwardedJobs(fwdRes.data.map((jo: any) => ({
          id: jo.id,
          status: jo.status,
          deal_type: jo.deal_type,
          deal_value: jo.deal_value,
          created_at: jo.created_at,
          viewed_at: jo.viewed_at,
          responded_at: jo.responded_at,
          sub_name: jo.subcontractors?.full_name || 'Unknown',
          sub_phone: jo.subcontractors?.phone || '',
          lead_city: jo.leads?.city || null,
          lead_zip: jo.leads?.zip_code || null,
        })))
      }
    } catch (err: unknown) {
      toast({ title: 'Error', description: 'Failed to load subcontractors', variant: 'destructive' })
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubs()
  }, [effectiveUserId])

  const { canManageSubs } = useSubscriptionAccess()

  if (!canManageSubs) {
    const teaserSteps = [
      {
        title: 'A New Lead Comes In',
        subtitle: "You get a lead you can't handle — but your network can.",
        duration: 5000,
        visual: (
          <div className="bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden max-w-md mx-auto">
            {/* Lead card mockup — mirrors our LeadsFeed design */}
            <div className="flex">
              {/* Left: time */}
              <div className="w-28 p-4 bg-black/[0.02] border-r border-black/[0.03] flex flex-col gap-1">
                <span className="text-xs font-bold text-[#FF3B30]">🔥 Hot</span>
                <span className="text-[10px] text-stone-400">2 min ago</span>
                <span className="text-[10px] text-stone-400 mt-2">GENESIS SAS</span>
              </div>
              {/* Center: content */}
              <div className="flex-1 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: '#ea580c15', color: '#ea580c' }}>🏠</div>
                  <span className="text-xs font-bold" style={{ color: '#ea580c' }}>Chimney</span>
                </div>
                <p className="text-sm font-medium text-stone-800 mb-1">Chimney repair requested for tomorrow in Cordova, TN.</p>
                <div className="flex items-center gap-3 text-[10px] text-stone-400">
                  <span>📍 Cordova</span>
                  <span>38016</span>
                </div>
              </div>
              {/* Right: action */}
              <div className="w-36 p-3 flex flex-col items-center justify-center gap-2">
                <div className="w-full py-2 rounded-xl bg-[#25D366] text-white text-[11px] font-bold text-center shadow-sm">
                  💬 Contact
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        title: 'Pick a Subcontractor',
        subtitle: 'Choose from your trusted subs — with their profile and track record.',
        duration: 4500,
        visual: (
          <div className="max-w-md mx-auto space-y-3">
            {/* Sub card mockup — mirrors our Subcontractors design */}
            {[
              { name: 'Mike Johnson', phone: '+1 (305) 555-0147', trade: '🔧 Plumbing', jobs: 3, selected: true },
              { name: 'Sarah Chen', phone: '+1 (786) 555-0234', trade: '⚡ Electrical', jobs: 2, selected: false },
            ].map((sub) => (
              <div key={sub.name} className={`bg-white rounded-xl p-4 flex items-center gap-3 border-2 transition-all ${sub.selected ? 'border-[#fe5b25] shadow-lg shadow-orange-100' : 'border-stone-100'}`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fee8df] to-[#fff4ef] border border-[#fdd5c5] flex items-center justify-center">
                  <span className="text-sm font-bold text-[#e04d1c]">{sub.name.split(' ').map(n => n[0]).join('')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-stone-800">{sub.name}</div>
                  <div className="text-[10px] text-stone-400">{sub.phone}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">{sub.trade}</span>
                    <span className="text-[10px] text-stone-400">{sub.jobs} active jobs</span>
                  </div>
                </div>
                {sub.selected && (
                  <div className="w-6 h-6 rounded-full bg-[#fe5b25] flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ),
      },
      {
        title: 'Send via WhatsApp',
        subtitle: 'A ready-made message is sent with all the lead details and deal terms.',
        duration: 5000,
        visual: (
          <div className="max-w-sm mx-auto">
            {/* WhatsApp chat mockup */}
            <div className="bg-[#e5ddd5] rounded-2xl overflow-hidden shadow-xl">
              {/* Header */}
              <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">MJ</div>
                <div>
                  <div className="text-white text-sm font-semibold">Mike Johnson</div>
                  <div className="text-green-200 text-[10px]">online</div>
                </div>
              </div>
              {/* Messages */}
              <div className="p-3 space-y-2">
                <div className="bg-[#DCF8C6] rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%] ml-auto shadow-sm">
                  <p className="text-[11px] text-stone-700 leading-relaxed">
                    Hey Mike! 👋 Got a chimney repair job for you:<br/><br/>
                    📍 <b>Cordova, TN — 38016</b><br/>
                    🏠 1766 Black Bear Circle<br/><br/>
                    💰 Deal: <b>20% of job value</b><br/><br/>
                    👉 View & accept: <span className="text-blue-600 underline">portal.masterleadflow.com/j/abc123</span>
                  </p>
                  <div className="text-[9px] text-stone-500 text-right mt-1">2:15 PM ✓✓</div>
                </div>
                <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 max-w-[70%] shadow-sm">
                  <p className="text-[11px] text-stone-700">I'm in! Accepting the deal now 🤝</p>
                  <div className="text-[9px] text-stone-400 text-right mt-1">2:16 PM</div>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        title: 'Set the Deal Terms',
        subtitle: 'Choose how you split — percentage, fixed price, or custom.',
        duration: 4500,
        visual: (
          <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-xl border border-stone-100 p-5">
            {/* Forward modal mockup */}
            <div className="text-sm font-semibold text-stone-800 mb-3">Forward Lead to Sub</div>
            <div className="bg-stone-50 rounded-xl p-3 mb-4 border border-stone-100">
              <div className="flex items-center gap-2">
                <span className="text-sm">🏠</span>
                <span className="text-xs font-medium text-stone-700">Chimney Repair — Cordova, TN</span>
              </div>
            </div>

            <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">Deal Type</div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: 'Percentage', active: true },
                { label: 'Fixed Price', active: false },
                { label: 'Custom', active: false },
              ].map((t) => (
                <div key={t.label} className={`py-2 px-3 text-[11px] font-medium rounded-xl border text-center ${
                  t.active
                    ? 'bg-[#fff4ef] border-[#fdd5c5] text-[#c43d10]'
                    : 'bg-white border-stone-200 text-stone-500'
                }`}>{t.label}</div>
              ))}
            </div>

            <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">Your Cut</div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-10 px-3 rounded-xl border border-stone-200 flex items-center text-sm font-bold text-stone-800">20</div>
              <span className="text-sm font-bold text-stone-400">%</span>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 py-2.5 rounded-xl bg-[#e04d1c] text-white text-xs font-bold flex items-center justify-center gap-1.5">
                📤 Send via WhatsApp
              </button>
            </div>
          </div>
        ),
      },
      {
        title: 'Track in Your Jobs Dashboard',
        subtitle: 'Monitor every job — status, payments, and sub performance.',
        duration: 5000,
        visual: (
          <div className="max-w-lg mx-auto space-y-3">
            {/* Jobs dashboard mockup — mirrors our JobsDashboard */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Total Jobs', value: '12', icon: '📋' },
                { label: 'Active', value: '5', icon: '🔄' },
                { label: 'Completed', value: '6', icon: '✅' },
                { label: 'Revenue', value: '$4.2k', icon: '💰' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl p-3 border border-stone-100 shadow-sm">
                  <div className="text-[10px] text-stone-400 mb-1">{s.icon} {s.label}</div>
                  <div className="text-lg font-extrabold text-stone-800">{s.value}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
              <table className="w-full text-[11px]">
                <thead><tr className="border-b border-stone-100 text-stone-400 text-[10px] uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Job</th>
                  <th className="px-3 py-2 text-left">Sub</th>
                  <th className="px-3 py-2 text-left">Deal</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Payment</th>
                </tr></thead>
                <tbody>
                  {[
                    { job: '🏠 Chimney Repair', loc: 'Cordova, TN', sub: 'Mike J.', deal: '20%', status: 'Accepted', statusColor: 'bg-blue-50 text-blue-700', payment: 'Pending', payColor: 'bg-stone-100 text-stone-500' },
                    { job: '🚪 Garage Door', loc: 'Osprey, FL', sub: 'Sarah C.', deal: '$500', status: 'Completed', statusColor: 'bg-green-50 text-green-700', payment: 'Paid', payColor: 'bg-green-50 text-green-700' },
                    { job: '🔧 Plumbing', loc: 'Miami, FL', sub: 'Carlos R.', deal: '15%', status: 'In Progress', statusColor: 'bg-amber-50 text-amber-700', payment: 'Partial', payColor: 'bg-amber-50 text-amber-700' },
                  ].map((r) => (
                    <tr key={r.job} className="border-b border-stone-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-stone-800">{r.job}</div>
                        <div className="text-[9px] text-stone-400">{r.loc}</div>
                      </td>
                      <td className="px-3 py-2 text-stone-600">{r.sub}</td>
                      <td className="px-3 py-2 font-mono text-stone-600">{r.deal}</td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.statusColor}`}>{r.status}</span></td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.payColor}`}>{r.payment}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ),
      },
    ]

    return (
      <FeatureTeaser
        steps={teaserSteps}
        featureName="Manage Your Subcontractors"
        price={399}
        planName="Unlimited"
      >
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Active Subs', value: '4', color: 'bg-blue-50 text-blue-600' },
              { label: 'Jobs This Month', value: '12', color: 'bg-green-50 text-green-600' },
              { label: 'Revenue Shared', value: '$8,400', color: 'bg-orange-50 text-orange-600' },
            ].map((s) => (
              <div key={s.label} className={`rounded-2xl p-4 ${s.color}`}>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs opacity-60">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stone-100 text-stone-400 text-xs">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Trade</th>
                <th className="px-4 py-3 text-left">Active Jobs</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr></thead>
              <tbody>
                {[
                  { name: 'Mike Johnson', trade: 'Plumbing', jobs: 3, status: 'Active' },
                  { name: 'Sarah Chen', trade: 'Electrical', jobs: 2, status: 'Active' },
                  { name: 'Carlos Rivera', trade: 'HVAC', jobs: 1, status: 'New' },
                  { name: 'Tom Williams', trade: 'Roofing', jobs: 4, status: 'Active' },
                ].map((r) => (
                  <tr key={r.name} className="border-b border-stone-50">
                    <td className="px-4 py-3 font-medium text-stone-800">{r.name}</td>
                    <td className="px-4 py-3 text-stone-500">{r.trade}</td>
                    <td className="px-4 py-3 text-stone-500">{r.jobs}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-xs">{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </FeatureTeaser>
    )
  }

  const filteredSubs = subs.filter((sub) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      sub.full_name.toLowerCase().includes(q) ||
      sub.phone.includes(q) ||
      sub.profession_tags.some((p) => p.toLowerCase().includes(q))
    )
  })

  const profLookup = Object.fromEntries(PROFESSIONS.map((p) => [p.id, p]))

  function handleOpenModal(sub?: Subcontractor) {
    if (sub) {
      setEditingId(sub.id)
      setFormData({
        full_name: sub.full_name,
        phone: sub.phone,
        profession_tags: sub.profession_tags || [],
        notes: sub.notes || '',
      })
    } else {
      setEditingId(null)
      setFormData({
        full_name: '',
        phone: '',
        profession_tags: [],
        notes: '',
      })
    }
    setIsOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!effectiveUserId) return

    if (!formData.full_name || !formData.phone) {
      toast({ title: 'Error', description: 'Name and phone are required', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase
          .from('subcontractors')
          .update({
            full_name: formData.full_name,
            phone: formData.phone,
            profession_tags: formData.profession_tags,
            notes: formData.notes,
          })
          .eq('id', editingId)

        if (error) throw error
        toast({ title: 'Success', description: 'Subcontractor updated' })
      } else {
        const { error } = await supabase
          .from('subcontractors')
          .insert({
            contractor_id: effectiveUserId,
            full_name: formData.full_name,
            phone: formData.phone,
            profession_tags: formData.profession_tags,
            notes: formData.notes,
          })

        if (error) throw error
        toast({ title: 'Success', description: 'Subcontractor added' })
      }
      setIsOpen(false)
      fetchSubs(false)
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this subcontractor?')) return

    const { error } = await supabase.from('subcontractors').delete().eq('id', id)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Success', description: 'Subcontractor deleted' })
      fetchSubs(false)
    }
  }

  function toggleProfession(profId: string) {
    setFormData((prev) => {
      const tags = prev.profession_tags.includes(profId)
        ? prev.profession_tags.filter((id) => id !== profId)
        : [...prev.profession_tags, profId]
      return { ...prev, profession_tags: tags }
    })
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
            {locale === 'he' ? 'קבלני המשנה שלי' : 'My Sub Contractors'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'hsl(40 4% 42%)' }}>
            {subs.length} {locale === 'he' ? 'קבלני משנה' : 'subcontractors'}
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus className="w-4 h-4" />
          {locale === 'he' ? 'הוסף קבלן משנה' : 'Add Subcontractor'}
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4" style={{ color: 'hsl(40 4% 42%)' }} />
          <input
            type="text"
            placeholder={locale === 'he' ? 'חיפוש...' : 'Search...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 text-sm outline-none"
            style={{ color: 'hsl(40 8% 10%)' }}
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-panel p-5 animate-pulse">
              <div className="h-4 bg-black/[0.04] rounded w-1/3 mb-3" />
              <div className="h-3 bg-black/[0.04] rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filteredSubs.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <User className="w-10 h-10 mx-auto mb-3" style={{ color: 'hsl(40 4% 42%)' }} />
          <p className="text-sm" style={{ color: 'hsl(40 4% 42%)' }}>
            {locale === 'he' ? 'לא נמצאו קבלני משנה' : 'No subcontractors found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubs.map((sub) => (
            <div key={sub.id} className="glass-panel p-5 flex flex-col relative group">
              <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleOpenModal(sub)}
                  className="p-1.5 text-stone-400 hover:text-[#e04d1c] transition-colors bg-white rounded-md shadow-sm border border-stone-100"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(sub.id)}
                  className="p-1.5 text-stone-400 hover:text-red-600 transition-colors bg-white rounded-md shadow-sm border border-stone-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fee8df] to-[#fff4ef] flex items-center justify-center border border-[#fdd5c5] shrink-0">
                  <User className="w-5 h-5 text-[#e04d1c]" />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-800 leading-tight">{sub.full_name}</h3>
                  <div className="flex items-center gap-1 text-xs text-stone-500 mt-0.5">
                    <Phone className="w-3 h-3" />
                    {sub.phone}
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <Briefcase className="w-3.5 h-3.5 text-stone-400" />
                  <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                    {locale === 'he' ? 'מקצועות' : 'Professions'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sub.profession_tags.length > 0 ? (
                    sub.profession_tags.map((tag) => {
                      const prof = profLookup[tag]
                      return (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-600 border border-stone-200"
                        >
                          {prof?.emoji} {prof ? (locale === 'he' ? prof.he : prof.en) : tag}
                        </span>
                      )
                    })
                  ) : (
                    <span className="text-xs text-stone-400 italic">
                      {locale === 'he' ? 'לא הוגדרו מקצועות' : 'No professions set'}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-stone-700">{jobStats[sub.id]?.active || 0}</span>
                  {locale === 'he' ? 'עבודות פעילות' : 'Active Jobs'}
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-stone-700">{jobStats[sub.id]?.completed || 0}</span>
                  {locale === 'he' ? 'הושלמו' : 'Completed'}
                </div>
              </div>

              {sub.notes && (
                <div className="mt-4 pt-3 border-t border-stone-100">
                  <p className="text-xs text-stone-500 line-clamp-2">{sub.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Forwarded Jobs CRM ─── */}
      {forwardedJobs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <SendIcon className="w-4 h-4 text-[#e04d1c]" />
            <h2 className="text-sm font-semibold text-stone-800">
              {locale === 'he' ? 'עבודות שהועברו' : 'Forwarded Jobs'}
            </h2>
            <span className="text-xs text-stone-400">({forwardedJobs.length})</span>
          </div>
          <div className="glass-panel overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs text-stone-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">{locale === 'he' ? 'קבלן משנה' : 'Subcontractor'}</th>
                  <th className="text-left px-4 py-3 font-medium">{locale === 'he' ? 'מיקום' : 'Location'}</th>
                  <th className="text-left px-4 py-3 font-medium">{locale === 'he' ? 'עסקה' : 'Deal'}</th>
                  <th className="text-left px-4 py-3 font-medium">{locale === 'he' ? 'סטטוס' : 'Status'}</th>
                  <th className="text-left px-4 py-3 font-medium">{locale === 'he' ? 'תאריך' : 'Date'}</th>
                </tr>
              </thead>
              <tbody>
                {forwardedJobs.map((job) => {
                  const statusConfig: Record<string, { icon: typeof Clock; label: string; color: string }> = {
                    pending: { icon: Clock, label: locale === 'he' ? 'ממתין' : 'Pending', color: 'text-amber-600 bg-amber-50' },
                    accepted: { icon: CheckCircle2, label: locale === 'he' ? 'התקבל' : 'Accepted', color: 'text-green-600 bg-green-50' },
                    rejected: { icon: XCircle, label: locale === 'he' ? 'נדחה' : 'Rejected', color: 'text-red-600 bg-red-50' },
                    completed: { icon: CheckCircle2, label: locale === 'he' ? 'הושלם' : 'Completed', color: 'text-blue-600 bg-blue-50' },
                    cancelled: { icon: XCircle, label: locale === 'he' ? 'בוטל' : 'Cancelled', color: 'text-stone-500 bg-stone-50' },
                  }
                  const sc = statusConfig[job.status] || statusConfig.pending
                  const StatusIcon = sc.icon
                  return (
                    <tr key={job.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-800">{job.sub_name}</p>
                        <p className="text-[10px] text-stone-400">{job.sub_phone}</p>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {job.lead_city || job.lead_zip || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-stone-600">{job.deal_value}</span>
                        <span className="text-[10px] text-stone-400 ml-1">
                          {job.deal_type === 'percentage' ? '%' : job.deal_type === 'fixed_price' ? '$' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sc.color}`}>
                          <StatusIcon className="w-2.5 h-2.5" />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-400">
                        {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? (locale === 'he' ? 'ערוך קבלן משנה' : 'Edit Subcontractor')
                : (locale === 'he' ? 'הוסף קבלן משנה' : 'Add Subcontractor')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                {locale === 'he' ? 'שם מלא' : 'Full Name'} *
              </label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                {locale === 'he' ? 'טלפון' : 'Phone'} *
              </label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1234567890"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                {locale === 'he' ? 'מקצועות' : 'Professions'}
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-1">
                {PROFESSIONS.map((prof) => {
                  const active = formData.profession_tags.includes(prof.id)
                  return (
                    <button
                      key={prof.id}
                      type="button"
                      onClick={() => toggleProfession(prof.id)}
                      className={[
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all border text-left',
                        active
                          ? 'bg-[#fff4ef] border-[#fdd5c5] text-[#c43d10]'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50',
                      ].join(' ')}
                    >
                      <span>{prof.emoji}</span>
                      <span className="truncate">{locale === 'he' ? prof.he : prof.en}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">
                {locale === 'he' ? 'הערות' : 'Notes'}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full min-h-[80px] rounded-md border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#fe5b25] focus:border-transparent"
                placeholder={locale === 'he' ? 'הערות נוספות...' : 'Additional notes...'}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                {locale === 'he' ? 'ביטול' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? '...' : (locale === 'he' ? 'שמור' : 'Save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
