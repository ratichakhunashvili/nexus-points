
-- Drop the view flagged by the linter
DROP VIEW IF EXISTS public.public_profiles;

-- Leaderboard RPC: returns only safe columns for all users
CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit integer DEFAULT 100)
RETURNS TABLE (id uuid, full_name text, avatar_icon text, avatar_url text, total_points integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_icon, p.avatar_url, p.total_points
  FROM public.profiles p
  ORDER BY p.total_points DESC
  LIMIT GREATEST(COALESCE(_limit, 100), 1)
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated, service_role;

-- Bulk name lookup for time-bounded leaderboards
CREATE OR REPLACE FUNCTION public.get_public_names(_ids uuid[])
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name FROM public.profiles p WHERE p.id = ANY(_ids)
$$;

REVOKE ALL ON FUNCTION public.get_public_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_names(uuid[]) TO authenticated, service_role;
