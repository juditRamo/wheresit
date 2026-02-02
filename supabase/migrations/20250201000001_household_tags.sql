-- Household tags: reusable custom location parts per household
CREATE TABLE public.household_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  tag_type text NOT NULL CHECK (tag_type IN ('room', 'spot', 'detail')),
  tag_key text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, tag_type, tag_key)
);

ALTER TABLE public.household_tags ENABLE ROW LEVEL SECURITY;

-- RLS: same membership-based pattern as storage_entries
CREATE POLICY "household_tags_select" ON public.household_tags
  FOR SELECT USING (household_id IN (SELECT public.user_household_ids()));

CREATE POLICY "household_tags_insert" ON public.household_tags
  FOR INSERT WITH CHECK (household_id IN (SELECT public.user_household_ids()));

CREATE POLICY "household_tags_delete" ON public.household_tags
  FOR DELETE USING (household_id IN (SELECT public.user_household_ids()));
