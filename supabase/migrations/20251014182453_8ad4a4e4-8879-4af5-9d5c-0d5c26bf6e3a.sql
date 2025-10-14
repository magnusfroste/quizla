-- Add UPDATE policy for materials table
-- This allows users to update materials in collections they own
CREATE POLICY "Users can update materials in own collections"
ON public.materials
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.collections 
    WHERE collections.id = materials.collection_id 
      AND collections.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.collections 
    WHERE collections.id = materials.collection_id 
      AND collections.user_id = auth.uid()
  )
);