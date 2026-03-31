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
    async (id: string, data: Partial<Pick<StorageEntry, 'item_name' | 'location_description' | 'photo_path' | 'place_id'>>) => {
      const { error } = await supabase
        .from('storage_entries')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (!error) refetch()
      return { error }
    },
    [refetch]
  )

  const deletePhoto = useCallback(async (photoPath: string) => {
    await supabase.storage.from('item-photos').remove([photoPath])
  }, [])

  const deleteEntry = useCallback(
    async (id: string, photoPath?: string | null) => {
      if (photoPath) await deletePhoto(photoPath)
      const { error } = await supabase
        .from('storage_entries')
        .delete()
        .eq('id', id)
      if (!error) refetch()
      return { error }
    },
    [refetch, deletePhoto]
  )

  const createEntry = useCallback(
    async (data: {
      item_name: string
      location_description: string
      photo_path?: string | null
      place_id?: string | null
    }) => {
      if (!householdId) return { data: null, error: new Error('No household') }
      const { data: session } = await supabase.auth.getSession()
      const userId = session?.session?.user?.id ?? null
      const { data: inserted, error } = await supabase
        .from('storage_entries')
        .insert({
          household_id: householdId,
          ...data,
          created_by: userId,
        })
        .select('id')
        .single()
      if (!error) refetch()
      return { data: inserted as { id: string } | null, error }
    },
    [householdId, refetch]
  )

  // Computed stats for dashboard
  const stats = useMemo(() => {
    const now = Date.now()
    const DAY = 86400000
    const totalItems = entries.length

    // Distinct places with items
    const placesUsed = new Set(entries.map(e => e.place_id).filter(Boolean)).size

    // Items with photos
    const withPhotos = entries.filter(e => e.photo_path).length

    // Recently moved (updated in last 7 days)
    const recentlyMoved = entries.filter(
      (e) => now - new Date(e.updated_at).getTime() < 7 * DAY
    )

    return {
      totalItems,
      placesUsed,
      withPhotos,
      recentlyMovedCount: recentlyMoved.length,
    }
  }, [entries])

  return { entries, loading, refetch, updateEntry, deleteEntry, deletePhoto, createEntry, stats }
}
