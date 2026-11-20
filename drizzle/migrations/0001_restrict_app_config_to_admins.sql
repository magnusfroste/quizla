DROP POLICY IF EXISTS "Signed-in users can read config" ON public.app_config;
CREATE POLICY "Admins can read config" ON public.app_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_app_limits()
RETURNS TABLE(key text, value text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.key, c.value FROM public.app_config c
  WHERE c.key IN ('free_max_collections','free_max_materials_total','free_max_materials_per_collection','free_max_quizzes_per_collection','student_max_collections','student_max_materials_total','student_max_quizzes_per_collection','student_price_sek','pro_price_sek')
$$;
REVOKE ALL ON FUNCTION public.get_app_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_app_limits() TO anon, authenticated;