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

export interface Place {
  id: string
  household_id: string
  type: string
  label: string
  parent_place_id: string | null
  attributes: Record<string, string>
  canonical_key: string | null
  created_at: string
}

export interface StorageEntry {
  id: string
  household_id: string
  item_name: string
  location_description: string
  category_key: string | null
  place_id: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  photo_path: string | null
}

export interface LocationHistory {
  id: string
  entry_id: string
  household_id: string
  room_key: string | null
  spot_key: string | null
  spot_detail: string | null
  location_description: string
  moved_by: string | null
  moved_at: string
}

export interface QueryResult {
  item_name: string
  location_description: string
  place_id?: string | null
}

export interface PendingUpdate {
  entryId: string
  oldLocation: string
  newLocation: string
  item_name: string
  category_key?: string
}

export interface PendingPlaceMatch {
  suggestedPlaceId: string
  suggestedPlaceLabel: string
  locationPath: Array<{ type: string; label: string; attributes?: Record<string, string> }>
  confidence: 'low' | 'medium'
}

export type ChatMessageRole = 'user' | 'assistant'

export interface LocationRef {
  place_id?: string
  place_label?: string
  location_description?: string
}

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  content: string
  createdAt: Date
  locationRef?: LocationRef
  queryResults?: QueryResult[]
  pendingUpdate?: PendingUpdate
  pendingPlaceMatch?: PendingPlaceMatch
}
