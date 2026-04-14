import { X } from 'lucide-react'
import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'
import type { LocationRef, Place } from '../../../../types'

interface InventoryFilterBarProps {
  filter: LocationRef
  getPlacePath: (id: string) => Place[]
  getPlaceById: (id: string) => Place | null
  onClear: () => void
}

export function InventoryFilterBar({ filter, getPlacePath, getPlaceById, onClear }: InventoryFilterBarProps) {
  const { language } = useLanguage()

  const placeLabel = filter.place_id
    ? getPlacePath(filter.place_id)
        .map((p) => p.label)
        .join(' \u203a ') ||
      (filter.place_label ?? getPlaceById(filter.place_id)?.label ?? filter.place_id)
    : (filter.place_label ?? filter.location_description ?? '')

  return (
    <div className="inventory__filter-bar">
      <span className="inventory__filter-text">
        {ui('inventory.filtered', language, { place: placeLabel })}
      </span>
      <button className="inventory__filter-clear" onClick={onClear}>
        <X size={12} />
        {ui('inventory.clear_filter', language)}
      </button>
    </div>
  )
}
