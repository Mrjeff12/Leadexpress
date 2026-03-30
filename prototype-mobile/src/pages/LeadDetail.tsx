import { ArrowLeft, MapPin, Clock, DollarSign, Zap, Flame, MessageCircle, Share2, Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function LeadDetail() {
  const nav = useNavigate()

  return (
    <div className="page-content bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => nav('/leads')} className="w-9 h-9 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
          <ArrowLeft size={17} strokeWidth={1.8} />
        </button>
        <h1 className="text-[18px] font-bold tracking-tight flex-1">Lead Details</h1>
        <button className="w-9 h-9 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
          <Share2 size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div className="px-5 pb-6">

        {/* Urgent badge */}
        <div className="flex items-center gap-2 mb-3 anim-up">
          <div className="flex items-center gap-1.5 bg-[var(--brand-light)] px-3 py-1.5 rounded-full">
            <Flame size={12} className="text-[var(--brand)]" />
            <span className="text-[11px] font-bold text-[var(--brand)]">URGENT</span>
          </div>
          <span className="text-[11px] text-muted">Posted 5 min ago</span>
        </div>

        {/* Title + Price */}
        <h2 className="text-[24px] font-bold tracking-tight mb-1 anim-up">Lockout Service</h2>
        <p className="text-[20px] font-bold text-green-600 mb-4 anim-up">$80 - $120</p>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-5 anim-up">
          <div className="card-filled p-3.5 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={13} className="text-muted" />
              <span className="t-tiny text-muted">Location</span>
            </div>
            <p className="t-sub text-[13px]">Miami, FL 33130</p>
            <p className="text-[10px] text-muted">2.3 miles away</p>
          </div>
          <div className="card-filled p-3.5 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={13} className="text-muted" />
              <span className="t-tiny text-muted">Needed</span>
            </div>
            <p className="t-sub text-[13px]">ASAP</p>
            <p className="text-[10px] text-muted">Customer is waiting</p>
          </div>
        </div>

        {/* Description */}
        <div className="mb-5 anim-up">
          <p className="t-label mb-2">Description</p>
          <div className="card p-4">
            <p className="text-[13px] text-[var(--gray-500)] leading-relaxed">
              Locked out of my apartment. Need a locksmith ASAP. The door has a standard deadbolt lock. I'm standing outside and it's getting late. Please come as quickly as possible.
            </p>
          </div>
        </div>

        {/* Customer */}
        <div className="mb-5 anim-up">
          <p className="t-label mb-2">Customer</p>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[var(--brand)] flex items-center justify-center text-white text-[13px] font-bold">SM</div>
            <div className="flex-1">
              <p className="t-sub">Sarah M.</p>
              <p className="text-[11px] text-muted">Miami, FL · First request</p>
            </div>
          </div>
        </div>

        {/* Map placeholder */}
        <div className="mb-5 anim-up">
          <p className="t-label mb-2">Location</p>
          <div className="h-[160px] rounded-2xl bg-[var(--gray-100)] relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <MapPin size={24} className="text-[var(--brand)]" />
            </div>
            <div className="absolute bottom-3 left-3 right-3">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
                <MapPin size={12} className="text-[var(--brand)]" />
                <span className="text-[11px] font-medium">Miami, FL 33130 · 2.3 mi</span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="anim-up">
          <button className="w-full btn-primary text-[16px] py-4">
            <Zap size={18} /> Contact Lead Publisher
          </button>
        </div>

      </div>
    </div>
  )
}
