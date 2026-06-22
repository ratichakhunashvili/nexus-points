
-- 1. profiles: restrict SELECT to own row + admins; create safe public view for leaderboard
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;

CREATE POLICY "users see own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "admins see all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Safe public leaderboard view (no email/phone/student_id/bio/department)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, full_name, avatar_icon, avatar_url, total_points
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- Allow authenticated to SELECT from view by exposing only safe columns via a SECURITY DEFINER
-- function backing the view is not needed because the view selects from profiles which now has RLS
-- restricting reads. To make the view show all users for the leaderboard, switch to security_invoker = false:
ALTER VIEW public.public_profiles SET (security_invoker = false);

-- 2. user_achievements: drop overly-broad SELECT, keep own-only
DROP POLICY IF EXISTS "achievements visible to authenticated" ON public.user_achievements;

-- 3. activities qr_code: ensure non-admins cannot read qr_code column
REVOKE SELECT (qr_code) ON public.activities FROM authenticated;
REVOKE SELECT (qr_code) ON public.activities FROM anon;
-- Admins still read via get_activity_qr() SECURITY DEFINER RPC (already in place)

-- 4. SECURITY DEFINER functions: tighten EXECUTE to only the roles that need them
-- has_role is used inside RLS policies; policy evaluation runs as the calling role,
-- so authenticated must keep EXECUTE. Revoke from PUBLIC and anon explicitly.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- scan_qr_code: students call this RPC; it self-gates via auth.uid()
REVOKE ALL ON FUNCTION public.scan_qr_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_qr_code(text) TO authenticated, service_role;

-- award_bonus_points: admins call via RPC; self-gates via has_role('admin')
REVOKE ALL ON FUNCTION public.award_bonus_points(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_bonus_points(uuid, integer, text) TO authenticated, service_role;

-- get_activity_qr: admins call via RPC; self-gates via has_role('admin')
REVOKE ALL ON FUNCTION public.get_activity_qr(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_activity_qr(uuid) TO authenticated, service_role;

-- handle_new_user: trigger-only, no client EXECUTE needed
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
