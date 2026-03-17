import { MapPin, Menu } from 'lucide-react'
import './Header.css'

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="header">
      <div className="header__left">
        <div className="header__logo-mark">
          <MapPin size={18} color="var(--gold-primary)" />
        </div>
        <span className="header__app-name">WHERESIT</span>
      </div>
      <div className="header__right">
        <button className="header__menu" onClick={onMenuClick}>
          <Menu size={20} color="var(--text-secondary)" />
        </button>
      </div>
    </header>
  )
}
