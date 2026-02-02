-- Add photo_path column to storage_entries
ALTER TABLE storage_entries ADD COLUMN IF NOT EXISTS photo_path text;

-- Create storage bucket for item photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-photos', 'item-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: anyone can read public bucket photos
CREATE POLICY "Public read access for item photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'item-photos');

-- RLS policy: authenticated users can upload photos
CREATE POLICY "Authenticated users can upload item photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'item-photos'
    AND auth.role() = 'authenticated'
  );

-- RLS policy: authenticated users can update their photos
CREATE POLICY "Authenticated users can update item photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'item-photos'
    AND auth.role() = 'authenticated'
  );
