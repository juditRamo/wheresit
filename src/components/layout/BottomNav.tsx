import { MessageSquare, Archive, MapPin, Settings, Clock } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { ui } from '../../i18n/ui'
import './BottomNav.css'

export type NavTab = 'chat' | 'items' | 'locations' | 'activity' | 'settings'

interface BottomNavProps {
  active: NavTab
  onNavigate: (tab: NavTab) => void
}

export function BottomNav({ active, onNavigate }: BottomNavProps) {
  const { language } = useLanguage()

  return (
    <nav className="bottom-nav">
      <button
        className={`bottom-nav__item ${active === 'items' ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onNavigate('items')}
      >
        <Archive size={20} />
        <span className="bottom-nav__label">{ui('nav.items', language)}</span>
      </button>
      <button
        className={`bottom-nav__item ${active === 'locations' ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onNavigate('locations')}
      >
        <MapPin size={20} />
        <span className="bottom-nav__label">{ui('nav.locations', language)}</span>
      </button>
      <button
        className={`bottom-nav__item ${active === 'chat' ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onNavigate('chat')}
      >
        <MessageSquare size={20} />
        <span className="bottom-nav__label">{ui('nav.chat', language)}</span>
      </button>
      <button
        className={`bottom-nav__item ${active === 'activity' ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onNavigate('activity')}
      >
        <Clock size={20} />
        <span className="bottom-nav__label">{ui('activity.title', language)}</span>
      </button>
      <button
        className={`bottom-nav__item ${active === 'settings' ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onNavigate('settings')}
      >
        <Settings size={20} />
        <span className="bottom-nav__label">{ui('settings.title', language)}</span>
      </button>
    </nav>
  )
}
