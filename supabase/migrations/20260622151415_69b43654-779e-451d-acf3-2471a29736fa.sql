
-- 1. Hide activities.qr_code from non-admins (column-level revoke)
REVOKE SELECT (qr_code) ON public.activities FROM PUBLIC;
REVOKE SELECT (qr_code) ON public.activities FROM anon;
REVOKE SELECT (qr_code) ON public.activities FROM authenticated;
-- service_role keeps full access; admins read via get_activity_qr()

-- 2. Scope "admins manage activities" policy to authenticated role only
DROP POLICY IF EXISTS "admins manage activities" ON public.activities;
CREATE POLICY "admins manage activities"
  ON public.activities
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Profiles: ensure no overly broad policies; recreate scoped to authenticated only
DROP POLICY IF EXISTS "users see own profile" ON public.profiles;
CREATE POLICY "users see own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "admins see all profiles" ON public.profiles;
CREATE POLICY "admins see all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
