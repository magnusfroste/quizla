-- Allow quiz owners to update their quizzes (for sharing settings)
CREATE POLICY "Quiz owners can update quizzes"
ON public.quizzes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.collections
    WHERE collections.id = quizzes.collection_id
    AND collections.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.collections
    WHERE collections.id = quizzes.collection_id
    AND collections.user_id = auth.uid()
  )
);