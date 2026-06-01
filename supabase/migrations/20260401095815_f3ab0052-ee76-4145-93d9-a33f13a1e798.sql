
-- Tickets table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  unit_id UUID REFERENCES public.units(id),
  department_id UUID REFERENCES public.departments(id),
  issue_department_id UUID REFERENCES public.departments(id),
  raised_by UUID REFERENCES auth.users(id) NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  status ticket_status NOT NULL DEFAULT 'open',
  target_date DATE,
  next_target_date DATE,
  remarks TEXT,
  photo_url TEXT,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id),
  closing_remarks TEXT,
  reopened_at TIMESTAMPTZ,
  reopen_remarks TEXT,
  reopen_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE SEQUENCE public.ticket_number_seq START 1;
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'TKT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.ticket_number_seq')::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER set_ticket_number BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.generate_ticket_number();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "view_tickets" ON public.tickets FOR SELECT TO authenticated
USING (
  raised_by = auth.uid()
  OR assigned_to = auth.uid()
  OR issue_department_id = public.get_user_department_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hod')
);
CREATE POLICY "create_tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (raised_by = auth.uid());
CREATE POLICY "update_tickets" ON public.tickets FOR UPDATE TO authenticated
USING (
  assigned_to = auth.uid() OR raised_by = auth.uid()
  OR public.has_role(auth.uid(), 'hod')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin')
);

-- Ticket history
CREATE TABLE public.ticket_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  old_status ticket_status,
  new_status ticket_status,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_history" ON public.ticket_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (
  t.raised_by = auth.uid() OR t.assigned_to = auth.uid()
  OR t.issue_department_id = public.get_user_department_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hod')
)));
CREATE POLICY "insert_history" ON public.ticket_history FOR INSERT TO authenticated WITH CHECK (performed_by = auth.uid());

-- Ratings
CREATE TABLE public.ticket_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL UNIQUE,
  rated_by UUID REFERENCES auth.users(id) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_ratings" ON public.ticket_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_ratings" ON public.ticket_ratings FOR INSERT TO authenticated
WITH CHECK (rated_by = auth.uid() AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.raised_by = auth.uid() AND t.status = 'closed'));

-- Attachments
CREATE TABLE public.ticket_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  attachment_type TEXT DEFAULT 'ticket',
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_attachments" ON public.ticket_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_attachments" ON public.ticket_attachments FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-attachments', 'ticket-attachments', true);
CREATE POLICY "view_ticket_files" ON storage.objects FOR SELECT USING (bucket_id = 'ticket-attachments');
CREATE POLICY "upload_ticket_files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ticket-attachments');

-- Indexes
CREATE INDEX idx_tickets_raised_by ON public.tickets(raised_by);
CREATE INDEX idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_issue_dept ON public.tickets(issue_department_id);
CREATE INDEX idx_ticket_history_ticket ON public.ticket_history(ticket_id);
