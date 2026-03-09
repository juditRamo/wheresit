import { MessageSquare, Archive, MapPin, Search, Settings } from 'lucide-react'
import type { NavTab } from './BottomNav'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import './Sidebar.css'

interface SidebarProps {
  active: NavTab
  onNavigate: (tab: NavTab) => void
  onSettingsClick: () => void
}

const navItems: { tab: NavTab; icon: typeof MessageSquare }[] = [
  { tab: 'items', icon: Archive },
  { tab: 'locations', icon: MapPin },
  { tab: 'search', icon: Search },
  { tab: 'chat', icon: MessageSquare },
]

export function Sidebar({ active, onNavigate, onSettingsClick }: SidebarProps) {
  const { language } = useLanguage()

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo-mark">
          <MapPin size={18} color="var(--gold-primary)" />
        </div>
        <div className="sidebar__logo-text">
          <span className="sidebar__app-name">WHERESIT</span>
          <span className="sidebar__app-sub">{ui('header.subtitle', language)}</span>
        </div>
      </div>

      <nav className="sidebar__nav">
        {navItems.map(({ tab, icon: Icon }) => (
          <button
            key={tab}
            className={`sidebar__nav-item ${active === tab ? 'sidebar__nav-item--active' : ''}`}
            onClick={() => onNavigate(tab)}
          >
            <Icon size={18} />
            <span>{ui(`nav.${tab}`, language)}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar__bottom">
        <button className="sidebar__nav-item" onClick={onSettingsClick}>
          <Settings size={18} />
          <span>{ui('settings.title', language)}</span>
        </button>
      </div>
    </aside>
  )
}
