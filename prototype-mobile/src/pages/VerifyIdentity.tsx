import { useState } from 'react'
import { ArrowLeft, Camera, Upload, Shield, CheckCircle2, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function VerifyIdentity() {
  const nav = useNavigate()
  const [step, setStep] = useState<'intro' | 'id' | 'selfie' | 'done'>('intro')

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => nav('/profile')} className="w-9 h-9 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
          <ArrowLeft size={17} strokeWidth={1.8} />
        </button>
        <h1 className="text-[18px] font-bold tracking-tight">Identity Verification</h1>
      </div>

      <div className="flex-1 px-6 pt-4 pb-6">
        {step === 'intro' && (
          <div className="text-center pt-8">
            <div className="w-16 h-16 rounded-2xl bg-[var(--brand-light)] flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-[var(--brand)]" />
            </div>
            <h2 className="text-[20px] font-bold tracking-tight mb-2">Get Verified</h2>
            <p className="text-[13px] text-muted leading-relaxed mb-8">
              Verify your identity to get the verified badge and unlock <strong className="text-[var(--brand)]">+30% more leads</strong>
            </p>

            <div className="space-y-3 text-left mb-8">
              {[
                { n: '1', title: 'Upload ID', desc: 'Photo of government-issued ID' },
                { n: '2', title: 'Take a selfie', desc: 'Quick face match for security' },
              ].map((s, i) => (
                <div key={i} className="card p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-[13px] font-bold">{s.n}</div>
                  <div>
                    <p className="text-[13px] font-semibold">{s.title}</p>
                    <p className="text-[11px] text-muted">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setStep('id')}
              className="w-full bg-[var(--brand)] text-white py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 press">
              Start Verification <ArrowRight size={16} />
            </button>
            <p className="text-[10px] text-faded mt-3">Takes less than 2 minutes</p>
          </div>
        )}

        {step === 'id' && (
          <div className="pt-4">
            <div className="flex gap-1 mb-6">
              <div className="flex-1 h-1 rounded-full bg-[var(--brand)]" />
              <div className="flex-1 h-1 rounded-full bg-[var(--gray-100)]" />
            </div>

            <h2 className="text-[20px] font-bold tracking-tight mb-1">Upload your ID</h2>
            <p className="text-[13px] text-muted mb-6">Driver's license, passport, or state ID</p>

            <div className="aspect-[3/2] rounded-2xl border-2 border-dashed border-[var(--gray-200)] flex flex-col items-center justify-center gap-3 mb-4 press bg-[var(--gray-50)]">
              <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                <Upload size={22} className="text-[var(--brand)]" />
              </div>
              <div className="text-center">
                <p className="text-[13px] font-semibold">Upload photo of ID</p>
                <p className="text-[11px] text-muted">or take a photo</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 card py-3.5 flex items-center justify-center gap-2 press shadow-sm">
                <Camera size={16} className="text-[var(--brand)]" />
                <span className="text-[13px] font-semibold">Camera</span>
              </button>
              <button className="flex-1 card py-3.5 flex items-center justify-center gap-2 press shadow-sm">
                <Upload size={16} className="text-muted" />
                <span className="text-[13px] font-semibold">Gallery</span>
              </button>
            </div>

            <button onClick={() => setStep('selfie')}
              className="w-full bg-[var(--brand)] text-white py-4 rounded-2xl text-[15px] font-semibold mt-6 press">
              Continue
            </button>
          </div>
        )}

        {step === 'selfie' && (
          <div className="pt-4">
            <div className="flex gap-1 mb-6">
              <div className="flex-1 h-1 rounded-full bg-[var(--brand)]" />
              <div className="flex-1 h-1 rounded-full bg-[var(--brand)]" />
            </div>

            <h2 className="text-[20px] font-bold tracking-tight mb-1">Take a selfie</h2>
            <p className="text-[13px] text-muted mb-6">We'll match it with your ID photo</p>

            <div className="aspect-square max-w-[240px] mx-auto rounded-full border-4 border-[var(--brand)]/20 flex items-center justify-center mb-6 bg-[var(--gray-50)]">
              <div className="text-center">
                <Camera size={32} className="text-[var(--brand)] mx-auto mb-2" />
                <p className="text-[12px] text-muted">Tap to take selfie</p>
              </div>
            </div>

            <div className="space-y-1.5 mb-6">
              {['Face the camera directly', 'Good lighting, no shadows', 'Remove sunglasses or hat'].map((tip, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-green-500" />
                  <span className="text-[12px] text-muted">{tip}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setStep('done')}
              className="w-full bg-[var(--brand)] text-white py-4 rounded-2xl text-[15px] font-semibold press">
              Take Selfie
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center pt-12">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <h2 className="text-[20px] font-bold tracking-tight mb-2">Verification Submitted!</h2>
            <p className="text-[13px] text-muted leading-relaxed mb-8">
              We'll review your documents and verify your identity within 24 hours. You'll get a notification when it's done.
            </p>

            <button onClick={() => nav('/profile')}
              className="w-full bg-[var(--dark)] text-white py-4 rounded-2xl text-[15px] font-semibold press">
              Back to Profile
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
