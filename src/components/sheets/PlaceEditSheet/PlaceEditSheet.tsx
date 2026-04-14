import { useState } from 'react'
import { useLanguage } from '../../../i18n/LanguageContext'
import { ui } from '../../../i18n/ui'
import type { PlaceWithChildren } from '../../../hooks/usePlaces'
import { PlaceIconPicker } from '../../pickers/PlaceIconPicker'
import { BottomSheet } from '../BottomSheet'
import { SheetHeader } from '../SheetHeader'
import { SheetActions } from '../SheetActions'
import '../edit-sheet.css'

interface PlaceEditSheetProps {
  place: PlaceWithChildren
  onSave: (data: { label: string; icon: string }) => void
  onClose: () => void
}

export function PlaceEditSheet({ place, onSave, onClose }: PlaceEditSheetProps) {
  const { language } = useLanguage()
  const [label, setLabel] = useState(place.label)
  const [icon, setIcon] = useState(place.icon)

  function handleSave() {
    onSave({ label: label.trim(), icon })
  }

  return (
    <BottomSheet onClose={onClose} className="edit-sheet">
      <SheetHeader title={ui('locations.edit_place_title', language)} onClose={onClose} />

      <div className="edit-sheet__form">
        <div className="edit-sheet__field">
          <label className="edit-sheet__label">{ui('locations.enter_name', language)}</label>
          <input
            className="input-field edit-sheet__input"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={ui('locations.enter_name', language)}
            autoFocus
          />
        </div>

        <div className="edit-sheet__field">
          <label className="edit-sheet__label">{ui('locations.icon', language)}</label>
          <PlaceIconPicker selected={icon} onSelect={setIcon} compact />
        </div>
      </div>

      <SheetActions
        onCancel={onClose}
        onSave={handleSave}
        saveDisabled={!label.trim()}
      />
    </BottomSheet>
  )
}
