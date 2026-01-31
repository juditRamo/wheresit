-- Households: one per "home" or shared space
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

-- Membership: which users belong to which household
create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  primary key (household_id, user_id)
);

create index household_members_user_id on public.household_members (user_id);

-- Storage entries: one "last place" per item per household (item_name normalized for lookups)
create table public.storage_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_name text not null,
  location_description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create unique index storage_entries_household_item_unique on public.storage_entries (household_id, lower(trim(item_name)));

-- RLS
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.storage_entries enable row level security;

-- Helper: true if current user is a member of the given household
create or replace function public.user_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

-- Households: read if member or if you created it (so INSERT ... RETURNING works before joining)
create policy "households_select" on public.households
  for select using (
    id in (select public.user_household_ids())
    or created_by = auth.uid()
  );

create policy "households_insert" on public.households
  for insert with check (created_by = auth.uid());

create policy "households_update" on public.households
  for update using (id in (select public.user_household_ids()));

-- Household members: read own memberships; insert when creating household or joining
create policy "household_members_select" on public.household_members
  for select using (user_id = auth.uid() or household_id in (select public.user_household_ids()));

create policy "household_members_insert" on public.household_members
  for insert with check (user_id = auth.uid());

create policy "household_members_update" on public.household_members
  for update using (household_id in (select public.user_household_ids()));

-- Storage entries: only for households the user belongs to
create policy "storage_entries_select" on public.storage_entries
  for select using (household_id in (select public.user_household_ids()));

create policy "storage_entries_insert" on public.storage_entries
  for insert with check (household_id in (select public.user_household_ids()));

create policy "storage_entries_update" on public.storage_entries
  for update using (household_id in (select public.user_household_ids()));

create policy "storage_entries_delete" on public.storage_entries
  for delete using (household_id in (select public.user_household_ids()));
