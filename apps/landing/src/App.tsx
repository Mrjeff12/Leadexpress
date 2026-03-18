import { LanguageProvider } from './i18n/LanguageContext'
import Navbar from './components/Navbar'
import Hero from './components/HeroOptionA'
import LogoStrip from './components/LogoStrip'
import ChaosToOrderSection from './components/ChaosToOrderSection'
import ContractorsShowcase from './components/ContractorsShowcase'
import PipelineSection from './components/PipelineSection'
import MapSection from './components/MapSection'
import WorkflowSection from './components/WorkflowSection'
import FeaturesSection from './components/FeaturesSection'
import FeatureGrid from './components/FeatureGrid'
import MarketingSection from './components/MarketingSection'
import SubcontractorFeature from './components/SubcontractorFeature'
import TestimonialsSection from './components/TestimonialsSection'
import PricingSection from './components/PricingSection'
import FAQSection from './components/FAQSection'
import CTASection from './components/CTASection'
import Footer from './components/Footer'

export default function App() {
  return (
    <LanguageProvider>
      <div className="grain">
        <Navbar />
        <Hero />
        {/* <LogoStrip /> */}
        {/* <ChaosToOrderSection /> */}
        <ContractorsShowcase />
        <WorkflowSection />
        {/* <PipelineSection /> */}
        <MapSection />
        <FeaturesSection />
        {/* <FeatureGrid /> */}
        {/* <MarketingSection /> */}
        <SubcontractorFeature />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        {/* <CTASection /> */}
        <Footer />
      </div>
    </LanguageProvider>
  )
}
