import { useState } from 'react'
import { Camera, ArrowRight, Check, User, Phone, Mail } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function CompleteAccount() {
  const nav = useNavigate()

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-6 pt-6 pb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-muted">Almost done!</p>
          <button onClick={() => nav('/')} className="text-[11px] text-muted press">Skip for now</button>
        </div>
        <div className="flex gap-1 mb-4">
          <div className="flex-1 h-1 rounded-full bg-[var(--brand)]" />
          <div className="flex-1 h-1 rounded-full bg-[var(--brand)]" />
          <div className="flex-1 h-1 rounded-full bg-[var(--gray-100)]" />
        </div>
      </div>

      <div className="flex-1 px-6 pb-6">
        <h2 className="text-[22px] font-bold tracking-tight mb-1">Complete your account</h2>
        <p className="text-[13px] text-muted mb-6">Add a few details so contractors can find and trust you</p>

        {/* Avatar */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[var(--gray-100)] flex items-center justify-center">
              <User size={32} className="text-[var(--gray-400)]" />
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 bg-[var(--brand)] rounded-full flex items-center justify-center press border-2 border-white">
              <Camera size={14} className="text-white" />
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <p className="text-[11px] text-muted font-medium mb-1.5">Full name</p>
            <div className="card flex items-center gap-3 px-4 py-3">
              <User size={15} className="text-muted" />
              <input type="text" placeholder="Your full name" defaultValue="Mike Johnson"
                className="flex-1 text-[14px] outline-none" />
              <Check size={14} className="text-green-500" />
            </div>
          </div>

          <div>
            <p className="text-[11px] text-muted font-medium mb-1.5">Phone number</p>
            <div className="card flex items-center gap-3 px-4 py-3">
              <Phone size={15} className="text-muted" />
              <input type="tel" placeholder="Your phone number" defaultValue="(305) 555-0147"
                className="flex-1 text-[14px] outline-none" />
              <Check size={14} className="text-green-500" />
            </div>
          </div>

          <div>
            <p className="text-[11px] text-muted font-medium mb-1.5">Email (optional)</p>
            <div className="card flex items-center gap-3 px-4 py-3">
              <Mail size={15} className="text-muted" />
              <input type="email" placeholder="your@email.com"
                className="flex-1 text-[14px] outline-none placeholder-[var(--gray-400)]" />
            </div>
          </div>

          <div>
            <p className="text-[11px] text-muted font-medium mb-1.5">Business name (optional)</p>
            <div className="card flex items-center gap-3 px-4 py-3">
              <input type="text" placeholder="e.g. Mike's Locksmith Services"
                className="flex-1 text-[14px] outline-none placeholder-[var(--gray-400)]" />
            </div>
          </div>
        </div>

        <div className="bg-[var(--brand-light)] rounded-xl p-3 mt-5 flex items-center gap-2">
          <span className="text-[11px] text-[var(--brand)]">Completing your account unlocks <strong>+20% more leads</strong></span>
        </div>
      </div>

      <div className="px-6 pb-8">
        <button onClick={() => nav('/')}
          className="w-full bg-[var(--brand)] text-white py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 press">
          Save & Continue <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
