import type { HistoryEventType, HistoryEntityType } from '../types'
import { supabase } from '../supabaseClient'

export const HISTORY_EVENT_TYPES = {
  add_place: 'add_place',
  move_place: 'move_place',
  edit_place: 'edit_place',
  delete_place: 'delete_place',
  add_object: 'add_object',
  move_object: 'move_object',
  edit_object: 'edit_object',
  delete_object: 'delete_object',
} as const satisfies Record<HistoryEventType, string>

export const HISTORY_ENTITY_TYPES = {
  place: 'place',
  storage_entry: 'storage_entry',
} as const satisfies Record<HistoryEntityType, string>

/** Payload shapes per event type (for documentation and typing) */
export interface HistoryPayloads {
  add_object: { item_name: string; location_description?: string; place_id?: string | null }
  move_object: {
    item_name: string
    from: { location_description?: string; place_id?: string | null }
    to: { location_description?: string; place_id?: string | null }
  }
  edit_object: { item_name: string; changes: Record<string, unknown> }
  delete_object: { item_name: string; last_location_description?: string }
  add_place: { label: string; type: string; parent_place_id?: string | null; canonical_key?: string | null }
  move_place: { label: string; from_parent_place_id?: string | null; to_parent_place_id?: string | null }
  edit_place: { label: string; changes: Record<string, unknown> }
  delete_place: { label: string; path_or_description?: string }
}

/**
 * Record a history event. Fire-and-forget: does not throw; failures are logged only.
 */
export function recordHistoryEvent(
  householdId: string,
  eventType: HistoryEventType,
  entityType: HistoryEntityType,
  entityId: string,
  payload: Record<string, unknown>
): void {
  supabase.auth.getSession().then(({ data }) => {
    const actorId = data?.session?.user?.id ?? null
    supabase
      .from('history_events')
      .insert({
        household_id: householdId,
        actor_id: actorId,
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        payload,
      })
      .then(({ error }) => {
        if (error) console.warn('[history_events] insert failed:', error.message)
      })
  })
}
