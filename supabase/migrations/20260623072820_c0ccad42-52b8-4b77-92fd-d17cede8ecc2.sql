
CREATE OR REPLACE FUNCTION private.get_leaderboard(_limit integer DEFAULT 100)
RETURNS TABLE(id uuid, full_name text, avatar_icon text, avatar_url text, total_points integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_icon, p.avatar_url, p.total_points
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role = 'admin'
  )
  ORDER BY p.total_points DESC
  LIMIT GREATEST(COALESCE(_limit, 100), 1)
$$;
