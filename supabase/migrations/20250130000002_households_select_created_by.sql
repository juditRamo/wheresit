-- Fix: allow SELECT on households where created_by = auth.uid() so INSERT ... RETURNING works
-- (user can see the household they just created before they're in household_members)
drop policy if exists "households_select" on public.households;
create policy "households_select" on public.households
  for select using (
    id in (select public.user_household_ids())
    or created_by = auth.uid()
  );
