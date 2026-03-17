-- Add icon column with sensible default
ALTER TABLE public.places ADD COLUMN icon text NOT NULL DEFAULT 'map-pin';

-- Make type optional from frontend perspective (DB default for chat-created places)
ALTER TABLE public.places ALTER COLUMN type SET DEFAULT 'place';

-- Backfill icon from existing type values
UPDATE public.places SET icon = CASE type
  WHEN 'room' THEN 'door-open'
  WHEN 'furniture' THEN 'armchair'
  WHEN 'shelf' THEN 'library-big'
  WHEN 'drawer' THEN 'inbox'
  WHEN 'box' THEN 'package'
  WHEN 'folder' THEN 'folder'
  ELSE 'map-pin'
END;
