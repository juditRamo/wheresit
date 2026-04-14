import { recordHistoryEvent } from '../../../lib/historyEvents'
import { ui } from '../../../i18n/ui'
import type { Lang } from '../../../i18n/picklists'
import type { StorageEntry, CustomField, CustomFieldValue } from '../../../types'

type EntryFormData = {
  item_name: string
  location_description: string
  photo_path?: string | null
  place_id?: string | null
}

interface SaveDeps {
  householdId: string
  language: Lang
  updateEntry: (id: string, data: Partial<Pick<StorageEntry, 'item_name' | 'location_description' | 'photo_path' | 'place_id'>>) => Promise<{ error: unknown }>
  deletePhoto: (path: string) => Promise<void>
  saveFormValues: (entryId: string, values: Record<string, unknown>) => Promise<void>
  getEntryValues: (entryId: string) => Record<string, CustomFieldValue>
  customFields: CustomField[]
  optionLabelMap: Map<string, string>
}

interface CreateDeps {
  householdId: string
  createEntry: (data: EntryFormData) => Promise<{ data: { id: string } | null; error: unknown }>
  saveFormValues: (entryId: string, values: Record<string, unknown>) => Promise<void>
}

interface DeleteDeps {
  householdId: string
  deleteEntry: (id: string, photoPath?: string | null) => Promise<{ error: unknown }>
}

export async function saveExistingEntry(
  entry: StorageEntry,
  formData: EntryFormData,
  fieldValues: Record<string, unknown>,
  deps: SaveDeps
) {
  const locationChanged =
    entry.location_description !== formData.location_description ||
    (entry.place_id ?? null) !== (formData.place_id ?? null)

  const err = await deps.updateEntry(entry.id, formData)
  if (err?.error) return

  // Delete orphaned photo from storage
  if (entry.photo_path && formData.photo_path === null) {
    await deps.deletePhoto(entry.photo_path)
  }

  if (locationChanged) {
    recordHistoryEvent(deps.householdId, 'move_object', 'storage_entry', entry.id, {
      item_name: formData.item_name,
      from: {
        location_description: entry.location_description,
        place_id: entry.place_id ?? undefined,
      },
      to: {
        location_description: formData.location_description,
        place_id: formData.place_id ?? undefined,
      },
    })
  } else {
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    if (entry.item_name !== formData.item_name) {
      changes[ui('activity.field_name', deps.language)] = { from: entry.item_name, to: formData.item_name }
    }
    if ((entry.photo_path ?? null) !== (formData.photo_path ?? null)) {
      changes[ui('activity.field_photo', deps.language)] = {
        from: entry.photo_path ? '\u2713' : null,
        to: formData.photo_path ? '\u2713' : null,
      }
    }
    // Diff custom field values
    if (deps.customFields.length > 0) {
      const prev = deps.getEntryValues(entry.id)
      for (const field of deps.customFields) {
        const newVal = fieldValues[field.id]
        const oldCfv = prev[field.id]
        const formatCfVal = (raw: unknown): string | null => {
          if (raw == null || raw === '') return null
          if (field.field_type === 'select') return deps.optionLabelMap.get(raw as string) ?? String(raw)
          if (field.field_type === 'multiselect') {
            const arr = raw as string[]
            return arr.length ? arr.map(id => deps.optionLabelMap.get(id) ?? id).join(', ') : null
          }
          if (field.field_type === 'boolean') return raw ? ui('common.yes', deps.language) : ui('common.no', deps.language)
          return String(raw)
        }
        const oldRaw = oldCfv
          ? (oldCfv.value_text ?? oldCfv.value_number ?? oldCfv.value_boolean ?? oldCfv.value_option ?? oldCfv.value_options ?? oldCfv.value_date ?? null)
          : null
        const oldStr = formatCfVal(oldRaw)
        const newStr = formatCfVal(newVal)
        if (oldStr !== newStr) {
          changes[field.name] = { from: oldStr, to: newStr }
        }
      }
    }
    recordHistoryEvent(deps.householdId, 'edit_object', 'storage_entry', entry.id, {
      item_name: formData.item_name,
      changes,
    })
  }

  await deps.saveFormValues(entry.id, fieldValues)
}

export async function createNewEntry(
  formData: EntryFormData,
  fieldValues: Record<string, unknown>,
  deps: CreateDeps
) {
  const { data: inserted, error } = await deps.createEntry(formData)
  if (error || !inserted) return

  recordHistoryEvent(deps.householdId, 'add_object', 'storage_entry', inserted.id, {
    item_name: formData.item_name,
    location_description: formData.location_description,
    place_id: formData.place_id ?? undefined,
  })

  await deps.saveFormValues(inserted.id, fieldValues)
}

export async function deleteExistingEntry(
  entry: StorageEntry,
  deps: DeleteDeps
) {
  recordHistoryEvent(deps.householdId, 'delete_object', 'storage_entry', entry.id, {
    item_name: entry.item_name,
    last_location_description: entry.location_description || undefined,
  })
  await deps.deleteEntry(entry.id, entry.photo_path)
}
