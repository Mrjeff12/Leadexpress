import Navbar from './components/Navbar'
import StickyProgressBar from './components/StickyProgressBar'
import NetworkSection from './components/NetworkSection'
import ContractorsShowcase from './components/ContractorsShowcase'
import ReceiveJobsSection from './components/ReceiveJobsSection'
import WhatsAppPhoneDemo from './components/HeroOptionA'
// WorkflowSection removed — merged into ReceiveJobsSection
import DashboardShowcase from './components/DashboardShowcase'
import LeadsFeedShowcase from './components/LeadsFeedShowcase'
import RebecaScannerSection from './components/RebecaScannerSection'
import SubcontractorShowcase from './components/SubcontractorShowcase'
import EarnMoreSection from './components/EarnMoreSection'
import RebecaDistributorSection from './components/RebecaDistributorSection'
import TestimonialsSection from './components/TestimonialsSection'
import PricingSection from './components/PricingSection'
import FAQSection from './components/FAQSection'
import MapSection from './components/MapSection'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="grain">
      <Navbar />
      <StickyProgressBar />

      {/* ═══ Hero ═══ */}
      <NetworkSection />
      <ContractorsShowcase />

      {/* ═══ Path 1: We bring you jobs ═══ */}
      <div id="path-1">
        <ReceiveJobsSection />
        <DashboardShowcase />
        <LeadsFeedShowcase />
        <RebecaScannerSection />
      </div>

      {/* ═══ Path 2: You publish private jobs ═══ */}
      <div id="path-2">
        <SubcontractorShowcase />
        <EarnMoreSection />
        <RebecaDistributorSection />
      </div>

      {/* ═══ Closing ═══ */}
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <MapSection />
      <Footer />
    </div>
  )
}
