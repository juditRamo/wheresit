import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { getItem, setItem } from '../lib/storage'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
})

const STORAGE_KEY = 'wheresit_theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('system')
  const [loaded, setLoaded] = useState(false)

  // Load persisted theme asynchronously
  useEffect(() => {
    getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeState(stored)
      }
      setLoaded(true)
    })
  }, [])

  function setTheme(mode: ThemeMode) {
    setThemeState(mode)
  }

  // Persist theme changes
  useEffect(() => {
    if (!loaded) return
    setItem(STORAGE_KEY, theme)
  }, [theme, loaded])

  // Apply data-theme attribute
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])

  // Update native status bar style
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {})
    StatusBar.setBackgroundColor({ color: isDark ? '#0C0A08' : '#F4EDE4' }).catch(() => {})
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext)
}
