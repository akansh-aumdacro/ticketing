CREATE OR REPLACE FUNCTION public.sync_role_to_enum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  exists_val boolean;
BEGIN
  IF NEW.name IS NULL OR length(trim(NEW.name)) = 0 THEN
    RETURN NEW;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = NEW.name
  ) INTO exists_val;
  IF NOT exists_val THEN
    EXECUTE format('ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS %L', NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS roles_sync_enum ON public.roles;
CREATE TRIGGER roles_sync_enum
BEFORE INSERT OR UPDATE OF name ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_enum();

-- Backfill: ensure existing role names are present in enum
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT name FROM public.roles WHERE name IS NOT NULL LOOP
    BEGIN
      EXECUTE format('ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS %L', r.name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;