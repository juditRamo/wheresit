import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import type { PlaceWithChildren } from '../hooks/usePlaces'
import './ItemEditSheet.css'

interface PlaceEditSheetProps {
  place: PlaceWithChildren
  onSave: (data: { label: string; type: string; attributes: Record<string, string> }) => void
  onClose: () => void
}

export function PlaceEditSheet({ place, onSave, onClose }: PlaceEditSheetProps) {
  const { language } = useLanguage()
  const [label, setLabel] = useState(place.label)
  const [type, setType] = useState(place.type)
  const [attributesText, setAttributesText] = useState(
    Object.entries(place.attributes ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ')
  )

  function handleSave() {
    const attrs: Record<string, string> = {}
    for (const part of attributesText.split(',').map((s) => s.trim()).filter(Boolean)) {
      const [k, v] = part.split(':').map((s) => s.trim())
      if (k && v) attrs[k] = v
    }
    onSave({ label: label.trim(), type, attributes: attrs })
  }

  return (
    <>
      <div className="edit-sheet-overlay" onClick={onClose} />
      <div className="edit-sheet">
        <div className="edit-sheet__handle"><div className="edit-sheet__handle-bar" /></div>
        <div className="edit-sheet__header">
          <h2 className="edit-sheet__title">{ui('locations.edit_place_title', language)}</h2>
          <button className="edit-sheet__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="edit-sheet__form">
          <div className="edit-sheet__field">
            <label className="edit-sheet__label">{ui('locations.enter_name', language)}</label>
            <input
              className="edit-sheet__input"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={ui('locations.enter_name', language)}
              autoFocus
            />
          </div>

          <div className="edit-sheet__field">
            <label className="edit-sheet__label">Type</label>
            <select className="edit-sheet__select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="room">Room</option>
              <option value="furniture">Furniture</option>
              <option value="shelf">Shelf</option>
              <option value="drawer">Drawer</option>
              <option value="box">Box</option>
              <option value="folder">Folder</option>
            </select>
          </div>

          <div className="edit-sheet__field">
            <label className="edit-sheet__label">Attributes</label>
            <input
              className="edit-sheet__input"
              type="text"
              value={attributesText}
              onChange={(e) => setAttributesText(e.target.value)}
              placeholder="color: beige, position: behind sofa"
            />
          </div>
        </div>

        <div className="edit-sheet__actions">
          <button className="edit-sheet__btn edit-sheet__btn--secondary" onClick={onClose}>
            {ui('edit.cancel', language)}
          </button>
          <button
            className="edit-sheet__btn edit-sheet__btn--primary"
            onClick={handleSave}
            disabled={!label.trim()}
          >
            <Save size={14} />
            {ui('edit.save', language)}
          </button>
        </div>
      </div>
    </>
  )
}
