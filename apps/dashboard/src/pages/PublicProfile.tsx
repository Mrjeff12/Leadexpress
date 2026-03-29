import { useState, useEffect, lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { getStateFromZip } from '../lib/us-geo'
import TrustBadge from '../components/TrustBadge'
import StarRating from '../components/StarRating'
import ReviewsList from '../components/ReviewsList'
import PortfolioGallery from '../components/PortfolioGallery'
const ServiceAreaMap = lazy(() => import('../components/ServiceAreaMap'))
import {
  MapPin,
  Globe,
  Share2,
  Copy,
  Check,
  Sparkles,
  MessageCircle,
  Users,
  CalendarDays,
  Briefcase,
  ShieldCheck,
  FileCheck,
  Languages,
  ExternalLink,
  Zap,
  Image,
  Star,
  Percent,
  DollarSign,
  Wrench,
} from 'lucide-react'

/* ───────────────────── Types ───────────────────── */

interface ProfileStats {
  leads_contacted: number
  successful_jobs: number
  feedbacks_given: number
  groups_active: number
  job_orders_total: number
  job_orders_completed: number
  avg_response_mins: number
  member_since: string
  network_points: number
  network_level: string
  available_today: boolean
}

interface PublicProfileData {
  user_id: string
  slug: string
  headline: string | null
  bio: string | null
  years_experience: number | null
  business_name: string | null
  license_number: string | null
  insurance_verified: boolean
  background_check: boolean
  languages: string[] | null
  team_size: number | null
  website_url: string | null
  avg_rating: number | null
  review_count: number
  completion_rate: number | null
  tier: 'new' | 'verified' | 'trusted' | 'elite'
  profile_completeness: number | null
  full_name: string
  counties: string[] | null
  professions: string[] | null
  zip_codes: string[] | null
  available_today: boolean
  member_since: string | null
  stats: ProfileStats | null
  whatsapp_phone: string | null
  avatar_url: string | null
  accepts_percentage: boolean
  accepts_fixed: boolean
  accepts_subwork: boolean
  min_job_value: number | null
  max_job_value: number | null
}

interface PortfolioItem {
  id: string
  title: string
  description: string | null
  category: string | null
  image_url: string
  before_url: string | null
  is_featured: boolean
}

/* ───────────────────── Helpers ───────────────────── */

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',DC:'D.C.',FL:'Florida',GA:'Georgia',HI:'Hawaii',
  ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',
  LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
  OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
  WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',PR:'Puerto Rico',
}

function deriveLocationFromZips(zips: string[] | null, counties: string[] | null): { state: string | null; countyLabel: string | null } {
  if (!zips || zips.length === 0) return { state: null, countyLabel: null }
  const stateAbbr = getStateFromZip(zips[0])
  const state = stateAbbr ? (STATE_NAMES[stateAbbr] ?? stateAbbr) : null
  const countyLabel = counties && counties.length > 0 ? counties.join(', ') : null
  return { state, countyLabel }
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function professionGradient(professions: string[] | null): string {
  const p = (professions?.[0] ?? '').toLowerCase()
  if (p.includes('hvac') || p.includes('air')) return 'from-blue-600 via-blue-500 to-cyan-400'
  if (p.includes('renovation') || p.includes('kitchen') || p.includes('bathroom')) return 'from-orange-600 via-amber-500 to-yellow-400'
  if (p.includes('electric')) return 'from-yellow-500 via-amber-500 to-orange-400'
  if (p.includes('plumb')) return 'from-teal-600 via-teal-500 to-emerald-400'
  if (p.includes('paint')) return 'from-purple-600 via-purple-500 to-pink-400'
  return 'from-[#fe5b25] via-[#ff6b3d] to-[#ff8f6b]'
}

function formatMemberSince(date: string | null | undefined): string {
  if (!date) return '--'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function responseTimeLabel(mins: number | null | undefined): string {
  if (!mins || mins <= 0) return '--'
  if (mins < 60) return `${Math.round(mins)} min`
  if (mins < 1440) return `${Math.round(mins / 60)} hr`
  return `${Math.round(mins / 1440)} days`
}

function getActivityLevel(stats: ProfileStats | null) {
  if (!stats) return { label: 'New Member', color: 'text-gray-500', dotColor: 'bg-gray-400' }
  const score = (stats.leads_contacted > 0 ? 1 : 0) + (stats.groups_active > 0 ? 1 : 0) + (stats.job_orders_total > 0 ? 1 : 0) + (stats.feedbacks_given > 0 ? 1 : 0)
  if (score >= 3) return { label: 'Very Active', color: 'text-green-600', dotColor: 'bg-green-500' }
  if (score >= 2) return { label: 'Active', color: 'text-blue-600', dotColor: 'bg-blue-500' }
  if (score >= 1) return { label: 'Getting Started', color: 'text-amber-600', dotColor: 'bg-amber-500' }
  return { label: 'New Member', color: 'text-gray-500', dotColor: 'bg-gray-400' }
}

/* ───────────────────── Skeleton ───────────────────── */

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-36 bg-gradient-to-br from-gray-300 to-gray-400 animate-pulse" />
      <div className="max-w-5xl mx-auto px-4 -mt-16 pb-10">
        <div className="bg-white rounded-3xl p-6 animate-pulse shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-300" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-40 bg-gray-200 rounded" />
              <div className="h-4 w-28 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────── Component ───────────────────── */

export default function PublicProfile() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<PublicProfileData | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showJobOffer, setShowJobOffer] = useState(false)

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return }
    ;(async () => {
      setLoading(true)
      const { data: result, error } = await supabase.rpc('get_public_profile', { p_slug: slug })
      if (error || !result) { setNotFound(true) } else {
        const profile = result as PublicProfileData
        setData(profile)
        const { data: pf } = await supabase.from('portfolio_items').select('*').eq('user_id', profile.user_id).order('display_order')
        if (pf) setPortfolio(pf)
      }
      setLoading(false)
    })()
  }, [slug])

  // Record profile view
  useEffect(() => {
    if (data?.slug) {
      supabase.rpc('record_profile_view', { p_slug: data.slug })
    }
  }, [data?.slug])

  if (loading) return <ProfileSkeleton />

  if (notFound || !data) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-orange-200/50" style={{ background: 'linear-gradient(135deg, #fe5b25, #ff7a4d)' }}>MLF</div>
          <h1 className="text-2xl font-bold text-gray-900">Profile Not Found</h1>
          <p className="text-gray-500 text-sm max-w-xs">This professional profile doesn't exist or may have been removed.</p>
          <a href="/" className="mt-2 px-6 py-3 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-[#fe5b25] to-[#ff7a4d] shadow-lg shadow-orange-200/40">Back to MasterLeadFlow</a>
        </div>
      </div>
    )
  }

  const stats = data.stats
  const { state: derivedState, countyLabel } = deriveLocationFromZips(data.zip_codes, data.counties)
  const location = [countyLabel, derivedState].filter(Boolean).join(', ') || (data.zip_codes?.[0] ? `ZIP ${data.zip_codes[0]}` : null)
  const profileUrl = `${window.location.origin}/pro/${data.slug}`
  const activity = getActivityLevel(stats)
  const hasReviews = data.review_count > 0
  const hasPortfolio = portfolio.length > 0
  const hasMap = (data.zip_codes?.length ?? 0) > 0

  const PLATFORM_WA = '13058516498' // Rebecca / MasterLeadFlow US number

  function handleShare() {
    window.open(`https://wa.me/?text=${encodeURIComponent(`Check out ${data!.full_name} on MasterLeadFlow: ${profileUrl}`)}`, '_blank')
  }
  function handleCopy() {
    navigator.clipboard.writeText(profileUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:bg-gray-100">
      <Helmet>
        <title>{data.full_name} — MasterLeadFlow</title>
        <meta name="description" content={data.headline || data.bio?.slice(0, 160) || `${data.full_name} on MasterLeadFlow`} />
        <meta property="og:title" content={`${data.full_name} — MasterLeadFlow`} />
        <meta property="og:description" content={data.headline || data.bio?.slice(0, 160) || `${data.full_name} — Professional Contractor`} />
        <meta property="og:image" content={data.avatar_url || 'https://masterleadflow.com/icon.png'} />
        <meta property="og:url" content={profileUrl} />
      </Helmet>

      {/* ═══════════ HERO ═══════════ */}
      <div className={`relative h-32 lg:h-44 bg-gradient-to-br ${professionGradient(data.professions)} overflow-hidden`}>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-60 h-60 rounded-full bg-white/10 blur-sm" />
          <div className="absolute top-20 -left-16 w-40 h-40 rounded-full bg-white/5" />
        </div>
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-[9px] tracking-tight">MLF</div>
          <span className="text-white/70 text-[11px] font-semibold tracking-wider uppercase hidden sm:block">MasterLeadFlow</span>
        </div>
        <div className="absolute top-3 right-3 flex gap-1.5">
          <button onClick={handleCopy} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white bg-white/15 backdrop-blur-sm hover:bg-white/25 transition-all">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button onClick={handleShare} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white bg-white/15 backdrop-blur-sm hover:bg-white/25 transition-all">
            <Share2 size={13} />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {/* ═══════════ MAIN ═══════════ */}
      <div className="max-w-6xl mx-auto px-0 lg:px-6 -mt-14 pb-6 relative z-10">
        <div className="lg:grid lg:grid-cols-[380px_1fr] lg:gap-6 lg:items-start">

          {/* ═══════ LEFT: Profile Card ═══════ */}
          <div className="lg:sticky lg:top-4 animate-fade-in-up">
            <div className="bg-white rounded-none lg:rounded-3xl shadow-sm lg:shadow-xl lg:shadow-gray-200/50 border-b border-gray-100 lg:border p-5 lg:p-6">
              <div className="flex items-center gap-4 lg:flex-col lg:items-center lg:text-center">
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 lg:w-28 lg:h-28 rounded-full border-[3px] border-white shadow-lg flex items-center justify-center text-2xl lg:text-3xl font-bold text-white ring-2 ring-gray-100 overflow-hidden" style={{ background: 'linear-gradient(135deg, #fe5b25, #ff7a4d)' }}>
                    {data.avatar_url ? (
                      <img src={data.avatar_url} alt={data.full_name} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(data.full_name)
                    )}
                  </div>
                  {data.available_today && (
                    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500 text-white text-[9px] font-bold shadow-md whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Available
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 lg:mt-3">
                  <h1 className="text-xl lg:text-2xl font-extrabold text-gray-900 truncate lg:truncate-none tracking-tight flex items-center gap-1.5">
                    {data.full_name}
                    {data.background_check && (
                      <svg viewBox="0 0 22 22" className="w-5 h-5 flex-shrink-0" fill="none">
                        <circle cx="11" cy="11" r="11" fill="#1d9bf0" />
                        <path d="M9.5 14.25L6.75 11.5l1.06-1.06 1.69 1.69 4.19-4.19L14.75 9l-5.25 5.25z" fill="white" />
                      </svg>
                    )}
                  </h1>
                  {data.business_name && <p className="text-xs text-gray-500 mt-0.5 truncate font-medium">{data.business_name}</p>}
                  {data.headline && <p className="text-xs text-gray-600 mt-1 line-clamp-2 lg:line-clamp-none leading-relaxed">{data.headline}</p>}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap lg:justify-center">
                    <TrustBadge tier={data.tier} size="sm" />
                    {hasReviews && data.avg_rating != null ? (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100">
                        <StarRating rating={data.avg_rating} size="sm" showValue />
                        <span className="text-[10px] text-amber-600 font-medium">({data.review_count})</span>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 border border-gray-200 ${activity.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${activity.dotColor} animate-pulse`} />
                        {activity.label}
                      </span>
                    )}
                    {(stats?.avg_response_mins ?? 0) > 0 && stats!.avg_response_mins < 30 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 border border-green-100 text-green-700">
                        <Zap size={10} /> Fast Responder
                      </span>
                    )}
                  </div>
                  {location && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-500 lg:justify-center">
                      <MapPin size={12} className="text-gray-400" /> {location}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="mt-4 grid grid-cols-4 lg:grid-cols-2 gap-2">
                <MiniStat label="Jobs" value={stats?.job_orders_completed ?? stats?.successful_jobs ?? 0} icon={<Briefcase size={15} className="text-gray-400" />} />
                <MiniStat label="Response" value={responseTimeLabel(stats?.avg_response_mins)} icon={<Zap size={15} className="text-gray-400" />} />
                <MiniStat label="Network" value={stats?.groups_active ?? 0} icon={<Users size={15} className="text-gray-400" />} />
                <MiniStat label="Since" value={formatMemberSince(data.member_since ?? stats?.member_since)} icon={<CalendarDays size={15} className="text-gray-400" />} />
              </div>

              {/* Trust badges */}
              {(data.license_number || data.insurance_verified) && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5 lg:justify-center">
                  {data.license_number && <MiniVerify icon={<FileCheck size={12} />} label="Licensed" />}
                  {data.insurance_verified && <MiniVerify icon={<ShieldCheck size={12} />} label="Insured" />}
                </div>
              )}

              {/* CTA — Send Job Offer */}
              <button
                onClick={() => setShowJobOffer(true)}
                className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#fe5b25] to-[#ff7a4d] hover:from-[#e5501f] hover:to-[#fe5b25] active:scale-[0.98] transition-all shadow-lg shadow-orange-200/40"
              >
                <Briefcase size={16} /> Send Job Offer
              </button>
              <div className="hidden lg:flex gap-2 mt-2">
                <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:scale-[0.98] transition-all">
                  <Share2 size={13} /> Share
                </button>
                <button onClick={handleCopy} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:scale-[0.98] transition-all">
                  {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Link'}
                </button>
              </div>
              {data.website_url && (
                <a href={data.website_url} target="_blank" rel="noopener noreferrer" className="hidden lg:flex items-center gap-1.5 mt-3 text-xs text-[#fe5b25] font-semibold hover:underline justify-center">
                  <Globe size={14} /> Website <ExternalLink size={11} className="opacity-60" />
                </a>
              )}
            </div>
            <div className="hidden lg:flex items-center justify-center gap-2 mt-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-[8px] tracking-tight" style={{ background: 'linear-gradient(135deg, #fe5b25, #ff7a4d)' }}>MLF</div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-500 tracking-tight leading-tight">MasterLeadFlow</span>
                <span className="text-[9px] text-gray-400 leading-tight">Professional Contractor Network</span>
              </div>
            </div>
          </div>

          {/* ═══════ RIGHT: All Content (scrollable) ═══════ */}
          <div className="mt-0 lg:mt-0 space-y-0 lg:space-y-3 animate-fade-in-up animate-fade-in-up-delay-1">

            {/* Services */}
            {data.professions && data.professions.length > 0 && (
              <Section icon={<Briefcase size={16} className="text-gray-400" />} title="Services">
                <div className="flex flex-wrap gap-2">
                  {data.professions.map((p) => (
                    <span key={p} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-orange-50/80 text-[#d94a1a] border border-orange-100">{p}</span>
                  ))}
                </div>
              </Section>
            )}

            {/* Work Preferences */}
            <Section icon={<Wrench size={16} className="text-gray-400" />} title="Work Preferences">
              <div className="flex flex-wrap gap-2">
                <WorkPref accepted={data.accepts_percentage} icon={<Percent size={13} />} label="Percentage" />
                <WorkPref accepted={data.accepts_fixed} icon={<DollarSign size={13} />} label="Fixed Price" />
                <WorkPref accepted={data.accepts_subwork} icon={<Users size={13} />} label="Sub Work" />
              </div>
              {(data.min_job_value || data.max_job_value) && (
                <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                  <DollarSign size={13} className="text-gray-400" />
                  {data.min_job_value && data.max_job_value
                    ? `$${data.min_job_value.toLocaleString()} – $${data.max_job_value.toLocaleString()}`
                    : data.min_job_value
                      ? `From $${data.min_job_value.toLocaleString()}`
                      : `Up to $${data.max_job_value!.toLocaleString()}`}
                </p>
              )}
            </Section>

            {/* Bio */}
            {data.bio && (
              <Section title="About">
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{data.bio}</p>
              </Section>
            )}

            {/* Details */}
            {(data.years_experience || data.team_size || data.languages?.length) && (
              <Section>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {data.years_experience != null && (
                    <div>
                      <div className="text-2xl font-extrabold text-gray-900">{data.years_experience}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">Years Exp.</div>
                    </div>
                  )}
                  {data.team_size != null && (
                    <div>
                      <div className="text-2xl font-extrabold text-gray-900">{data.team_size}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">Team</div>
                    </div>
                  )}
                  {data.languages && data.languages.length > 0 && (
                    <div>
                      <div className="flex items-center justify-center gap-1">
                        <Languages size={16} className="text-gray-400" />
                        <span className="text-2xl font-extrabold text-gray-900">{data.languages.length}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{data.languages.slice(0, 2).join(', ')}</div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Map */}
            {hasMap && (
              <div className="bg-white border-b border-gray-100 lg:border lg:rounded-2xl lg:shadow-sm overflow-hidden">
                <div className="px-5 py-3 lg:p-4 lg:pb-2">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <MapPin size={16} className="text-gray-400" /> Service Areas
                  </h3>
                  {(countyLabel || derivedState) && (
                    <p className="text-xs text-gray-500 mt-1">
                      {[countyLabel, derivedState].filter(Boolean).join(' · ')}
                      {data.zip_codes && <span className="text-gray-400"> · {data.zip_codes.length} ZIP{data.zip_codes.length !== 1 ? 's' : ''}</span>}
                    </p>
                  )}
                </div>
                <Suspense fallback={<div className="h-[240px] bg-gray-50 animate-pulse rounded-none" />}>
                  <ServiceAreaMap zipCodes={data.zip_codes!} height="240px" className="rounded-none" />
                </Suspense>
                <div className="px-5 py-3 lg:p-3 border-t border-gray-100">
                  <div className="flex flex-wrap gap-1.5">
                    {data.zip_codes!.map((z) => (
                      <span key={z} className="px-2 py-0.5 rounded-md text-[11px] font-mono text-gray-500 bg-gray-50 border border-gray-100">{z}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Portfolio */}
            {hasPortfolio && (
              <Section icon={<Image size={16} className="text-gray-400" />} title="Portfolio" extra={<span className="text-xs text-gray-400">{portfolio.length} project{portfolio.length !== 1 ? 's' : ''}</span>}>
                <PortfolioGallery items={portfolio} />
              </Section>
            )}

            {/* Reviews */}
            <div className="bg-white border-b border-gray-100 lg:border lg:rounded-2xl lg:shadow-sm px-5 py-4 lg:p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Star size={16} className="text-gray-400" /> Reviews
                {hasReviews && <span className="ml-auto text-xs font-normal text-gray-400">{data.review_count} review{data.review_count !== 1 ? 's' : ''}</span>}
              </h3>
              {hasReviews ? (
                /* When there are reviews — show rating summary + cards */
                <div className="space-y-4">
                  {/* Rating summary bar */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="text-center">
                      <div className="text-3xl font-extrabold text-gray-900">{(data.avg_rating ?? 0).toFixed(1)}</div>
                      <StarRating rating={data.avg_rating ?? 0} size="sm" />
                      <div className="text-[10px] text-gray-400 mt-1">{data.review_count} review{data.review_count !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="flex-1 h-px bg-gray-200" />
                    <div className="text-center">
                      <div className="text-2xl font-extrabold text-green-600">100%</div>
                      <div className="text-[10px] text-gray-400">would hire again</div>
                    </div>
                  </div>
                  <ReviewsList userId={data.user_id} avgRating={data.avg_rating ?? undefined} reviewCount={data.review_count} />
                </div>
              ) : (
                /* Cold start — clean, light empty state */
                <div className="py-8 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mb-4">
                    <Star size={24} className="text-gray-300" />
                  </div>
                  <p className="text-gray-800 font-semibold text-sm">No reviews yet</p>
                  <p className="text-gray-400 text-xs mt-1 max-w-[260px] mx-auto leading-relaxed">
                    Reviews will appear here after completed jobs. This professional is verified and active on MasterLeadFlow.
                  </p>

                  {/* Activity signals as proof */}
                  {stats && (
                    <div className="flex flex-wrap justify-center gap-2 mt-5">
                      {(stats.groups_active ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100 text-gray-500 text-xs">
                          <Users size={12} /> {stats.groups_active} group{stats.groups_active !== 1 ? 's' : ''}
                        </span>
                      )}
                      {(stats.leads_contacted ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100 text-gray-500 text-xs">
                          <MessageCircle size={12} /> {stats.leads_contacted} leads
                        </span>
                      )}
                      {stats.member_since && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100 text-gray-500 text-xs">
                          <CalendarDays size={12} /> Since {formatMemberSince(stats.member_since)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Website — mobile */}
            {data.website_url && (
              <Section>
                <a href={data.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#fe5b25] font-semibold hover:underline">
                  <Globe size={16} /> Visit Website <ExternalLink size={13} className="opacity-60" />
                </a>
              </Section>
            )}

            {/* Share — mobile */}
            <div className="lg:hidden flex gap-2 px-4 py-3">
              <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:scale-[0.98] transition-all">
                <Share2 size={13} /> Share
              </button>
              <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:scale-[0.98] transition-all">
                {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy Link'}
              </button>
            </div>

            {/* Footer — mobile */}
            <div className="lg:hidden flex items-center justify-center gap-2 py-6">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-[8px] tracking-tight" style={{ background: 'linear-gradient(135deg, #fe5b25, #ff7a4d)' }}>MLF</div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-500 tracking-tight leading-tight">MasterLeadFlow</span>
                <span className="text-[9px] text-gray-400 leading-tight">Professional Contractor Network</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ═══════ Job Offer Bottom Sheet ═══════ */}
      {showJobOffer && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowJobOffer(false)} />
          <div className="relative bg-white w-full lg:max-w-md lg:rounded-2xl rounded-t-3xl p-6 pb-8 lg:pb-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5 lg:hidden" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">Send Job Offer</h3>
            <p className="text-sm text-gray-500 mb-5">Choose how to reach {data.full_name}</p>

            <div className="space-y-3">
              {/* Option 1: WhatsApp to Rebecca */}
              <a
                href={`https://wa.me/${PLATFORM_WA}?text=${encodeURIComponent(`Hi, I'd like to send a job offer to ${data.full_name} (${data.professions?.join(', ') ?? 'contractor'}) — found on MasterLeadFlow profile: ${profileUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 w-full p-4 rounded-2xl border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-[#25D366] flex items-center justify-center text-white flex-shrink-0">
                  <MessageCircle size={20} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-900">Quick via WhatsApp</p>
                  <p className="text-xs text-gray-500">Message our team to coordinate the job</p>
                </div>
                <ExternalLink size={14} className="text-gray-400 group-hover:text-green-500" />
              </a>

              {/* Option 2: In-app form (coming soon / simplified) */}
              <button
                onClick={() => {
                  setShowJobOffer(false)
                  window.location.href = `/jobs/new?contractor=${data.user_id}&name=${encodeURIComponent(data.full_name)}`
                }}
                className="flex items-center gap-4 w-full p-4 rounded-2xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/50 transition-all group text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#fe5b25] to-[#ff7a4d] flex items-center justify-center text-white flex-shrink-0">
                  <Briefcase size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">Submit Job Details</p>
                  <p className="text-xs text-gray-500">Fill out a form with job specifics</p>
                </div>
                <ExternalLink size={14} className="text-gray-400 group-hover:text-orange-500" />
              </button>
            </div>

            <button
              onClick={() => setShowJobOffer(false)}
              className="mt-4 w-full py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────────────── Sub Components ───────────────────── */

function Section({ icon, title, extra, children }: {
  icon?: React.ReactNode; title?: string; extra?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="bg-white border-b border-gray-100 lg:border lg:rounded-2xl lg:shadow-sm px-5 py-4 lg:p-5">
      {title && (
        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          {icon} {title} {extra && <span className="ml-auto">{extra}</span>}
        </h3>
      )}
      {children}
    </div>
  )
}

function MiniStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="p-2.5 lg:p-3 rounded-xl bg-gray-50/80 border border-gray-100 flex flex-col items-center gap-1 text-center">
      {icon}
      <div className="text-sm lg:text-base font-bold text-gray-900 leading-tight">{value}</div>
      <div className="text-[10px] text-gray-400 font-medium">{label}</div>
    </div>
  )
}

function MiniVerify({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-green-700 bg-green-50 border border-green-100">
      {icon} {label}
    </span>
  )
}

function ActivitySignal({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs">
      {icon} {label}
    </span>
  )
}

function WorkPref({ accepted, icon, label }: { accepted: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
      accepted
        ? 'bg-green-50/80 text-green-700 border-green-100'
        : 'bg-gray-50 text-gray-400 border-gray-100 line-through'
    }`}>
      {icon} {label}
      {accepted && <Check size={12} className="text-green-500" />}
    </span>
  )
}
