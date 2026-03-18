import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { PROFESSIONS } from '../lib/professions'
import { Plus, Search, User, Phone, Briefcase, Trash2, Edit2 } from 'lucide-react'
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

  const fetchSubs = async (showLoading = true) => {
    if (!effectiveUserId) return
    if (showLoading) setLoading(true)
    try {
      const [subsRes, jobsRes] = await Promise.all([
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
    } catch (err: unknown) {
      toast({ title: 'Error', description: 'Failed to load subcontractors', variant: 'destructive' })
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubs()
  }, [effectiveUserId])

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
            {locale === 'he' ? 'הצוות שלי' : 'My Team'}
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
                  className="p-1.5 text-stone-400 hover:text-emerald-600 transition-colors bg-white rounded-md shadow-sm border border-stone-100"
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
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center border border-emerald-200 shrink-0">
                  <User className="w-5 h-5 text-emerald-600" />
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
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
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
                className="w-full min-h-[80px] rounded-md border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
