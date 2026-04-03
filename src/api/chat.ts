import { supabase } from '../supabaseClient'
import type { LocationRef, QueryResult, PendingUpdate, PendingPlaceMatch, PendingDuplicateChoice } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface ChatResponse {
  reply: string
  language: 'en' | 'es'
  locationRef?: LocationRef
  queryResults?: QueryResult[]
  pendingUpdate?: PendingUpdate
  pendingPlaceMatch?: PendingPlaceMatch
  pendingDuplicateChoice?: PendingDuplicateChoice
}

export async function sendChatMessage(
  message: string,
  householdId: string,
  options?: { confirm?: boolean | 'move' | 'add'; confirmPlaceId?: string; confirmEntryId?: string }
): Promise<ChatResponse> {
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
  if (options?.confirm) body.confirm = options.confirm
  if (options?.confirmPlaceId) body.confirmPlaceId = options.confirmPlaceId
  if (options?.confirmEntryId) body.confirmEntryId = options.confirmEntryId

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
    queryResults: resBody.queryResults,
    pendingUpdate: resBody.pendingUpdate,
    pendingPlaceMatch: resBody.pendingPlaceMatch,
    pendingDuplicateChoice: resBody.pendingDuplicateChoice,
  }
}
