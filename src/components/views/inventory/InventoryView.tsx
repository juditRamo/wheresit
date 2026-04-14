import { useState, useCallback, useEffect } from 'react'
import { useBackHandler } from '../../../hooks/useBackHandler'
import { useStorageEntries } from '../../../hooks/useStorageEntries'
import { usePlaces } from '../../../hooks/usePlaces'
import { useCustomFieldsContext } from '../../../hooks/CustomFieldsContext'
import { useLanguage } from '../../../i18n/LanguageContext'
import { ui } from '../../../i18n/ui'
import type { StorageEntry, LocationRef, CustomFieldValue, HistoryEntityType } from '../../../types'
import { ItemEditSheet } from '../../sheets/ItemEditSheet'
import { CustomFieldFilters } from '../../fields/CustomFieldFilters'
import type { CustomFieldFilter } from '../../fields/CustomFieldFilters'
import { useToast } from '../../../toast/ToastContext'
import { getPlaceGroupIcon, getLocationDisplay, getRootPlaceLabel, groupByPlace } from './helpers'
import { InventoryHeader } from './components/InventoryHeader'
import { InventoryFilterBar } from './components/InventoryFilterBar'
import { InventorySearch } from './components/InventorySearch'
import { InventoryTabs, type SortTab } from './components/InventoryTabs'
import { InventoryPlaceChips } from './components/InventoryPlaceChips'
import { InventoryFilteredCount } from './components/InventoryFilteredCount'
import { InventoryItemCard } from './components/InventoryItemCard'
import { InventoryEmptyState } from './components/InventoryEmptyState'
import './InventoryView.css'

interface InventoryViewProps {
  householdId: string
  filter?: LocationRef | null
  onClearFilter: () => void
  highlightEntity?: { type: HistoryEntityType; id: string } | null
  onClearHighlight?: () => void
}


export function InventoryView({ householdId, filter, onClearFilter, highlightEntity, onClearHighlight }: InventoryViewProps) {
  const { entries, loading, refetch } = useStorageEntries(householdId)
  const { getDescendantIds, getPlaceById, getPlacePath, places } = usePlaces(householdId)
  const { fields: customFields, valuesByEntry, optionLabelMap } = useCustomFieldsContext()
  const { language } = useLanguage()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<SortTab>('place')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingEntry, setEditingEntry] = useState<StorageEntry | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [placeChipFilter, setPlaceChipFilter] = useState<string | null>(null)
  const [customFilters, setCustomFilters] = useState<CustomFieldFilter[]>([])

  const handleSync = useCallback(async () => {
    await refetch()
    toast.info(ui('inventory.synced', language))
  }, [refetch, toast, language])

  // Scroll to and highlight entity when navigated from Activity tab
  useEffect(() => {
    if (!highlightEntity || highlightEntity.type !== 'storage_entry') return
    const el = document.querySelector(`[data-entity-id="${highlightEntity.id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('inventory__item--highlight')
      const timer = setTimeout(() => {
        el.classList.remove('inventory__item--highlight')
        onClearHighlight?.()
      }, 2000)
      return () => clearTimeout(timer)
    }
    onClearHighlight?.()
  }, [highlightEntity, onClearHighlight])

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

  return (
    <div className="inventory">
      <InventoryHeader
        totalCount={entries.length}
        loading={loading}
        onSync={handleSync}
        onAdd={() => setShowAddSheet(true)}
      />

      {filter && (
        <InventoryFilterBar
          filter={filter}
          getPlacePath={getPlacePath}
          getPlaceById={getPlaceById}
          onClear={onClearFilter}
        />
      )}

      <InventorySearch
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <InventoryTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <InventoryPlaceChips
        entries={entries}
        places={places}
        placeChipFilter={placeChipFilter}
        onChipChange={setPlaceChipFilter}
      />

      {customFields.length > 0 && (
        <CustomFieldFilters
          fields={customFields}
          filters={customFilters}
          onChange={setCustomFilters}
        />
      )}

      <InventoryFilteredCount
        filteredCount={filtered.length}
        totalCount={entries.length}
        hasActiveFilters={customFilters.length > 0 || !!placeChipFilter || !!searchQuery}
      />

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
              {section.items.map((entry) => (
                <InventoryItemCard
                  key={entry.id}
                  entry={entry}
                  getPlacePath={getPlacePath}
                  onClick={() => setEditingEntry(entry)}
                />
              ))}
            </div>
          )
        })}
        {filtered.length === 0 && !loading && (
          <InventoryEmptyState
            isWelcome={entries.length === 0 && !searchQuery}
            onAdd={() => setShowAddSheet(true)}
          />
        )}
      </div>

      {/* Edit sheet */}
      {editingEntry && (
        <ItemEditSheet
          mode="edit"
          entry={editingEntry}
          householdId={householdId}
          onSaved={() => { refetch(); setEditingEntry(null) }}
          onDeleted={() => { refetch(); setEditingEntry(null) }}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {/* Add sheet */}
      {showAddSheet && (
        <ItemEditSheet
          mode="create"
          householdId={householdId}
          onSaved={() => { refetch(); setShowAddSheet(false) }}
          onClose={() => setShowAddSheet(false)}
        />
      )}
    </div>
  )
}
