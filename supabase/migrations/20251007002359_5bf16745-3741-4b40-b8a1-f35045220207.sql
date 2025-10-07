-- Add is_public column to quizzes table
ALTER TABLE public.quizzes 
ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Create quiz_shares table
CREATE TABLE public.quiz_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, shared_with_user_id)
);

-- Enable RLS on quiz_shares
ALTER TABLE public.quiz_shares ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check quiz share access
CREATE OR REPLACE FUNCTION public.has_quiz_share_access(_quiz_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quiz_shares
    WHERE quiz_id = _quiz_id
      AND shared_with_user_id = _user_id
  )
$$;

-- RLS Policies for quiz_shares
CREATE POLICY "Quiz owners can create shares"
ON public.quiz_shares
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quizzes q
    JOIN public.collections c ON c.id = q.collection_id
    WHERE q.id = quiz_shares.quiz_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Quiz owners can delete shares"
ON public.quiz_shares
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.quizzes q
    JOIN public.collections c ON c.id = q.collection_id
    WHERE q.id = quiz_shares.quiz_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view shares for their quizzes"
ON public.quiz_shares
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.quizzes q
    JOIN public.collections c ON c.id = q.collection_id
    WHERE q.id = quiz_shares.quiz_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their received shares"
ON public.quiz_shares
FOR SELECT
TO authenticated
USING (shared_with_user_id = auth.uid());

-- Update RLS policies for quizzes to include shared access
DROP POLICY IF EXISTS "Users can view quizzes from accessible collections" ON public.quizzes;

CREATE POLICY "Users can view quizzes from accessible collections"
ON public.quizzes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM collections c
    WHERE c.id = quizzes.collection_id
      AND (
        c.user_id = auth.uid() 
        OR c.is_public = true 
        OR EXISTS (
          SELECT 1
          FROM collection_shares cs
          WHERE cs.collection_id = c.id 
            AND cs.shared_with_user_id = auth.uid()
        )
      )
  )
  OR is_public = true
  OR has_quiz_share_access(id, auth.uid())
);

-- Update questions RLS to include quiz shares
DROP POLICY IF EXISTS "Users can view questions from accessible quizzes" ON public.questions;

CREATE POLICY "Users can view questions from accessible quizzes"
ON public.questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM quizzes q
    JOIN collections c ON c.id = q.collection_id
    WHERE q.id = questions.quiz_id
      AND (
        c.user_id = auth.uid()
        OR c.is_public = true
        OR EXISTS (
          SELECT 1
          FROM collection_shares cs
          WHERE cs.collection_id = c.id
            AND cs.shared_with_user_id = auth.uid()
        )
        OR q.is_public = true
        OR has_quiz_share_access(q.id, auth.uid())
      )
  )
);