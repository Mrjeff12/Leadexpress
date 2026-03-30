import { ArrowLeft, Shield, Star, MapPin, Wrench, Clock, Briefcase, Users, Share2, Image, CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function PublicProfileView() {
  const nav = useNavigate()

  return (
    <div className="page-content bg-[var(--gray-50)]">

      {/* Hero gradient */}
      <div className="bg-gradient-to-br from-[var(--brand)] to-[#e8461c] px-5 pt-5 pb-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full opacity-[0.06] -translate-y-12 translate-x-12" />

        <div className="flex items-center justify-between mb-4 relative">
          <button onClick={() => nav('/profile')} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center press">
            <ArrowLeft size={17} className="text-white" />
          </button>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center press">
              <Share2 size={15} className="text-white" />
            </button>
          </div>
        </div>

        <p className="text-[10px] text-white/50 font-medium relative">PUBLIC PROFILE PREVIEW</p>
      </div>

      {/* Profile card */}
      <div className="px-5 -mt-12 relative">
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-16 h-16 rounded-2xl bg-[var(--dark)] flex items-center justify-center text-white text-[22px] font-bold border-2 border-white shadow-lg">MJ</div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-[18px] font-bold">Mike Johnson</h2>
                <Shield size={14} className="text-[var(--brand)]" />
              </div>
              <p className="text-[12px] text-muted">Professional Locksmith</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-0.5 text-[12px] font-semibold text-amber-500">
                  <Star size={11} fill="#f59e0b" /> 4.8
                </span>
                <span className="text-[11px] text-faded">(23 reviews)</span>
              </div>
            </div>
          </div>

          <p className="text-[12px] text-muted leading-relaxed mb-3">Licensed locksmith with 8 years of experience in residential and commercial services. Available for emergency calls 24/7.</p>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--brand-light)] text-[var(--brand)]">Verified</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600">Available</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--gray-100)] text-muted">8 yrs exp</span>
          </div>

          <button className="w-full bg-[var(--brand)] text-white py-3.5 rounded-xl text-[14px] font-semibold mt-4 press">
            Send Job Offer
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { icon: Briefcase, val: '47', label: 'Jobs' },
            { icon: Clock, val: '< 15m', label: 'Response' },
            { icon: Users, val: '3', label: 'Groups' },
            { icon: Star, val: '4.8', label: 'Rating' },
          ].map((s, i) => {
            const I = s.icon
            return (
              <div key={i} className="card p-3 text-center">
                <I size={14} className="text-muted mx-auto mb-1" />
                <p className="text-[14px] font-bold">{s.val}</p>
                <p className="text-[9px] text-faded">{s.label}</p>
              </div>
            )
          })}
        </div>

        {/* Services */}
        <div className="card p-4 mb-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Wrench size={14} className="text-muted" />
            <p className="text-[13px] font-semibold">Services</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['Locksmith', 'Lock Rekey', 'Smart Locks', 'Deadbolts', 'Car Lockout', 'Safe Opening'].map(s => (
              <span key={s} className="text-[11px] bg-[var(--gray-100)] px-2.5 py-1 rounded-full">{s}</span>
            ))}
          </div>
        </div>

        {/* Service areas */}
        <div className="card p-4 mb-3">
          <div className="flex items-center gap-2 mb-2.5">
            <MapPin size={14} className="text-muted" />
            <p className="text-[13px] font-semibold">Service Areas</p>
          </div>
          <p className="text-[12px] text-muted">Miami-Dade County, Broward County</p>
        </div>

        {/* Portfolio */}
        <div className="card p-4 mb-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Image size={14} className="text-muted" />
            <p className="text-[13px] font-semibold">Portfolio</p>
            <span className="text-[10px] text-faded ml-auto">4 projects</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex-shrink-0 w-[100px] aspect-square rounded-xl bg-[var(--gray-100)] flex items-center justify-center">
                <Image size={16} className="text-[var(--gray-400)]" />
              </div>
            ))}
          </div>
        </div>

        {/* Reviews */}
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Star size={14} className="text-amber-400" fill="#fbbf24" />
            <p className="text-[13px] font-semibold">Reviews</p>
            <span className="text-[10px] text-faded ml-auto">23 total</span>
          </div>

          <div className="space-y-3">
            {[
              { name: 'Sarah M.', rating: 5, text: 'Excellent work! Fast and professional.', time: '2 days ago' },
              { name: 'James K.', rating: 5, text: 'Great job on the rekey. Fair price.', time: '1 week ago' },
            ].map((r, i) => (
              <div key={i} className="bg-[var(--gray-50)] rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[12px] font-semibold">{r.name}</p>
                  <div className="flex gap-0.5">{Array(r.rating).fill(0).map((_, j) => <Star key={j} size={8} className="text-amber-400" fill="#fbbf24" />)}</div>
                </div>
                <p className="text-[11px] text-muted">{r.text}</p>
                <p className="text-[9px] text-faded mt-1">{r.time}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[10px] text-faded mb-4">Masterleadflow · Verified Contractor</p>
      </div>
    </div>
  )
}
