
-- Remove any pre-existing duplicate attendance rows so the unique index can be created
DELETE FROM public.attendance a
USING public.attendance b
WHERE a.ctid < b.ctid
  AND a.student_id = b.student_id
  AND a.activity_id = b.activity_id;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_activity_unique
  ON public.attendance (student_id, activity_id);

CREATE OR REPLACE FUNCTION public.scan_qr_code(_qr text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$;
