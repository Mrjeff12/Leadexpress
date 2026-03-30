import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { useContractorProfile } from '../hooks/useContractorProfile'
import { PROFESSIONS } from '../lib/professions'
import {
  Shield,
  Star,
  MapPin,
  Wrench,
  Clock,
  Briefcase,
  Users,
  Share2,
  Image,
  ExternalLink,
  Globe,
  ArrowLeft,
  Eye,
  Copy,
  Check,
  Loader2,
  Pencil,
} from 'lucide-react'

/* ───────────────────── Helpers ───────────────────── */

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function responseTimeLabel(mins: number | null | undefined): string {
  if (!mins || mins <= 0) return '--'
  if (mins < 60) return `${Math.round(mins)} min`
  if (mins < 1440) return `${Math.round(mins / 60)} hr`
  return `${Math.round(mins / 1440)} days`
}

/* ───────────────────── Component ───────────────────── */

export default function PublicProfileView() {
  const navigate = useNavigate()
  const { profile: authProfile } = useAuth()
  const { t, locale } = useI18n()
  const isHe = locale === 'he'
  const { data, isLoading, publishProfile, isPublishing } = useContractorProfile()
  const [copied, setCopied] = useState(false)

  const cp = data?.profile
  const stats = data?.stats
  const fullName = data?.full_name ?? authProfile?.full_name ?? ''
  const professions = data?.professions ?? []
  const counties = data?.counties ?? []
  const zipCodes = data?.zip_codes ?? []

  const profileUrl = cp?.slug ? `${window.location.origin}/pro/${cp.slug}` : null

  function handleShare() {
    if (!profileUrl) return
    if (navigator.share) {
      navigator.share({ title: fullName, url: profileUrl })
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${fullName} on MasterLeadFlow: ${profileUrl}`)}`, '_blank')
    }
  }

  function handleCopy() {
    if (!profileUrl) return
    navigator.clipboard.writeText(profileUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handlePublish() {
    try {
      const slug = await publishProfile()
      if (slug) window.open(`/pro/${slug}`, '_blank')
    } catch {
      // handled by mutation
    }
  }

  /* ───── Loading ───── */
  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        <div className="glass-panel rounded-2xl p-6 animate-pulse">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-40 bg-white/10 rounded-lg" />
              <div className="h-4 w-28 bg-white/5 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-20 bg-white/5 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  /* ───── Main ───── */
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/profile')}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Eye size={18} className="text-white/40" />
              {isHe ? '\u05ea\u05e6\u05d5\u05d2\u05d4 \u05de\u05e7\u05d3\u05d9\u05de\u05d4 \u05e9\u05dc \u05d4\u05e4\u05e8\u05d5\u05e4\u05d9\u05dc' : 'Public Profile Preview'}
            </h1>
            <p className="text-xs text-white/40 mt-0.5">
              {isHe ? '\u05db\u05da \u05d4\u05e4\u05e8\u05d5\u05e4\u05d9\u05dc \u05e9\u05dc\u05da \u05e0\u05e8\u05d0\u05d4 \u05dc\u05d0\u05d7\u05e8\u05d9\u05dd' : 'This is how others see your profile'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profileUrl && (
            <>
              <button
                onClick={handleCopy}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                {copied ? (isHe ? '\u05d4\u05d5\u05e2\u05ea\u05e7' : 'Copied') : (isHe ? '\u05e7\u05d9\u05e9\u05d5\u05e8' : 'Copy Link')}
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-[#fe5b25] hover:bg-[#e5501f] transition-colors"
              >
                <Share2 size={13} />
                {isHe ? '\u05e9\u05ea\u05e3' : 'Share'}
              </button>
            </>
          )}
          {!profileUrl && (
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#fe5b25] hover:bg-[#e5501f] transition-colors disabled:opacity-50"
            >
              {isPublishing ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
              {isHe ? '\u05e4\u05e8\u05e1\u05dd \u05e4\u05e8\u05d5\u05e4\u05d9\u05dc' : 'Publish Profile'}
            </button>
          )}
        </div>
      </div>

      {/* ═══════ Hero Card ═══════ */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {/* Gradient header */}
        <div className="bg-gradient-to-br from-[#fe5b25] to-[#e8461c] px-6 pt-6 pb-14 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full opacity-[0.06] -translate-y-16 translate-x-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full opacity-[0.04] translate-y-12 -translate-x-8" />
          <p className="text-[10px] text-white/40 font-semibold uppercase tracking-widest relative">
            {isHe ? '\u05ea\u05e6\u05d5\u05d2\u05d4 \u05de\u05e7\u05d3\u05d9\u05de\u05d4' : 'PUBLIC PROFILE PREVIEW'}
          </p>
        </div>

        {/* Profile info - overlapping hero */}
        <div className="px-5 md:px-6 -mt-10 pb-5 relative">
          <div className="flex items-end gap-4 mb-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white text-2xl font-bold border-[3px] border-gray-900 shadow-xl overflow-hidden flex-shrink-0">
              {cp?.avatar_url ? (
                <img src={cp.avatar_url} alt={fullName} className="w-full h-full object-cover" />
              ) : (
                getInitials(fullName)
              )}
            </div>
            <div className="flex-1 min-w-0 pb-0.5">
              <div className="flex items-center gap-1.5">
                <h2 className="text-lg md:text-xl font-bold text-white truncate">{fullName || (isHe ? '\u05d4\u05e9\u05dd \u05e9\u05dc\u05da' : 'Your Name')}</h2>
                {cp?.tier && cp.tier !== 'new' && (
                  <Shield size={16} className="text-[#fe5b25] flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-white/50 truncate">
                {cp?.headline || professions[0] || (isHe ? '\u05e7\u05d1\u05dc\u05df' : 'Contractor')}
              </p>
              {cp?.avg_rating != null && cp.avg_rating > 0 && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Star size={12} className="text-amber-400" fill="#fbbf24" />
                  <span className="text-xs font-semibold text-amber-400">{cp.avg_rating.toFixed(1)}</span>
                  {cp.review_count > 0 && (
                    <span className="text-[10px] text-white/30">({cp.review_count} {isHe ? '\u05d1\u05d9\u05e7\u05d5\u05e8\u05d5\u05ea' : 'reviews'})</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {cp?.tier && cp.tier !== 'new' && (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[#fe5b25]/15 text-[#fe5b25]">
                {cp.tier === 'elite' ? 'Elite' : cp.tier === 'trusted' ? 'Trusted' : 'Verified'}
              </span>
            )}
            {stats?.available_today && (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-green-500/15 text-green-400">
                {isHe ? '\u05d6\u05de\u05d9\u05df' : 'Available'}
              </span>
            )}
            {cp?.years_experience && (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/5 text-white/50 border border-white/10">
                {cp.years_experience} {isHe ? '\u05e9\u05e0\u05d5\u05ea \u05e0\u05d9\u05e1\u05d9\u05d5\u05df' : 'yrs exp'}
              </span>
            )}
          </div>

          {/* Bio */}
          {cp?.bio && (
            <p className="text-xs text-white/40 leading-relaxed mb-4 line-clamp-3">{cp.bio}</p>
          )}

          {/* CTA button (preview - disabled) */}
          <button
            disabled
            className="w-full bg-[#fe5b25]/80 text-white py-3 rounded-xl text-sm font-semibold opacity-60 cursor-not-allowed"
          >
            <Briefcase size={14} className="inline mr-1.5 -mt-0.5" />
            {isHe ? '\u05e9\u05dc\u05d7 \u05d4\u05e6\u05e2\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4' : 'Send Job Offer'}
          </button>
          <p className="text-[10px] text-white/20 text-center mt-1.5">
            {isHe ? '\u05db\u05e4\u05ea\u05d5\u05e8 \u05de\u05d5\u05e9\u05d1\u05ea \u05d1\u05ea\u05e6\u05d5\u05d2\u05d4 \u05de\u05e7\u05d3\u05d9\u05de\u05d4' : 'Button disabled in preview mode'}
          </p>
        </div>
      </div>

      {/* ═══════ Stats Grid ═══════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 stagger-children">
        {[
          {
            icon: Briefcase,
            value: stats?.job_orders_completed ?? stats?.successful_jobs ?? 0,
            label: isHe ? '\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea' : 'Jobs',
          },
          {
            icon: Clock,
            value: responseTimeLabel(stats?.avg_response_mins),
            label: isHe ? '\u05d6\u05de\u05df \u05ea\u05d2\u05d5\u05d1\u05d4' : 'Response',
          },
          {
            icon: Users,
            value: stats?.groups_active ?? 0,
            label: isHe ? '\u05e7\u05d1\u05d5\u05e6\u05d5\u05ea' : 'Groups',
          },
          {
            icon: Star,
            value: cp?.avg_rating ? cp.avg_rating.toFixed(1) : '--',
            label: isHe ? '\u05d3\u05d9\u05e8\u05d5\u05d2' : 'Rating',
          },
        ].map((stat, i) => {
          const Icon = stat.icon
          return (
            <div key={i} className="glass-panel rounded-2xl p-4 text-center" style={{ animationDelay: `${i * 60}ms` }}>
              <Icon size={16} className="text-white/30 mx-auto mb-1.5" />
              <p className="text-lg font-bold text-white">{stat.value}</p>
              <p className="text-[10px] text-white/40 font-medium">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* ═══════ Services ═══════ */}
      {professions.length > 0 && (
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wrench size={15} className="text-white/30" />
            <p className="text-sm font-semibold text-white/80">{isHe ? '\u05e9\u05d9\u05e8\u05d5\u05ea\u05d9\u05dd' : 'Services'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {professions.map(p => {
              const prof = PROFESSIONS.find(pr => pr.id === p)
              const label = prof ? (isHe ? prof.he : prof.en) : p
              return (
                <span key={p} className="text-xs px-3 py-1.5 rounded-xl bg-[#fe5b25]/10 text-[#fe5b25] font-medium border border-[#fe5b25]/20">
                  {label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══════ Service Areas ═══════ */}
      {(counties.length > 0 || zipCodes.length > 0) && (
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={15} className="text-white/30" />
            <p className="text-sm font-semibold text-white/80">{isHe ? '\u05d0\u05d6\u05d5\u05e8\u05d9 \u05e9\u05d9\u05e8\u05d5\u05ea' : 'Service Areas'}</p>
          </div>
          {counties.length > 0 && (
            <p className="text-xs text-white/50 mb-2">{counties.join(', ')}</p>
          )}
          {zipCodes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {zipCodes.slice(0, 12).map(z => (
                <span key={z} className="px-2 py-0.5 rounded-md text-[10px] font-mono text-white/40 bg-white/5 border border-white/10">
                  {z}
                </span>
              ))}
              {zipCodes.length > 12 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] text-white/30">
                  +{zipCodes.length - 12} more
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════ Portfolio Placeholder ═══════ */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Image size={15} className="text-white/30" />
          <p className="text-sm font-semibold text-white/80">{isHe ? '\u05ea\u05d9\u05e7 \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea' : 'Portfolio'}</p>
          <span className="text-[10px] text-white/25 ml-auto">
            {isHe ? '\u05d1\u05e7\u05e8\u05d5\u05d1' : 'Coming soon'}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex-shrink-0 w-24 md:w-28 aspect-square rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Image size={18} className="text-white/10" />
            </div>
          ))}
        </div>
      </div>

      {/* ═══════ Reviews Preview ═══════ */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Star size={15} className="text-amber-400/50" />
          <p className="text-sm font-semibold text-white/80">{isHe ? '\u05d1\u05d9\u05e7\u05d5\u05e8\u05d5\u05ea' : 'Reviews'}</p>
          {cp?.review_count != null && cp.review_count > 0 && (
            <span className="text-[10px] text-white/25 ml-auto">{cp.review_count} {isHe ? '\u05e1\u05d4"\u05db' : 'total'}</span>
          )}
        </div>

        {cp?.review_count != null && cp.review_count > 0 ? (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-center">
              <div className="text-2xl font-extrabold text-white">{(cp.avg_rating ?? 0).toFixed(1)}</div>
              <div className="flex gap-0.5 justify-center mt-1">
                {Array(5).fill(0).map((_, j) => (
                  <Star key={j} size={10} className={j < Math.round(cp.avg_rating ?? 0) ? 'text-amber-400' : 'text-white/10'} fill={j < Math.round(cp.avg_rating ?? 0) ? '#fbbf24' : 'transparent'} />
                ))}
              </div>
              <div className="text-[10px] text-white/30 mt-1">{cp.review_count} {isHe ? '\u05d1\u05d9\u05e7\u05d5\u05e8\u05d5\u05ea' : 'reviews'}</div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-white/5 border border-dashed border-white/10 flex items-center justify-center mb-3">
              <Star size={20} className="text-white/15" />
            </div>
            <p className="text-sm font-medium text-white/50">
              {isHe ? '\u05d0\u05d9\u05df \u05d1\u05d9\u05e7\u05d5\u05e8\u05d5\u05ea \u05e2\u05d3\u05d9\u05d9\u05df' : 'No reviews yet'}
            </p>
            <p className="text-xs text-white/25 mt-1 max-w-xs mx-auto">
              {isHe
                ? '\u05d1\u05d9\u05e7\u05d5\u05e8\u05d5\u05ea \u05d9\u05d5\u05e4\u05d9\u05e2\u05d5 \u05d0\u05d7\u05e8\u05d9 \u05d4\u05e9\u05dc\u05de\u05ea \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea'
                : 'Reviews will appear after completed jobs.'}
            </p>
          </div>
        )}
      </div>

      {/* ═══════ Edit profile link ═══════ */}
      <div className="flex items-center justify-center gap-3 pt-2 pb-6">
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
        >
          <Pencil size={13} />
          {isHe ? '\u05e2\u05e8\u05d5\u05da \u05e4\u05e8\u05d5\u05e4\u05d9\u05dc' : 'Edit Profile'}
        </button>
        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#fe5b25] bg-[#fe5b25]/10 border border-[#fe5b25]/20 hover:bg-[#fe5b25]/15 transition-colors"
          >
            <ExternalLink size={13} />
            {isHe ? '\u05e4\u05ea\u05d7 \u05e4\u05e8\u05d5\u05e4\u05d9\u05dc \u05e6\u05d9\u05d1\u05d5\u05e8\u05d9' : 'View Live Profile'}
          </a>
        )}
      </div>
    </div>
  )
}
