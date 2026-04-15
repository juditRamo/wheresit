import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

function fetchItems(householdId: string) {
  return supabase
    .from('storage_entries')
    .select('item_name')
    .eq('household_id', householdId)
    .order('updated_at', { ascending: false })
}

export function useStoredItems(householdId: string | null) {
  const [items, setItems] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(() => {
    if (!householdId) return
    setLoading(true)
    fetchItems(householdId).then(({ data, error }) => {
      setLoading(false)
      if (error) setItems([])
      else setItems([...new Set((data ?? []).map((r) => r.item_name))])
    })
  }, [householdId])

  useEffect(() => {
    if (!householdId) return
    refetch() // eslint-disable-line react-hooks/set-state-in-effect
  }, [householdId, refetch])

  return { items, loading, refetch }
}
