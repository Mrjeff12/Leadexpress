import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import en from './en.json'
import he from './he.json'
import es from './es.json'

export type Lang = 'en' | 'he' | 'es'
export const SUPPORTED_LANGS: Lang[] = ['en', 'es', 'he']

const translations = { en, he, es } as const
const STORAGE_KEY = 'le-landing-lang'

function detectInitialLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'he' || stored === 'es') return stored
  } catch {
    // localStorage unavailable (private mode, SSR) — fall through to browser detect
  }
  // Default to English — target audience is US contractors.
  // Users can switch language manually via the navbar picker.
  return 'en'
}

interface LanguageContextType {
  lang: Lang
  t: typeof en
  setLang: (lang: Lang) => void
  dir: 'ltr' | 'rtl'
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang)
  const t = translations[lang]
  const dir = lang === 'he' ? 'rtl' : 'ltr'

  const setLang = (next: Lang) => {
    setLangState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
      document.documentElement.dir = dir
    }
  }, [lang, dir])

  return (
    <LanguageContext.Provider value={{ lang, t, setLang, dir }}>
      <div dir={dir} className={lang === 'he' ? 'font-hebrew' : 'font-body'}>
        {children}
      </div>
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return ctx
}
