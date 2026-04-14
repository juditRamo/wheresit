import { Sun, Moon, Monitor } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { useTheme } from '../../theme/ThemeContext'
import type { ThemeMode } from '../../theme/ThemeContext'
import { ui } from '../../i18n/ui'
import { Auth } from './Auth'
import './LandingPage.css'

const themeIcons: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

const themeCycle: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

export function LandingPage() {
  const { language, setLanguage } = useLanguage()
  const { theme, setTheme } = useTheme()

  const ThemeIcon = themeIcons[theme]

  return (
    <div className="landing">
      <div className="landing__marketing">
        <div className="landing__marketing-inner">
          <div className="landing__logo">WheresIt</div>
          <h1>{ui('landing.headline', language)}</h1>
          <p className="landing__subheadline">{ui('landing.subheadline', language)}</p>
          <ul className="landing__features">
            <li>{ui('landing.feature.organize', language)}</li>
            <li>{ui('landing.feature.find', language)}</li>
            <li>{ui('landing.feature.share', language)}</li>
          </ul>
          {/*<p className="landing__free">{ui('landing.free', language)}</p>*/}
        </div>
      </div>

      <div className="landing__auth-panel">
        <div className="landing__toolbar">
          <div className="landing__lang-toggle">
            <button
              className={language === 'en' ? 'active' : ''}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <button
              className={language === 'es' ? 'active' : ''}
              onClick={() => setLanguage('es')}
            >
              ES
            </button>
          </div>
          <button
            className="landing__theme-toggle"
            onClick={() => setTheme(themeCycle[theme])}
            aria-label={ui('landing.toggle_theme', language)}
          >
            <ThemeIcon size={18} />
          </button>
        </div>
        <div className="landing__auth">
          <Auth />
        </div>
      </div>
    </div>
  )
}
