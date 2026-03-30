import { ArrowLeft, Phone, Navigation, MapPin, Clock, DollarSign, MessageCircle, CheckCircle2, Copy, Timer, MessageSquare, Star, Shield, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const steps = ['Claimed', 'Driving', 'Working', 'Done']
const currentStep = 2

export default function JobDetail() {
  const nav = useNavigate()

  return (
    <div className="page-content bg-white">

      {/* Compact orange header */}
      <div className="bg-[var(--brand)] px-5 pt-5 pb-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-full opacity-[0.08] -translate-y-8 translate-x-8" />

        <div className="flex items-center justify-between mb-2 relative">
          <button onClick={() => nav('/jobs')} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center press">
            <ArrowLeft size={17} className="text-white" />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-white/60"><Timer size={10} />1h 23m</span>
            <span className="text-[11px] font-semibold text-white bg-white/20 px-2.5 py-0.5 rounded-full">Active</span>
          </div>
        </div>

        <div className="flex items-center justify-between relative">
          <div>
            <h1 className="text-[20px] font-bold text-white tracking-tight">Lock Rekey</h1>
            <p className="text-[11px] text-white/60">3 locks · Residential</p>
          </div>
          <span className="text-[22px] font-bold text-white">$175</span>
        </div>

        {/* Timeline integrated in header */}
        <div className="mt-4 flex items-center gap-0">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  i < currentStep ? 'bg-white text-[var(--brand)]' :
                  i === currentStep ? 'bg-white text-[var(--brand)] ring-4 ring-white/20' :
                  'bg-white/20 text-white/40'
                }`}>
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span className={`text-[8px] font-medium mt-1 ${
                  i === currentStep ? 'text-white' : i < currentStep ? 'text-white/60' : 'text-white/20'
                }`}>{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-[2px] w-full mt-[-14px] ${i < currentStep ? 'bg-white/60' : 'bg-white/15'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Mark as Done */}
        <button className="w-full mt-4 bg-white text-[var(--brand)] py-3 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 press">
          <CheckCircle2 size={16} />
          Mark as Done
        </button>
      </div>

      {/* Map */}
      <div className="h-[90px] bg-gradient-to-br from-[#e8e5de] to-[#d4d0c8] relative overflow-hidden press">
        <div className="absolute inset-0 opacity-15">
          {[0,1,2,3,4].map(i => <div key={`h${i}`} className="absolute left-0 right-0 border-b border-[#999]" style={{top:`${i*25}%`}} />)}
          {[0,1,2,3,4].map(i => <div key={`v${i}`} className="absolute top-0 bottom-0 border-r border-[#999]" style={{left:`${i*25}%`}} />)}
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-6 h-6 rounded-full bg-[var(--brand)]/20 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--brand)] border-2 border-white shadow-sm" />
          </div>
        </div>
        <div className="absolute bottom-2 left-3 right-3">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm">
            <Navigation size={10} className="text-blue-500" />
            <span className="text-[10px] font-medium">1234 NW 5th Ave, Ft. Lauderdale · 3.5 mi</span>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">

        {/* Job info */}
        <div className="card p-4 anim-up">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-muted">Fixed price</span>
            <span className="text-[15px] font-bold text-green-600">$175</span>
          </div>
          <p className="text-[14px] font-medium leading-relaxed mb-2">Rekey 3 locks — front door, back door, garage entry.</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11px] text-muted"><Clock size={10} />Today · 10:00 AM</span>
          </div>
          <div className="bg-amber-50 rounded-lg p-2.5 mt-3">
            <p className="text-[10px] text-amber-700 font-medium">📝 Has a dog. Ring the bell. Gate: 4521</p>
          </div>
        </div>

        {/* Publisher - who sent you this job */}
        <div className="anim-up">
          <p className="t-label mb-2">Published by</p>
          <div className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"
                alt="Tom B." className="w-12 h-12 rounded-2xl object-cover" />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[14px] font-bold">Tom B.</p>
                  <Shield size={12} className="text-[var(--brand)]" />
                </div>
                <p className="text-[10px] text-muted">General Contractor · Verified</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star size={10} className="text-amber-400" fill="#fbbf24" />
                  <span className="text-[10px] font-semibold text-amber-500">4.9</span>
                  <span className="text-[10px] text-faded">(47 reviews)</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-faded" />
            </div>

            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--brand-light)] press border border-[var(--brand)]/15">
                <MessageCircle size={13} className="text-[var(--brand)]" />
                <span className="text-[11px] font-semibold text-[var(--brand)]">Chat</span>
              </button>
              <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#25D366]/10 press">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.212L4 20l1.212-3.757A8 8 0 1112 20z"/></svg>
                <span className="text-[11px] font-semibold text-[#25D366]">WhatsApp</span>
              </button>
              <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-50 press">
                <Phone size={13} className="text-green-600" />
                <span className="text-[11px] font-semibold text-green-600">Call</span>
              </button>
            </div>
          </div>
        </div>

        {/* Customer - who you're doing the work for */}
        <div className="anim-up">
          <p className="t-label mb-2">Customer</p>
          <div className="card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
                alt="James K." className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1">
                <p className="text-[14px] font-bold">James K.</p>
                <p className="text-[10px] text-muted">End customer · Ft. Lauderdale</p>
              </div>
            </div>

            <button className="w-full flex items-center gap-3 px-4 py-3 press" style={{ borderTop: '1px solid var(--gray-100)' }}>
              <Phone size={13} className="text-green-600" />
              <span className="text-[13px] font-medium flex-1">(954) 555-0182</span>
              <span className="text-[10px] text-[var(--brand)] font-semibold bg-[var(--brand-light)] px-2 py-0.5 rounded-full">Call</span>
            </button>

            <button className="w-full flex items-center gap-3 px-4 py-3 press" style={{ borderTop: '1px solid var(--gray-100)' }}>
              <MessageSquare size={13} className="text-blue-500" />
              <span className="text-[13px] font-medium flex-1">Send SMS</span>
              <span className="text-[10px] text-blue-500 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">SMS</span>
            </button>

            <button className="w-full flex items-center gap-3 px-4 py-3 press" style={{ borderTop: '1px solid var(--gray-100)' }}>
              <MapPin size={13} className="text-muted" />
              <div className="flex-1 text-left">
                <p className="text-[13px] font-medium">1234 NW 5th Ave</p>
                <p className="text-[10px] text-muted">Ft. Lauderdale, FL 33301</p>
              </div>
              <Copy size={12} className="text-[var(--brand)]" />
            </button>
          </div>
        </div>



      </div>
    </div>
  )
}
