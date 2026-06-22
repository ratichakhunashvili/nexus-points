
-- attendance: re-scope all policies from {public} to {authenticated}
DROP POLICY IF EXISTS "admins manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "admins see all attendance" ON public.attendance;
DROP POLICY IF EXISTS "students see own attendance" ON public.attendance;

CREATE POLICY "admins manage attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins see all attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "students see own attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- user_achievements: re-scope to {authenticated}
DROP POLICY IF EXISTS "users see own achievements" ON public.user_achievements;
CREATE POLICY "users see own achievements"
  ON public.user_achievements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- activities: ensure qr_code remains revoked from non-admins (idempotent)
REVOKE SELECT (qr_code) ON public.activities FROM PUBLIC;
REVOKE SELECT (qr_code) ON public.activities FROM anon;
REVOKE SELECT (qr_code) ON public.activities FROM authenticated;
