import { useLang } from '../i18n/LanguageContext'

export default function Footer() {
  const { t } = useLang()

  return (
    <footer className="bg-dark text-white py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-xl font-medium">Lead Express</span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed mb-6">{t.footer.desc}</p>
            <div className="flex gap-3">
              {['fb', 'li', 'ig', 'tg'].map(social => (
                <a key={social} href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-primary transition-colors flex items-center justify-center">
                  <span className="text-xs">{social === 'fb' ? 'f' : social === 'li' ? 'in' : social === 'ig' ? '📷' : '✈'}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-white/80">{t.footer.company}</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-white/40 hover:text-primary transition-colors">{t.footer.aboutUs}</a></li>
              <li><a href="#features" className="text-sm text-white/40 hover:text-primary transition-colors">{t.footer.features}</a></li>
              <li><a href="#pricing" className="text-sm text-white/40 hover:text-primary transition-colors">{t.footer.pricing}</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-white/80">{t.footer.resources}</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-white/40 hover:text-primary transition-colors">{t.footer.blog}</a></li>
              <li><a href="#contact" className="text-sm text-white/40 hover:text-primary transition-colors">{t.footer.contact}</a></li>
              <li><a href="#" className="text-sm text-white/40 hover:text-primary transition-colors">{t.footer.integrations}</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-white/80">{t.footer.legal}</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-white/40 hover:text-primary transition-colors">{t.footer.privacy}</a></li>
              <li><a href="#" className="text-sm text-white/40 hover:text-primary transition-colors">{t.footer.terms}</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-white/30 text-xs">{t.footer.copyright}</p>
        </div>
      </div>
    </footer>
  )
}
