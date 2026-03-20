import { useParams, Link } from 'react-router-dom'
import { MapPin, Users, TrendingUp, BadgeCheck, ArrowRight, Shield, MessageCircle, Share2, UserPlus, DollarSign } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

/* ─── Placeholder partner data (API integration later) ─── */
const PARTNER_DATA: Record<string, {
  name: string
  initials: string
  location: string
  group: string
  members: number
  leads: number
  subscribers: number
  verified: boolean
  bio: string
  specialties: string[]
  color: string
}> = {
  'yossi-goldberg': {
    name: 'Yossi Goldberg',
    initials: 'YG',
    location: 'New Jersey',
    group: 'NJ Contractors Network',
    members: 2340,
    leads: 189,
    subscribers: 47,
    verified: true,
    bio: 'Running the largest contractor community in New Jersey since 2023. Focused on connecting tradespeople with quality job opportunities.',
    specialties: ['Plumbing', 'HVAC', 'Electrical'],
    color: 'from-[#fe5b25] to-[#e04d1c]',
  },
  'marco-diaz': {
    name: 'Marco Diaz',
    initials: 'MD',
    location: 'Florida',
    group: 'FL Contractors Hub',
    members: 1850,
    leads: 142,
    subscribers: 31,
    verified: true,
    bio: 'Connecting Florida contractors with homeowners since 2024. Specializing in electrical and roofing trades.',
    specialties: ['Electrical', 'Roofing', 'General Contracting'],
    color: 'from-blue-500 to-blue-600',
  },
}

const DEFAULT_PARTNER = {
  name: 'Community Partner',
  initials: 'CP',
  location: 'United States',
  group: 'Contractors Community',
  members: 500,
  leads: 40,
  subscribers: 12,
  verified: false,
  bio: 'A verified Lead Express community partner helping contractors find quality job leads.',
  specialties: ['General Contracting'],
  color: 'from-gray-500 to-gray-600',
}

export default function PartnerProfile() {
  const { slug } = useParams<{ slug: string }>()
  const partner = (slug && PARTNER_DATA[slug]) || DEFAULT_PARTNER

  const signupUrl = `https://app.leadexpress.co.il/login?ref=${slug || 'partner'}`

  const steps = [
    { icon: <UserPlus size={20} />, title: 'Sign Up', desc: `Join through ${partner.name.split(' ')[0]}'s link` },
    { icon: <MessageCircle size={20} />, title: 'Connect WhatsApp', desc: 'Link your WhatsApp groups' },
    { icon: <TrendingUp size={20} />, title: 'Get Leads', desc: 'AI finds leads matched to your trade' },
    { icon: <DollarSign size={20} />, title: 'Win Jobs', desc: 'Respond first and win more work' },
  ]

  return (
    <div className="grain">
      <Navbar />
      <main className="pt-28 pb-0 bg-cream min-h-screen">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <div className="relative">
            {/* Glow */}
            <div className="absolute -inset-6 bg-gradient-to-br from-[#fe5b25]/15 via-orange-200/10 to-transparent rounded-3xl blur-2xl" />

            <div className="relative bg-white/60 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_8px_60px_rgba(254,91,37,0.12)] p-6 md:p-8">
              {/* Profile header */}
              <div className="flex flex-col md:flex-row items-start gap-6 mb-6">
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${partner.color} flex items-center justify-center text-white text-2xl font-bold flex-shrink-0`}>
                  {partner.initials}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-dark">{partner.name}</h1>
                    {partner.verified && (
                      <BadgeCheck size={22} className="text-[#fe5b25]" />
                    )}
                  </div>
                  <p className="text-sm text-dark/40 mb-1">{partner.group}</p>
                  <div className="flex items-center gap-1.5 text-xs text-dark/40 mb-4">
                    <MapPin size={12} />
                    <span>{partner.location}</span>
                  </div>
                  <p className="text-sm text-gray-subtle/60 leading-relaxed mb-4">{partner.bio}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {partner.specialties.map(s => (
                      <span key={s} className="bg-[#fe5b25]/10 border border-[#fe5b25]/20 text-[#fe5b25] text-xs font-medium px-3 py-1 rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: 'Community Members', value: partner.members.toLocaleString(), icon: <Users size={16} /> },
                  { label: 'Active Leads', value: partner.leads.toString(), icon: <TrendingUp size={16} /> },
                  { label: 'Active Subscribers', value: partner.subscribers.toString(), icon: <Share2 size={16} /> },
                ].map(s => (
                  <div key={s.label} className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 py-3 px-3 text-center">
                    <div className="flex justify-center mb-1.5">
                      <div className="w-8 h-8 rounded-lg bg-[#fe5b25]/10 flex items-center justify-center text-[#fe5b25]">
                        {s.icon}
                      </div>
                    </div>
                    <p className="text-xl font-bold text-dark">{s.value}</p>
                    <p className="text-[10px] text-dark/30">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <a
                href={signupUrl}
                className="group flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white w-full py-4 text-base font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-[#fe5b25]/25 active:scale-[0.98]"
              >
                Join Through {partner.name.split(' ')[0]}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </a>

              <div className="flex items-center justify-center gap-4 mt-3 text-dark/30 text-xs">
                <span className="flex items-center gap-1"><Shield size={10} /> Free to try</span>
                <span className="flex items-center gap-1"><MessageCircle size={10} /> WhatsApp delivery</span>
              </div>
            </div>
          </div>
        </section>

        {/* How it works condensed */}
        <section className="bg-cream-dark section-padding">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-medium text-dark mb-2">
                How It Works
              </h2>
              <p className="text-sm text-gray-subtle/60">
                Get started in minutes. Leads delivered straight to your WhatsApp.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              {steps.map((step, i) => (
                <div key={i} className="relative text-center">
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute top-6 left-[calc(50%+28px)] w-[calc(100%-56px)] h-px bg-gradient-to-r from-[#fe5b25]/30 to-[#fe5b25]/10" />
                  )}
                  <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#fe5b25]/10 text-[#fe5b25] mb-3">
                    {step.icon}
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] text-white text-[8px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-dark mb-1">{step.title}</h3>
                  <p className="text-xs text-gray-subtle/50">{step.desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-10">
              <a
                href={signupUrl}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white px-8 py-3.5 text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#fe5b25]/25 active:scale-95"
              >
                Get Started Now
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </section>

        {/* Back to directory */}
        <section className="bg-cream py-8">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <Link to="/community" className="text-sm text-dark/40 hover:text-[#fe5b25] transition-colors">
              &larr; Back to Community Directory
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
