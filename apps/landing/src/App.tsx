import Navbar from './components/Navbar'
import SolutionProgress from './components/SolutionProgress'
import NetworkSection from './components/NetworkSection'
import ContractorsShowcase from './components/ContractorsShowcase'
import ChaosToOrderSection from './components/ChaosToOrderSection'
// Solution 1: Find Jobs
import ReceiveJobsSection from './components/ReceiveJobsSection'
import DashboardShowcase from './components/DashboardShowcase'
import LeadsFeedShowcase from './components/LeadsFeedShowcase'
import RebecaScannerSection from './components/RebecaScannerSection'
// Solution 2: Share Jobs
import SubcontractorShowcase from './components/SubcontractorShowcase'
import EarnMoreSection from './components/EarnMoreSection'
import RebecaDistributorSection from './components/RebecaDistributorSection'
// Solution 3: How We Protect You
import SecureTabContent from './components/SecureTabContent'
// Closing sections
import PricingSection from './components/PricingSection'
import FAQSection from './components/FAQSection'
import MapSection from './components/MapSection'
import Footer from './components/Footer'
import { ArrowRight, Search, Send, Shield } from 'lucide-react'

/* ─── Section step badge — big numbered divider above each section ─── */
function SectionStep({ num, label, color, children }: {
  num: string
  label: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="relative" data-step={num} data-step-label={label} data-step-color={color}>
      <div className="flex items-center justify-center gap-4 md:gap-6 py-10 md:py-14 px-6">
        <div className="h-px flex-1 max-w-[120px] bg-current opacity-10" />
        <div className="flex items-center gap-3 md:gap-4">
          <div
            className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-black shadow-lg"
            style={{ background: color, boxShadow: `0 4px 20px ${color}40` }}
          >
            {num}
          </div>
          <span className="text-base md:text-lg font-bold tracking-tight">{label}</span>
        </div>
        <div className="h-px flex-1 max-w-[120px] bg-current opacity-10" />
      </div>
      {children}
    </div>
  )
}

/* ─── Solution section header ─── */
function SolutionHeader({ icon: Icon, title, subtitle, color }: {
  icon: typeof Search
  title: string
  subtitle: string
  color: string
}) {
  return (
    <div className="py-16 md:py-20 px-6 text-center">
      <div
        className="inline-flex items-center gap-2.5 rounded-full px-5 py-2 mb-6"
        style={{ background: `${color}12`, border: `1px solid ${color}25` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-sm font-bold tracking-tight" style={{ color }}>{title}</span>
      </div>
      <p className="text-lg md:text-xl text-stone-500 max-w-xl mx-auto">
        {subtitle}
      </p>
    </div>
  )
}

/* ─── CTA banner between sections ─── */
function MidCTA({ text, variant = 'orange' }: { text: string; variant?: 'orange' | 'white' }) {
  return (
    <section className="py-12 md:py-16 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <a
          href="https://app.masterleadflow.com/login"
          className={`
            inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95
            ${variant === 'white'
              ? 'bg-white text-[#fe5b25] hover:shadow-lg hover:shadow-white/25'
              : 'bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white hover:shadow-lg hover:shadow-[#fe5b25]/25'
            }
          `}
        >
          {text}
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <div className="grain">
      <Navbar />
      <SolutionProgress />

      {/* ═══ Hero ═══ */}
      <NetworkSection />

      {/* ═══ Problem ═══ */}
      <ChaosToOrderSection />

      {/* ═══ CTA after problem ═══ */}
      <MidCTA text="Get Started Free — No Credit Card" />

      {/* ═══════════════════════════════════════════════════════════════
           SOLUTION 1: FIND JOBS
         ═══════════════════════════════════════════════════════════════ */}
      <div id="solution-find">
        <SolutionHeader
          icon={Search}
          title="Find Jobs"
          subtitle="AI scans your WhatsApp groups 24/7 and sends you matching jobs instantly."
          color="#25D366"
        />
        <SectionStep num="1" label="Connect Your Groups" color="#25D366">
          <ReceiveJobsSection />
        </SectionStep>
        <SectionStep num="2" label="AI Scans 24/7" color="#fe5b25">
          <RebecaScannerSection />
        </SectionStep>
        <SectionStep num="3" label="Get Your Job Feed" color="#3b82f6">
          <LeadsFeedShowcase />
        </SectionStep>
        <SectionStep num="4" label="Claim & Start Working" color="#16a34a">
          <DashboardShowcase />
        </SectionStep>
        <MidCTA text="Start Getting Jobs — Free" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
           SOLUTION 2: SHARE JOBS
         ═══════════════════════════════════════════════════════════════ */}
      <div id="solution-share">
        <SolutionHeader
          icon={Send}
          title="Share Jobs"
          subtitle="Post overflow work and AI matches it with verified subcontractors."
          color="#fe5b25"
        />
        <SectionStep num="5" label="Post a Job You Can't Take" color="#fe5b25">
          <SubcontractorShowcase />
        </SectionStep>
        <SectionStep num="6" label="AI Finds the Right Sub" color="#3b82f6">
          <RebecaDistributorSection />
        </SectionStep>
        <SectionStep num="7" label="Earn on Every Transfer" color="#16a34a">
          <EarnMoreSection />
        </SectionStep>
        <MidCTA text="Start Posting Jobs — Free" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
           SOLUTION 3: PROTECTION
         ═══════════════════════════════════════════════════════════════ */}
      <div id="solution-protect">
        <SolutionHeader
          icon={Shield}
          title="Protection"
          subtitle="Both sides verified. Every job tracked. No more blind trust."
          color="#3b82f6"
        />
        <SecureTabContent />
        <MidCTA text="Get Verified — It's Free" />
      </div>

      <MidCTA text="Get Verified — It's Free" />

      {/* ═══ Social proof ═══ */}
      <ContractorsShowcase />

      {/* ═══ Closing ═══ */}
      <PricingSection />
      <FAQSection />
      <MapSection />
      <Footer />
    </div>
  )
}
