-- Drop legacy picklist columns from storage_entries; filtering uses place_id and location_description.
ALTER TABLE public.storage_entries
  DROP COLUMN IF EXISTS room_key,
  DROP COLUMN IF EXISTS spot_key,
  DROP COLUMN IF EXISTS spot_detail;
