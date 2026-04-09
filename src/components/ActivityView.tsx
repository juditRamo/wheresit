import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, Package, Plus, ArrowRight, Pencil, X, type LucideIcon } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useActivityFeed, type EntityTypeFilter, type ActionFilter, type ActivityEntry } from '../hooks/useActivityFeed'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import { getPlaceIcon } from '../lib/placeIcons'
import type { HistoryEventType, HistoryEntityType } from '../types'
import './ActivityView.css'

interface ActivityViewProps {
  householdId: string
  onNavigateToEntity: (entityType: HistoryEntityType, entityId: string) => void
}

function formatDateLabel(dateKey: string, lang: 'en' | 'es'): string {
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)

  if (dateKey === todayKey) return ui('activity.today', lang)
  if (dateKey === yesterdayKey) return ui('activity.yesterday', lang)

  const d = new Date(dateKey + 'T00:00:00')
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
    month: 'long',
    day: 'numeric',
  })
}

function timeAgo(dateStr: string, lang: 'en' | 'es'): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return ui('activity.ago', lang, { time: ui('activity.minutes', lang, { n: Math.max(1, minutes) }) })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return ui('activity.ago', lang, { time: ui('activity.hours', lang, { n: hours }) })
  const days = Math.floor(hours / 24)
  if (days < 7) return ui('activity.ago', lang, { time: ui('activity.days', lang, { n: days }) })
  const d = new Date(dateStr)
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })
}

function getLocationFromPayload(payload: Record<string, unknown>, eventType: HistoryEventType): string {
  if (eventType === 'move_object' && payload.to && typeof payload.to === 'object') {
    const to = payload.to as Record<string, unknown>
    return (to.location_description as string) ?? '—'
  }
  if (eventType === 'add_object') {
    return (payload.location_description as string) ?? '—'
  }
  return '—'
}

const ACTION_BADGE_ICON: Record<string, LucideIcon> = {
  add_object: Plus,
  move_object: ArrowRight,
  edit_object: Pencil,
  delete_object: X,
  add_place: Plus,
  move_place: ArrowRight,
  edit_place: Pencil,
  delete_place: X,
}

// Map legacy DB column names to human-readable labels (for old events before i18n field names)
const LEGACY_FIELD_LABELS: Record<string, { en: string; es: string }> = {
  item_name: { en: 'Name', es: 'Nombre' },
  photo_path: { en: 'Photo', es: 'Foto' },
  label: { en: 'Name', es: 'Nombre' },
  icon: { en: 'Icon', es: 'Icono' },
  location_description: { en: 'Location', es: 'Ubicación' },
}

function DiffLines({ changes, language }: { changes: Record<string, unknown>; language: 'en' | 'es' }) {
  const entries = Object.entries(changes)
  if (entries.length === 0) return null

  return (
    <div className="activity-view__diff">
      {entries.map(([field, value]) => {
        if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
          const { from, to } = value as { from: unknown; to: unknown }
          const fromStr = from != null ? String(from) : ''
          const toStr = to != null ? String(to) : ''
          const fieldLabel = LEGACY_FIELD_LABELS[field]?.[language] ?? field
          if (!fromStr && toStr) {
            return <div key={field} className="activity-view__diff-line">{fieldLabel}: <span className="activity-view__diff-add">{toStr}</span></div>
          }
          if (fromStr && !toStr) {
            return <div key={field} className="activity-view__diff-line">{fieldLabel}: <span className="activity-view__diff-remove">{fromStr}</span></div>
          }
          return (
            <div key={field} className="activity-view__diff-line">
              {fieldLabel}: <span className="activity-view__diff-remove">{fromStr}</span> → <span className="activity-view__diff-add">{toStr}</span>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

const EVENT_TEXT_CONFIG: Record<HistoryEventType, {
  en: string; es: string
  prep?: { en: string; es: string }
}> = {
  add_object:    { en: 'added',         es: 'añadió',        prep: { en: 'at', es: 'en' } },
  move_object:   { en: 'moved',         es: 'movió',         prep: { en: 'to', es: 'a' } },
  edit_object:   { en: 'edited',        es: 'editó' },
  delete_object: { en: 'deleted',       es: 'eliminó' },
  add_place:     { en: 'added place',   es: 'añadió lugar' },
  move_place:    { en: 'moved',         es: 'movió',         prep: { en: 'to', es: 'a' } },
  edit_place:    { en: 'edited place',  es: 'editó lugar' },
  delete_place:  { en: 'deleted place', es: 'eliminó lugar' },
}

function EventText({
  entry,
  language,
  actorName,
}: {
  entry: ActivityEntry
  language: 'en' | 'es'
  actorName: string
}) {
  const payload = entry.payload
  const itemName = (payload.item_name as string) ?? '?'
  const label = (payload.label as string) ?? '?'
  const location = getLocationFromPayload(payload, entry.event_type)
  const isPlace = entry.entity_type === 'place'
  const entityName = isPlace ? label : itemName

  const nameSpan = (
    <strong className={isPlace ? 'activity-view__place-name' : 'activity-view__entity-name'}>{entityName}</strong>
  )

  const config = EVENT_TEXT_CONFIG[entry.event_type]
  const verb = config[language]

  if (config.prep) {
    const locSpan = location && location !== '—'
      ? <span className="activity-view__location">{location}</span>
      : <>{location || '—'}</>
    return <>{actorName} {verb} {nameSpan} {config.prep[language]} {locSpan}</>
  }

  return <>{actorName} {verb} {nameSpan}</>
}

function ActivityEventRow({
  entry,
  language,
  actorName,
  isDeleted,
  placeIconId,
  onTap,
}: {
  entry: ActivityEntry
  language: 'en' | 'es'
  actorName: string
  isDeleted: boolean
  placeIconId: string | null
  onTap: () => void
}) {
  const isDeleteEvent = entry.event_type === 'delete_object' || entry.event_type === 'delete_place'
  const disabled = isDeleteEvent || isDeleted
  const changes = (entry.payload.changes as Record<string, unknown>) ?? null
  const isEdit = entry.event_type === 'edit_object' || entry.event_type === 'edit_place'

  // Determine entity icon
  const isPlace = entry.entity_type === 'place'
  const EntityIcon = isPlace ? getPlaceIcon(placeIconId ?? 'map-pin') : Package
  const BadgeIcon = ACTION_BADGE_ICON[entry.event_type] ?? Plus

  return (
    <div
      className={`activity-view__row ${disabled ? 'activity-view__row--disabled' : 'activity-view__row--tappable'}`}
      onClick={disabled ? undefined : onTap}
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      onKeyDown={disabled ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } }}
    >
      <div className="activity-view__icon-bubble">
        <EntityIcon size={18} className="activity-view__icon-bubble-icon" />
        <span className="activity-view__action-badge"><BadgeIcon size={10} /></span>
      </div>
      <div className="activity-view__row-body">
        <div className="activity-view__row-text">
          <EventText entry={entry} language={language} actorName={actorName} />
        </div>
        {isEdit && changes && <DiffLines changes={changes} language={language} />}
        <div className="activity-view__row-time">{timeAgo(entry.created_at, language)}</div>
      </div>
    </div>
  )
}

const ENTITY_FILTERS: { value: EntityTypeFilter; labelKey: string }[] = [
  { value: 'storage_entry', labelKey: 'activity.filter_objects' },
  { value: 'place', labelKey: 'activity.filter_places' },
]

const ACTION_FILTERS: { value: ActionFilter; labelKey: string }[] = [
  { value: 'add', labelKey: 'activity.filter_added' },
  { value: 'move', labelKey: 'activity.filter_moved' },
  { value: 'edit', labelKey: 'activity.filter_edited' },
  { value: 'delete', labelKey: 'activity.filter_deleted' },
]

export function ActivityView({ householdId, onNavigateToEntity }: ActivityViewProps) {
  const { language } = useLanguage()
  const [entityFilter, setEntityFilter] = useState<EntityTypeFilter>('all')
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { grouped, loading, hasMore, loadMore } = useActivityFeed({
    householdId,
    entityTypeFilter: entityFilter,
    actionFilter,
    searchQuery: debouncedSearch,
  })

  // Fetch actor display names
  const [actorNames, setActorNames] = useState<Record<string, string>>({})
  const actorIds = useMemo(() => {
    const ids = new Set<string>()
    for (const g of grouped) for (const e of g.entries) if (e.actor_id) ids.add(e.actor_id)
    return [...ids]
  }, [grouped])

  useEffect(() => {
    if (actorIds.length === 0) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', actorIds)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error('Failed to fetch actor names:', error); return }
        const map: Record<string, string> = {}
        for (const p of data ?? []) {
          if (p.display_name) map[p.id] = p.display_name
        }
        setActorNames((prev) => ({ ...prev, ...map }))
      })
    return () => { cancelled = true }
  }, [actorIds])

  // Fetch place icons for place events
  const [placeIcons, setPlaceIcons] = useState<Record<string, string>>({})
  const placeEntityIds = useMemo(() => {
    const ids = new Set<string>()
    for (const g of grouped) {
      for (const e of g.entries) {
        if (e.entity_type === 'place') ids.add(e.entity_id)
      }
    }
    return [...ids]
  }, [grouped])

  useEffect(() => {
    if (placeEntityIds.length === 0) return
    let cancelled = false

    // First, extract icons from add_place payloads (they include the icon field)
    const fromPayloads: Record<string, string> = {}
    for (const g of grouped) {
      for (const e of g.entries) {
        if (e.event_type === 'add_place' && e.payload.icon) {
          fromPayloads[e.entity_id] = e.payload.icon as string
        }
      }
    }

    // Fetch remaining from places table
    const missingIds = placeEntityIds.filter((id) => !fromPayloads[id])
    if (missingIds.length === 0) {
      if (!cancelled) setPlaceIcons((prev) => ({ ...prev, ...fromPayloads }))
      return
    }

    supabase
      .from('places')
      .select('id, icon')
      .in('id', missingIds)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error('Failed to fetch place icons:', error); return }
        const map: Record<string, string> = { ...fromPayloads }
        for (const p of data ?? []) {
          if (p.icon) map[p.id] = p.icon
        }
        setPlaceIcons((prev) => ({ ...prev, ...map }))
      })
    return () => { cancelled = true }
  }, [placeEntityIds, grouped])

  // Collect IDs of deleted entities (events with delete_* type)
  const deletedEntityIds = useMemo(() => {
    const ids = new Set<string>()
    for (const g of grouped) {
      for (const e of g.entries) {
        if (e.event_type === 'delete_object' || e.event_type === 'delete_place') {
          ids.add(e.entity_id)
        }
      }
    }
    return ids
  }, [grouped])

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || loading || !hasMore) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      loadMore()
    }
  }, [loading, hasMore, loadMore])

  const isEmpty = !loading && grouped.length === 0
  const hasFilters = entityFilter !== 'all' || actionFilter !== 'all' || debouncedSearch.length > 0

  return (
    <div className="activity-view">
      <div className="activity-view__header">
        <h1 className="activity-view__title">{ui('activity.title', language)}</h1>
      </div>

      {/* Search bar */}
      <div className="activity-view__search">
        <Search size={14} className="activity-view__search-icon" />
        <input
          type="text"
          className="activity-view__search-input"
          placeholder={ui('activity.search', language)}
          aria-label={ui('activity.search', language)}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {/* Filter chips */}
      <div className="activity-view__filters">
        <div className="activity-view__filter-row">
          <span className="activity-view__filter-label">{ui('activity.filter_type_label', language)}</span>
          {ENTITY_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`activity-view__chip ${entityFilter === f.value ? 'activity-view__chip--active' : ''}`}
              onClick={() => setEntityFilter(entityFilter === f.value ? 'all' : f.value)}
            >
              {ui(f.labelKey, language)}
            </button>
          ))}
          {entityFilter !== 'all' && (
            <button className="activity-view__filter-clear" onClick={() => setEntityFilter('all')} aria-label="Clear">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="activity-view__filter-row">
          <span className="activity-view__filter-label">{ui('activity.filter_action_label', language)}</span>
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`activity-view__chip ${actionFilter === f.value ? 'activity-view__chip--active' : ''}`}
              onClick={() => setActionFilter(actionFilter === f.value ? 'all' : f.value)}
            >
              {ui(f.labelKey, language)}
            </button>
          ))}
          {actionFilter !== 'all' && (
            <button className="activity-view__filter-clear" onClick={() => setActionFilter('all')} aria-label="Clear">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="activity-view__feed" ref={scrollRef} onScroll={handleScroll}>
        {grouped.map((group) => (
          <div key={group.dateKey} className="activity-view__day">
            <div className="activity-view__day-header">{formatDateLabel(group.dateKey, language)}</div>
            {group.entries.map((entry) => (
              <ActivityEventRow
                key={entry.id}
                entry={entry}
                language={language}
                actorName={entry.actor_id ? (actorNames[entry.actor_id] ?? entry.actor_id.slice(0, 8)) : '?'}
                isDeleted={deletedEntityIds.has(entry.entity_id)}
                placeIconId={entry.entity_type === 'place' ? (placeIcons[entry.entity_id] ?? null) : null}
                onTap={() => onNavigateToEntity(entry.entity_type, entry.entity_id)}
              />
            ))}
          </div>
        ))}

        {loading && (
          <div className="activity-view__loading">
            <span className="activity-view__spinner" />
          </div>
        )}

        {isEmpty && (
          <div className="activity-view__empty">
            <p>{ui(hasFilters ? 'activity.empty_filtered' : 'activity.empty', language)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
