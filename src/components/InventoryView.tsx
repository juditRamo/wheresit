import { useState } from 'react'
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
import { useHouseholdTags } from '../hooks/useHouseholdTags'
import { useLanguage } from '../i18n/LanguageContext'
import { t, ROOMS, SPOTS, SPOT_DETAILS, CATEGORIES } from '../i18n/picklists'
import { ui } from '../i18n/ui'
import type { StorageEntry, LocationRef } from '../types'
import { ItemEditSheet } from './ItemEditSheet'
import { DashboardCards } from './DashboardCards'
import { ActivityFeed } from './ActivityFeed'
import './InventoryView.css'

interface InventoryViewProps {
  householdId: string
  filter?: LocationRef | null
  onClearFilter: () => void
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

function buildLocationDisplay(entry: StorageEntry, lang: 'en' | 'es'): string {
  if (entry.room_key) {
    const parts: string[] = []
    const room = t(ROOMS, entry.room_key, lang)
    if (room) parts.push(room)
    const spot = t(SPOTS, entry.spot_key, lang)
    if (spot) parts.push(spot)
    const detail = t(SPOT_DETAILS, entry.spot_detail, lang)
    if (detail) parts.push(detail)
    return parts.join(' \u203A ')
  }
  return entry.location_description
}

function groupByRoom(entries: StorageEntry[], lang: 'en' | 'es'): Record<string, { key: string; entries: StorageEntry[] }> {
  const groups: Record<string, { key: string; entries: StorageEntry[] }> = {}
  for (const entry of entries) {
    const roomKey = entry.room_key ?? 'other'
    const label = t(ROOMS, roomKey, lang) || ui('inventory.other_room', lang)
    if (!groups[roomKey]) groups[roomKey] = { key: roomKey, entries: [] }
    groups[roomKey].entries.push(entry)
    void label
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

export function InventoryView({ householdId, filter, onClearFilter }: InventoryViewProps) {
  const { entries, loading, refetch, updateEntry, deleteEntry, createEntry, stats } = useStorageEntries(householdId)
  const { tags: householdTags } = useHouseholdTags(householdId)
  const { language } = useLanguage()
  const [activeTab, setActiveTab] = useState<SortTab>('room')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingEntry, setEditingEntry] = useState<StorageEntry | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)

  // Apply location filter if set
  let filtered = filter
    ? entries.filter((e) => {
        const roomMatch = e.room_key === filter.room_key || (!e.room_key && e.location_description === filter.room_key)
        if (!roomMatch) return false
        if (filter.spot_key) return e.spot_key === filter.spot_key
        return true
      })
    : entries

  // Apply search query
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(
      (e) =>
        e.item_name.toLowerCase().includes(q) ||
        buildLocationDisplay(e, language).toLowerCase().includes(q)
    )
  }

  const itemCount = (n: number) =>
    n === 1 ? ui('inventory.item_one', language) : ui('inventory.item_other', language, { n })

  let sections: Array<{ label: string; key: string; items: StorageEntry[] }>

  if (activeTab === 'room') {
    const groups = groupByRoom(filtered, language)
    sections = Object.entries(groups).map(([, g]) => ({
      key: g.key,
      label: t(ROOMS, g.key, language) || ui('inventory.other_room', language),
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
    room_key: string | null
    spot_key: string | null
    spot_detail: string | null
    category_key: string | null
    location_description: string
    photo_path?: string | null
  }) {
    if (editingEntry) {
      await updateEntry(editingEntry.id, data)
      setEditingEntry(null)
    }
  }

  async function handleDeleteEntry() {
    if (editingEntry) {
      await deleteEntry(editingEntry.id)
      setEditingEntry(null)
    }
  }

  async function handleCreateEntry(data: {
    item_name: string
    room_key: string | null
    spot_key: string | null
    spot_detail: string | null
    category_key: string | null
    location_description: string
    photo_path?: string | null
  }) {
    await createEntry(data)
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
            {filter.spot_key
              ? ui('inventory.filtered_spot', language, {
                  room: t(ROOMS, filter.room_key, language) || filter.room_key,
                  spot: t(SPOTS, filter.spot_key, language) || filter.spot_key,
                })
              : ui('inventory.filtered', language, { room: t(ROOMS, filter.room_key, language) || filter.room_key })}
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
            const RoomIcon = getRoomIcon(section.key)
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
                        <span className="inventory__item-loc">{buildLocationDisplay(entry, language)}</span>
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
              <p>{ui('inventory.empty', language)}</p>
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
          householdTags={householdTags}
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
          householdTags={householdTags}
          onSave={handleCreateEntry}
          onClose={() => setShowAddSheet(false)}
        />
      )}
    </div>
  )
}
