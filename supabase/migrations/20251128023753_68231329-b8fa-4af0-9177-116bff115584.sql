-- Remove the unsafe policy that exposes all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create new policy that only allows users to view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Also allow admins to view all profiles (for admin functionality)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));