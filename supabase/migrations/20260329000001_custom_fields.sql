-- Custom fields system: household-scoped field definitions + per-item values

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Field definitions, one per household
CREATE TABLE public.custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text','number','boolean','select','multiselect')),
  options jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX custom_fields_household_name ON public.custom_fields(household_id, lower(trim(name)));
CREATE INDEX custom_fields_household_id ON public.custom_fields(household_id);

-- Field values, one row per item per field
CREATE TABLE public.custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_entry_id uuid NOT NULL REFERENCES public.storage_entries(id) ON DELETE CASCADE,
  custom_field_id uuid NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  value_text text,
  value_number double precision,
  value_boolean boolean,
  value_option text,
  value_options jsonb,
  UNIQUE(storage_entry_id, custom_field_id)
);

CREATE INDEX cfv_entry_id ON public.custom_field_values(storage_entry_id);
CREATE INDEX cfv_field_id ON public.custom_field_values(custom_field_id);
CREATE INDEX cfv_household_id ON public.custom_field_values(household_id);
CREATE INDEX cfv_value_text_trgm ON public.custom_field_values
  USING gin (lower(value_text) gin_trgm_ops);
CREATE INDEX cfv_value_option_trgm ON public.custom_field_values
  USING gin (lower(value_option) gin_trgm_ops);

-- RLS
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cf_select" ON public.custom_fields
  FOR SELECT USING (household_id IN (SELECT public.user_household_ids()));
CREATE POLICY "cf_insert" ON public.custom_fields
  FOR INSERT WITH CHECK (household_id IN (SELECT public.user_household_ids()));
CREATE POLICY "cf_update" ON public.custom_fields
  FOR UPDATE USING (household_id IN (SELECT public.user_household_ids()));
CREATE POLICY "cf_delete" ON public.custom_fields
  FOR DELETE USING (household_id IN (SELECT public.user_household_ids()));

CREATE POLICY "cfv_select" ON public.custom_field_values
  FOR SELECT USING (household_id IN (SELECT public.user_household_ids()));
CREATE POLICY "cfv_insert" ON public.custom_field_values
  FOR INSERT WITH CHECK (household_id IN (SELECT public.user_household_ids()));
CREATE POLICY "cfv_update" ON public.custom_field_values
  FOR UPDATE USING (household_id IN (SELECT public.user_household_ids()));
CREATE POLICY "cfv_delete" ON public.custom_field_values
  FOR DELETE USING (household_id IN (SELECT public.user_household_ids()));
