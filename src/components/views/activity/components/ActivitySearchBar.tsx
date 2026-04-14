import { Search } from 'lucide-react'
import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'

interface ActivitySearchBarProps {
  searchInput: string
  onSearchChange: (value: string) => void
}

export function ActivitySearchBar({ searchInput, onSearchChange }: ActivitySearchBarProps) {
  const { language } = useLanguage()

  return (
    <div className="activity-view__search">
      <Search size={14} className="activity-view__search-icon" />
      <input
        type="text"
        className="activity-view__search-input"
        placeholder={ui('activity.search', language)}
        aria-label={ui('activity.search', language)}
        value={searchInput}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  )
}
