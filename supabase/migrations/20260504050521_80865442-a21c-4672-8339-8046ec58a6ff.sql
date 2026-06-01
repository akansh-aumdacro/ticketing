ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_unit_id ON public.profiles(unit_id);