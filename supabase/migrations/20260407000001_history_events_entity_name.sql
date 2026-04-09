-- Add entity_name column for text search in activity feed
ALTER TABLE public.history_events
  ADD COLUMN entity_name text;

-- Backfill from existing payloads
UPDATE public.history_events
SET entity_name = COALESCE(payload->>'item_name', payload->>'label');

-- Enable pg_trgm for fast ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index for text search on entity_name
CREATE INDEX idx_history_events_entity_name
  ON public.history_events USING gin (entity_name gin_trgm_ops);

-- Composite index for cursor-based pagination
CREATE INDEX idx_history_events_cursor
  ON public.history_events (household_id, created_at DESC, id DESC);
