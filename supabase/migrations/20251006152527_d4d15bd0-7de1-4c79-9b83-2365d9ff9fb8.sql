-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view shared collections" ON public.collections;
DROP POLICY IF EXISTS "Users can view shares for their collections" ON public.collection_shares;

-- Create security definer function to check collection ownership
CREATE OR REPLACE FUNCTION public.is_collection_owner(_collection_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collections
    WHERE id = _collection_id
      AND user_id = _user_id
  )
$$;

-- Create security definer function to check if user has access to collection via sharing
CREATE OR REPLACE FUNCTION public.has_collection_share_access(_collection_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collection_shares
    WHERE collection_id = _collection_id
      AND shared_with_user_id = _user_id
  )
$$;

-- Recreate the policies using security definer functions to avoid recursion
CREATE POLICY "Users can view shared collections"
ON public.collections
FOR SELECT
USING (
  public.has_collection_share_access(id, auth.uid())
);

CREATE POLICY "Users can view shares for their collections"
ON public.collection_shares
FOR SELECT
USING (
  public.is_collection_owner(collection_id, auth.uid())
);