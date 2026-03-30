import { useState } from 'react'
import { Phone, ArrowRight, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const nav = useNavigate()
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [code, setCode] = useState('')

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">

      {/* Hero */}
      <div className="bg-[var(--brand)] px-6 pt-16 pb-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full opacity-[0.06] -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full opacity-[0.04] translate-y-8 -translate-x-8" />

        <div className="relative">
          <h1 className="text-[28px] font-bold text-white tracking-tight leading-tight">Master<span className="text-white/80">leadflow</span></h1>
          <p className="text-[14px] text-white/60 mt-2">Your leads, jobs, and business — all in one app.</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pt-8 pb-6">

        {step === 'phone' ? (
          <>
            <h2 className="text-[22px] font-bold tracking-tight mb-1">Get started</h2>
            <p className="text-[13px] text-muted mb-6">Enter your phone number to sign in or create an account</p>

            <div className="mb-4">
              <p className="text-[11px] text-muted font-medium mb-1.5">Phone number</p>
              <div className="flex items-center gap-2 card p-0 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-3.5 bg-[var(--gray-50)] border-r border-[var(--gray-100)]">
                  <span className="text-[14px]">🇺🇸</span>
                  <span className="text-[13px] font-medium">+1</span>
                </div>
                <input type="tel" placeholder="(555) 000-0000" value={phone} onChange={e => setPhone(e.target.value)}
                  className="flex-1 py-3.5 px-2 text-[15px] outline-none placeholder-[var(--gray-400)]" />
              </div>
            </div>

            <button onClick={() => setStep('code')}
              className="w-full bg-[var(--brand)] text-white py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 press mb-4">
              Continue <ArrowRight size={16} />
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[var(--gray-200)]" />
              <span className="text-[11px] text-faded">or</span>
              <div className="flex-1 h-px bg-[var(--gray-200)]" />
            </div>

            <button className="w-full card py-3.5 flex items-center justify-center gap-2.5 press shadow-sm">
              <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center">
                <MessageCircle size={13} className="text-white" />
              </div>
              <span className="text-[14px] font-semibold">Continue with WhatsApp</span>
            </button>
          </>
        ) : (
          <>
            <h2 className="text-[22px] font-bold tracking-tight mb-1">Verify your number</h2>
            <p className="text-[13px] text-muted mb-6">We sent a code to +1 {phone || '(555) 000-0000'}</p>

            <div className="mb-4">
              <p className="text-[11px] text-muted font-medium mb-1.5">Verification code</p>
              <div className="flex gap-2">
                {[0,1,2,3,4,5].map(i => (
                  <input key={i} type="text" maxLength={1}
                    className="flex-1 h-14 text-center text-[20px] font-bold card outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    value={code[i] || ''} onChange={e => {
                      const c = code.split('')
                      c[i] = e.target.value
                      setCode(c.join(''))
                    }} />
                ))}
              </div>
            </div>

            <button onClick={() => nav('/')}
              className="w-full bg-[var(--brand)] text-white py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 press mb-4">
              Verify & Sign In
            </button>

            <button onClick={() => setStep('phone')} className="w-full text-center text-[13px] text-muted press py-2">
              Change number
            </button>

            <p className="text-[11px] text-faded text-center mt-4">
              Didn't receive? <button className="text-[var(--brand)] font-semibold">Resend code</button>
            </p>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 pb-8 text-center">
        <p className="text-[10px] text-faded">By continuing, you agree to our Terms & Privacy Policy</p>
      </div>
    </div>
  )
}
