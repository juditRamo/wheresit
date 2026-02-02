-- Location history: tracks where items were before being moved
CREATE TABLE location_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES storage_entries(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  room_key text,
  spot_key text,
  spot_detail text,
  location_description text NOT NULL,
  moved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moved_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by entry
CREATE INDEX idx_location_history_entry ON location_history(entry_id);
CREATE INDEX idx_location_history_household ON location_history(household_id);

-- RLS
ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their household's location history"
  ON location_history FOR SELECT
  USING (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Members can insert location history for their household"
  ON location_history FOR INSERT
  WITH CHECK (household_id IN (SELECT user_household_ids()));
