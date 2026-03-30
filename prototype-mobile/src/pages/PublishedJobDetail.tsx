import { ArrowLeft, Eye, Users, Clock, MapPin, Star, Shield, MessageCircle, CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const applicants = [
  { name: 'Carlos M.', photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face', profession: 'Plumber', rating: 4.9, reviews: 32, tier: 'Trusted', distance: '4 mi', response: '12 min ago' },
  { name: 'Alex R.', photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face', profession: 'General Contractor', rating: 4.7, reviews: 18, tier: 'Verified', distance: '7 mi', response: '35 min ago' },
  { name: 'David L.', photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face', profession: 'Plumber', rating: 4.5, reviews: 8, tier: 'Verified', distance: '12 mi', response: '1h ago' },
]

export default function PublishedJobDetail() {
  const nav = useNavigate()

  return (
    <div className="page-content bg-white">

      {/* Header */}
      <div className="bg-[var(--brand)] px-5 pt-5 pb-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-full opacity-[0.08] -translate-y-8 translate-x-8" />

        <div className="flex items-center justify-between mb-2 relative">
          <button onClick={() => nav('/jobs')} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center press">
            <ArrowLeft size={17} className="text-white" />
          </button>
          <span className="text-[11px] font-semibold text-white bg-white/20 px-2.5 py-0.5 rounded-full">Open</span>
        </div>

        <div className="flex items-center justify-between relative">
          <div>
            <h1 className="text-[20px] font-bold text-white tracking-tight">Bathroom Plumbing</h1>
            <p className="text-[11px] text-white/60">Doral, FL · Posted yesterday</p>
          </div>
          <span className="text-[22px] font-bold text-white">$800</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3">
          <span className="flex items-center gap-1 text-[11px] text-white/60"><Eye size={11} />31 views</span>
          <span className="flex items-center gap-1 text-[11px] text-white font-semibold"><Users size={11} />3 responses</span>
          <span className="flex items-center gap-1 text-[11px] text-white/60"><Clock size={11} />Expires in 48h</span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">

        {/* Job description */}
        <div className="card p-4 anim-up">
          <p className="text-[13px] leading-relaxed">Full bathroom plumbing job — replace pipes, install new fixtures, connect water heater. Tools provided.</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[11px] text-muted flex items-center gap-1"><MapPin size={10} />Doral, FL</span>
            <span className="text-[11px] text-green-600 font-semibold">Fixed · $800</span>
          </div>
        </div>

        {/* Responses header */}
        <div className="flex items-center justify-between px-1 anim-up">
          <p className="t-label">Responses ({applicants.length})</p>
          <span className="text-[10px] text-muted">Newest first</span>
        </div>

        {/* Applicant cards */}
        <div className="space-y-2.5 stagger">
          {applicants.map((a, i) => (
            <div key={i} className={`card p-4 anim-up ${i === 0 ? 'ring-1 ring-[var(--brand)]/15' : ''}`}>
              {i === 0 && (
                <div className="flex items-center gap-1 mb-2">
                  <Star size={10} className="text-amber-400" fill="#fbbf24" />
                  <span className="text-[9px] font-bold text-amber-600">Best match</span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-3">
                <img src={a.photo} alt={a.name} className="w-12 h-12 rounded-2xl object-cover" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[14px] font-bold">{a.name}</p>
                    <Shield size={12} className="text-[var(--brand)]" />
                  </div>
                  <p className="text-[10px] text-muted">{a.profession} · {a.distance}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-500">
                      <Star size={9} fill="#f59e0b" />{a.rating}
                    </span>
                    <span className="text-[10px] text-faded">({a.reviews} reviews)</span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                      a.tier === 'Trusted' ? 'bg-green-50 text-green-600' : 'bg-[var(--brand-light)] text-[var(--brand)]'
                    }`}>{a.tier}</span>
                  </div>
                </div>
                <span className="text-[9px] text-faded">{a.response}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="flex-1 bg-[var(--brand)] text-white py-2.5 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 press">
                  <CheckCircle2 size={13} /> Accept
                </button>
                <button className="flex-1 card py-2.5 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 press shadow-sm">
                  <MessageCircle size={13} className="text-[var(--brand)]" /> Chat
                </button>
                <button className="w-10 card py-2.5 rounded-xl flex items-center justify-center press shadow-sm">
                  <ChevronRight size={14} className="text-muted" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Share again */}
        <div className="card p-4 text-center anim-up">
          <p className="text-[12px] text-muted mb-2">Not finding the right fit?</p>
          <button className="bg-[var(--dark)] text-white py-3 px-6 rounded-xl text-[13px] font-semibold press">
            Rebroadcast to More Contractors
          </button>
        </div>

      </div>
    </div>
  )
}
