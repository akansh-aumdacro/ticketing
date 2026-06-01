
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_breached boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_response_breached boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_at_risk_notified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id uuid PRIMARY KEY,
  sla_breach boolean NOT NULL DEFAULT true,
  sla_at_risk boolean NOT NULL DEFAULT true,
  ticket_assigned boolean NOT NULL DEFAULT true,
  new_message boolean NOT NULL DEFAULT true,
  ticket_resolved boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view own prefs" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "insert own prefs" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "update own prefs" ON public.user_notification_preferences;
CREATE POLICY "view own prefs" ON public.user_notification_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "insert own prefs" ON public.user_notification_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own prefs" ON public.user_notification_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS unp_updated_at ON public.user_notification_preferences;
CREATE TRIGGER unp_updated_at BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid, _type text, _title text, _message text, _ticket_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pref_enabled boolean := true;
  pref_col text;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  pref_col := CASE _type
    WHEN 'sla_breach' THEN 'sla_breach'
    WHEN 'sla_escalation' THEN 'sla_breach'
    WHEN 'sla_at_risk' THEN 'sla_at_risk'
    WHEN 'ticket_assigned' THEN 'ticket_assigned'
    WHEN 'ticket_message' THEN 'new_message'
    WHEN 'ticket_resolved' THEN 'ticket_resolved'
    ELSE NULL END;
  IF pref_col IS NOT NULL THEN
    EXECUTE format(
      'SELECT COALESCE((SELECT %I FROM public.user_notification_preferences WHERE user_id = $1), true)',
      pref_col
    ) INTO pref_enabled USING _user_id;
  END IF;
  IF NOT pref_enabled THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id, type, title, message, ticket_id)
  VALUES (_user_id, _type, _title, _message, _ticket_id);
END; $$;

CREATE OR REPLACE FUNCTION public.compute_sla_hours(_priority ticket_priority, OUT response_hours int, OUT resolution_hours int)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  CASE _priority
    WHEN 'critical' THEN response_hours := 1; resolution_hours := 8;
    WHEN 'high' THEN response_hours := 4; resolution_hours := 24;
    WHEN 'medium' THEN response_hours := 12; resolution_hours := 48;
    ELSE response_hours := 24; resolution_hours := 72;
  END CASE;
END; $$;

CREATE OR REPLACE FUNCTION public.set_ticket_sla()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r int; s int;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.priority IS DISTINCT FROM OLD.priority THEN
    SELECT response_hours, resolution_hours INTO r, s FROM public.compute_sla_hours(NEW.priority);
    NEW.sla_response_due_at := COALESCE(NEW.created_at, now()) + (r || ' hours')::interval;
    NEW.sla_due_at := COALESCE(NEW.created_at, now()) + (s || ' hours')::interval;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_ticket_sla ON public.tickets;
CREATE TRIGGER trg_set_ticket_sla
  BEFORE INSERT OR UPDATE OF priority ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_sla();

CREATE OR REPLACE FUNCTION public.tickets_notify_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL THEN
      PERFORM public.notify_user(NEW.assigned_to, 'ticket_assigned', 'Ticket Assigned',
        'Ticket #' || NEW.ticket_number || ' — ' || NEW.title || ' has been assigned to you. SLA due by ' || to_char(NEW.sla_due_at, 'DD Mon YYYY HH24:MI'),
        NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      PERFORM public.notify_user(NEW.assigned_to, 'ticket_assigned', 'Ticket Assigned',
        'Ticket #' || NEW.ticket_number || ' — ' || NEW.title || ' has been assigned to you. SLA due by ' || to_char(NEW.sla_due_at, 'DD Mon YYYY HH24:MI'),
        NEW.id);
    END IF;
    IF NEW.status = 'resolved'::ticket_status AND OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.notify_user(NEW.raised_by, 'ticket_resolved', 'Your Ticket is Resolved',
        'Ticket #' || NEW.ticket_number || ' — ' || NEW.title || ' has been resolved. Please rate your experience.',
        NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_tickets_notify_changes ON public.tickets;
CREATE TRIGGER trg_tickets_notify_changes
  AFTER INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_notify_changes();

CREATE OR REPLACE FUNCTION public.ticket_messages_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tickets; recipient uuid;
BEGIN
  IF NEW.is_system_message THEN RETURN NEW; END IF;
  SELECT * INTO t FROM public.tickets WHERE id = NEW.ticket_id;
  IF t IS NULL THEN RETURN NEW; END IF;

  IF t.assigned_to IS NOT NULL AND NEW.sender_id = t.assigned_to AND t.first_response_at IS NULL THEN
    UPDATE public.tickets SET first_response_at = NEW.created_at WHERE id = t.id;
  END IF;

  IF NEW.sender_id = t.raised_by THEN
    recipient := t.assigned_to;
  ELSE
    recipient := t.raised_by;
  END IF;

  IF recipient IS NOT NULL AND recipient <> NEW.sender_id THEN
    PERFORM public.notify_user(recipient, 'ticket_message', 'New Message',
      NEW.sender_name || ' replied on Ticket #' || t.ticket_number || ' — ' || t.title,
      t.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_ticket_messages_notify ON public.ticket_messages;
CREATE TRIGGER trg_ticket_messages_notify
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.ticket_messages_notify();
