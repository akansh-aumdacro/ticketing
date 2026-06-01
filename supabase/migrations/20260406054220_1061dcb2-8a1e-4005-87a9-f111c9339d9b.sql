
-- Update RLS on user_roles: allow admin to also manage roles (not just super_admin)
DROP POLICY IF EXISTS "manage_roles" ON public.user_roles;

CREATE POLICY "manage_roles" ON public.user_roles
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update profiles UPDATE policy: allow super_admin and admin to update any profile
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;

CREATE POLICY "update_profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Add assigned_at column to tickets if not exists
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
