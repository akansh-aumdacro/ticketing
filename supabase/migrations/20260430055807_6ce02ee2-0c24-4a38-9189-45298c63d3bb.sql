-- Enable pg_net for async HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: fire-and-forget POST to the sync edge function
CREATE OR REPLACE FUNCTION public.trigger_sync_tickets_to_sheets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM extensions.http_post(
    url := 'https://zagobelpjdvkabovcjjt.supabase.co/functions/v1/sync-tickets-to-sheets',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('source', 'db_trigger', 'op', TG_OP)
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Never let sync failures block ticket changes
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_tickets_to_sheets_trigger ON public.tickets;
CREATE TRIGGER sync_tickets_to_sheets_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.tickets
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_sync_tickets_to_sheets();