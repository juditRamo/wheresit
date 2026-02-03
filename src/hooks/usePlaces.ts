import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import type { Place } from '../types'

export interface PlaceWithChildren extends Place {
  children: PlaceWithChildren[]
}

export function usePlaces(householdId: string | null) {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(() => {
    if (!householdId) return
    setLoading(true)
    supabase
      .from('places')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        setLoading(false)
        if (error) setPlaces([])
        else setPlaces(data ?? [])
      })
  }, [householdId])

  useEffect(() => {
    if (!householdId) {
      setPlaces([])
      return
    }
    refetch()
  }, [householdId, refetch])

  const placeTree = useMemo((): PlaceWithChildren[] => {
    const byId = new Map<string, PlaceWithChildren>()
    for (const p of places) {
      byId.set(p.id, { ...p, attributes: p.attributes ?? {}, children: [] })
    }
    const roots: PlaceWithChildren[] = []
    for (const p of byId.values()) {
      const node = p as PlaceWithChildren
      if (p.parent_place_id) {
        const parent = byId.get(p.parent_place_id)
        if (parent) parent.children.push(node)
        else roots.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  }, [places])

  const createPlace = useCallback(
    async (data: {
      type: string
      label: string
      parent_place_id?: string | null
      attributes?: Record<string, string>
      canonical_key?: string | null
    }) => {
      if (!householdId) return { data: null as Place | null, error: new Error('No household') }
      const { data: created, error } = await supabase
        .from('places')
        .insert({
          household_id: householdId,
          type: data.type,
          label: data.label,
          parent_place_id: data.parent_place_id ?? null,
          attributes: data.attributes ?? {},
          canonical_key: data.canonical_key ?? null,
        })
        .select()
        .single()
      if (!error) refetch()
      return { data: created as Place | null, error }
    },
    [householdId, refetch]
  )

  const updatePlace = useCallback(
    async (
      id: string,
      changes: Partial<{ label: string; type: string; attributes: Record<string, string> }>
    ) => {
      if (!householdId) return { error: new Error('No household') }
      const { error } = await supabase
        .from('places')
        .update(changes)
        .eq('id', id)
        .eq('household_id', householdId)
      if (!error) refetch()
      return { error }
    },
    [householdId, refetch]
  )

  const movePlace = useCallback(
    async (placeId: string, newParentPlaceId: string | null) => {
      if (!householdId) return { error: new Error('No household') }
      const { error } = await supabase
        .from('places')
        .update({ parent_place_id: newParentPlaceId })
        .eq('id', placeId)
        .eq('household_id', householdId)
      if (!error) refetch()
      return { error }
    },
    [householdId, refetch]
  )

  const deletePlace = useCallback(
    async (id: string) => {
      if (!householdId) return { error: new Error('No household') }
      const { error } = await supabase
        .from('places')
        .delete()
        .eq('id', id)
        .eq('household_id', householdId)
      if (!error) refetch()
      return { error }
    },
    [householdId, refetch]
  )

  const getPlaceById = useCallback(
    (id: string) => places.find((p) => p.id === id) ?? null,
    [places]
  )

  const getDescendantIds = useCallback(
    (placeId: string): string[] => {
      const result: string[] = [placeId]
      for (const p of places) {
        if (p.parent_place_id === placeId) {
          result.push(...getDescendantIds(p.id))
        }
      }
      return result
    },
    [places]
  )

  return {
    places,
    placeTree,
    loading,
    refetch,
    createPlace,
    updatePlace,
    movePlace,
    deletePlace,
    getPlaceById,
    getDescendantIds,
  }
}
