-- Create roles table for permission definitions, keyed by existing app_role enum name
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name app_role NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins manage roles"
  ON public.roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default permissions for each existing app role
INSERT INTO public.roles (name, description, permissions) VALUES
('super_admin', 'Full system access', '{
  "tickets": {"create":true,"viewAll":true,"viewOwn":true,"assign":true,"updateStatus":true,"close":true,"delete":true},
  "dashboard": {"view":true,"scope":"all"},
  "sidebar": {"overview":true,"analytics":true,"summary":true,"createTicket":true,"myTickets":true,"pendingTickets":true,"assignedTickets":true,"departmentTickets":true,"manageUsers":true,"settings":true},
  "department": "all"
}'::jsonb),
('admin', 'Administrator access', '{
  "tickets": {"create":true,"viewAll":true,"viewOwn":true,"assign":true,"updateStatus":true,"close":true,"delete":false},
  "dashboard": {"view":true,"scope":"all"},
  "sidebar": {"overview":true,"analytics":true,"summary":true,"createTicket":true,"myTickets":true,"pendingTickets":true,"assignedTickets":true,"departmentTickets":true,"manageUsers":true,"settings":false},
  "department": "all"
}'::jsonb),
('hod', 'Head of Department access', '{
  "tickets": {"create":true,"viewAll":false,"viewOwn":true,"assign":true,"updateStatus":true,"close":false,"delete":false},
  "dashboard": {"view":true,"scope":"department"},
  "sidebar": {"overview":true,"analytics":true,"summary":true,"createTicket":true,"myTickets":true,"pendingTickets":true,"assignedTickets":true,"departmentTickets":true,"manageUsers":false,"settings":false},
  "department": "own"
}'::jsonb),
('assigned_person', 'Team member / technician', '{
  "tickets": {"create":false,"viewAll":false,"viewOwn":true,"assign":false,"updateStatus":true,"close":true,"delete":false},
  "dashboard": {"view":false,"scope":"own"},
  "sidebar": {"overview":true,"analytics":false,"summary":false,"createTicket":false,"myTickets":true,"pendingTickets":false,"assignedTickets":true,"departmentTickets":false,"manageUsers":false,"settings":false},
  "department": "own"
}'::jsonb),
('user', 'Standard user', '{
  "tickets": {"create":true,"viewAll":false,"viewOwn":true,"assign":false,"updateStatus":false,"close":false,"delete":false},
  "dashboard": {"view":false,"scope":"own"},
  "sidebar": {"overview":true,"analytics":false,"summary":false,"createTicket":true,"myTickets":true,"pendingTickets":false,"assignedTickets":false,"departmentTickets":false,"manageUsers":false,"settings":false},
  "department": "own"
}'::jsonb)
ON CONFLICT (name) DO NOTHING;