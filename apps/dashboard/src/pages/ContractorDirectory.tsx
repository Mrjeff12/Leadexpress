import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, SlidersHorizontal, Loader2, Users, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import InlineProfileCard, { type ContractorResult } from '../components/InlineProfileCard'

const TIERS = ['All', 'Verified', 'Trusted', 'Elite'] as const
const PAGE_SIZE = 24

const PROFESSIONS = [
  'All Professions', 'Plumber', 'Electrician', 'HVAC', 'Painter', 'Roofer',
  'Carpenter', 'Landscaper', 'General Contractor', 'Handyman', 'Flooring',
  'Mason', 'Welder', 'Pest Control', 'Locksmith', 'Cleaning',
]

export default function ContractorDirectory() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [profession, setProfession] = useState('')
  const [tier, setTier] = useState<string>('All')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [contractors, setContractors] = useState<ContractorResult[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const offsetRef = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const fetchContractors = useCallback(
    async (offset: number, append: boolean) => {
      if (offset === 0) setLoading(true)
      else setLoadingMore(true)

      const { data, error } = await supabase.rpc('search_contractors', {
        p_query: debouncedQuery || null,
        p_profession: profession || null,
        p_state: null,
        p_tier: tier === 'All' ? null : tier.toLowerCase(),
        p_available: availableOnly || null,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      })

      if (!error && data) {
        const results = (data as ContractorResult[]) ?? []
        if (append) setContractors((prev) => [...prev, ...results])
        else setContractors(results)
        setHasMore(results.length === PAGE_SIZE)
      }
      setLoading(false)
      setLoadingMore(false)
    },
    [debouncedQuery, profession, tier, availableOnly],
  )

  useEffect(() => {
    offsetRef.current = 0
    fetchContractors(0, false)
  }, [fetchContractors])

  const loadMore = () => {
    const next = offsetRef.current + PAGE_SIZE
    offsetRef.current = next
    fetchContractors(next, true)
  }

  return (
    <div className="min-h-screen" style={{ background: '#faf9f6' }}>
      {/* ═══════ Hero Header ═══════ */}
      <header className="relative overflow-hidden border-b border-black/5">
        {/* Subtle glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#fe5b25]/5 rounded-full blur-[100px]" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-8 relative">
          {/* MLF branding */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-[9px] tracking-tight" style={{ background: 'linear-gradient(135deg, #fe5b25, #ff7a4d)' }}>MLF</div>
            <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: '#3b3b3b' }}>MasterLeadFlow</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] leading-tight" style={{ color: '#0b0707' }}>
            Find Your Next{' '}
            <span className="relative">
              <span className="relative z-10">Partner</span>
              <span className="absolute bottom-0 left-0 right-0 h-3 bg-[#fe5b25]/15 rounded-sm -z-0" />
            </span>
          </h1>
          <p className="text-base mt-3 max-w-lg leading-relaxed" style={{ color: '#3b3b3b', opacity: 0.6 }}>
            Browse verified contractors in your area. Connect, collaborate, and grow your business together.
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-6 mt-6">
            <div className="flex -space-x-2">
              {['bg-[#fe5b25]', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500'].map((bg, i) => (
                <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 flex items-center justify-center text-[10px] font-bold text-white`} style={{ borderColor: '#faf9f6' }}>
                  {['D', 'M', 'S', 'R'][i]}
                </div>
              ))}
            </div>
            <p className="text-xs" style={{ color: '#3b3b3b', opacity: 0.4 }}>
              {contractors.length > 0 ? `${contractors.length}+ professionals in the network` : 'Growing network of professionals'}
            </p>
          </div>
        </div>
      </header>

      {/* ═══════ Search + Filters ═══════ */}
      <div className="sticky top-0 z-30 border-b border-black/5 backdrop-blur-xl" style={{ background: 'rgba(250, 249, 246, 0.85)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#3b3b3b', opacity: 0.3 }} />
            <input
              type="text"
              placeholder="Search by name, business, or profession..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/20 focus:border-[#fe5b25]/40"
              style={{ background: 'white', borderColor: 'rgba(0,0,0,0.08)', color: '#0b0707' }}
            />
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <select
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              className="text-xs font-medium border rounded-full px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/20 cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#3b3b3b' }}
            >
              {PROFESSIONS.map((p) => (
                <option key={p} value={p === 'All Professions' ? '' : p}>{p}</option>
              ))}
            </select>

            {TIERS.map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`text-xs font-semibold px-4 py-2 rounded-full border transition-all duration-200 ${
                  tier === t
                    ? 'bg-[#0b0707] text-white border-[#0b0707]'
                    : 'bg-white border-black/8 hover:border-black/20'
                }`}
                style={tier !== t ? { color: '#3b3b3b' } : undefined}
              >
                {t}
              </button>
            ))}

            <button
              onClick={() => setAvailableOnly(!availableOnly)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full border transition-all duration-200 ${
                availableOnly
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-white border-black/8 hover:border-black/20'
              }`}
              style={!availableOnly ? { color: '#3b3b3b' } : undefined}
            >
              <span className={`w-2 h-2 rounded-full ${availableOnly ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`} />
              Available Today
            </button>
          </div>
        </div>
      </div>

      {/* ═══════ Results ═══════ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse" style={{ border: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded-lg w-3/4" />
                    <div className="h-3 bg-gray-50 rounded-lg w-1/2" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <div className="h-6 bg-gray-50 rounded-full w-16" />
                  <div className="h-6 bg-gray-50 rounded-full w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : contractors.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(254, 91, 37, 0.08)' }}>
              <Users className="w-7 h-7 text-[#fe5b25]" />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: '#0b0707' }}>No contractors found</h3>
            <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: '#3b3b3b', opacity: 0.5 }}>
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {contractors.map((c) => (
                <InlineProfileCard key={c.user_id} c={c} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="group inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50"
                  style={{ background: '#0b0707', color: 'white' }}
                >
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loadingMore ? 'Loading...' : 'Load more'}
                  {!loadingMore && <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-black/5 py-8">
        <div className="flex items-center justify-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-[8px] tracking-tight" style={{ background: 'linear-gradient(135deg, #fe5b25, #ff7a4d)' }}>MLF</div>
          <span className="text-xs font-semibold" style={{ color: '#3b3b3b', opacity: 0.4 }}>MasterLeadFlow</span>
        </div>
      </div>
    </div>
  )
}
