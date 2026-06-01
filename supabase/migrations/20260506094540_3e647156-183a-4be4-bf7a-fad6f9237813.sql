
-- 1. Notifications: restrict INSERT to self (system inserts use SECURITY DEFINER notify_user, which bypasses RLS)
DROP POLICY IF EXISTS insert_notifications ON public.notifications;
CREATE POLICY insert_notifications ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2. ticket_attachments: scope SELECT to users with ticket access
DROP POLICY IF EXISTS view_attachments ON public.ticket_attachments;
CREATE POLICY view_attachments ON public.ticket_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_attachments.ticket_id
      AND (t.raised_by = auth.uid()
        OR t.assigned_to = auth.uid()
        OR t.issue_department_id = public.get_user_department_id(auth.uid())
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'hod'::app_role))
  ));

-- 3. ticket_work_logs: scope SELECT to users with ticket access
DROP POLICY IF EXISTS view_work_logs ON public.ticket_work_logs;
CREATE POLICY view_work_logs ON public.ticket_work_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_work_logs.ticket_id
      AND (t.raised_by = auth.uid()
        OR t.assigned_to = auth.uid()
        OR t.issue_department_id = public.get_user_department_id(auth.uid())
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'hod'::app_role))
  ));

-- 4. ticket_ratings: scope SELECT to users with ticket access
DROP POLICY IF EXISTS view_ratings ON public.ticket_ratings;
CREATE POLICY view_ratings ON public.ticket_ratings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_ratings.ticket_id
      AND (t.raised_by = auth.uid()
        OR t.assigned_to = auth.uid()
        OR t.issue_department_id = public.get_user_department_id(auth.uid())
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'hod'::app_role))
  ));

-- 5. Storage uploads: require path to start with the uploader's user_id (folder)
DROP POLICY IF EXISTS upload_ticket_files ON storage.objects;
CREATE POLICY upload_ticket_files ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
