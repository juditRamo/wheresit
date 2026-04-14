import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../supabaseClient'
import { useActivityFeed, type EntityTypeFilter, type ActionFilter } from '../../../hooks/useActivityFeed'
import { useLanguage } from '../../../i18n/LanguageContext'
import { ui } from '../../../i18n/ui'
import type { HistoryEntityType } from '../../../types'
import { ActivitySearchBar } from './components/ActivitySearchBar'
import { ActivityFilterChips } from './components/ActivityFilterChips'
import { ActivityFeed } from './components/ActivityFeed'
import './ActivityView.css'

interface ActivityViewProps {
  householdId: string
  onNavigateToEntity: (entityType: HistoryEntityType, entityId: string) => void
}

export function ActivityView({ householdId, onNavigateToEntity }: ActivityViewProps) {
  const { language } = useLanguage()
  const [entityFilter, setEntityFilter] = useState<EntityTypeFilter>('all')
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

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

  const hasFilters = entityFilter !== 'all' || actionFilter !== 'all' || debouncedSearch.length > 0

  return (
    <div className="activity-view">
      <div className="activity-view__header">
        <h1 className="activity-view__title">{ui('activity.title', language)}</h1>
      </div>

      <ActivitySearchBar searchInput={searchInput} onSearchChange={setSearchInput} />

      <ActivityFilterChips
        entityFilter={entityFilter}
        actionFilter={actionFilter}
        onEntityFilterChange={setEntityFilter}
        onActionFilterChange={setActionFilter}
      />

      <ActivityFeed
        grouped={grouped}
        loading={loading}
        hasMore={hasMore}
        loadMore={loadMore}
        actorNames={actorNames}
        deletedEntityIds={deletedEntityIds}
        placeIcons={placeIcons}
        hasFilters={hasFilters}
        onNavigateToEntity={onNavigateToEntity}
      />
    </div>
  )
}
