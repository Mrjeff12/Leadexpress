import { useState, useEffect } from 'react'
import { FileText, MapPin, Users, Clock, MessageSquarePlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { PROFESSIONS } from '../lib/professions'

interface PublishedLead {
  id: string
  profession: string
  city: string | null
  state: string | null
  zip_code: string | null
  parsed_summary: string | null
  urgency: string
  matched_contractors: string[] | null
  created_at: string
  status: string
}

export default function MyPublishedLeads() {
  const { user } = useAuth()
  const { locale } = useI18n()
  const [leads, setLeads] = useState<PublishedLead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('leads')
      .select('id, profession, city, state, zip_code, parsed_summary, urgency, matched_contractors, created_at, status')
      .eq('publisher_id', user.id)
      .eq('source_type', 'publisher')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setLeads(data)
        setLoading(false)
      })
  }, [user])

  const urgencyBadge: Record<string, string> = {
    hot: 'bg-red-100 text-red-700',
    warm: 'bg-amber-100 text-amber-700',
    cold: 'bg-blue-100 text-blue-700',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-[#fe5b25] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#fe5b25]" />
          <h1 className="text-xl font-semibold text-stone-800">
            {locale === 'he' ? 'העבודות שפרסמתי' : 'My Published Leads'}
          </h1>
          <span className="ml-1 px-2 py-0.5 text-xs bg-stone-100 rounded-full text-stone-500 font-medium">
            {leads.length}
          </span>
        </div>
        <Link
          to="/publish"
          className="flex items-center gap-1.5 px-4 py-2 bg-[#fe5b25] hover:bg-[#e04d1c]
                     text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <MessageSquarePlus className="w-4 h-4" />
          {locale === 'he' ? 'פרסם עבודה' : 'Publish Job'}
        </Link>
      </div>

      {leads.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-200">
          <FileText className="w-10 h-10 mx-auto mb-3 text-stone-300" />
          <p className="text-stone-500 mb-2">
            {locale === 'he' ? 'עוד לא פרסמת עבודות' : 'No published leads yet'}
          </p>
          <Link to="/publish" className="text-[#fe5b25] text-sm font-medium hover:underline">
            {locale === 'he' ? 'פרסם את העבודה הראשונה שלך' : 'Publish your first job'} →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => {
            const prof = PROFESSIONS.find((p) => p.id === lead.profession)
            const matchedCount = lead.matched_contractors?.length || 0

            return (
              <div
                key={lead.id}
                className="bg-white border border-stone-200 rounded-2xl p-5
                           hover:border-stone-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{prof?.emoji || '\u{1F527}'}</span>
                    <span className="font-semibold text-stone-800">{prof?.en || lead.profession}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${urgencyBadge[lead.urgency] || urgencyBadge.warm}`}>
                      {lead.urgency}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-stone-400">
                    <Clock className="w-3 h-3" />
                    {new Date(lead.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-sm text-stone-500 mb-2">
                  <MapPin className="w-3.5 h-3.5" />
                  {lead.city}, {lead.state} {lead.zip_code || ''}
                </div>

                {lead.parsed_summary && (
                  <p className="text-sm text-stone-500 mb-3 line-clamp-2">{lead.parsed_summary}</p>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <Users className="w-3.5 h-3.5" />
                    {matchedCount} {locale === 'he' ? 'קבלנים מתאימים' : 'contractors matched'}
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                    lead.status === 'sent'
                      ? 'bg-emerald-100 text-emerald-700'
                      : lead.status === 'claimed'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-stone-100 text-stone-500'
                  }`}>
                    {lead.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
