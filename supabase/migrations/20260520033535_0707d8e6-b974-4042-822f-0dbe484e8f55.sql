
-- 1. Restrict app_settings SELECT to authenticated users only
DROP POLICY IF EXISTS anon_read_settings ON public.app_settings;

-- 2. Add UPDATE/DELETE storage policies for ticket-attachments scoped to uploader's folder
CREATE POLICY "ticket_attachments_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ticket-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'ticket-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ticket_attachments_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ticket-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Update DB trigger to include service-role auth header so the sync edge function can verify caller
CREATE OR REPLACE FUNCTION public.trigger_sync_tickets_to_sheets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  service_key text;
BEGIN
  -- Read service role key from vault if available; fall back to skipping sync
  BEGIN
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    service_key := NULL;
  END;

  PERFORM extensions.http_post(
    url := 'https://zagobelpjdvkabovcjjt.supabase.co/functions/v1/sync-tickets-to-sheets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, '')
    ),
    body := jsonb_build_object('source', 'db_trigger', 'op', TG_OP)
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;
