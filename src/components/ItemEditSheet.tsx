import { useState } from 'react'
import { X, Trash2, Save } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import type { StorageEntry, CustomField, CustomFieldOption, CustomFieldValue } from '../types'
import { usePlaces } from '../hooks/usePlaces'
import { PhotoUpload } from './PhotoUpload'
import { PlaceDrillDown } from './PlaceDrillDown'
import { CustomFieldInputs } from './CustomFieldInputs'
import './ItemEditSheet.css'

interface ItemEditSheetProps {
  mode: 'create' | 'edit'
  entry?: StorageEntry | null
  householdId: string
  initialPlaceId?: string
  customFields?: CustomField[]
  customFieldValues?: Record<string, CustomFieldValue>
  onCreateOption?: (fieldId: string, label: string) => Promise<CustomFieldOption | null>
  onSave: (data: {
    item_name: string
    location_description: string
    photo_path?: string | null
    place_id?: string | null
  }, fieldValues?: Record<string, unknown>) => void
  onDelete?: () => void
  onClose: () => void
}

export function ItemEditSheet({ mode, entry, householdId, initialPlaceId, customFields, customFieldValues, onCreateOption, onSave, onDelete, onClose }: ItemEditSheetProps) {
  const { language } = useLanguage()
  const { placeTree, getPlacePath } = usePlaces(householdId)
  const [itemName, setItemName] = useState(entry?.item_name ?? '')
  const [placeId, setPlaceId] = useState(entry?.place_id ?? initialPlaceId ?? '')
  const legacyLocationText = (!entry?.place_id && entry?.location_description) ? entry.location_description : null
  const [photoPath, setPhotoPath] = useState<string | null>(entry?.photo_path ?? null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showPlacePicker, setShowPlacePicker] = useState(
    initialPlaceId ? false : (mode === 'create' || !entry?.place_id)
  )

  // Custom field values state: fieldId → value
  const [cfValues, setCfValues] = useState<Record<string, unknown>>(() => {
    if (!customFieldValues || !customFields) return {}
    const initial: Record<string, unknown> = {}
    for (const f of customFields) {
      const v = customFieldValues[f.id]
      if (!v) continue
      if (f.field_type === 'text') initial[f.id] = v.value_text
      else if (f.field_type === 'number') initial[f.id] = v.value_number
      else if (f.field_type === 'boolean') initial[f.id] = v.value_boolean
      else if (f.field_type === 'select') initial[f.id] = v.value_option
      else if (f.field_type === 'multiselect') initial[f.id] = v.value_options
      else if (f.field_type === 'date') initial[f.id] = v.value_date
    }
    return initial
  })

  function getLocationDescription(): string {
    if (placeId) {
      const path = getPlacePath(placeId)
      return path.length ? path.map((p) => p.label).join(' › ') : ''
    }
    return legacyLocationText ?? ''
  }

  // NOTE: Renaming an item does not update item_concepts linkage.
  // That would require calling the edge function's concept logic from the client.
  function handleSave() {
    if (!itemName.trim()) return
    onSave({
      item_name: itemName.trim(),
      location_description: getLocationDescription(),
      photo_path: photoPath,
      place_id: placeId || null,
    }, cfValues)
  }

  function handlePlaceSelect(id: string | null) {
    setPlaceId(id ?? '')
    setShowPlacePicker(false)
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
              <button className="btn-secondary edit-sheet__btn edit-sheet__btn--secondary" onClick={() => setShowDeleteConfirm(false)}>
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
              className="input-field edit-sheet__input"
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={ui('add.item_name', language)}
              autoFocus={mode === 'create'}
            />
          </div>

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
                  onClick={() => setShowPlacePicker(true)}
                >
                  {ui('places.change', language)}
                </button>
              </div>
            ) : showPlacePicker && placeTree.length > 0 ? (
              <PlaceDrillDown
                placeTree={placeTree}
                onSelect={handlePlaceSelect}
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
                  onClick={() => setShowPlacePicker(true)}
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

          <div className="edit-sheet__field">
            <label className="edit-sheet__label">{ui('add.photo', language)}</label>
            <PhotoUpload
              householdId={householdId}
              entryId={entry?.id ?? null}
              photoPath={photoPath}
              onPhotoChange={setPhotoPath}
              onUploadingChange={setPhotoUploading}
            />
          </div>

          {customFields && customFields.length > 0 && (
            <CustomFieldInputs
              fields={customFields}
              values={cfValues}
              onChange={(fieldId, value) => setCfValues(prev => ({ ...prev, [fieldId]: value }))}
              onCreateOption={onCreateOption}
            />
          )}
        </div>

        <div className="edit-sheet__actions">
          {mode === 'edit' && onDelete && (
            <button className="edit-sheet__btn edit-sheet__btn--danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={14} />
              {ui('edit.delete', language)}
            </button>
          )}
          <button
            className="btn-gold edit-sheet__btn edit-sheet__btn--primary"
            onClick={handleSave}
            disabled={!itemName.trim() || photoUploading}
          >
            <Save size={14} />
            {mode === 'edit' ? ui('edit.save', language) : ui('add.save', language)}
          </button>
        </div>
      </div>
    </>
  )
}
