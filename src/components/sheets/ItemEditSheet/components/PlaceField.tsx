import { useLanguage } from '../../../../i18n/LanguageContext'
import { ui } from '../../../../i18n/ui'
import { PlaceDrillDown } from '../../../pickers/PlaceDrillDown'
import type { PlaceWithChildren } from '../../../../hooks/usePlaces'

interface PlaceFieldProps {
  placeId: string
  showPlacePicker: boolean
  onShowPicker: () => void
  onSelect: (id: string | null) => void
  placeTree: PlaceWithChildren[]
  getPlacePath: (id: string) => Array<{ label: string }>
  legacyLocationText: string | null
}

export function PlaceField({
  placeId,
  showPlacePicker,
  onShowPicker,
  onSelect,
  placeTree,
  getPlacePath,
  legacyLocationText,
}: PlaceFieldProps) {
  const { language } = useLanguage()

  return (
    <div className="edit-sheet__field">
      <label className="edit-sheet__label">{ui('add.room', language)}</label>
      {placeId && !showPlacePicker ? (
        <div className="edit-sheet__place-display">
          <span className="edit-sheet__place-path">
            {getPlacePath(placeId).map((p) => p.label).join(' › ')}
          </span>
          <button
            type="button"
            className="btn-ghost-gold edit-sheet__place-change"
            onClick={onShowPicker}
          >
            {ui('places.change', language)}
          </button>
        </div>
      ) : showPlacePicker && placeTree.length > 0 ? (
        <PlaceDrillDown
          placeTree={placeTree}
          onSelect={onSelect}
          emptyOptionLabel={ui('places.no_place', language)}
          confirmLabel={ui('places.use_this_place', language)}
        />
      ) : placeTree.length > 0 ? (
        <>
          {legacyLocationText && (
            <span className="edit-sheet__legacy-location">{legacyLocationText}</span>
          )}
          <button
            type="button"
            className="btn-ghost-gold edit-sheet__place-choose"
            onClick={onShowPicker}
          >
            {ui('places.choose_place', language)}
          </button>
        </>
      ) : (
        <>
          {legacyLocationText && (
            <span className="edit-sheet__legacy-location">{legacyLocationText}</span>
          )}
          <span className="edit-sheet__no-places-hint">
            {ui('places.create_places_hint', language)}
          </span>
        </>
      )}
    </div>
  )
}
