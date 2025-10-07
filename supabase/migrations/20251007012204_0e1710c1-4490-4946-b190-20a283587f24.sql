-- Fix RLS policies on attempts table to prevent anonymous attempts leaking into owner's dashboard

-- Drop the existing policy that allows authenticated users to see all anonymous attempts
DROP POLICY IF EXISTS "Users can view own attempts" ON public.attempts;

-- Create separate policies for authenticated and anonymous users
CREATE POLICY "Users can view own attempts"
ON public.attempts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Anonymous users can view anonymous attempts"
ON public.attempts
FOR SELECT
TO anon
USING (user_id IS NULL);