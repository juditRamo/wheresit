import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'

export type SortTab = 'place' | 'recent'

interface InventoryTabsProps {
  activeTab: SortTab
  onTabChange: (tab: SortTab) => void
}

export function InventoryTabs({ activeTab, onTabChange }: InventoryTabsProps) {
  const { language } = useLanguage()

  return (
    <div className="inventory__tabs">
      <button
        className={`inventory__tab ${activeTab === 'place' ? 'inventory__tab--active' : ''}`}
        onClick={() => onTabChange('place')}
      >
        {ui('inventory.by_room', language)}
      </button>
      <button
        className={`inventory__tab ${activeTab === 'recent' ? 'inventory__tab--active' : ''}`}
        onClick={() => onTabChange('recent')}
      >
        {ui('inventory.recent', language)}
      </button>
    </div>
  )
}
