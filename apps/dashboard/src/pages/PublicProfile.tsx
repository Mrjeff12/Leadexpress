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

function formatProfession(p: string): string {
  return p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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
  if (!stats) return { label: 'New Member', color: '#636366', dotColor: '#48484a' }
  const score = (stats.leads_contacted > 0 ? 1 : 0) + (stats.groups_active > 0 ? 1 : 0) + (stats.job_orders_total > 0 ? 1 : 0) + (stats.feedbacks_given > 0 ? 1 : 0)
  if (score >= 3) return { label: 'Very Active', color: '#30d158', dotColor: '#30d158' }
  if (score >= 2) return { label: 'Active', color: '#0a84ff', dotColor: '#0a84ff' }
  if (score >= 1) return { label: 'Getting Started', color: '#ff9f0a', dotColor: '#ff9f0a' }
  return { label: 'New Member', color: '#636366', dotColor: '#48484a' }
}

/* ───────────────────── Skeleton ───────────────────── */

function ProfileSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ height: 160, background: '#141414' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px', marginTop: -64 }}>
        <div style={{ background: '#141414', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#1c1c1e' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 24, width: 160, background: '#1c1c1e', borderRadius: 8 }} />
              <div style={{ height: 16, width: 112, background: '#1c1c1e', borderRadius: 8 }} />
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
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', fontFamily: 'Outfit, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', padding: '0 24px' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 18, background: '#ff6b35', boxShadow: '0 0 24px rgba(255,107,53,0.25)' }}>MLF</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>Profile Not Found</h1>
          <p style={{ color: '#636366', fontSize: 14, maxWidth: 280 }}>This professional profile doesn't exist or may have been removed.</p>
          <a href="/" style={{ marginTop: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600, color: '#fff', borderRadius: 12, background: '#ff6b35', textDecoration: 'none', boxShadow: '0 0 24px rgba(255,107,53,0.25)' }}>Back to MasterLeadFlow</a>
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
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Outfit, sans-serif' }}>
      <Helmet>
        <title>{data.full_name} — MasterLeadFlow</title>
        <meta name="description" content={data.headline || data.bio?.slice(0, 160) || `${data.full_name} on MasterLeadFlow`} />
        <meta property="og:title" content={`${data.full_name} — MasterLeadFlow`} />
        <meta property="og:description" content={data.headline || data.bio?.slice(0, 160) || `${data.full_name} — Professional Contractor`} />
        <meta property="og:image" content={data.avatar_url || 'https://masterleadflow.com/icon.png'} />
        <meta property="og:url" content={profileUrl} />
      </Helmet>

      {/* ═══════════ NAV BAR ═══════════ */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#ff6b35', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 9, letterSpacing: '-0.02em' }}>MLF</div>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>MasterLeadFlow</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500, color: '#a1a1a6', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500, color: '#a1a1a6', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
            <Share2 size={13} />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {/* ═══════════ MAIN ═══════════ */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 0 24px' }} className="lg:px-6">
        <div className="lg:grid lg:grid-cols-[380px_1fr] lg:gap-6 lg:items-start" style={{ paddingTop: 24 }}>

          {/* ═══════ LEFT: Profile Card ═══════ */}
          <div className="lg:sticky lg:top-16">
            <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }} className="rounded-none lg:rounded-2xl border-0 lg:border">
              <div className="flex items-center gap-4 lg:flex-col lg:items-center lg:text-center">
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#1c1c1e', border: '3px solid #141414', boxShadow: '0 0 0 2px rgba(255,107,53,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff', overflow: 'hidden' }} className="lg:!w-28 lg:!h-28 lg:!text-3xl">
                    {data.avatar_url ? (
                      <img src={data.avatar_url} alt={data.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      getInitials(data.full_name)
                    )}
                  </div>
                  {data.available_today && (
                    <div style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: 'rgba(48,209,88,0.15)', color: '#30d158', fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap' as const }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#30d158', animation: 'pulse 2s infinite' }} /> Available
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }} className="lg:mt-3">
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 6 }} className="lg:text-2xl lg:justify-center truncate lg:truncate-none">
                    {data.full_name}
                    {data.background_check && (
                      <svg viewBox="0 0 22 22" style={{ width: 20, height: 20, flexShrink: 0 }} fill="none">
                        <circle cx="11" cy="11" r="11" fill="#ff6b35" />
                        <path d="M9.5 14.25L6.75 11.5l1.06-1.06 1.69 1.69 4.19-4.19L14.75 9l-5.25 5.25z" fill="white" />
                      </svg>
                    )}
                  </h1>
                  {data.business_name && <p style={{ fontSize: 12, color: '#636366', marginTop: 2, fontWeight: 500 }} className="truncate">{data.business_name}</p>}
                  {data.headline && <p style={{ fontSize: 12, color: '#a1a1a6', marginTop: 4, lineHeight: 1.5 }} className="line-clamp-2 lg:line-clamp-none">{data.headline}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' as const }} className="lg:justify-center">
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: 'rgba(255,107,53,0.15)', color: '#ff6b35', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{data.tier}</span>
                    {hasReviews && data.avg_rating != null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.15)' }}>
                        <StarRating rating={data.avg_rating} size="sm" showValue />
                        <span style={{ fontSize: 10, color: '#ff6b35', fontWeight: 500 }}>({data.review_count})</span>
                      </div>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10, fontWeight: 600, color: activity.color }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: activity.dotColor }} />
                        {activity.label}
                      </span>
                    )}
                    {(stats?.avg_response_mins ?? 0) > 0 && stats!.avg_response_mins < 30 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: 'rgba(48,209,88,0.15)', color: '#30d158', fontSize: 10, fontWeight: 600 }}>
                        <Zap size={10} /> Fast
                      </span>
                    )}
                  </div>
                  {location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, color: '#636366' }} className="lg:justify-center">
                      <MapPin size={12} style={{ color: '#48484a' }} /> {location}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div style={{ marginTop: 16, display: 'grid', gap: 8 }} className="grid-cols-4 lg:grid-cols-2">
                <MiniStat label="Jobs" value={stats?.job_orders_completed ?? stats?.successful_jobs ?? 0} icon={<Briefcase size={15} style={{ color: '#48484a' }} />} />
                <MiniStat label="Response" value={responseTimeLabel(stats?.avg_response_mins)} icon={<Zap size={15} style={{ color: '#48484a' }} />} />
                <MiniStat label="Network" value={stats?.groups_active ?? 0} icon={<Users size={15} style={{ color: '#48484a' }} />} />
                <MiniStat label="Since" value={formatMemberSince(data.member_since ?? stats?.member_since)} icon={<CalendarDays size={15} style={{ color: '#48484a' }} />} />
              </div>

              {/* Trust badges */}
              {(data.license_number || data.insurance_verified) && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexWrap: 'wrap' as const, gap: 6 }} className="lg:justify-center">
                  {data.license_number && <MiniVerify icon={<FileCheck size={12} />} label="Licensed" />}
                  {data.insurance_verified && <MiniVerify icon={<ShieldCheck size={12} />} label="Insured" />}
                </div>
              )}

              {/* CTA — Send Job Offer */}
              <button
                onClick={() => setShowJobOffer(true)}
                style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px 16px', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', background: '#ff6b35', border: 'none', cursor: 'pointer', boxShadow: '0 0 24px rgba(255,107,53,0.25)', transition: 'transform 0.1s' }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <Briefcase size={16} /> Send Job Offer
              </button>
              <div className="hidden lg:flex" style={{ gap: 8, marginTop: 8 }}>
                <button onClick={handleShare} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: '#a1a1a6', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                  <Share2 size={13} /> Share
                </button>
                <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: '#a1a1a6', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                  {copied ? <Check size={13} style={{ color: '#30d158' }} /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Link'}
                </button>
              </div>
              {data.website_url && (
                <a href={data.website_url} target="_blank" rel="noopener noreferrer" className="hidden lg:flex" style={{ alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: '#ff6b35', fontWeight: 600, textDecoration: 'none', justifyContent: 'center' }}>
                  <Globe size={14} /> Website <ExternalLink size={11} style={{ opacity: 0.6 }} />
                </a>
              )}
            </div>
            {/* Desktop footer */}
            <div className="hidden lg:flex" style={{ alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 8, background: '#ff6b35' }}>MLF</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#636366', letterSpacing: '-0.01em', lineHeight: 1.2 }}>MasterLeadFlow</span>
                <span style={{ fontSize: 9, color: '#48484a', lineHeight: 1.2 }}>Professional Contractor Network</span>
              </div>
            </div>
          </div>

          {/* ═══════ RIGHT: All Content (scrollable) ═══════ */}
          <div className="mt-0 lg:mt-0 space-y-0 lg:space-y-3">

            {/* Services */}
            {data.professions && data.professions.length > 0 && (
              <Section icon={<Briefcase size={16} style={{ color: '#48484a' }} />} title="Services">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.professions.map((p) => (
                    <span key={p} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'rgba(255,107,53,0.1)', color: '#ff6b35' }}>{formatProfession(p)}</span>
                  ))}
                </div>
              </Section>
            )}

            {/* Work Preferences */}
            <Section icon={<Wrench size={16} style={{ color: '#48484a' }} />} title="Work Preferences">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <WorkPref accepted={data.accepts_percentage} icon={<Percent size={13} />} label="Percentage" />
                <WorkPref accepted={data.accepts_fixed} icon={<DollarSign size={13} />} label="Fixed Price" />
                <WorkPref accepted={data.accepts_subwork} icon={<Users size={13} />} label="Sub Work" />
              </div>
              {(data.min_job_value || data.max_job_value) && (
                <p style={{ fontSize: 12, color: '#636366', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarSign size={13} style={{ color: '#48484a' }} />
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
                <p style={{ fontSize: 14, color: '#a1a1a6', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{data.bio}</p>
              </Section>
            )}

            {/* Details */}
            {(data.years_experience || data.team_size || data.languages?.length) && (
              <Section>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, textAlign: 'center' }}>
                  {data.years_experience != null && (
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{data.years_experience}</div>
                      <div style={{ fontSize: 11, color: '#636366', marginTop: 2 }}>Years Exp.</div>
                    </div>
                  )}
                  {data.team_size != null && (
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{data.team_size}</div>
                      <div style={{ fontSize: 11, color: '#636366', marginTop: 2 }}>Team</div>
                    </div>
                  )}
                  {data.languages && data.languages.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Languages size={16} style={{ color: '#48484a' }} />
                        <span style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{data.languages.length}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#636366', marginTop: 2 }}>{data.languages.slice(0, 2).join(', ')}</div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Map */}
            {hasMap && (
              <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }} className="rounded-none lg:rounded-2xl border-0 lg:border">
                <div style={{ padding: '12px 20px' }} className="lg:p-4 lg:pb-2">
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={16} style={{ color: '#48484a' }} /> Service Areas
                  </h3>
                  {(countyLabel || derivedState) && (
                    <p style={{ fontSize: 12, color: '#a1a1a6', marginTop: 4 }}>
                      {[countyLabel, derivedState].filter(Boolean).join(' · ')}
                      {data.zip_codes && <span style={{ color: '#636366' }}> · {data.zip_codes.length} ZIP{data.zip_codes.length !== 1 ? 's' : ''}</span>}
                    </p>
                  )}
                </div>
                <Suspense fallback={<div style={{ height: 240, background: '#1c1c1e' }} />}>
                  <ServiceAreaMap zipCodes={data.zip_codes!} height="240px" className="rounded-none" />
                </Suspense>
                <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {data.zip_codes!.map((z) => (
                      <span key={z} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: '#636366', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)' }}>{z}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Portfolio */}
            {hasPortfolio && (
              <Section icon={<Image size={16} style={{ color: '#48484a' }} />} title="Portfolio" extra={<span style={{ fontSize: 12, color: '#48484a' }}>{portfolio.length} project{portfolio.length !== 1 ? 's' : ''}</span>}>
                <PortfolioGallery items={portfolio} />
              </Section>
            )}

            {/* Reviews */}
            <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px' }} className="rounded-none lg:rounded-2xl border-0 lg:border lg:p-5">
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Star size={16} style={{ color: '#48484a' }} /> Reviews
                {hasReviews && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 400, color: '#48484a' }}>{data.review_count} review{data.review_count !== 1 ? 's' : ''}</span>}
              </h3>
              {hasReviews ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 12, background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{(data.avg_rating ?? 0).toFixed(1)}</div>
                      <StarRating rating={data.avg_rating ?? 0} size="sm" />
                      <div style={{ fontSize: 10, color: '#48484a', marginTop: 4 }}>{data.review_count} review{data.review_count !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#30d158' }}>100%</div>
                      <div style={{ fontSize: 10, color: '#48484a' }}>would hire again</div>
                    </div>
                  </div>
                  <ReviewsList userId={data.user_id} avgRating={data.avg_rating ?? undefined} reviewCount={data.review_count} />
                </div>
              ) : (
                <div style={{ padding: '32px 0', textAlign: 'center' }}>
                  <div style={{ margin: '0 auto', width: 64, height: 64, borderRadius: '50%', background: '#1c1c1e', border: '2px dashed rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Star size={24} style={{ color: '#2c2c2e' }} />
                  </div>
                  <p style={{ color: '#636366', fontWeight: 600, fontSize: 14 }}>No reviews yet</p>
                  <p style={{ color: '#48484a', fontSize: 12, marginTop: 4, maxWidth: 260, margin: '4px auto 0', lineHeight: 1.5 }}>
                    Reviews will appear here after completed jobs. This professional is verified and active on MasterLeadFlow.
                  </p>

                  {stats && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                      {(stats.groups_active ?? 0) > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)', color: '#636366', fontSize: 12 }}>
                          <Users size={12} /> {stats.groups_active} group{stats.groups_active !== 1 ? 's' : ''}
                        </span>
                      )}
                      {(stats.leads_contacted ?? 0) > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)', color: '#636366', fontSize: 12 }}>
                          <MessageCircle size={12} /> {stats.leads_contacted} leads
                        </span>
                      )}
                      {stats.member_since && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)', color: '#636366', fontSize: 12 }}>
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
                <a href={data.website_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#ff6b35', fontWeight: 600, textDecoration: 'none' }}>
                  <Globe size={16} /> Visit Website <ExternalLink size={13} style={{ opacity: 0.6 }} />
                </a>
              </Section>
            )}

            {/* Share — mobile */}
            <div className="lg:hidden" style={{ display: 'flex', gap: 8, padding: '12px 16px' }}>
              <button onClick={handleShare} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: '#a1a1a6', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                <Share2 size={13} /> Share
              </button>
              <button onClick={handleCopy} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: '#a1a1a6', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                {copied ? <Check size={13} style={{ color: '#30d158' }} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy Link'}
              </button>
            </div>

            {/* Footer — mobile */}
            <div className="lg:hidden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 8, background: '#ff6b35' }}>MLF</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#636366', letterSpacing: '-0.01em', lineHeight: 1.2 }}>MasterLeadFlow</span>
                <span style={{ fontSize: 9, color: '#48484a', lineHeight: 1.2 }}>Professional Contractor Network</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ═══════ Job Offer Bottom Sheet ═══════ */}
      {showJobOffer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} className="lg:items-center">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} onClick={() => setShowJobOffer(false)} />
          <div style={{ position: 'relative', background: '#141414', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px 24px 32px', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }} className="lg:max-w-md lg:!rounded-2xl lg:!pb-6 lg:!border-b">
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#2c2c2e', margin: '0 auto 20px' }} className="lg:hidden" />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4, letterSpacing: '-0.03em' }}>Send Job Offer</h3>
            <p style={{ fontSize: 14, color: '#636366', marginBottom: 20 }}>Choose how to reach {data.full_name}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a
                href={`https://wa.me/${PLATFORM_WA}?text=${encodeURIComponent(`Hi, I'd like to send a job offer to ${data.full_name} (${data.professions?.join(', ') ?? 'contractor'}) — found on MasterLeadFlow profile: ${profileUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', padding: 16, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: '#1c1c1e', textDecoration: 'none', transition: 'background 0.15s' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                  <MessageCircle size={20} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>Quick via WhatsApp</p>
                  <p style={{ fontSize: 12, color: '#636366', margin: '2px 0 0' }}>Message our team to coordinate the job</p>
                </div>
                <ExternalLink size={14} style={{ color: '#48484a' }} />
              </a>

              <button
                onClick={() => {
                  setShowJobOffer(false)
                  window.location.href = `/jobs/new?contractor=${data.user_id}&name=${encodeURIComponent(data.full_name)}`
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', padding: 16, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: '#1c1c1e', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ff6b35', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                  <Briefcase size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>Submit Job Details</p>
                  <p style={{ fontSize: 12, color: '#636366', margin: '2px 0 0' }}>Fill out a form with job specifics</p>
                </div>
                <ExternalLink size={14} style={{ color: '#48484a' }} />
              </button>
            </div>

            <button
              onClick={() => setShowJobOffer(false)}
              style={{ marginTop: 16, width: '100%', padding: '10px 0', fontSize: 14, fontWeight: 600, color: '#636366', background: 'transparent', border: 'none', cursor: 'pointer' }}
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
    <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px' }} className="rounded-none lg:rounded-2xl border-0 lg:border lg:p-5">
      {title && (
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <span style={{ fontSize: 10, fontWeight: 600, color: '#636366', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{title}</span>
          {extra && <span style={{ marginLeft: 'auto' }}>{extra}</span>}
        </h3>
      )}
      {children}
    </div>
  )
}

function MiniStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div style={{ padding: 10, borderRadius: 12, background: '#141414', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' }} className="lg:p-3">
      {icon}
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.2 }} className="lg:text-base">{value}</div>
      <div style={{ fontSize: 10, color: '#636366', fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function MiniVerify({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600, color: '#30d158', background: 'rgba(48,209,88,0.15)', border: '1px solid rgba(48,209,88,0.1)' }}>
      {icon} {label}
    </span>
  )
}

function ActivitySignal({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)', color: '#636366', fontSize: 12 }}>
      {icon} {label}
    </span>
  )
}

function WorkPref({ accepted, icon, label }: { accepted: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      background: accepted ? 'rgba(48,209,88,0.15)' : '#2c2c2e',
      color: accepted ? '#30d158' : '#48484a',
      border: accepted ? '1px solid rgba(48,209,88,0.1)' : '1px solid rgba(255,255,255,0.06)',
      textDecoration: accepted ? 'none' : 'line-through',
    }}>
      {icon} {label}
      {accepted && <Check size={12} style={{ color: '#30d158' }} />}
    </span>
  )
}
