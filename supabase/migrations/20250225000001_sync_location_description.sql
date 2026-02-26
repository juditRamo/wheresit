-- Keep storage_entries.location_description in sync with place_id and place hierarchy.
-- When place_id is set, location_description is derived from the place path.
-- When a place is moved or renamed, all storage_entries at that place or descendants get updated paths.

-- Function: build materialized path string for a place (root › ... › leaf)
CREATE OR REPLACE FUNCTION public.get_place_path_string(place_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  result text;
BEGIN
  WITH RECURSIVE path AS (
    SELECT id, label, parent_place_id, 0 AS depth
    FROM public.places
    WHERE id = place_id
    UNION ALL
    SELECT p.id, p.label, p.parent_place_id, path.depth + 1
    FROM public.places p
    INNER JOIN path ON p.id = path.parent_place_id
  )
  SELECT string_agg(label, ' › ' ORDER BY depth DESC)
  INTO result
  FROM path;
  RETURN COALESCE(result, '');
END;
$$;

-- Trigger: when storage_entries.place_id is set or changed, set location_description from place path
CREATE OR REPLACE FUNCTION public.sync_storage_entry_location_description()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.place_id IS NOT NULL THEN
    NEW.location_description := public.get_place_path_string(NEW.place_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_storage_entry_location_description_trigger ON public.storage_entries;
CREATE TRIGGER sync_storage_entry_location_description_trigger
  BEFORE INSERT OR UPDATE OF place_id
  ON public.storage_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_storage_entry_location_description();

-- Trigger: when a place is moved or renamed, update location_description for all storage_entries at that place and descendants
CREATE OR REPLACE FUNCTION public.sync_storage_entries_after_place_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.parent_place_id IS DISTINCT FROM NEW.parent_place_id OR OLD.label IS DISTINCT FROM NEW.label THEN
    WITH RECURSIVE descs AS (
      SELECT id FROM public.places WHERE id = NEW.id
      UNION ALL
      SELECT p.id FROM public.places p INNER JOIN descs d ON p.parent_place_id = d.id
    )
    UPDATE public.storage_entries
    SET
      location_description = public.get_place_path_string(place_id),
      updated_at = now()
    WHERE place_id IN (SELECT id FROM descs);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_storage_entries_after_place_change_trigger ON public.places;
CREATE TRIGGER sync_storage_entries_after_place_change_trigger
  AFTER UPDATE OF parent_place_id, label
  ON public.places
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_storage_entries_after_place_change();

-- One-time backfill: fix existing rows where place_id is set but location_description is out of sync
UPDATE public.storage_entries
SET location_description = public.get_place_path_string(place_id)
WHERE place_id IS NOT NULL
  AND (location_description IS DISTINCT FROM public.get_place_path_string(place_id));
