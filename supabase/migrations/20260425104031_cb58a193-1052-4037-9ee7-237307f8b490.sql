CREATE POLICY "superadmin_delete_tickets"
ON public.tickets
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));