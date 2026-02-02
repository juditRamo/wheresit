-- Add structured picklist columns to storage_entries
ALTER TABLE storage_entries
  ADD COLUMN IF NOT EXISTS room_key     TEXT,
  ADD COLUMN IF NOT EXISTS spot_key     TEXT,
  ADD COLUMN IF NOT EXISTS spot_detail  TEXT,
  ADD COLUMN IF NOT EXISTS category_key TEXT;

-- Backfill: copy existing location_description into room_key as custom text
UPDATE storage_entries
SET room_key = location_description
WHERE room_key IS NULL AND location_description IS NOT NULL;
