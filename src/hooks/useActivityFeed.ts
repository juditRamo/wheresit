import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../supabaseClient'
import type { HistoryEventType, HistoryEntityType } from '../types'

export interface ActivityEntry {
  id: string
  event_type: HistoryEventType
  entity_type: HistoryEntityType
  entity_id: string
  entity_name: string | null
  payload: Record<string, unknown>
  created_at: string
  actor_id: string | null
}

export type EntityTypeFilter = 'all' | 'storage_entry' | 'place'
export type ActionFilter = 'all' | 'add' | 'move' | 'edit' | 'delete'

export interface ActivityDayGroup {
  dateKey: string
  label: string
  entries: ActivityEntry[]
}

interface UseActivityFeedOptions {
  householdId: string | null
  entityTypeFilter?: EntityTypeFilter
  actionFilter?: ActionFilter
  searchQuery?: string
  entityId?: string
  pageSize?: number
}

function mapRow(row: Record<string, unknown>): ActivityEntry {
  return {
    id: row.id as string,
    event_type: row.event_type as HistoryEventType,
    entity_type: row.entity_type as HistoryEntityType,
    entity_id: row.entity_id as string,
    entity_name: (row.entity_name as string) ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
    actor_id: row.actor_id as string | null,
  }
}

const ACTION_EVENT_MAP: Record<string, HistoryEventType[]> = {
  add: ['add_object', 'add_place'],
  move: ['move_object', 'move_place'],
  edit: ['edit_object', 'edit_place'],
  delete: ['delete_object', 'delete_place'],
}

export function useActivityFeed({
  householdId,
  entityTypeFilter = 'all',
  actionFilter = 'all',
  searchQuery = '',
  entityId,
  pageSize = 20,
}: UseActivityFeedOptions) {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const cursorRef = useRef<{ date: string; id: string } | null>(null)
  const trimmedSearch = searchQuery.trim()

  const fetchPage = useCallback(
    async (cursor: { date: string; id: string } | null) => {
      if (!householdId) return []

      let query = supabase
        .from('history_events')
        .select('id, event_type, entity_type, entity_id, entity_name, payload, created_at, actor_id')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(pageSize)

      if (entityId) {
        query = query.eq('entity_id', entityId)
      }

      if (entityTypeFilter !== 'all') {
        query = query.eq('entity_type', entityTypeFilter)
      }

      if (actionFilter !== 'all') {
        const types = ACTION_EVENT_MAP[actionFilter]
        if (types) query = query.in('event_type', types)
      }

      if (trimmedSearch) {
        query = query.ilike('entity_name', `%${trimmedSearch}%`)
      }

      if (cursor) {
        query = query.or(`created_at.lt.${cursor.date},and(created_at.eq.${cursor.date},id.lt.${cursor.id})`)
      }

      const { data, error } = await query
      if (error) { console.error('Failed to fetch activity feed:', error); return [] }
      if (!data) return []
      return data.map((r: Record<string, unknown>) => mapRow(r))
    },
    [householdId, entityTypeFilter, actionFilter, trimmedSearch, entityId, pageSize]
  )

  // Reset and fetch first page when filters change
  useEffect(() => {
    if (!householdId) {
      setActivities([])
      setHasMore(false)
      return
    }

    let cancelled = false
    setLoading(true)
    cursorRef.current = null

    fetchPage(null).then((rows) => {
      if (cancelled) return
      setActivities(rows)
      setHasMore(rows.length >= pageSize)
      if (rows.length > 0) {
        const last = rows[rows.length - 1]
        cursorRef.current = { date: last.created_at, id: last.id }
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [householdId, fetchPage, pageSize])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !cursorRef.current) return
    setLoading(true)
    const rows = await fetchPage(cursorRef.current)
    setActivities((prev) => [...prev, ...rows])
    setHasMore(rows.length >= pageSize)
    if (rows.length > 0) {
      const last = rows[rows.length - 1]
      cursorRef.current = { date: last.created_at, id: last.id }
    }
    setLoading(false)
  }, [loading, hasMore, fetchPage, pageSize])

  const refetch = useCallback(() => {
    if (!householdId) return
    setLoading(true)
    cursorRef.current = null
    fetchPage(null).then((rows) => {
      setActivities(rows)
      setHasMore(rows.length >= pageSize)
      if (rows.length > 0) {
        const last = rows[rows.length - 1]
        cursorRef.current = { date: last.created_at, id: last.id }
      }
      setLoading(false)
    })
  }, [householdId, fetchPage, pageSize])

  // Group activities by day
  const grouped: ActivityDayGroup[] = useMemo(() => {
    const groups: Map<string, ActivityEntry[]> = new Map()
    for (const a of activities) {
      const dateKey = a.created_at.slice(0, 10) // YYYY-MM-DD
      const existing = groups.get(dateKey)
      if (existing) {
        existing.push(a)
      } else {
        groups.set(dateKey, [a])
      }
    }
    return Array.from(groups.entries()).map(([dateKey, entries]) => ({
      dateKey,
      label: dateKey, // Will be localized by the component
      entries,
    }))
  }, [activities])

  return { activities, grouped, loading, hasMore, loadMore, refetch }
}
