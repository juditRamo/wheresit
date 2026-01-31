import type { User, Session } from '@supabase/supabase-js'

export type { User, Session }

export interface Household {
  id: string
  name: string
  created_at: string
  created_by: string | null
}

export interface HouseholdMember {
  household_id: string
  user_id: string
  role: 'owner' | 'member'
}

export interface StorageEntry {
  id: string
  household_id: string
  item_name: string
  location_description: string
  created_at: string
  updated_at: string
  created_by: string | null
}

export type ChatMessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  content: string
  createdAt: Date
}
