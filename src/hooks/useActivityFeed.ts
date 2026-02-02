import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

export interface ActivityEntry {
  id: string
  entry_id: string
  room_key: string | null
  spot_key: string | null
  spot_detail: string | null
  location_description: string
  moved_by: string | null
  moved_at: string
  // joined
  item_name?: string
  user_email?: string
}

export function useActivityFeed(householdId: string | null) {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(() => {
    if (!householdId) return
    setLoading(true)

    // Fetch location_history joined with storage_entries for item name
    supabase
      .from('location_history')
      .select('*, storage_entries(item_name)')
      .eq('household_id', householdId)
      .order('moved_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        setLoading(false)
        if (error || !data) {
          setActivities([])
          return
        }
        const mapped: ActivityEntry[] = data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          entry_id: row.entry_id as string,
          room_key: row.room_key as string | null,
          spot_key: row.spot_key as string | null,
          spot_detail: row.spot_detail as string | null,
          location_description: row.location_description as string,
          moved_by: row.moved_by as string | null,
          moved_at: row.moved_at as string,
          item_name: (row.storage_entries as Record<string, unknown> | null)?.item_name as string | undefined,
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
