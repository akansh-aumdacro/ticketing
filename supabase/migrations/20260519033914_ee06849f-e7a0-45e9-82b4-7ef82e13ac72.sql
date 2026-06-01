ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
UPDATE public.departments SET is_active = true WHERE is_active IS NULL;