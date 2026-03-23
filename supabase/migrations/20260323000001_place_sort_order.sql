-- Add sort_order column to places for custom ordering
ALTER TABLE places ADD COLUMN sort_order INTEGER;

-- Backfill existing places: assign order by creation date within each parent group
UPDATE places SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY household_id, parent_place_id
    ORDER BY created_at
  ) AS rn
  FROM places
) sub
WHERE places.id = sub.id;

-- Now set NOT NULL and default
ALTER TABLE places ALTER COLUMN sort_order SET NOT NULL;
ALTER TABLE places ALTER COLUMN sort_order SET DEFAULT 0;

-- Index for efficient ordering queries
CREATE INDEX idx_places_sort_order ON places (household_id, parent_place_id, sort_order);
