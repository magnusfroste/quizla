DROP POLICY IF EXISTS "Anyone can read config" ON public.app_config;
REVOKE SELECT ON public.app_config FROM anon;
CREATE POLICY "Signed-in users can read config" ON public.app_config FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);