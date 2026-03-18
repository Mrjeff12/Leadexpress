import { useState } from 'react'
import { Menu, X, Globe } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

export default function Navbar() {
  const { t, lang, setLang, dir } = useLang()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-cream/80 backdrop-blur-xl border-b border-dark/5">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-xl font-semibold tracking-[-0.03em]">Lead Express</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-gray-subtle hover:text-primary transition-colors">{t.nav.features}</a>
          <a href="#pricing" className="text-sm text-gray-subtle hover:text-primary transition-colors">{t.nav.pricing}</a>
          <a href="#faq" className="text-sm text-gray-subtle hover:text-primary transition-colors">{t.nav.faq}</a>
          <a href="#contact" className="text-sm text-gray-subtle hover:text-primary transition-colors">{t.nav.contact}</a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a href="http://localhost:5173/login" className="text-sm font-medium text-gray-subtle hover:text-dark transition-colors px-4 py-2">
            Log in
          </a>
          <a href="#pricing" className="btn-primary text-xs !px-5 !py-2.5">{t.nav.getStarted}</a>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-dark/5 px-6 py-6 space-y-4">
          <a href="#features" className="block text-sm py-2">{t.nav.features}</a>
          <a href="#pricing" className="block text-sm py-2">{t.nav.pricing}</a>
          <a href="#faq" className="block text-sm py-2">{t.nav.faq}</a>
          <a href="#contact" className="block text-sm py-2">{t.nav.contact}</a>
          <a href="http://localhost:5173/login" className="block text-sm py-2 font-medium text-gray-subtle">
            Log in
          </a>
          <a href="#pricing" className="btn-primary w-full text-center">{t.nav.getStarted}</a>
        </div>
      )}
    </nav>
  )
}
