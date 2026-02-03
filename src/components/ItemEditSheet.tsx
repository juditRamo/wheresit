import { useState } from 'react'
import { X, Trash2, Save } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import { CATEGORIES, t } from '../i18n/picklists'
import type { StorageEntry } from '../types'
import { usePlaces } from '../hooks/usePlaces'
import { PhotoUpload } from './PhotoUpload'
import './ItemEditSheet.css'

interface ItemEditSheetProps {
  mode: 'create' | 'edit'
  entry?: StorageEntry | null
  householdId: string
  onSave: (data: {
    item_name: string
    room_key: string | null
    spot_key: string | null
    spot_detail: string | null
    category_key: string | null
    location_description: string
    photo_path?: string | null
    place_id?: string | null
  }) => void
  onDelete?: () => void
  onClose: () => void
}

function flattenPlaces(tree: Array<{ id: string; label: string; type: string; children: unknown[] }>, prefix = ''): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = []
  for (const p of tree) {
    out.push({ id: p.id, label: prefix ? `${prefix} › ${p.label}` : p.label })
    out.push(...flattenPlaces(p.children as Array<{ id: string; label: string; type: string; children: unknown[] }>, prefix ? `${prefix} › ${p.label}` : p.label))
  }
  return out
}

export function ItemEditSheet({ mode, entry, householdId, onSave, onDelete, onClose }: ItemEditSheetProps) {
  const { language } = useLanguage()
  const { placeTree } = usePlaces(householdId)
  const [itemName, setItemName] = useState(entry?.item_name ?? '')
  const [placeId, setPlaceId] = useState(entry?.place_id ?? '')
  const [locationText, setLocationText] = useState(entry?.place_id ? '' : (entry?.location_description ?? ''))
  const [categoryKey, setCategoryKey] = useState(entry?.category_key ?? '')
  const [photoPath, setPhotoPath] = useState<string | null>(entry?.photo_path ?? null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const placeOptions = flattenPlaces(placeTree as Array<{ id: string; label: string; type: string; children: unknown[] }>)

  function handleSave() {
    if (!itemName.trim()) return
    const selectedPlace = placeOptions.find((p) => p.id === placeId)
    const locationDescription = selectedPlace ? selectedPlace.label : locationText.trim()
    onSave({
      item_name: itemName.trim().toLowerCase(),
      room_key: null,
      spot_key: null,
      spot_detail: null,
      category_key: categoryKey || null,
      location_description: locationDescription,
      photo_path: photoPath,
      place_id: placeId || null,
    })
  }

  if (showDeleteConfirm) {
    return (
      <>
        <div className="edit-sheet-overlay" onClick={() => setShowDeleteConfirm(false)} />
        <div className="edit-sheet">
          <div className="edit-sheet__handle"><div className="edit-sheet__handle-bar" /></div>
          <div className="edit-sheet__confirm">
            <p className="edit-sheet__confirm-text">{ui('edit.confirm_delete', language)}</p>
            <div className="edit-sheet__confirm-actions">
              <button className="edit-sheet__btn edit-sheet__btn--secondary" onClick={() => setShowDeleteConfirm(false)}>
                {ui('edit.cancel', language)}
              </button>
              <button className="edit-sheet__btn edit-sheet__btn--danger" onClick={onDelete}>
                <Trash2 size={14} />
                {ui('edit.delete', language)}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="edit-sheet-overlay" onClick={onClose} />
      <div className="edit-sheet">
        <div className="edit-sheet__handle"><div className="edit-sheet__handle-bar" /></div>
        <div className="edit-sheet__header">
          <h2 className="edit-sheet__title">
            {mode === 'edit' ? ui('edit.title', language) : ui('add.title', language)}
          </h2>
          <button className="edit-sheet__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="edit-sheet__form">
          <div className="edit-sheet__field">
            <label className="edit-sheet__label">{ui('add.item_name', language)}</label>
            <input
              className="edit-sheet__input"
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={ui('add.item_name', language)}
              autoFocus={mode === 'create'}
            />
          </div>

          <div className="edit-sheet__field">
            <label className="edit-sheet__label">{ui('add.room', language)}</label>
            {placeOptions.length > 0 && (
              <select className="edit-sheet__select" value={placeId} onChange={(e) => { setPlaceId(e.target.value); if (!e.target.value) setLocationText(''); }}>
                <option value="">—</option>
                {placeOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            )}
            {(!placeId || placeOptions.length === 0) && (
              <input
                className="edit-sheet__input"
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="e.g. living room › desk › top drawer"
              />
            )}
          </div>

          <div className="edit-sheet__field">
            <label className="edit-sheet__label">{ui('add.category', language)}</label>
            <select className="edit-sheet__select" value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)}>
              <option value="">—</option>
              {Object.entries(CATEGORIES).map(([key]) => (
                <option key={key} value={key}>{t(CATEGORIES, key, language)}</option>
              ))}
            </select>
          </div>

          <PhotoUpload
            householdId={householdId}
            entryId={entry?.id ?? null}
            photoPath={photoPath}
            onPhotoChange={setPhotoPath}
          />
        </div>

        <div className="edit-sheet__actions">
          {mode === 'edit' && onDelete && (
            <button className="edit-sheet__btn edit-sheet__btn--danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={14} />
              {ui('edit.delete', language)}
            </button>
          )}
          <button
            className="edit-sheet__btn edit-sheet__btn--primary"
            onClick={handleSave}
            disabled={!itemName.trim()}
          >
            <Save size={14} />
            {mode === 'edit' ? ui('edit.save', language) : ui('add.save', language)}
          </button>
        </div>
      </div>
    </>
  )
}
