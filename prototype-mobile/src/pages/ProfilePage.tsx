import { useState } from 'react'
import { Camera, Shield, CheckCircle2, ChevronRight, ChevronDown, Star, MapPin, Wrench, Image, Award, Clock, MessageCircle, Send, Bell, Globe, Briefcase, Eye, Lock, FileCheck, ShieldCheck, ArrowRight, TrendingUp, Sparkles, UserCircle, BadgeCheck, Crown } from 'lucide-react'

function Section({ title, badge, children, defaultOpen = false }: {
  title: string; badge?: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3.5 press">
        <div className="flex items-center gap-2">
          <p className="t-sub text-[14px]">{title}</p>
          {badge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              badge === 'Complete' ? 'bg-green-50 text-green-600' : 'bg-[var(--brand-light)] text-[var(--brand)]'
            }`}>{badge}</span>
          )}
        </div>
        <ChevronDown size={16} className={`text-faded transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 border-t border-[var(--gray-100)]">{children}</div>}
    </div>
  )
}

const verifs = [
  { label: 'Profile Photo', status: 'done', icon: Camera },
  { label: 'Phone Verified', status: 'done', icon: MessageCircle },
  { label: 'Identity Verification', status: 'pending', desc: 'ID + selfie · Get verified badge ✓', icon: ShieldCheck, impact: '+30% more leads' },
  { label: 'Trade License', status: 'missing', desc: 'Upload license (optional)', icon: FileCheck, impact: '+10% more leads' },
]

const tierIcons = { New: UserCircle, Verified: BadgeCheck, Trusted: Award, Elite: Crown }
const tiers = [
  { name: 'New' as const, reached: true, perks: ['Basic lead access'] },
  { name: 'Verified' as const, reached: true, perks: ['Priority in feed', 'Blue badge'] },
  { name: 'Trusted' as const, reached: false, current: true, perks: ['3x leads', 'Featured', 'Lower fees'] },
  { name: 'Elite' as const, reached: false, perks: ['Top placement', 'VIP', 'Exclusive leads'] },
]

type Tab = 'profile' | 'settings'

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>('profile')

  return (
    <div className="page-content">
      <div className="px-6 pt-5 pb-6">

        {/* ---- HERO CARD ---- */}
        <div className="card-dark p-5 mb-5 relative overflow-hidden anim-up">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--brand)] rounded-full opacity-[0.08] -translate-y-10 translate-x-10" />

          {/* Avatar + Info */}
          <div className="flex items-center gap-3.5 mb-4 relative">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-white text-[22px] font-bold">MJ</div>
              <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-[var(--brand)] rounded-full flex items-center justify-center border-2 border-[var(--dark)]">
                <Camera size={10} className="text-white" />
              </button>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[18px] font-bold text-white tracking-tight">Mike Johnson</h2>
                <Shield size={14} className="text-[var(--brand)]" />
              </div>
              <p className="text-[12px] text-white/40">Locksmith · Miami, FL · 8 yrs</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-0.5 text-[11px] text-amber-400 font-semibold">
                  <Star size={10} fill="#fbbf24" /> 4.8 <span className="text-white/25 font-normal">(23)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Journey inline */}
          <div className="flex items-center gap-1 mb-4">
            {tiers.map((t, i, arr) => {
              const TierIcon = tierIcons[t.name]
              return (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                    t.reached ? 'bg-green-500/20' : t.current ? 'bg-[var(--brand)]/20 ring-[1.5px] ring-[var(--brand)]' : 'bg-white/5'
                  }`}>
                    <TierIcon size={15} strokeWidth={1.8} className={
                      t.reached ? 'text-green-400' : t.current ? 'text-[var(--brand)]' : 'text-white/15'
                    } />
                  </div>
                  <span className={`text-[9px] font-medium ${
                    t.reached ? 'text-green-400' : t.current ? 'text-[var(--brand)]' : 'text-white/15'
                  }`}>{t.name}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`h-0.5 w-full mt-[-14px] ${t.reached ? 'bg-green-500/30' : 'bg-white/5'}`} />
                )}
              </div>
              )
            })}
          </div>

          {/* Strength + Preview */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 flex gap-0.5">
              {[0,1,2,3,4].map(i => (
                <div key={i} className={`flex-1 h-1.5 rounded-full ${i < 3 ? 'bg-[var(--brand)]' : 'bg-white/10'}`} />
              ))}
            </div>
            <span className="text-[12px] font-bold text-[var(--brand)]">72%</span>
          </div>

          <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 press">
            <Eye size={14} className="text-white/60" />
            <span className="text-[13px] font-medium text-white/60">Preview my public profile</span>
          </button>
        </div>

        {/* ---- UNLOCK NEXT TIER ---- */}
        <div className="card p-4 mb-5 anim-up">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="t-sub text-[14px]">Unlock <span className="text-green-600">Trusted</span></p>
              <p className="text-[11px] text-muted">3x more leads & featured placement</p>
            </div>
          </div>

          {/* Steps to unlock - only incomplete items */}
          <div className="space-y-2">
            {verifs.filter(v => v.status !== 'done').map((v, i) => {
              const I = v.icon
              return (
                <button key={i} className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--gray-50)] press">
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <I size={15} className="text-[var(--dark)]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[13px] font-semibold">{v.label}</p>
                    <p className="text-[10px] text-muted">{v.desc}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold text-green-600">{v.impact}</span>
                    <ArrowRight size={12} className="text-faded" />
                  </div>
                </button>
              )
            })}
          </div>

          {/* What's done */}
          <div className="flex items-center gap-2 mt-3 px-1">
            {verifs.filter(v => v.status === 'done').map((v, i) => (
              <div key={i} className="flex items-center gap-1">
                <CheckCircle2 size={12} className="text-green-500" />
                <span className="text-[10px] text-green-600">{v.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ---- TABS ---- */}
        <div className="flex bg-[var(--gray-100)] rounded-xl p-1 mb-5 anim-up">
          <button onClick={() => setTab('profile')}
            className={`flex-1 py-2.5 rounded-lg t-sub text-[13px] transition-all ${tab === 'profile' ? 'bg-white shadow-sm text-[var(--dark)]' : 'text-muted'}`}>
            Profile
          </button>
          <button onClick={() => setTab('settings')}
            className={`flex-1 py-2.5 rounded-lg t-sub text-[13px] transition-all ${tab === 'settings' ? 'bg-white shadow-sm text-[var(--dark)]' : 'text-muted'}`}>
            Settings
          </button>
        </div>

        {tab === 'profile' ? (
          <div className="space-y-3 stagger">

            {/* Professional Info */}
            <Section title="Professional Info" badge="Complete">
              <div className="space-y-0 mt-3">
                {[
                  { icon: Wrench, label: 'Services', val: 'Locksmith, Rekey, Smart Locks' },
                  { icon: MapPin, label: 'Service Areas', val: 'Miami-Dade, Broward' },
                  { icon: Globe, label: 'Languages', val: 'English, Spanish' },
                  { icon: Briefcase, label: 'Work Preferences', val: 'Fixed, Percentage, Sub-work' },
                ].map((item, i, arr) => {
                  const I = item.icon
                  return (
                    <div key={i} className="flex items-center gap-3 py-3 press"
                      style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                      <div className="w-8 h-8 rounded-lg bg-[var(--gray-50)] flex items-center justify-center">
                        <I size={15} strokeWidth={1.6} />
                      </div>
                      <div className="flex-1">
                        <p className="t-sub text-[12px]">{item.label}</p>
                        <p className="text-[10px] text-muted">{item.val}</p>
                      </div>
                      <ChevronRight size={14} className="text-faded" />
                    </div>
                  )
                })}
              </div>
            </Section>

            {/* Portfolio */}
            <Section title="Portfolio" badge="4 projects">
              <div className="mt-3">
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
                  {['Smart Lock Install', 'Commercial Rekey', 'Emergency Lockout', 'Safe Install'].map((p, i) => (
                    <div key={i} className="flex-shrink-0 w-[120px] press">
                      <div className="aspect-[3/4] rounded-xl bg-[var(--gray-100)] flex items-center justify-center mb-1.5 relative">
                        <Image size={16} className="text-[var(--gray-400)]" />
                        <span className="absolute bottom-1 left-1 text-[8px] font-semibold bg-[var(--dark)]/70 text-white px-1.5 py-0.5 rounded backdrop-blur-sm">B/A</span>
                      </div>
                      <p className="text-[10px] font-medium truncate">{p}</p>
                    </div>
                  ))}
                  <div className="flex-shrink-0 w-[120px] press">
                    <div className="aspect-[3/4] rounded-xl border-2 border-dashed border-[var(--gray-200)] flex flex-col items-center justify-center gap-1 mb-1.5">
                      <div className="w-6 h-6 rounded-full bg-[var(--brand-light)] flex items-center justify-center">
                        <Image size={11} className="text-[var(--brand)]" />
                      </div>
                      <p className="text-[9px] text-[var(--brand)] font-semibold">Add</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2 bg-blue-50 rounded-lg p-2.5">
                  <TrendingUp size={12} className="text-blue-500" />
                  <p className="text-[10px] text-blue-700">6+ projects = <strong>40% more inquiries</strong></p>
                </div>
              </div>
            </Section>

            {/* Reviews */}
            <div className="card p-4 anim-up">
              <div className="flex items-center justify-between mb-3">
                <p className="t-sub text-[14px]">Reviews</p>
                <span className="text-[11px] text-muted">23 total</span>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div>
                  <p className="text-[26px] font-bold tracking-tight">4.8</p>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => <Star key={i} size={9} className="text-amber-400" fill="#fbbf24" />)}
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  {[{n:5,w:72},{n:4,w:18},{n:3,w:6},{n:2,w:3},{n:1,w:1}].map(r => (
                    <div key={r.n} className="flex items-center gap-1.5">
                      <span className="text-[9px] text-muted w-2">{r.n}</span>
                      <div className="flex-1 h-1 rounded-full bg-[var(--gray-100)]">
                        <div className="h-full rounded-full bg-amber-400" style={{width:`${r.w}%`}} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[var(--gray-50)] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full bg-[var(--dark)] flex items-center justify-center text-white text-[7px] font-bold">JK</div>
                  <span className="text-[11px] font-semibold">James K.</span>
                  <div className="flex gap-0.5 ml-auto">{[1,2,3,4,5].map(i => <Star key={i} size={7} className="text-amber-400" fill="#fbbf24" />)}</div>
                </div>
                <p className="text-[10px] text-muted leading-relaxed">"Great work on the rekey. Fast, professional, fair price."</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 stagger">
            <Section title="Communication" defaultOpen={true}>
              <div className="space-y-0 mt-3">
                {[
                  { icon: MessageCircle, label: 'WhatsApp', status: 'Connected', bg: 'bg-[#25D366]', ok: true },
                  { icon: Bell, label: 'Push Notifications', status: 'Enabled', bg: 'bg-[var(--dark)]', ok: true },
                ].map((ch, i, arr) => {
                  const I = ch.icon
                  return (
                    <div key={i} className="flex items-center gap-3 py-3"
                      style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                      <div className={`w-8 h-8 rounded-lg ${ch.bg} flex items-center justify-center`}>
                        <I size={14} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="t-sub text-[12px]">{ch.label}</p>
                        <p className={`text-[10px] ${ch.ok ? 'text-green-500' : 'text-muted'}`}>{ch.status}</p>
                      </div>
                      {ch.ok ? <div className="w-2 h-2 rounded-full bg-green-500" /> : (
                        <button className="t-tiny font-semibold text-[var(--brand)] bg-[var(--brand-light)] px-3 py-1.5 rounded-full press">Connect</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </Section>

            <Section title="Working Hours">
              <div className="space-y-2 mt-3">
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
                  <div key={d} className="flex items-center justify-between">
                    <span className={`t-sub text-[12px] w-10 ${i>=5?'text-faded':''}`}>{d}</span>
                    {i >= 5 ? <span className="t-tiny text-faded">Off</span> : (
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] bg-[var(--gray-50)] px-2.5 py-1 rounded-lg">8:00 AM</span>
                        <span className="text-[10px] text-faded">—</span>
                        <span className="text-[11px] bg-[var(--gray-50)] px-2.5 py-1 rounded-lg">6:00 PM</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Preferences">
              <div className="space-y-0 mt-3">
                {[{l:'Language',v:'English'},{l:'Distance',v:'Miles'},{l:'Notifications',v:'On'}].map((p, i, arr) => (
                  <div key={i} className="flex items-center justify-between py-3"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                    <p className="t-sub text-[12px]">{p.l}</p>
                    <div className="flex items-center gap-1">
                      <span className="t-tiny text-muted">{p.v}</span>
                      <ChevronRight size={13} className="text-faded" />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <div className="card p-4 flex items-center gap-3 press">
              <div className="w-9 h-9 rounded-xl bg-[var(--brand)] flex items-center justify-center">
                <Star size={14} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="t-sub text-[13px]">Premium Plan</p>
                <p className="t-tiny text-muted">$79/mo · Renews Apr 15</p>
              </div>
              <ChevronRight size={14} className="text-faded" />
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
