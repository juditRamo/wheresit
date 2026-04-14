import { Search } from 'lucide-react'
import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'

interface InventorySearchProps {
  searchQuery: string
  onSearchChange: (value: string) => void
}

export function InventorySearch({ searchQuery, onSearchChange }: InventorySearchProps) {
  const { language } = useLanguage()

  return (
    <div className="inventory__search">
      <Search size={16} color="var(--text-tertiary)" />
      <input
        type="text"
        placeholder={ui('inventory.search', language)}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="inventory__search-input"
      />
    </div>
  )
}
