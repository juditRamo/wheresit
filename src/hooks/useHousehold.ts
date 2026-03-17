import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { getItem, setItem, removeItem } from '../lib/storage'
import type { Household } from '../types'

const HOUSEHOLD_STORAGE_KEY = 'wheresit_household_id'

export function useHousehold(userId: string | undefined) {
  const [households, setHouseholds] = useState<Household[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedIdState] = useState<string | null>(null)

  // Load persisted household ID asynchronously
  useEffect(() => {
    getItem(HOUSEHOLD_STORAGE_KEY).then((id) => {
      if (id) setSelectedIdState(id)
    })
  }, [])

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIdState(id)
    if (id) setItem(HOUSEHOLD_STORAGE_KEY, id)
    else removeItem(HOUSEHOLD_STORAGE_KEY)
  }, [])

  useEffect(() => {
    if (!userId) {
      setHouseholds([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchHouseholds() {
      const { data: members, error: membersError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)

      if (membersError || !members?.length) {
        if (!cancelled) {
          setHouseholds([])
          setLoading(false)
        }
        return
      }

      const ids = members.map((m) => m.household_id)
      const { data: list, error } = await supabase
        .from('households')
        .select('id, name, created_at, created_by')
        .in('id', ids)
        .order('name')

      if (!cancelled) {
        if (error) setHouseholds([])
        else setHouseholds(list ?? [])
        setLoading(false)
      }
    }

    fetchHouseholds()
    return () => {
      cancelled = true
    }
  }, [userId])

  const selectedHousehold = households.find((h) => h.id === selectedId) ?? null

  useEffect(() => {
    if (households.length === 0) return
    const isSelectedValid = selectedId && households.some((h) => h.id === selectedId)
    if (!isSelectedValid) setSelectedId(households[0].id)
  }, [households, selectedId, setSelectedId])

  const createHousehold = useCallback(
    async (name: string) => {
      if (!userId) return { error: new Error('Not signed in') }
      const { data: household, error: insertError } = await supabase
        .from('households')
        .insert({ name, created_by: userId })
        .select('id, name, created_at, created_by')
        .single()

      if (insertError) return { error: insertError }
      if (!household) return { error: new Error('No household returned') }

      const { error: memberError } = await supabase.from('household_members').insert({
        household_id: household.id,
        user_id: userId,
        role: 'owner',
      })

      if (memberError) return { error: memberError }
      setHouseholds((prev) => [...prev, household])
      setSelectedId(household.id)
      return { data: household }
    },
    [userId, setSelectedId]
  )

  const joinHousehold = useCallback(
    async (householdId: string) => {
      if (!userId) return { error: new Error('Not signed in') }
      const { error } = await supabase.from('household_members').insert({
        household_id: householdId,
        user_id: userId,
        role: 'member',
      })
      if (error) return { error }

      const { data: household } = await supabase
        .from('households')
        .select('id, name, created_at, created_by')
        .eq('id', householdId)
        .single()

      if (household) {
        setHouseholds((prev) => (prev.some((h) => h.id === household.id) ? prev : [...prev, household]))
        setSelectedId(household.id)
      }
      return { data: household ?? null }
    },
    [userId, setSelectedId]
  )

  const updateHouseholdName = useCallback(async (householdId: string, name: string) => {
    const { data, error } = await supabase
      .from('households')
      .update({ name })
      .eq('id', householdId)
      .select('id, name, created_at, created_by')
      .single()
    if (!error && data) {
      setHouseholds((prev) => prev.map((h) => (h.id === householdId ? { ...h, name } : h)))
    }
    return { data, error }
  }, [])

  return {
    households,
    selectedId,
    selectedHousehold,
    setSelectedId,
    createHousehold,
    joinHousehold,
    updateHouseholdName,
    loading,
  }
}
