-- Remove the unsafe policy that allows anyone to manage subscriptions
DROP POLICY IF EXISTS "System can manage subscriptions" ON public.subscriptions;