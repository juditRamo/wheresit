import type { User, Session } from '@supabase/supabase-js'

export type { User, Session }

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  theme: string | null
  language: string | null
}

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
  icon: string
  label: string
  parent_place_id: string | null
  canonical_key: string | null
  sort_order: number
  created_at: string
}

export interface StorageEntry {
  id: string
  household_id: string
  item_name: string
  location_description: string
  place_id: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  photo_path: string | null
}

export type HistoryEventType =
  | 'add_place'
  | 'move_place'
  | 'edit_place'
  | 'delete_place'
  | 'add_object'
  | 'move_object'
  | 'edit_object'
  | 'delete_object'

export type HistoryEntityType = 'place' | 'storage_entry'

export interface HistoryEvent {
  id: string
  household_id: string
  actor_id: string | null
  event_type: HistoryEventType
  entity_type: HistoryEntityType
  entity_id: string
  payload: Record<string, unknown>
  created_at: string
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
}

export interface PendingPlaceMatch {
  suggestedPlaceId: string
  suggestedPlaceLabel: string
  locationPath: Array<{ type: string; label: string }>
  confidence: 'low' | 'medium'
}

export type CustomFieldType = 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'date'

export interface CustomFieldOption {
  id: string
  custom_field_id: string
  household_id: string
  label: string
  sort_order: number
  created_at: string
}

export interface CustomField {
  id: string
  household_id: string
  name: string
  field_type: CustomFieldType
  options: CustomFieldOption[]
  sort_order: number
  created_at: string
}

export interface CustomFieldValue {
  id: string
  storage_entry_id: string
  custom_field_id: string
  household_id: string
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_option: string | null
  value_options: string[] | null
  value_date: string | null
}

export interface PendingDuplicateChoice {
  entries: Array<{ entryId: string; location: string }>
  newLocation: string
  item_name: string
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
  pendingDuplicateChoice?: PendingDuplicateChoice
}
