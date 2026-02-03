-- Semantic concept modeling for stored items
create extension if not exists vector;

create table if not exists public.item_concepts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null,
  canonical_label text not null,
  parent_concept_id uuid references public.item_concepts(id) on delete set null,
  embedding vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, canonical_label)
);

create index if not exists item_concepts_household_idx on public.item_concepts(household_id);
create index if not exists item_concepts_parent_idx on public.item_concepts(parent_concept_id);

create table if not exists public.item_concept_aliases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  concept_id uuid not null references public.item_concepts(id) on delete cascade,
  alias text not null,
  canonical_alias text not null,
  created_at timestamptz not null default now(),
  unique (household_id, canonical_alias)
);

create index if not exists item_concept_aliases_concept_idx on public.item_concept_aliases(concept_id);

create table if not exists public.storage_entry_concepts (
  entry_id uuid not null references public.storage_entries(id) on delete cascade,
  concept_id uuid not null references public.item_concepts(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  source text not null default 'llm' check (source in ('llm', 'user', 'inferred')),
  confidence real not null default 0.8,
  linked_at timestamptz not null default now(),
  primary key (entry_id, concept_id)
);

create index if not exists storage_entry_concepts_household_idx on public.storage_entry_concepts(household_id);
create index if not exists storage_entry_concepts_concept_idx on public.storage_entry_concepts(concept_id);

alter table public.item_concepts enable row level security;
alter table public.item_concept_aliases enable row level security;
alter table public.storage_entry_concepts enable row level security;

create policy item_concepts_select on public.item_concepts
  for select using (household_id in (select public.user_household_ids()));

create policy item_concepts_insert on public.item_concepts
  for insert with check (household_id in (select public.user_household_ids()));

create policy item_concepts_update on public.item_concepts
  for update using (household_id in (select public.user_household_ids()));

create policy item_concepts_delete on public.item_concepts
  for delete using (household_id in (select public.user_household_ids()));

create policy item_concept_aliases_select on public.item_concept_aliases
  for select using (household_id in (select public.user_household_ids()));

create policy item_concept_aliases_insert on public.item_concept_aliases
  for insert with check (household_id in (select public.user_household_ids()));

create policy item_concept_aliases_update on public.item_concept_aliases
  for update using (household_id in (select public.user_household_ids()));

create policy item_concept_aliases_delete on public.item_concept_aliases
  for delete using (household_id in (select public.user_household_ids()));

create policy storage_entry_concepts_select on public.storage_entry_concepts
  for select using (household_id in (select public.user_household_ids()));

create policy storage_entry_concepts_insert on public.storage_entry_concepts
  for insert with check (household_id in (select public.user_household_ids()));

create policy storage_entry_concepts_update on public.storage_entry_concepts
  for update using (household_id in (select public.user_household_ids()));

create policy storage_entry_concepts_delete on public.storage_entry_concepts
  for delete using (household_id in (select public.user_household_ids()));

create or replace function public.match_item_concepts(
  p_household_id uuid,
  query_embedding text,
  match_threshold double precision default 0.75,
  match_count int default 5
)
returns table (
  concept_id uuid,
  label text,
  similarity double precision
)
language sql
stable
as $$
  with query_vec as (
    select query_embedding::vector(768) as v
  )
  select
    ic.id as concept_id,
    ic.label,
    1 - (ic.embedding <=> query_vec.v) as similarity
  from public.item_concepts ic
  cross join query_vec
  where ic.household_id = p_household_id
    and ic.embedding is not null
    and 1 - (ic.embedding <=> query_vec.v) >= match_threshold
  order by ic.embedding <=> query_vec.v
  limit match_count
$$;
