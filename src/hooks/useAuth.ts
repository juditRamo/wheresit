import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import type { User, Session } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const clearRecovery = useCallback(() => setIsRecovery(false), [])

  return { user, session, loading, isRecovery, clearRecovery }
}
