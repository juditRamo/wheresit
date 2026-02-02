-- Add parent_room_key so custom spots can be nested under a specific room
ALTER TABLE public.household_tags ADD COLUMN parent_room_key text;

-- Allow members to update their household's tags (needed for drag-and-drop room reassignment)
CREATE POLICY "household_tags_update" ON public.household_tags
  FOR UPDATE USING (household_id IN (SELECT public.user_household_ids()))
  WITH CHECK (household_id IN (SELECT public.user_household_ids()));
