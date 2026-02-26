import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import type { StorageEntry } from '../types'

export function useStorageEntries(householdId: string | null) {
  const [entries, setEntries] = useState<StorageEntry[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(() => {
    if (!householdId) return
    setLoading(true)
    supabase
      .from('storage_entries')
      .select('*')
      .eq('household_id', householdId)
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        setLoading(false)
        if (error) setEntries([])
        else setEntries(data ?? [])
      })
  }, [householdId])

  useEffect(() => {
    if (!householdId) {
      setEntries([])
      return
    }
    refetch()
  }, [householdId, refetch])

  // When place_id is set, the DB derives location_description from the place hierarchy (see sync_storage_entry_location_description trigger).
  const updateEntry = useCallback(
    async (id: string, data: Partial<Pick<StorageEntry, 'item_name' | 'room_key' | 'spot_key' | 'spot_detail' | 'category_key' | 'location_description' | 'photo_path' | 'place_id'>>) => {
      const { error } = await supabase
        .from('storage_entries')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (!error) refetch()
      return { error }
    },
    [refetch]
  )

  const deleteEntry = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('storage_entries')
        .delete()
        .eq('id', id)
      if (!error) refetch()
      return { error }
    },
    [refetch]
  )

  const createEntry = useCallback(
    async (data: {
      item_name: string
      room_key: string | null
      spot_key: string | null
      spot_detail: string | null
      category_key: string | null
      location_description: string
      photo_path?: string | null
      place_id?: string | null
    }) => {
      if (!householdId) return { error: new Error('No household') }
      const { data: session } = await supabase.auth.getSession()
      const userId = session?.session?.user?.id ?? null
      const { error } = await supabase
        .from('storage_entries')
        .insert({
          household_id: householdId,
          ...data,
          created_by: userId,
        })
      if (!error) refetch()
      return { error }
    },
    [householdId, refetch]
  )

  // Computed stats for dashboard
  const stats = useMemo(() => {
    const now = Date.now()
    const DAY = 86400000
    const totalItems = entries.length

    // Items per location (first segment of path or "other")
    const locationCounts: Record<string, number> = {}
    for (const e of entries) {
      const key = e.location_description?.split(' › ')[0] ?? 'other'
      locationCounts[key] = (locationCounts[key] ?? 0) + 1
    }
    const topRooms = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    const mostPopulatedRoom = topRooms[0]?.[0] ?? null

    // Forgotten items (not updated in 90+ days)
    const forgotten = entries.filter(
      (e) => now - new Date(e.updated_at).getTime() > 90 * DAY
    )

    // Recently moved (updated in last 7 days)
    const recentlyMoved = entries.filter(
      (e) => now - new Date(e.updated_at).getTime() < 7 * DAY
    )

    return {
      totalItems,
      topRooms,
      mostPopulatedRoom,
      forgottenCount: forgotten.length,
      recentlyMovedCount: recentlyMoved.length,
      forgottenEntries: forgotten,
    }
  }, [entries])

  return { entries, loading, refetch, updateEntry, deleteEntry, createEntry, stats }
}
