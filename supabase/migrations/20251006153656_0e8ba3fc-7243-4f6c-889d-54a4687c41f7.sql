-- Create storage policies for study-materials bucket
-- Allow users to upload files to their own collections
CREATE POLICY "Users can upload to own collections"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'study-materials' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.collections
    WHERE id = (storage.foldername(name))[2]::uuid
    AND user_id = auth.uid()
  )
);

-- Allow users to view files from collections they have access to
CREATE POLICY "Users can view materials from accessible collections"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'study-materials'
  AND EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = (storage.foldername(name))[2]::uuid
    AND (
      c.user_id = auth.uid()
      OR c.is_public = true
      OR EXISTS (
        SELECT 1 FROM public.collection_shares cs
        WHERE cs.collection_id = c.id
        AND cs.shared_with_user_id = auth.uid()
      )
    )
  )
);

-- Allow users to delete files from their own collections
CREATE POLICY "Users can delete from own collections"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'study-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.collections
    WHERE id = (storage.foldername(name))[2]::uuid
    AND user_id = auth.uid()
  )
);