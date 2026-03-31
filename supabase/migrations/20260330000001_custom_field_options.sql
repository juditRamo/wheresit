-- Move select/multiselect options from JSONB column to dedicated table with stable UUIDs

-- 1. Create options table
CREATE TABLE public.custom_field_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_field_id uuid NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cfo_field_id ON public.custom_field_options(custom_field_id);
CREATE INDEX cfo_household_id ON public.custom_field_options(household_id);
CREATE UNIQUE INDEX cfo_field_label ON public.custom_field_options(custom_field_id, lower(trim(label)));

-- RLS
ALTER TABLE public.custom_field_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cfo_select" ON public.custom_field_options
  FOR SELECT USING (household_id IN (SELECT public.user_household_ids()));
CREATE POLICY "cfo_insert" ON public.custom_field_options
  FOR INSERT WITH CHECK (household_id IN (SELECT public.user_household_ids()));
CREATE POLICY "cfo_update" ON public.custom_field_options
  FOR UPDATE USING (household_id IN (SELECT public.user_household_ids()));
CREATE POLICY "cfo_delete" ON public.custom_field_options
  FOR DELETE USING (household_id IN (SELECT public.user_household_ids()));

-- 2. Migrate existing JSONB options → rows
INSERT INTO public.custom_field_options (custom_field_id, household_id, label, sort_order)
SELECT cf.id, cf.household_id, opt.value::text, opt.ordinality::int - 1
FROM public.custom_fields cf,
     jsonb_array_elements_text(cf.options) WITH ORDINALITY AS opt(value, ordinality)
WHERE cf.options IS NOT NULL AND jsonb_array_length(cf.options) > 0;

-- 3. Migrate value_option: label text → option UUID
UPDATE public.custom_field_values cfv
SET value_option = cfo.id::text
FROM public.custom_field_options cfo
WHERE cfv.value_option IS NOT NULL
  AND cfv.custom_field_id = cfo.custom_field_id
  AND lower(trim(cfv.value_option)) = lower(trim(cfo.label));

-- 4. Migrate value_options: label array → UUID array
UPDATE public.custom_field_values cfv
SET value_options = sub.new_options
FROM (
  SELECT cfv2.id AS cfv_id,
    jsonb_agg(cfo.id::text ORDER BY opt.ordinality) AS new_options
  FROM public.custom_field_values cfv2
  CROSS JOIN LATERAL jsonb_array_elements_text(cfv2.value_options) WITH ORDINALITY AS opt(value, ordinality)
  JOIN public.custom_field_options cfo
    ON cfo.custom_field_id = cfv2.custom_field_id
    AND lower(trim(cfo.label)) = lower(trim(opt.value))
  WHERE cfv2.value_options IS NOT NULL AND jsonb_array_length(cfv2.value_options) > 0
  GROUP BY cfv2.id
) sub
WHERE cfv.id = sub.cfv_id;

-- 5. Cleanup trigger: when an option is deleted, nullify/remove references in values
CREATE OR REPLACE FUNCTION public.clean_deleted_option() RETURNS trigger AS $$
BEGIN
  -- Clear single-select references
  UPDATE public.custom_field_values
  SET value_option = NULL
  WHERE custom_field_id = OLD.custom_field_id
    AND value_option = OLD.id::text;

  -- Remove from multi-select arrays
  UPDATE public.custom_field_values
  SET value_options = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements_text(value_options) AS elem
    WHERE elem != OLD.id::text
  )
  WHERE custom_field_id = OLD.custom_field_id
    AND value_options IS NOT NULL
    AND value_options @> to_jsonb(OLD.id::text);

  -- Nullify empty arrays
  UPDATE public.custom_field_values
  SET value_options = NULL
  WHERE custom_field_id = OLD.custom_field_id
    AND value_options = '[]'::jsonb;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_clean_deleted_option
  AFTER DELETE ON public.custom_field_options
  FOR EACH ROW EXECUTE FUNCTION public.clean_deleted_option();

-- 6. Mark old column deprecated (keep for rollback safety)
COMMENT ON COLUMN public.custom_fields.options IS 'DEPRECATED: migrated to custom_field_options table';
