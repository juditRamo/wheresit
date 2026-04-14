import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'

interface InventoryFilteredCountProps {
  filteredCount: number
  totalCount: number
  hasActiveFilters: boolean
}

export function InventoryFilteredCount({ filteredCount, totalCount, hasActiveFilters }: InventoryFilteredCountProps) {
  const { language } = useLanguage()

  if (!hasActiveFilters || filteredCount === totalCount) return null

  return (
    <div className="inventory__filtered-count">
      {ui('cf.filtered_count', language, { n: filteredCount, total: totalCount })}
    </div>
  )
}
