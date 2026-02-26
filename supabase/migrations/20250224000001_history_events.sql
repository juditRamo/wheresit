-- Unified history_events: one table for all place/object add/move/edit/delete events
CREATE TABLE history_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('place', 'storage_entry')),
  entity_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_history_events_household_created ON history_events(household_id, created_at DESC);
CREATE INDEX idx_history_events_entity ON history_events(entity_type, entity_id);

ALTER TABLE history_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their household's history events"
  ON history_events FOR SELECT
  USING (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Members can insert history events for their household"
  ON history_events FOR INSERT
  WITH CHECK (household_id IN (SELECT user_household_ids()));

-- Drop location_history (empty; no data migration)
DROP TABLE IF EXISTS location_history;
