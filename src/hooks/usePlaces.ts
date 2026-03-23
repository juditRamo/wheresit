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
      .order('sort_order', { ascending: true })
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
    // Sort children by sort_order within each parent
    const sortByOrder = (a: PlaceWithChildren, b: PlaceWithChildren) => a.sort_order - b.sort_order
    roots.sort(sortByOrder)
    function sortChildren(nodes: PlaceWithChildren[]) {
      for (const n of nodes) {
        n.children.sort(sortByOrder)
        sortChildren(n.children)
      }
    }
    sortChildren(roots)
    return roots
  }, [places])

  const createPlace = useCallback(
    async (data: {
      label: string
      icon?: string
      parent_place_id?: string | null
      attributes?: Record<string, string>
      canonical_key?: string | null
    }) => {
      if (!householdId) return { data: null as Place | null, error: new Error('No household') }
      const parentId = data.parent_place_id ?? null
      let maxSortOrder = 0
      if (parentId === null) {
        const { data: rows } = await supabase
          .from('places')
          .select('sort_order')
          .eq('household_id', householdId)
          .is('parent_place_id', null)
          .order('sort_order', { ascending: false })
          .limit(1)
        maxSortOrder = (rows?.[0]?.sort_order ?? 0) + 1
      } else {
        const { data: rows } = await supabase
          .from('places')
          .select('sort_order')
          .eq('household_id', householdId)
          .eq('parent_place_id', parentId)
          .order('sort_order', { ascending: false })
          .limit(1)
        maxSortOrder = (rows?.[0]?.sort_order ?? 0) + 1
      }
      const { data: created, error } = await supabase
        .from('places')
        .insert({
          household_id: householdId,
          type: 'place',
          icon: data.icon ?? 'map-pin',
          label: data.label,
          parent_place_id: parentId,
          attributes: data.attributes ?? {},
          canonical_key: data.canonical_key ?? null,
          sort_order: maxSortOrder,
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
      changes: Partial<{ label: string; icon: string; attributes: Record<string, string> }>
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
      // Assign sort_order = max + 1 in the new sibling group
      let maxSortOrder = 0
      if (newParentPlaceId === null) {
        const { data: rows } = await supabase
          .from('places')
          .select('sort_order')
          .eq('household_id', householdId)
          .is('parent_place_id', null)
          .order('sort_order', { ascending: false })
          .limit(1)
        maxSortOrder = (rows?.[0]?.sort_order ?? 0) + 1
      } else {
        const { data: rows } = await supabase
          .from('places')
          .select('sort_order')
          .eq('household_id', householdId)
          .eq('parent_place_id', newParentPlaceId)
          .order('sort_order', { ascending: false })
          .limit(1)
        maxSortOrder = (rows?.[0]?.sort_order ?? 0) + 1
      }
      const { error } = await supabase
        .from('places')
        .update({ parent_place_id: newParentPlaceId, sort_order: maxSortOrder })
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

  const reorderPlaces = useCallback(
    async (orderedIds: string[]) => {
      if (!householdId) return
      // Optimistic update
      setPlaces((prev) => {
        const updated = [...prev]
        for (let i = 0; i < orderedIds.length; i++) {
          const idx = updated.findIndex((p) => p.id === orderedIds[i])
          if (idx !== -1) updated[idx] = { ...updated[idx], sort_order: i + 1 }
        }
        return updated
      })
      // Persist to DB
      try {
        await Promise.all(
          orderedIds.map((id, i) =>
            supabase
              .from('places')
              .update({ sort_order: i + 1 })
              .eq('id', id)
              .eq('household_id', householdId)
          )
        )
      } catch {
        refetch()
      }
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

  const getPlacePath = useCallback(
    (placeId: string): Place[] => {
      const byId = new Map(places.map((p) => [p.id, p]))
      const path: Place[] = []
      let current: string | null = placeId
      while (current) {
        const p = byId.get(current)
        if (!p) break
        path.push(p)
        current = p.parent_place_id
      }
      path.reverse()
      return path
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
    reorderPlaces,
    getPlaceById,
    getDescendantIds,
    getPlacePath,
  }
}
