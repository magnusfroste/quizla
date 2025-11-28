-- Add admin RLS policies to allow admins to view all data for statistics

-- Collections: Admin can view all
CREATE POLICY "Admins can view all collections"
ON public.collections
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Quizzes: Admin can view all
CREATE POLICY "Admins can view all quizzes"
ON public.quizzes
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Attempts: Admin can view all
CREATE POLICY "Admins can view all attempts"
ON public.attempts
FOR SELECT
USING (has_role(auth.uid(), 'admin'));