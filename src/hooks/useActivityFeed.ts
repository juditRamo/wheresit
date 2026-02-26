import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import type { HistoryEventType } from '../types'

export interface ActivityEntry {
  id: string
  event_type: HistoryEventType
  entity_type: 'place' | 'storage_entry'
  entity_id: string
  payload: Record<string, unknown>
  created_at: string
  actor_id: string | null
}

export function useActivityFeed(householdId: string | null) {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(() => {
    if (!householdId) return
    setLoading(true)
    supabase
      .from('history_events')
      .select('id, event_type, entity_type, entity_id, payload, created_at, actor_id')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        setLoading(false)
        if (error || !data) {
          setActivities([])
          return
        }
        const mapped: ActivityEntry[] = data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          event_type: row.event_type as HistoryEventType,
          entity_type: row.entity_type as 'place' | 'storage_entry',
          entity_id: row.entity_id as string,
          payload: (row.payload as Record<string, unknown>) ?? {},
          created_at: row.created_at as string,
          actor_id: row.actor_id as string | null,
        }))
        setActivities(mapped)
      })
  }, [householdId])

  useEffect(() => {
    if (!householdId) {
      setActivities([])
      return
    }
    refetch()
  }, [householdId, refetch])

  return { activities, loading, refetch }
}
