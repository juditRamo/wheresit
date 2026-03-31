CREATE POLICY "Authenticated users can delete item photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'item-photos'
    AND auth.role() = 'authenticated'
  );
