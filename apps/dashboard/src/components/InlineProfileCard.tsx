import { Link } from 'react-router-dom'
import { MapPin, ArrowUpRight } from 'lucide-react'
import TrustBadge from './TrustBadge'
import StarRating from './StarRating'

export interface ContractorResult {
  user_id: string
  slug: string
  full_name: string
  business_name: string | null
  headline: string | null
  avatar_url: string | null
  professions: string[] | null
  zip_codes: string[] | null
  counties: string[] | null
  tier: 'new' | 'verified' | 'trusted' | 'elite'
  avg_rating: number | null
  review_count: number
  available_today: boolean
  background_check: boolean
  member_since: string | null
}

export default function InlineProfileCard({ c }: { c: ContractorResult }) {
  const initials = c.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const professions = (c.professions ?? []).slice(0, 3)
  const location = c.counties?.length ? c.counties[0] : null

  return (
    <Link
      to={`/pro/${c.slug}`}
      className="group block bg-white rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-1"
      style={{ border: '1px solid rgba(0,0,0,0.06)' }}
    >
      {/* Top: Avatar + Info */}
      <div className="flex items-start gap-3.5">
        <div className="relative flex-shrink-0">
          {c.avatar_url ? (
            <img src={c.avatar_url} alt={c.full_name} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold text-white" style={{ background: 'linear-gradient(135deg, #fe5b25, #ff7a4d)' }}>
              {initials}
            </div>
          )}
          {c.available_today && (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm truncate" style={{ color: '#0b0707' }}>
              {c.full_name}
            </span>
            {c.background_check && (
              <svg viewBox="0 0 22 22" className="w-4 h-4 flex-shrink-0" fill="none">
                <circle cx="11" cy="11" r="11" fill="#1d9bf0" />
                <path d="M9.5 14.25L6.75 11.5l1.06-1.06 1.69 1.69 4.19-4.19L14.75 9l-5.25 5.25z" fill="white" />
              </svg>
            )}
          </div>

          {c.business_name && (
            <p className="text-xs truncate mt-0.5" style={{ color: '#3b3b3b', opacity: 0.5 }}>{c.business_name}</p>
          )}

          {c.review_count > 0 && c.avg_rating ? (
            <div className="mt-1.5">
              <StarRating rating={c.avg_rating} size="sm" count={c.review_count} />
            </div>
          ) : (
            <p className="text-[11px] mt-1.5" style={{ color: '#3b3b3b', opacity: 0.35 }}>New professional</p>
          )}
        </div>

        {/* Arrow indicator */}
        <ArrowUpRight size={16} className="text-gray-300 group-hover:text-[#fe5b25] transition-colors mt-1 flex-shrink-0" />
      </div>

      {/* Profession pills */}
      {professions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3.5">
          {professions.map((p) => (
            <span key={p} className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: 'rgba(254, 91, 37, 0.08)', color: '#d94a1a' }}>
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Bottom: location + tier */}
      <div className="flex items-center justify-between mt-3.5 pt-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
        {location ? (
          <span className="flex items-center gap-1 text-xs" style={{ color: '#3b3b3b', opacity: 0.4 }}>
            <MapPin className="w-3 h-3" /> {location}
          </span>
        ) : <span />}
        <TrustBadge tier={c.tier} size="sm" />
      </div>
    </Link>
  )
}
