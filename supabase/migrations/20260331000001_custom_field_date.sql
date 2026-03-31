-- Add 'date' to custom field types and add value_date column

-- Drop and re-add the CHECK constraint to include 'date'
ALTER TABLE custom_fields
  DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;

ALTER TABLE custom_fields
  ADD CONSTRAINT custom_fields_field_type_check
  CHECK (field_type IN ('text', 'number', 'boolean', 'select', 'multiselect', 'date'));

-- Add value_date column to custom_field_values
ALTER TABLE custom_field_values
  ADD COLUMN IF NOT EXISTS value_date date;
