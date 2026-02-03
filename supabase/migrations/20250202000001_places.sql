-- Places: flexible nested locations (composite pattern)
-- type: room, furniture, shelf, drawer, box, folder, etc. (no enum)
CREATE TABLE public.places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  type text NOT NULL,
  label text NOT NULL,
  parent_place_id uuid REFERENCES public.places(id) ON DELETE CASCADE,
  attributes jsonb DEFAULT '{}',
  canonical_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, canonical_key)
);

CREATE INDEX places_household_id ON public.places(household_id);
CREATE INDEX places_parent_place_id ON public.places(parent_place_id);
CREATE INDEX places_canonical_key ON public.places(household_id, canonical_key) WHERE canonical_key IS NOT NULL;

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "places_select" ON public.places
  FOR SELECT USING (household_id IN (SELECT public.user_household_ids()));

CREATE POLICY "places_insert" ON public.places
  FOR INSERT WITH CHECK (household_id IN (SELECT public.user_household_ids()));

CREATE POLICY "places_update" ON public.places
  FOR UPDATE USING (household_id IN (SELECT public.user_household_ids()));

CREATE POLICY "places_delete" ON public.places
  FOR DELETE USING (household_id IN (SELECT public.user_household_ids()));

-- Add place_id to storage_entries
ALTER TABLE public.storage_entries
  ADD COLUMN IF NOT EXISTS place_id uuid REFERENCES public.places(id) ON DELETE SET NULL;

CREATE INDEX storage_entries_place_id ON public.storage_entries(place_id);
