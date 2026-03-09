import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'

export type ProfileUpdate = Partial<Pick<Profile, 'display_name' | 'avatar_url' | 'theme' | 'language'>>

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const updateProfile = useCallback(
    async (updates: ProfileUpdate) => {
      if (!userId) return { error: new Error('Not authenticated') }
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()
      if (!error && data) setProfile(data as Profile)
      return { data, error }
    },
    [userId]
  )

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchOrCreate() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, theme, language')
        .eq('id', userId)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        setProfile(null)
        setLoading(false)
        return
      }

      if (data) {
        setProfile(data as Profile)
        setLoading(false)
        return
      }

      // No profile row (e.g. existing user before trigger) — upsert one
      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert({ id: userId })
        .select('id, display_name, avatar_url, theme, language')
        .single()

      if (!cancelled) {
        if (!insertError && inserted) setProfile(inserted as Profile)
        else setProfile(null)
        setLoading(false)
      }
    }

    setLoading(true)
    fetchOrCreate()
    return () => {
      cancelled = true
    }
  }, [userId])

  return { profile, updateProfile, loading }
}
