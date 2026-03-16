import { createContext, useContext, useState, type ReactNode } from 'react'
import en from './en.json'
import he from './he.json'

type Lang = 'en' | 'he'
const translations = { en, he } as const

interface LanguageContextType {
  lang: Lang
  t: typeof en
  setLang: (lang: Lang) => void
  dir: 'ltr' | 'rtl'
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('he')
  const t = translations[lang]
  const dir = lang === 'he' ? 'rtl' : 'ltr'

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
