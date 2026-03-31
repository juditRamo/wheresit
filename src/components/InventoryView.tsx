import { useState } from 'react'
import { useBackHandler } from '../hooks/useBackHandler'
import {
  Search,
  RefreshCw,
  Plus,
  X,
  BookOpen,
  Watch,
  Key,
  Headphones,
  Package,
  Home,
  History,
} from 'lucide-react'
import { useStorageEntries } from '../hooks/useStorageEntries'
import { usePlaces } from '../hooks/usePlaces'
import { useCustomFields } from '../hooks/useCustomFields'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import { getPlaceIcon } from '../lib/placeIcons'
import { recordHistoryEvent } from '../lib/historyEvents'
import type { StorageEntry, Place, LocationRef, CustomFieldValue } from '../types'
import { ItemEditSheet } from './ItemEditSheet'
import { DashboardCards } from './DashboardCards'
import { ActivityFeed } from './ActivityFeed'
import { CustomFieldFilters } from './CustomFieldFilters'
import type { CustomFieldFilter } from './CustomFieldFilters'
import './InventoryView.css'

interface InventoryViewProps {
  householdId: string
  filter?: LocationRef | null
  onClearFilter: () => void
}

type SortTab = 'place' | 'recent'

const ITEM_ICONS: Record<string, typeof Package> = {
  passport: BookOpen,
  book: BookOpen,
  watch: Watch,
  key: Key,
  keys: Key,
  headphone: Headphones,
  headphones: Headphones,
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

function getItemIcon(itemName: string) {
  const lower = itemName.toLowerCase()
  for (const [keyword, Icon] of Object.entries(ITEM_ICONS)) {
    if (lower.includes(keyword)) return Icon
  }
  return Package
}

function getPlaceGroupIcon(rootPlaceId: string, places: Place[]) {
  const place = places.find(p => p.id === rootPlaceId)
  if (place?.icon) return getPlaceIcon(place.icon)
  return Home
}

function getLocationDisplay(
  entry: StorageEntry,
  getPlacePath: (id: string) => Array<{ label: string }>
): string {
  if (entry.place_id) {
    const path = getPlacePath(entry.place_id)
    if (path.length) return path.map((p) => p.label).join(' › ')
  }
  return entry.location_description ?? ''
}

function getRootPlaceId(placeId: string | null, places: Array<{ id: string; parent_place_id: string | null }>): string | null {
  if (!placeId) return null
  const byId = new Map(places.map((p) => [p.id, p]))
  let current = placeId
  while (current) {
    const p = byId.get(current)
    if (!p) return current
    if (!p.parent_place_id) return current
    current = p.parent_place_id
  }
  return null
}

function getRootPlaceLabel(entry: StorageEntry, places: Array<{ id: string; label: string; parent_place_id: string | null }>): string | null {
  if (entry.place_id) {
    const rootId = getRootPlaceId(entry.place_id, places)
    const byId = new Map(places.map((p) => [p.id, p]))
    const root = rootId ? byId.get(rootId) : null
    return root?.label ?? null
  }
  const first = entry.location_description?.split(' › ')[0]
  return first ?? null
}

function groupByPlace(entries: StorageEntry[], places: Array<{ id: string; label: string; parent_place_id: string | null }>): Record<string, { key: string; label: string; entries: StorageEntry[] }> {
  const groups: Record<string, { key: string; label: string; entries: StorageEntry[] }> = {}
  const byId = new Map(places.map((p) => [p.id, p]))
  for (const entry of entries) {
    let groupKey: string
    let label: string
    if (entry.place_id) {
      const rootId = getRootPlaceId(entry.place_id, places)
      const root = rootId ? byId.get(rootId) : null
      groupKey = rootId ?? entry.place_id
      label = root?.label ?? entry.location_description?.split(' › ')[0] ?? 'Other'
    } else {
      groupKey = entry.location_description?.split(' › ')[0] ?? 'other'
      label = groupKey
    }
    if (!groups[groupKey]) groups[groupKey] = { key: groupKey, label, entries: [] }
    groups[groupKey].entries.push(entry)
  }
  return groups
}

export function InventoryView({ householdId, filter, onClearFilter }: InventoryViewProps) {
  const { entries, loading, refetch, updateEntry, deleteEntry, createEntry, stats } = useStorageEntries(householdId)
  const { getDescendantIds, getPlaceById, getPlacePath, places } = usePlaces(householdId)
  const { fields: customFields, valuesByEntry, optionLabelMap, getEntryValues, saveEntryValues, createOption } = useCustomFields(householdId)
  const { language } = useLanguage()
  const [activeTab, setActiveTab] = useState<SortTab>('place')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingEntry, setEditingEntry] = useState<StorageEntry | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [placeChipFilter, setPlaceChipFilter] = useState<string | null>(null)
  const [showActivity, setShowActivity] = useState(false)
  const [customFilters, setCustomFilters] = useState<CustomFieldFilter[]>([])


  useBackHandler(showActivity, () => setShowActivity(false))
  useBackHandler(!!editingEntry, () => setEditingEntry(null))
  useBackHandler(showAddSheet, () => setShowAddSheet(false))

  // Apply location filter if set
  let filtered = filter
    ? entries.filter((e) => {
        if (filter.place_id) {
          const placeIds = new Set(getDescendantIds(filter.place_id))
          placeIds.add(filter.place_id)
          return e.place_id && placeIds.has(e.place_id)
        }
        if (filter.location_description) {
          const desc = (e.location_description ?? '').trim()
          const filterDesc = filter.location_description.trim()
          return desc === filterDesc || desc.includes(filterDesc) || filterDesc.includes(desc)
        }
        return true
      })
    : entries

  // Apply search query (enhanced with custom field values)
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter((e) => {
      if (e.item_name.toLowerCase().includes(q)) return true
      if (getLocationDisplay(e, getPlacePath).toLowerCase().includes(q)) return true
      const fvs = valuesByEntry.get(e.id) ?? []
      for (const fv of fvs) {
        if (fv.value_text?.toLowerCase().includes(q)) return true
        if (fv.value_date?.includes(q)) return true
        if (fv.value_option) {
          const optLabel = optionLabelMap.get(fv.value_option)
          if (optLabel?.toLowerCase().includes(q)) return true
        }
        if (fv.value_options) {
          if (fv.value_options.some((o: string) => {
            const optLabel = optionLabelMap.get(o)
            return optLabel?.toLowerCase().includes(q)
          })) return true
        }
      }
      return false
    })
  }

  // Apply chip filters
  if (placeChipFilter) {
    filtered = filtered.filter((e) => getRootPlaceLabel(e, places) === placeChipFilter)
  }

  // Apply custom field filters
  if (customFilters.length > 0) {
    filtered = filtered.filter((e) => {
      const fvs = valuesByEntry.get(e.id) ?? []
      return customFilters.every((filter) => {
        const fv = fvs.find((v: CustomFieldValue) => v.custom_field_id === filter.fieldId)
        if (!fv) return false
        if (filter.booleanValue != null) return fv.value_boolean === filter.booleanValue
        if (filter.numberMin != null || filter.numberMax != null) {
          if (fv.value_number == null) return false
          if (filter.numberMin != null && fv.value_number < filter.numberMin) return false
          if (filter.numberMax != null && fv.value_number > filter.numberMax) return false
          return true
        }
        if (filter.dateFrom != null || filter.dateTo != null) {
          if (fv.value_date == null) return false
          if (filter.dateFrom != null && fv.value_date < filter.dateFrom) return false
          if (filter.dateTo != null && fv.value_date > filter.dateTo) return false
          return true
        }
        if (filter.selectedOptions && filter.selectedOptions.length > 0) {
          if (fv.value_option) return filter.selectedOptions.includes(fv.value_option)
          if (fv.value_options) return fv.value_options.some((o: string) => filter.selectedOptions!.includes(o))
          return false
        }
        return true
      })
    })
  }

  // Compute chip options from all entries (before chip filtering)
  const placeChipKeys = [...new Set(entries.map((e) => getRootPlaceLabel(e, places)).filter(Boolean))] as string[]

  const itemCount = (n: number) =>
    n === 1 ? ui('inventory.item_one', language) : ui('inventory.item_other', language, { n })

  let sections: Array<{ label: string; key: string; items: StorageEntry[] }>

  if (activeTab === 'place') {
    const groups = groupByPlace(filtered, places)
    sections = Object.entries(groups).map(([, g]) => ({
      key: g.key,
      label: g.label || ui('inventory.other_room', language),
      items: g.entries,
    }))
  } else {
    sections = [{ key: 'all', label: '', items: filtered }]
  }

  async function handleSaveEdit(data: {
    item_name: string
    location_description: string
    photo_path?: string | null
    place_id?: string | null
  }, fieldValues?: Record<string, unknown>) {
    if (!editingEntry) return
    const locationChanged =
      editingEntry.location_description !== data.location_description ||
      (editingEntry.place_id ?? null) !== (data.place_id ?? null)
    const err = await updateEntry(editingEntry.id, data)
    if (!err?.error) {
      if (locationChanged) {
        recordHistoryEvent(householdId, 'move_object', 'storage_entry', editingEntry.id, {
          item_name: data.item_name,
          from: {
            location_description: editingEntry.location_description,
            place_id: editingEntry.place_id ?? undefined,
          },
          to: {
            location_description: data.location_description,
            place_id: data.place_id ?? undefined,
          },
        })
      } else {
        recordHistoryEvent(householdId, 'edit_object', 'storage_entry', editingEntry.id, {
          item_name: data.item_name,
          changes: { ...data },
        })
      }
      if (fieldValues) {
        await saveCustomFieldValues(editingEntry.id, fieldValues)
      }
    }
    setEditingEntry(null)
  }

  async function handleDeleteEntry() {
    if (!editingEntry) return
    recordHistoryEvent(householdId, 'delete_object', 'storage_entry', editingEntry.id, {
      item_name: editingEntry.item_name,
      last_location_description: editingEntry.location_description || undefined,
    })
    await deleteEntry(editingEntry.id)
    setEditingEntry(null)
  }

  async function handleCreateEntry(data: {
    item_name: string
    location_description: string
    photo_path?: string | null
    place_id?: string | null
  }, fieldValues?: Record<string, unknown>) {
    const { data: inserted, error } = await createEntry(data)
    if (!error && inserted) {
      recordHistoryEvent(householdId, 'add_object', 'storage_entry', inserted.id, {
        item_name: data.item_name,
        location_description: data.location_description,
        place_id: data.place_id ?? undefined,
      })
      if (fieldValues) {
        await saveCustomFieldValues(inserted.id, fieldValues)
      }
    }
    setShowAddSheet(false)
  }

  async function saveCustomFieldValues(entryId: string, fieldValues: Record<string, unknown>) {
    const mapped: Record<string, { value_text?: string | null; value_number?: number | null; value_boolean?: boolean | null; value_option?: string | null; value_options?: string[] | null; value_date?: string | null }> = {}
    for (const field of customFields) {
      const val = fieldValues[field.id]
      const row: typeof mapped[string] = {}
      if (field.field_type === 'text') row.value_text = (val as string) ?? null
      else if (field.field_type === 'number') row.value_number = (val as number) ?? null
      else if (field.field_type === 'boolean') row.value_boolean = val != null ? (val as boolean) : null
      else if (field.field_type === 'select') row.value_option = (val as string) ?? null
      else if (field.field_type === 'multiselect') row.value_options = (val as string[]) ?? null
      else if (field.field_type === 'date') row.value_date = (val as string) ?? null
      mapped[field.id] = row
    }
    await saveEntryValues(entryId, mapped)
  }

  return (
    <div className="inventory">
      {/* Header — compact with inline count */}
      <div className="inventory__header">
        <div className="inventory__header-left">
          <h1 className="inventory__title">
            {ui('inventory.title', language)}
            {entries.length > 0 && (
              <span className="inventory__subtitle"> ({entries.length})</span>
            )}
          </h1>
        </div>
        <div className="inventory__header-right">
          <button
            className={`inventory__icon-btn ${showActivity ? 'inventory__icon-btn--active' : ''}`}
            onClick={() => setShowActivity(true)}
            aria-label={ui('activity.title', language)}
          >
            <History size={16} />
          </button>
          <button className="inventory__icon-btn" onClick={refetch} aria-label="Sync">
            <RefreshCw size={16} className={loading ? 'inventory__spin' : ''} />
          </button>
          <button
            className="inventory__icon-btn inventory__icon-btn--gold"
            aria-label="Add item"
            onClick={() => setShowAddSheet(true)}
          >
            <Plus size={16} color="var(--text-on-gold)" />
          </button>
        </div>
      </div>

      {/* Dashboard cards (when no filter active) */}
      {!filter && !searchQuery && (
        <DashboardCards stats={stats} language={language} />
      )}

      {/* Filter indicator */}
      {filter && (
        <div className="inventory__filter-bar">
          <span className="inventory__filter-text">
            {ui('inventory.filtered', language, {
              place: filter.place_id
                ? getPlacePath(filter.place_id)
                    .map((p) => p.label)
                    .join(' › ') ||
                  (filter.place_label ?? getPlaceById(filter.place_id)?.label ?? filter.place_id)
                : (filter.place_label ?? filter.location_description ?? ''),
            })}
          </span>
          <button className="inventory__filter-clear" onClick={onClearFilter}>
            <X size={12} />
            {ui('inventory.clear_filter', language)}
          </button>
        </div>
      )}

      {/* Search */}
      <div className="inventory__search">
        <Search size={16} color="var(--text-tertiary)" />
        <input
          type="text"
          placeholder={ui('inventory.search', language)}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="inventory__search-input"
        />
      </div>

      {/* Tabs */}
      <div className="inventory__tabs">
        <button
          className={`inventory__tab ${activeTab === 'place' ? 'inventory__tab--active' : ''}`}
          onClick={() => setActiveTab('place')}
        >
          {ui('inventory.by_room', language)}
        </button>
        <button
          className={`inventory__tab ${activeTab === 'recent' ? 'inventory__tab--active' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          {ui('inventory.recent', language)}
        </button>
      </div>

      {/* Filter chips */}
      {placeChipKeys.length > 0 && (
        <div className="inventory__chips">
          <span className="inventory__chip-label">{ui('search.filter_room', language)}</span>
          {placeChipKeys.map((key) => (
            <button
              key={key}
              className={`inventory__chip ${placeChipFilter === key ? 'inventory__chip--active' : ''}`}
              onClick={() => setPlaceChipFilter(placeChipFilter === key ? null : key)}
            >
              {key}
            </button>
          ))}
        </div>
      )}

      {/* Custom field filters */}
      {customFields.length > 0 && (
        <CustomFieldFilters
          fields={customFields}
          filters={customFilters}
          onChange={setCustomFilters}
        />
      )}

      {/* Filtered count */}
      {(customFilters.length > 0 || placeChipFilter || searchQuery) && filtered.length !== entries.length && (
        <div className="inventory__filtered-count">
          {ui('cf.filtered_count', language, { n: filtered.length, total: entries.length })}
        </div>
      )}

      {/* Items List */}
      <div className="inventory__list">
        {sections.map((section) => {
          const PlaceGroupIcon = getPlaceGroupIcon(section.key, places)
          return (
            <div key={section.key} className="inventory__section">
              {activeTab === 'place' && (
                <div className="inventory__section-header">
                  <div className="inventory__section-left">
                    <PlaceGroupIcon size={16} color="var(--gold-primary)" />
                    <span className="inventory__section-title">{section.label}</span>
                  </div>
                  <span className="inventory__section-count">
                    {itemCount(section.items.length)}
                  </span>
                </div>
              )}
              {section.items.map((entry) => {
                const ItemIcon = getItemIcon(entry.item_name)
                const thumbnailUrl = entry.photo_path
                  ? `${supabaseUrl}/storage/v1/object/public/item-photos/${entry.photo_path}`
                  : null
                return (
                  <div
                    key={entry.id}
                    className="inventory__item inventory__item--clickable"
                    onClick={() => setEditingEntry(entry)}
                  >
                    <div className="inventory__item-icon">
                      {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt="" className="inventory__item-thumb" />
                      ) : (
                        <ItemIcon size={16} color="var(--gold-primary)" />
                      )}
                    </div>
                    <div className="inventory__item-info">
                      <span className="inventory__item-name">{entry.item_name}</span>
                      <span className="inventory__item-loc">{getLocationDisplay(entry, getPlacePath)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
        {filtered.length === 0 && !loading && (
          <div className="inventory__empty">
            {entries.length === 0 && !searchQuery ? (
              <>
                <p className="inventory__empty-title">{ui('inventory.empty_welcome', language)}</p>
                <p className="inventory__empty-hint">{ui('inventory.empty_hint', language)}</p>
                <button
                  className="inventory__empty-cta"
                  onClick={() => setShowAddSheet(true)}
                >
                  <Plus size={16} />
                  {ui('add.title', language)}
                </button>
              </>
            ) : (
              <p>{ui('inventory.empty', language)}</p>
            )}
          </div>
        )}
      </div>

      {/* Activity slide-over panel */}
      {showActivity && (
        <>
          <div className="inventory__overlay" onClick={() => setShowActivity(false)} />
          <div className="inventory__activity-panel">
            <div className="inventory__activity-header">
              <h2 className="inventory__activity-title">{ui('activity.title', language)}</h2>
              <button className="inventory__icon-btn" onClick={() => setShowActivity(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="inventory__activity-body">
              <ActivityFeed householdId={householdId} />
            </div>
          </div>
        </>
      )}

      {/* Edit sheet */}
      {editingEntry && (
        <ItemEditSheet
          mode="edit"
          entry={editingEntry}
          householdId={householdId}
          customFields={customFields}
          customFieldValues={getEntryValues(editingEntry.id)}
          onCreateOption={createOption}
          onSave={handleSaveEdit}
          onDelete={handleDeleteEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {/* Add sheet */}
      {showAddSheet && (
        <ItemEditSheet
          mode="create"
          householdId={householdId}
          customFields={customFields}
          onCreateOption={createOption}
          onSave={handleCreateEntry}
          onClose={() => setShowAddSheet(false)}
        />
      )}
    </div>
  )
}
