-- Remove unsafe policies that allow anyone to manipulate analysis progress
DROP POLICY IF EXISTS "System can create analysis progress" ON public.analysis_progress;
DROP POLICY IF EXISTS "System can update analysis progress" ON public.analysis_progress;
DROP POLICY IF EXISTS "System can delete analysis progress" ON public.analysis_progress;