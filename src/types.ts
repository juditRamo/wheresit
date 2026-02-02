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
  room_key: string | null
  spot_key: string | null
  spot_detail: string | null
  category_key: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  photo_path: string | null
}

export interface HouseholdTag {
  id: string
  household_id: string
  tag_type: 'room' | 'spot' | 'detail'
  tag_key: string
  label: string
  parent_room_key?: string | null
}

export interface NewTag {
  type: 'room' | 'spot' | 'detail'
  key: string
  label: string
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
  room_key: string | null
  spot_key: string | null
  spot_detail: string | null
  location_description: string
}

export interface PendingUpdate {
  entryId: string
  oldLocation: string
  newLocation: string
  item_name: string
  room_key: string
  spot_key?: string
  spot_detail?: string
  category_key?: string
}

export type ChatMessageRole = 'user' | 'assistant'

export interface LocationRef {
  room_key: string
  spot_key?: string
}

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  content: string
  createdAt: Date
  locationRef?: LocationRef
  newTags?: NewTag[]
  queryResults?: QueryResult[]
  pendingUpdate?: PendingUpdate
}
