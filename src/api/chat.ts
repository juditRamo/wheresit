import { supabase } from '../supabaseClient'
import type { LocationRef, NewTag, QueryResult, PendingUpdate } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface ChatResponse {
  reply: string
  language: 'en' | 'es'
  locationRef?: LocationRef
  newTags?: NewTag[]
  queryResults?: QueryResult[]
  pendingUpdate?: PendingUpdate
}

export async function sendChatMessage(message: string, householdId: string, confirm?: boolean): Promise<ChatResponse> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session?.access_token) {
    throw new Error('Not signed in')
  }

  const { data: { session: freshSession }, error: refreshError } = await supabase.auth.refreshSession({ refresh_token: session.refresh_token })
  const token = freshSession?.access_token ?? session.access_token
  if (refreshError && !token) {
    throw new Error('Session expired. Please sign in again.')
  }

  const url = `${supabaseUrl}/functions/v1/chat`
  const body: Record<string, unknown> = { message, householdId }
  if (confirm) body.confirm = true

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  })

  const resBody = await res.json()
  if (!res.ok) {
    throw new Error(resBody.error ?? resBody.reply ?? 'Request failed')
  }
  return {
    reply: resBody.reply ?? '',
    language: resBody.language === 'es' ? 'es' : 'en',
    locationRef: resBody.locationRef,
    newTags: resBody.newTags,
    queryResults: resBody.queryResults,
    pendingUpdate: resBody.pendingUpdate,
  }
}
