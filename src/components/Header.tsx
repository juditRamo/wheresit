import { MapPin, Menu } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import './Header.css'

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { language } = useLanguage()

  return (
    <header className="header">
      <div className="header__left">
        <div className="header__logo-mark">
          <MapPin size={18} color="var(--gold-primary)" />
        </div>
        <div className="header__logo-text">
          <span className="header__app-name">WHERESIT</span>
          <span className="header__app-sub">{ui('header.subtitle', language)}</span>
        </div>
      </div>
      <div className="header__right">
        <div className="header__lang-indicator">
          {language.toUpperCase()}
        </div>
        <button className="header__menu" onClick={onMenuClick}>
          <Menu size={20} color="var(--text-secondary)" />
        </button>
      </div>
    </header>
  )
}
