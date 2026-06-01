
-- Helper: returns true if the user's role has tickets.viewAll = true in public.roles permissions
CREATE OR REPLACE FUNCTION public.user_can_view_all_tickets(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (r.permissions->'tickets'->>'viewAll')::boolean
      FROM public.user_roles ur
      JOIN public.roles r ON r.name::text = ur.role::text
      WHERE ur.user_id = _user_id
      LIMIT 1
    ),
    false
  );
$$;

-- tickets SELECT
DROP POLICY IF EXISTS view_tickets ON public.tickets;
CREATE POLICY view_tickets ON public.tickets
FOR SELECT USING (
  raised_by = auth.uid()
  OR assigned_to = auth.uid()
  OR issue_department_id = public.get_user_department_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.user_can_view_all_tickets(auth.uid())
);

-- ticket_messages SELECT
DROP POLICY IF EXISTS view_ticket_messages ON public.ticket_messages;
CREATE POLICY view_ticket_messages ON public.ticket_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_messages.ticket_id
      AND (
        t.raised_by = auth.uid()
        OR t.assigned_to = auth.uid()
        OR t.issue_department_id = public.get_user_department_id(auth.uid())
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.user_can_view_all_tickets(auth.uid())
      )
  )
);

-- ticket_history SELECT
DROP POLICY IF EXISTS view_history ON public.ticket_history;
CREATE POLICY view_history ON public.ticket_history
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_history.ticket_id
      AND (
        t.raised_by = auth.uid()
        OR t.assigned_to = auth.uid()
        OR t.issue_department_id = public.get_user_department_id(auth.uid())
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.user_can_view_all_tickets(auth.uid())
      )
  )
);

-- ticket_ratings SELECT
DROP POLICY IF EXISTS view_ratings ON public.ticket_ratings;
CREATE POLICY view_ratings ON public.ticket_ratings
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_ratings.ticket_id
      AND (
        t.raised_by = auth.uid()
        OR t.assigned_to = auth.uid()
        OR t.issue_department_id = public.get_user_department_id(auth.uid())
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'hod'::app_role)
        OR public.user_can_view_all_tickets(auth.uid())
      )
  )
);

-- ticket_work_logs SELECT
DROP POLICY IF EXISTS view_work_logs ON public.ticket_work_logs;
CREATE POLICY view_work_logs ON public.ticket_work_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_work_logs.ticket_id
      AND (
        t.raised_by = auth.uid()
        OR t.assigned_to = auth.uid()
        OR t.issue_department_id = public.get_user_department_id(auth.uid())
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'hod'::app_role)
        OR public.user_can_view_all_tickets(auth.uid())
      )
  )
);
