import { supabase } from '../supabaseClient'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export async function sendChatMessage(message: string, householdId: string): Promise<{ reply: string }> {
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
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ message, householdId }),
  })

  const body = await res.json()
  if (!res.ok) {
    throw new Error(body.error ?? body.reply ?? 'Request failed')
  }
  return { reply: body.reply ?? '' }
}
