import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getItem, setItem } from '../lib/storage'
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Lang>(detectBrowserLang)
  const [loaded, setLoaded] = useState(false)

  // Load persisted language asynchronously
  useEffect(() => {
    getItem('wheresit_lang').then((stored) => {
      if (stored === 'en' || stored === 'es') {
        setLanguageState(stored)
      }
      setLoaded(true)
    })
  }, [])

  function setLanguage(lang: Lang) {
    setLanguageState(lang)
  }

  // Persist language changes
  useEffect(() => {
    if (!loaded) return
    setItem('wheresit_lang', language)
  }, [language, loaded])

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  return useContext(LanguageContext)
}
