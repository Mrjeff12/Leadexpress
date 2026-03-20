import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, MapPin, Users, TrendingUp, BadgeCheck, ArrowRight, Filter } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

/* ─── Sample partner data (API integration later) ─── */
const PARTNERS = [
  {
    slug: 'yossi-goldberg',
    name: 'Yossi Goldberg',
    initials: 'YG',
    location: 'New Jersey',
    group: 'NJ Contractors Network',
    members: 2340,
    leads: 189,
    verified: true,
    color: 'from-[#fe5b25] to-[#e04d1c]',
    specialties: ['Plumbing', 'HVAC'],
  },
  {
    slug: 'marco-diaz',
    name: 'Marco Diaz',
    initials: 'MD',
    location: 'Florida',
    group: 'FL Contractors Hub',
    members: 1850,
    leads: 142,
    verified: true,
    color: 'from-blue-500 to-blue-600',
    specialties: ['Electrical', 'Roofing'],
  },
  {
    slug: 'dave-thompson',
    name: 'Dave Thompson',
    initials: 'DT',
    location: 'Texas',
    group: 'TX Trade Workers',
    members: 1620,
    leads: 118,
    verified: true,
    color: 'from-amber-500 to-amber-600',
    specialties: ['General Contracting'],
  },
  {
    slug: 'ahmed-hassan',
    name: 'Ahmed Hassan',
    initials: 'AH',
    location: 'California',
    group: 'CA Handyman Network',
    members: 2100,
    leads: 167,
    verified: true,
    color: 'from-green-500 to-green-600',
    specialties: ['Handyman', 'Painting'],
  },
  {
    slug: 'tony-rossi',
    name: 'Tony Rossi',
    initials: 'TR',
    location: 'New York',
    group: 'NYC Contractors',
    members: 980,
    leads: 76,
    verified: false,
    color: 'from-purple-500 to-purple-600',
    specialties: ['Renovation', 'Flooring'],
  },
  {
    slug: 'carlos-mendez',
    name: 'Carlos Mendez',
    initials: 'CM',
    location: 'Arizona',
    group: 'AZ Contractors Community',
    members: 1340,
    leads: 94,
    verified: true,
    color: 'from-rose-500 to-rose-600',
    specialties: ['HVAC', 'Solar'],
  },
  {
    slug: 'james-wilson',
    name: 'James Wilson',
    initials: 'JW',
    location: 'Georgia',
    group: 'ATL Trade Pros',
    members: 870,
    leads: 63,
    verified: false,
    color: 'from-teal-500 to-teal-600',
    specialties: ['Plumbing', 'Electrical'],
  },
  {
    slug: 'mike-chen',
    name: 'Mike Chen',
    initials: 'MC',
    location: 'Illinois',
    group: 'Chicago Contractors',
    members: 1520,
    leads: 112,
    verified: true,
    color: 'from-indigo-500 to-indigo-600',
    specialties: ['Moving', 'Cleaning'],
  },
]

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

export default function CommunityDirectory() {
  const [search, setSearch] = useState('')
  const { ref, visible } = useInView()

  const filtered = PARTNERS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.location.toLowerCase().includes(search.toLowerCase()) ||
    p.group.toLowerCase().includes(search.toLowerCase()) ||
    p.specialties.some(s => s.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="grain">
      <Navbar />
      <main className="pt-28 pb-0 bg-cream min-h-screen">
        {/* Header */}
        <div className="max-w-6xl mx-auto px-6 mb-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-[#fe5b25]/10 border border-[#fe5b25]/20 text-[#fe5b25] rounded-full px-4 py-1.5 text-xs font-semibold mb-5">
              <Users className="w-3.5 h-3.5" />
              Community Directory
            </div>
            <h1 className="text-4xl md:text-5xl font-medium text-dark mb-4 tracking-[-0.04em]">
              Find a Community{' '}
              <span className="highlight-box">Near You</span>
            </h1>
            <p className="text-gray-subtle/60 max-w-xl mx-auto text-lg">
              Browse verified community partners across the US. Join through a partner to support your local network.
            </p>
          </div>

          {/* Search bar */}
          <div className="max-w-lg mx-auto relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark/30" />
            <input
              type="text"
              placeholder="Search by name, location, or trade..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-white/60 backdrop-blur-xl rounded-xl border border-dark/10 text-sm text-dark placeholder:text-dark/30 focus:outline-none focus:border-[#fe5b25]/30 focus:ring-2 focus:ring-[#fe5b25]/10 transition-all"
            />
          </div>
        </div>

        {/* Partner grid */}
        <section ref={ref as any} className="max-w-6xl mx-auto px-6 pb-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((partner, i) => (
              <Link
                to={`/community/${partner.slug}`}
                key={partner.slug}
                className={`group bg-white/60 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_4px_40px_rgba(0,0,0,0.04)] p-5 transition-all duration-500 hover:shadow-lg hover:-translate-y-1 ${
                  visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: `${Math.min(i * 80, 600)}ms` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${partner.color} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                    {partner.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-dark truncate">{partner.name}</h3>
                      {partner.verified && (
                        <BadgeCheck size={14} className="text-[#fe5b25] flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-dark/40 truncate">{partner.group}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-dark/40 mb-3">
                  <MapPin size={12} />
                  <span>{partner.location}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white/70 rounded-lg border border-white/50 py-1.5 text-center">
                    <p className="text-xs font-bold text-dark">{partner.members.toLocaleString()}</p>
                    <p className="text-[8px] text-dark/30">Members</p>
                  </div>
                  <div className="bg-white/70 rounded-lg border border-white/50 py-1.5 text-center">
                    <p className="text-xs font-bold text-dark">{partner.leads}</p>
                    <p className="text-[8px] text-dark/30">Active Leads</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {partner.specialties.map(s => (
                    <span key={s} className="bg-[#fe5b25]/5 text-[#fe5b25] text-[9px] font-medium px-2 py-0.5 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-dark/40 text-sm">No communities found matching "{search}"</p>
            </div>
          )}
        </section>

        {/* CTA */}
        <section className="bg-[#0b0707] section-padding">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-medium text-white mb-4">
              Run a WhatsApp Group?{' '}
              <span className="gradient-text">Join as a Partner.</span>
            </h2>
            <p className="text-white/40 max-w-lg mx-auto mb-8">
              Earn 15% recurring commission on every contractor that subscribes through your community.
            </p>
            <Link
              to="/partners"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white px-8 py-4 text-base font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#fe5b25]/25 active:scale-95"
            >
              Become a Partner
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
