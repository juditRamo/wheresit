-- Profiles: user info and preferences (one row per auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  theme text check (theme is null or theme in ('light', 'dark', 'system')),
  language text check (language is null or language in ('en', 'es'))
);

alter table public.profiles enable row level security;

-- SELECT: own profile or profiles of users who share a household (for members list / activity)
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or id in (
      select user_id from public.household_members
      where household_id in (select public.user_household_ids())
    )
  );

-- INSERT: only own row (e.g. on first sign-in)
create policy "profiles_insert" on public.profiles
  for insert with check (id = auth.uid());

-- UPDATE: only own row
create policy "profiles_update" on public.profiles
  for update using (id = auth.uid());

-- Create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
