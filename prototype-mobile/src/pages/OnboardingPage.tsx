import { useState } from 'react'
import { MessageCircle, Wrench, MapPin, Users, Clock, ArrowRight, Check, Link2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const professions = ['Locksmith', 'Plumber', 'Electrician', 'HVAC', 'Painter', 'Roofer', 'General Contractor', 'Handyman']

export default function OnboardingPage() {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<string[]>(['Locksmith'])

  const steps = [
    { icon: MessageCircle, title: 'Connect WhatsApp', sub: 'Get lead notifications instantly' },
    { icon: Wrench, title: 'Your Professions', sub: 'What services do you offer?' },
    { icon: MapPin, title: 'Service Areas', sub: 'Where do you work?' },
    { icon: Users, title: 'WhatsApp Groups', sub: 'Add groups to scan for leads' },
    { icon: Clock, title: 'Working Hours', sub: 'When are you available?' },
  ]

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">

      {/* Progress */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] text-muted">Step {step + 1} of {steps.length}</p>
          <button onClick={() => nav('/')} className="text-[11px] text-muted press">Skip</button>
        </div>
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full ${i <= step ? 'bg-[var(--brand)]' : 'bg-[var(--gray-100)]'}`} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pt-4 pb-6">
        {/* Step icon + title */}
        <div className="mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-light)] flex items-center justify-center mb-3">
            {(() => { const I = steps[step].icon; return <I size={22} className="text-[var(--brand)]" /> })()}
          </div>
          <h2 className="text-[22px] font-bold tracking-tight">{steps[step].title}</h2>
          <p className="text-[13px] text-muted mt-0.5">{steps[step].sub}</p>
        </div>

        {/* Step content */}
        {step === 0 && (
          <div className="space-y-3">
            <div className="card p-4">
              <p className="text-[11px] text-muted mb-2">WhatsApp phone number</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-[var(--gray-50)] rounded-lg px-3 py-2.5">
                  <span className="text-[13px]">🇺🇸 +1</span>
                </div>
                <input type="tel" placeholder="Your WhatsApp number" className="flex-1 card px-3 py-2.5 text-[14px] outline-none" />
              </div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 flex items-center gap-2">
              <MessageCircle size={14} className="text-green-600" />
              <p className="text-[11px] text-green-700">You'll receive lead alerts via WhatsApp</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            {professions.map(p => {
              const on = selected.includes(p)
              return (
                <button key={p} onClick={() => setSelected(on ? selected.filter(s=>s!==p) : [...selected, p])}
                  className={`w-full card p-3.5 flex items-center justify-between press ${on ? 'ring-1 ring-[var(--brand)]' : ''}`}>
                  <span className="text-[14px] font-medium">{p}</span>
                  {on && <div className="w-5 h-5 rounded-full bg-[var(--brand)] flex items-center justify-center"><Check size={12} className="text-white" /></div>}
                </button>
              )
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="card p-4">
              <p className="text-[11px] text-muted mb-2">Enter zip codes</p>
              <input type="text" placeholder="e.g. 33130, 33101" className="w-full card px-3 py-2.5 text-[14px] outline-none" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['33130','33101','33301'].map(z => (
                <span key={z} className="bg-[var(--brand-light)] text-[var(--brand)] text-[12px] font-medium px-3 py-1.5 rounded-full">{z}</span>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="card p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center mx-auto mb-2">
                <Link2 size={16} className="text-[#25D366]" />
              </div>
              <p className="text-[13px] font-medium mb-1">Paste WhatsApp group link</p>
              <input type="text" placeholder="https://chat.whatsapp.com/..." className="w-full card px-3 py-2.5 text-[13px] outline-none mt-2" />
            </div>
            <p className="text-[10px] text-faded text-center">We'll scan groups for leads matching your professions</p>
          </div>
        )}

        {step === 4 && (
          <div className="card p-4">
            <div className="space-y-2">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
                <div key={d} className="flex items-center justify-between py-1.5">
                  <span className={`text-[13px] font-medium w-10 ${i>=5?'text-faded':''}`}>{d}</span>
                  {i >= 5 ? <span className="text-[11px] text-faded">Off</span> : (
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] bg-[var(--gray-50)] px-2.5 py-1 rounded-lg">8:00 AM</span>
                      <span className="text-[10px] text-faded">—</span>
                      <span className="text-[12px] bg-[var(--gray-50)] px-2.5 py-1 rounded-lg">6:00 PM</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom button */}
      <div className="px-6 pb-8">
        <button onClick={() => step < 4 ? setStep(step + 1) : nav('/')}
          className="w-full bg-[var(--brand)] text-white py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 press">
          {step < 4 ? 'Continue' : 'Start Getting Leads'} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
