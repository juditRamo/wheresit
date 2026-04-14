import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'
import { getRootPlaceLabel } from '../helpers'
import type { StorageEntry, Place } from '../../../../types'

interface InventoryPlaceChipsProps {
  entries: StorageEntry[]
  places: Place[]
  placeChipFilter: string | null
  onChipChange: (key: string | null) => void
}

export function InventoryPlaceChips({ entries, places, placeChipFilter, onChipChange }: InventoryPlaceChipsProps) {
  const { language } = useLanguage()

  const placeChipKeys = [...new Set(entries.map((e) => getRootPlaceLabel(e, places)).filter(Boolean))] as string[]

  if (placeChipKeys.length === 0) return null

  return (
    <div className="inventory__chips">
      <span className="inventory__chip-label">{ui('search.filter_room', language)}</span>
      {placeChipKeys.map((key) => (
        <button
          key={key}
          className={`inventory__chip ${placeChipFilter === key ? 'inventory__chip--active' : ''}`}
          onClick={() => onChipChange(placeChipFilter === key ? null : key)}
        >
          {key}
        </button>
      ))}
    </div>
  )
}
