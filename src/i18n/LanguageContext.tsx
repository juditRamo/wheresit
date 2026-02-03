import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Lang } from './picklists'

interface LanguageContextValue {
  language: Lang
  setLanguage: (lang: Lang) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
})

function detectBrowserLang(): Lang {
  const nav = navigator.language?.toLowerCase() ?? ''
  if (nav.startsWith('es')) return 'es'
  return 'en'
}

function loadPersistedLang(): Lang {
  try {
    const stored = localStorage.getItem('wheresit_lang')
    if (stored === 'en' || stored === 'es') return stored
  } catch { /* ignore */ }
  return detectBrowserLang()
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Lang>(loadPersistedLang)

  function setLanguage(lang: Lang) {
    setLanguageState(lang)
  }

  useEffect(() => {
    try {
      localStorage.setItem('wheresit_lang', language)
    } catch { /* ignore */ }
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
