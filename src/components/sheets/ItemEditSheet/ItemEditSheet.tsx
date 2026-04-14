import { useState, useEffect } from 'react'
import { useLanguage } from '../../../i18n/LanguageContext'
import { ui } from '../../../i18n/ui'
import type { StorageEntry } from '../../../types'
import { useStorageEntries } from '../../../hooks/useStorageEntries'
import { useCustomFieldsContext } from '../../../hooks/CustomFieldsContext'
import { usePlaces } from '../../../hooks/usePlaces'
import { PhotoUpload } from '../../fields/PhotoUpload'
import { CustomFieldInputs } from '../../fields/CustomFieldInputs'
import { BottomSheet } from '../BottomSheet'
import { SheetHeader } from '../SheetHeader'
import { SheetActions } from '../SheetActions'
import { saveExistingEntry, createNewEntry, deleteExistingEntry } from './saveActions'
import { DeleteConfirmSheet } from './components/DeleteConfirmSheet'
import { ItemNameField } from './components/ItemNameField'
import { PlaceField } from './components/PlaceField'
import './ItemEditSheet.css'

interface ItemEditSheetProps {
  mode: 'create' | 'edit'
  entry?: StorageEntry | null
  householdId: string
  initialPlaceId?: string
  onSaved: () => void
  onDeleted?: () => void
  onClose: () => void
}

export function ItemEditSheet({ mode, entry, householdId, initialPlaceId, onSaved, onDeleted, onClose }: ItemEditSheetProps) {
  const { language } = useLanguage()
  const { placeTree, getPlacePath } = usePlaces(householdId)
  const { updateEntry, createEntry, deleteEntry, deletePhoto } = useStorageEntries(householdId)
  const { fields: customFields, getEntryValues, saveFormValues, createOption, optionLabelMap, loading: cfLoading } = useCustomFieldsContext()

  const [itemName, setItemName] = useState(entry?.item_name ?? '')
  const [placeId, setPlaceId] = useState(entry?.place_id ?? initialPlaceId ?? '')
  const legacyLocationText = (!entry?.place_id && entry?.location_description) ? entry.location_description : null
  const [photoPath, setPhotoPath] = useState<string | null>(entry?.photo_path ?? null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showPlacePicker, setShowPlacePicker] = useState(
    initialPlaceId ? false : (mode === 'create' || !entry?.place_id)
  )
  const [saving, setSaving] = useState(false)

  // Custom field values state: fieldId → value
  const [cfValues, setCfValues] = useState<Record<string, unknown>>({})
  const [cfInitialized, setCfInitialized] = useState(mode === 'create')

  // Populate custom field values once data loads (for edit mode)
  useEffect(() => {
    if (cfLoading || !entry || cfInitialized) return
    if (!customFields.length) {
      setCfInitialized(true)
      return
    }
    const raw = getEntryValues(entry.id)
    const initial: Record<string, unknown> = {}
    for (const f of customFields) {
      const v = raw[f.id]
      if (!v) continue
      if (f.field_type === 'text') initial[f.id] = v.value_text
      else if (f.field_type === 'number') initial[f.id] = v.value_number
      else if (f.field_type === 'boolean') initial[f.id] = v.value_boolean
      else if (f.field_type === 'select') initial[f.id] = v.value_option
      else if (f.field_type === 'multiselect') initial[f.id] = v.value_options
      else if (f.field_type === 'date') initial[f.id] = v.value_date
    }
    setCfValues(initial)
    setCfInitialized(true)
  }, [cfLoading, entry, customFields, getEntryValues, cfInitialized])

  function getLocationDescription(): string {
    if (placeId) {
      const path = getPlacePath(placeId)
      return path.length ? path.map((p) => p.label).join(' › ') : ''
    }
    return legacyLocationText ?? ''
  }

  async function handleSave() {
    if (!itemName.trim() || saving) return
    setSaving(true)
    const formData = {
      item_name: itemName.trim(),
      location_description: getLocationDescription(),
      photo_path: photoPath,
      place_id: placeId || null,
    }
    try {
      if (mode === 'edit' && entry) {
        await saveExistingEntry(entry, formData, cfValues, {
          householdId, language, updateEntry, deletePhoto, saveFormValues, getEntryValues, customFields, optionLabelMap,
        })
      } else {
        await createNewEntry(formData, cfValues, {
          householdId, createEntry, saveFormValues,
        })
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!entry) return
    await deleteExistingEntry(entry, { householdId, deleteEntry })
    onDeleted?.()
  }

  function handlePlaceSelect(id: string | null) {
    setPlaceId(id ?? '')
    setShowPlacePicker(false)
  }

  // Wait for custom field definitions before rendering the form
  if (cfLoading || (mode === 'edit' && !cfInitialized)) {
    return (
      <BottomSheet onClose={onClose} className="edit-sheet">
        <SheetHeader
          title={mode === 'edit' ? ui('edit.title', language) : ui('add.title', language)}
          onClose={onClose}
        />
      </BottomSheet>
    )
  }

  if (showDeleteConfirm) {
    return <DeleteConfirmSheet onCancel={() => setShowDeleteConfirm(false)} onConfirm={handleDelete} />
  }

  return (
    <BottomSheet onClose={onClose} className="edit-sheet">
      <SheetHeader
        title={mode === 'edit' ? ui('edit.title', language) : ui('add.title', language)}
        onClose={onClose}
      />

      <div className="edit-sheet__form">
        <ItemNameField value={itemName} onChange={setItemName} autoFocus={mode === 'create'} />

        <PlaceField
          placeId={placeId}
          showPlacePicker={showPlacePicker}
          onShowPicker={() => setShowPlacePicker(true)}
          onSelect={handlePlaceSelect}
          placeTree={placeTree}
          getPlacePath={getPlacePath}
          legacyLocationText={legacyLocationText}
        />

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
            onCreateOption={createOption}
          />
        )}
      </div>

      <SheetActions
        onDelete={mode === 'edit' && onDeleted ? () => setShowDeleteConfirm(true) : undefined}
        onSave={handleSave}
        saveDisabled={!itemName.trim() || photoUploading || saving}
        saveLabel={mode === 'edit' ? ui('edit.save', language) : ui('add.save', language)}
      />
    </BottomSheet>
  )
}
