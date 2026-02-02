import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import type { HouseholdTag } from '../types'

export function useHouseholdTags(householdId: string | null) {
  const [tags, setTags] = useState<HouseholdTag[]>([])

  const refetch = useCallback(() => {
    if (!householdId) return
    supabase
      .from('household_tags')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setTags([])
        else setTags(data ?? [])
      })
  }, [householdId])

  useEffect(() => {
    if (!householdId) {
      setTags([])
      return
    }
    refetch()
  }, [householdId, refetch])

  const saveTag = useCallback(
    async (tag: { tag_type: string; tag_key: string; label: string; parent_room_key?: string | null }) => {
      if (!householdId) return
      const { error } = await supabase.from('household_tags').upsert(
        {
          household_id: householdId,
          tag_type: tag.tag_type,
          tag_key: tag.tag_key,
          label: tag.label,
          parent_room_key: tag.parent_room_key ?? null,
        },
        { onConflict: 'household_id,tag_type,tag_key' }
      )
      if (!error) refetch()
    },
    [householdId, refetch]
  )

  const updateTag = useCallback(
    async (id: string, changes: Partial<{ label: string; parent_room_key: string | null }>) => {
      if (!householdId) return
      const { error } = await supabase
        .from('household_tags')
        .update(changes)
        .eq('id', id)
        .eq('household_id', householdId)
      if (!error) refetch()
    },
    [householdId, refetch]
  )

  const deleteTag = useCallback(
    async (id: string) => {
      if (!householdId) return
      const { error } = await supabase
        .from('household_tags')
        .delete()
        .eq('id', id)
        .eq('household_id', householdId)
      if (!error) refetch()
    },
    [householdId, refetch]
  )

  return { tags, saveTag, updateTag, deleteTag, refetch }
}
