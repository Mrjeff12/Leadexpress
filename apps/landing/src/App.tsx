import { LanguageProvider } from './i18n/LanguageContext'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import LogoStrip from './components/LogoStrip'
import ChaosToOrderSection from './components/ChaosToOrderSection'
import MapSection from './components/MapSection'
import WorkflowSection from './components/WorkflowSection'
import FeaturesSection from './components/FeaturesSection'
import FeatureGrid from './components/FeatureGrid'
import MarketingSection from './components/MarketingSection'
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
        <LogoStrip />
        <ChaosToOrderSection />
        <MapSection />
        <WorkflowSection />
        <FeaturesSection />
        <FeatureGrid />
        <MarketingSection />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
        <Footer />
      </div>
    </LanguageProvider>
  )
}
