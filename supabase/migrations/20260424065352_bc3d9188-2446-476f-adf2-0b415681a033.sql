-- 1. Table
CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  message TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system_message BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_messages_ticket_created
  ON public.ticket_messages (ticket_id, created_at);

-- 2. Realtime
ALTER TABLE public.ticket_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;

-- 3. Enable RLS
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- 4. SELECT — anyone who can view the ticket can view its thread
CREATE POLICY "view_ticket_messages"
ON public.ticket_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = ticket_messages.ticket_id
      AND (
        t.raised_by = auth.uid()
        OR t.assigned_to = auth.uid()
        OR t.issue_department_id = public.get_user_department_id(auth.uid())
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- 5. INSERT — only ticket creator or assignee, only while ticket is open
CREATE POLICY "send_ticket_messages"
ON public.ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (
  is_system_message = false
  AND sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = ticket_messages.ticket_id
      AND (t.raised_by = auth.uid() OR t.assigned_to = auth.uid()
           OR public.has_role(auth.uid(), 'super_admin'::app_role)
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'hod'::app_role))
      AND t.status IN ('open'::ticket_status, 'in_progress'::ticket_status, 'reopened'::ticket_status)
  )
);

-- 6. System message trigger
CREATE OR REPLACE FUNCTION public.notify_ticket_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignee_name TEXT;
  actor_name TEXT;
  actor_id UUID;
BEGIN
  actor_id := COALESCE(auth.uid(), NEW.raised_by);

  -- Assigned to changed
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    SELECT name INTO assignee_name FROM public.profiles WHERE user_id = NEW.assigned_to;
    INSERT INTO public.ticket_messages(ticket_id, sender_id, sender_name, sender_role, message, is_system_message)
    VALUES (NEW.id, actor_id, 'System', 'system',
      'Ticket assigned to ' || COALESCE(assignee_name, 'a team member'),
      true);
  END IF;

  -- Status changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status IN ('resolved'::ticket_status, 'closed'::ticket_status) THEN
      SELECT name INTO actor_name FROM public.profiles WHERE user_id = actor_id;
      INSERT INTO public.ticket_messages(ticket_id, sender_id, sender_name, sender_role, message, is_system_message)
      VALUES (NEW.id, actor_id, 'System', 'system',
        'Ticket ' || NEW.status::text || ' by ' || COALESCE(actor_name, 'a user') || '. Thread is now read-only.',
        true);
    ELSE
      INSERT INTO public.ticket_messages(ticket_id, sender_id, sender_name, sender_role, message, is_system_message)
      VALUES (NEW.id, actor_id, 'System', 'system',
        'Status changed to ' || replace(NEW.status::text, '_', ' '),
        true);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ticket_change_notify
AFTER UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_change();