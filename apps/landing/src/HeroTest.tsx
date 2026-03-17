import { LanguageProvider } from './i18n/LanguageContext'
import HeroOptionA from './components/HeroOptionA'
import HeroOptionB from './components/HeroOptionB'
import HeroOptionC from './components/HeroOptionC'

export default function HeroTest() {
  return (
    <LanguageProvider>
      <div>
        {/* Option A */}
        <div className="relative">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-dark text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl">
            OPTION A — Single Phone: Extraction Process
          </div>
          <HeroOptionA />
        </div>

        {/* Divider */}
        <div className="bg-dark py-6 text-center">
          <div className="text-white/30 text-xs tracking-widest uppercase">Scroll down for Option B</div>
        </div>

        {/* Option B */}
        <div className="relative">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-dark text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl">
            OPTION B — Two Phones Side by Side
          </div>
          <HeroOptionB />
        </div>

        {/* Divider */}
        <div className="bg-dark py-6 text-center">
          <div className="text-white/30 text-xs tracking-widest uppercase">Scroll down for Option C</div>
        </div>

        {/* Option C */}
        <div className="relative">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-dark text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl">
            OPTION C — ChaosToOrder as Hero
          </div>
          <HeroOptionC />
        </div>
      </div>
    </LanguageProvider>
  )
}
