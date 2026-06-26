
CREATE TABLE public.activity_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, student_id)
);

GRANT SELECT, INSERT, DELETE ON public.activity_registrations TO authenticated;
GRANT ALL ON public.activity_registrations TO service_role;

ALTER TABLE public.activity_registrations ENABLE ROW LEVEL SECURITY;

-- Students can see their own registrations; admins can see all
CREATE POLICY "view own or admin"
  ON public.activity_registrations FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Students may register themselves only for upcoming, active activities
CREATE POLICY "self register upcoming"
  ON public.activity_registrations FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND a.is_active = true
        AND a.event_date >= current_date
    )
  );

-- Students may cancel their own registration for upcoming activities; admins can delete any
CREATE POLICY "self cancel or admin"
  ON public.activity_registrations FOR DELETE
  TO authenticated
  USING (
    (student_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id AND a.event_date >= current_date
    ))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX activity_registrations_activity_idx ON public.activity_registrations(activity_id);
CREATE INDEX activity_registrations_student_idx ON public.activity_registrations(student_id);
