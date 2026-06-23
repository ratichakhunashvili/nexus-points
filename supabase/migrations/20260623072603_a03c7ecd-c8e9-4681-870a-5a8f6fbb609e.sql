
-- 1. Private schema for SECURITY DEFINER functions
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

-- 2. Recreate every public SECURITY DEFINER function inside private (same bodies)

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.get_public_names(_ids uuid[])
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name FROM public.profiles p WHERE p.id = ANY(_ids)
$$;

CREATE OR REPLACE FUNCTION private.get_leaderboard(_limit integer DEFAULT 100)
RETURNS TABLE(id uuid, full_name text, avatar_icon text, avatar_url text, total_points integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_icon, p.avatar_url, p.total_points
  FROM public.profiles p
  ORDER BY p.total_points DESC
  LIMIT GREATEST(COALESCE(_limit, 100), 1)
$$;

CREATE OR REPLACE FUNCTION private.award_bonus_points(_student uuid, _points integer, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;
  UPDATE public.profiles SET total_points = total_points + _points WHERE id = _student;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION private.get_activity_qr(_activity_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_qr text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT qr_code INTO v_qr FROM public.activities WHERE id = _activity_id;
  RETURN v_qr;
END; $$;

CREATE OR REPLACE FUNCTION private.scan_qr_code(_qr text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity public.activities%ROWTYPE;
  v_exists INTEGER;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_activity FROM public.activities WHERE qr_code = _qr;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid QR code');
  END IF;

  IF NOT v_activity.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Activity is not active');
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM public.attendance
  WHERE activity_id = v_activity.id AND student_id = v_uid;

  IF v_exists > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have already scanned this activity');
  END IF;

  INSERT INTO public.attendance (activity_id, student_id, points_awarded)
  VALUES (v_activity.id, v_uid, v_activity.points);

  UPDATE public.profiles SET total_points = total_points + v_activity.points WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'points', v_activity.points, 'activity', v_activity.name);
END; $$;

CREATE OR REPLACE FUNCTION private.admin_remove_attendance(_attendance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.attendance%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;
  SELECT * INTO v_row FROM public.attendance WHERE id = _attendance_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Attendance not found');
  END IF;
  DELETE FROM public.attendance WHERE id = _attendance_id;
  UPDATE public.profiles
  SET total_points = GREATEST(total_points - COALESCE(v_row.points_awarded, 0), 0)
  WHERE id = v_row.student_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION private.admin_delete_user(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;
  IF _user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot delete yourself');
  END IF;
  DELETE FROM auth.users WHERE id = _user_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- 3. Lock down EXECUTE on private functions, grant only what wrappers need
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_public_names(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_leaderboard(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.award_bonus_points(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_activity_qr(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.scan_qr_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.admin_remove_attendance(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.admin_delete_user(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_public_names(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_leaderboard(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.award_bonus_points(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_activity_qr(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.scan_qr_code(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_remove_attendance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_delete_user(uuid) TO authenticated, service_role;

-- 4. Replace public functions with thin SECURITY INVOKER wrappers that delegate to private
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.has_role(_user_id, _role) $$;

CREATE OR REPLACE FUNCTION public.get_public_names(_ids uuid[])
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$ SELECT * FROM private.get_public_names(_ids) $$;

CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit integer DEFAULT 100)
RETURNS TABLE(id uuid, full_name text, avatar_icon text, avatar_url text, total_points integer)
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$ SELECT * FROM private.get_leaderboard(_limit) $$;

CREATE OR REPLACE FUNCTION public.award_bonus_points(_student uuid, _points integer, _reason text)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.award_bonus_points(_student, _points, _reason) $$;

CREATE OR REPLACE FUNCTION public.get_activity_qr(_activity_id uuid)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.get_activity_qr(_activity_id) $$;

CREATE OR REPLACE FUNCTION public.scan_qr_code(_qr text)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.scan_qr_code(_qr) $$;

CREATE OR REPLACE FUNCTION public.admin_remove_attendance(_attendance_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.admin_remove_attendance(_attendance_id) $$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.admin_delete_user(_user_id) $$;
