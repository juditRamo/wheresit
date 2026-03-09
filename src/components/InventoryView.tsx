import { useState, useEffect } from 'react'
import {
  Search,
  RefreshCw,
  Plus,
  X,
  Trash2,
  BedDouble,
  BookOpen,
  Watch,
  Key,
  Headphones,
  Package,
  Home,
  Utensils,
  Bath,
  Sofa,
  Car,
} from 'lucide-react'
import { useStorageEntries } from '../hooks/useStorageEntries'
import { usePlaces } from '../hooks/usePlaces'
import { useLanguage } from '../i18n/LanguageContext'
import { t, CATEGORIES } from '../i18n/picklists'
import { ui } from '../i18n/ui'
import { recordHistoryEvent } from '../lib/historyEvents'
import type { StorageEntry, LocationRef } from '../types'
import { ItemEditSheet } from './ItemEditSheet'
import { DashboardCards } from './DashboardCards'
import { ActivityFeed } from './ActivityFeed'
import './InventoryView.css'

interface InventoryViewProps {
  householdId: string
  filter?: LocationRef | null
  onClearFilter: () => void
  addItemTrigger?: number
}

type SortTab = 'room' | 'category' | 'recent' | 'activity'

const ROOM_ICONS: Record<string, typeof Home> = {
  bedroom: BedDouble,
  master_bedroom: BedDouble,
  kids_room: BedDouble,
  guest_room: BedDouble,
  kitchen: Utensils,
  bathroom: Bath,
  living_room: Sofa,
  dining_room: Utensils,
  garage: Car,
}

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

function getRoomIcon(roomKey: string) {
  const Icon = ROOM_ICONS[roomKey]
  if (Icon) return Icon
  const lower = roomKey.toLowerCase()
  for (const [keyword, Ic] of Object.entries(ROOM_ICONS)) {
    if (lower.includes(keyword)) return Ic
  }
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

function groupByCategory(entries: StorageEntry[], lang: 'en' | 'es'): Record<string, { key: string; entries: StorageEntry[] }> {
  const groups: Record<string, { key: string; entries: StorageEntry[] }> = {}
  for (const entry of entries) {
    const catKey = entry.category_key ?? 'misc'
    if (!groups[catKey]) groups[catKey] = { key: catKey, entries: [] }
    groups[catKey].entries.push(entry)
    void t(CATEGORIES, catKey, lang)
  }
  return groups
}

export function InventoryView({ householdId, filter, onClearFilter, addItemTrigger }: InventoryViewProps) {
  const { entries, loading, refetch, updateEntry, deleteEntry, createEntry, stats } = useStorageEntries(householdId)
  const { getDescendantIds, getPlaceById, getPlacePath, places } = usePlaces(householdId)
  const { language } = useLanguage()
  const [activeTab, setActiveTab] = useState<SortTab>('room')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingEntry, setEditingEntry] = useState<StorageEntry | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)

  useEffect(() => {
    if (addItemTrigger != null && addItemTrigger > 0) {
      setShowAddSheet(true)
    }
  }, [addItemTrigger])

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

  // Apply search query
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(
      (e) =>
        e.item_name.toLowerCase().includes(q) ||
        getLocationDisplay(e, getPlacePath).toLowerCase().includes(q)
    )
  }

  const itemCount = (n: number) =>
    n === 1 ? ui('inventory.item_one', language) : ui('inventory.item_other', language, { n })

  let sections: Array<{ label: string; key: string; items: StorageEntry[] }>

  if (activeTab === 'room') {
    const groups = groupByPlace(filtered, places)
    sections = Object.entries(groups).map(([, g]) => ({
      key: g.key,
      label: g.label || ui('inventory.other_room', language),
      items: g.entries,
    }))
  } else if (activeTab === 'category') {
    const groups = groupByCategory(filtered, language)
    sections = Object.entries(groups).map(([, g]) => ({
      key: g.key,
      label: t(CATEGORIES, g.key, language) || ui('inventory.uncategorized', language),
      items: g.entries,
    }))
  } else if (activeTab === 'recent') {
    sections = [{ key: 'all', label: '', items: filtered }]
  } else {
    sections = []
  }

  async function handleSaveEdit(data: {
    item_name: string
    category_key: string | null
    location_description: string
    photo_path?: string | null
    place_id?: string | null
  }) {
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
    category_key: string | null
    location_description: string
    photo_path?: string | null
    place_id?: string | null
  }) {
    const { data: inserted, error } = await createEntry(data)
    if (!error && inserted) {
      recordHistoryEvent(householdId, 'add_object', 'storage_entry', inserted.id, {
        item_name: data.item_name,
        location_description: data.location_description,
        place_id: data.place_id ?? undefined,
      })
    }
    setShowAddSheet(false)
  }

  return (
    <div className="inventory">
      {/* Header */}
      <div className="inventory__header">
        <div className="inventory__header-left">
          <h1 className="inventory__title">{ui('inventory.title', language)}</h1>
          <span className="inventory__subtitle">
            {entries.length === 1
              ? ui('inventory.subtitle_one', language)
              : ui('inventory.subtitle_other', language, { n: entries.length })}
          </span>
        </div>
        <div className="inventory__header-right">
          <button className="inventory__icon-btn" onClick={refetch} aria-label="Sync">
            <RefreshCw size={14} className={loading ? 'inventory__spin' : ''} />
          </button>
          <button
            className="inventory__icon-btn inventory__icon-btn--gold"
            aria-label="Add item"
            onClick={() => setShowAddSheet(true)}
          >
            <Plus size={14} color="var(--text-on-gold)" />
          </button>
        </div>
      </div>

      {/* Dashboard cards (when no filter active) */}
      {!filter && !searchQuery && activeTab !== 'activity' && (
        <DashboardCards stats={stats} language={language} />
      )}

      {/* Filter indicator */}
      {filter && (
        <div className="inventory__filter-bar">
          <span className="inventory__filter-text">
            {ui('inventory.filtered', language, {
              room: filter.place_id
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
          className={`inventory__tab ${activeTab === 'room' ? 'inventory__tab--active' : ''}`}
          onClick={() => setActiveTab('room')}
        >
          {ui('inventory.by_room', language)}
        </button>
        <button
          className={`inventory__tab ${activeTab === 'category' ? 'inventory__tab--active' : ''}`}
          onClick={() => setActiveTab('category')}
        >
          {ui('inventory.by_category', language)}
        </button>
        <button
          className={`inventory__tab ${activeTab === 'recent' ? 'inventory__tab--active' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          {ui('inventory.recent', language)}
        </button>
        <button
          className={`inventory__tab ${activeTab === 'activity' ? 'inventory__tab--active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          {ui('activity.title', language)}
        </button>
      </div>

      {/* Activity Feed tab */}
      {activeTab === 'activity' ? (
        <ActivityFeed householdId={householdId} />
      ) : (
        /* Items List */
        <div className="inventory__list">
          {sections.map((section) => {
            const RoomIcon = getRoomIcon(section.label)
            return (
              <div key={section.key} className="inventory__section">
                {(activeTab === 'room' || activeTab === 'category') && (
                  <div className="inventory__section-header">
                    <div className="inventory__section-left">
                      <RoomIcon size={16} color="var(--gold-primary)" />
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
                      {entry.category_key && (
                        <span className="inventory__item-badge">
                          {t(CATEGORIES, entry.category_key, language)}
                        </span>
                      )}
                      <button
                        className="inventory__item-delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingEntry(entry)
                          // Will trigger delete confirm in edit sheet
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
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
      )}

      {/* Edit sheet */}
      {editingEntry && (
        <ItemEditSheet
          mode="edit"
          entry={editingEntry}
          householdId={householdId}
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
          onSave={handleCreateEntry}
          onClose={() => setShowAddSheet(false)}
        />
      )}
    </div>
  )
}
