ALTER TABLE public.tickets
  DROP CONSTRAINT tickets_raised_by_fkey,
  DROP CONSTRAINT tickets_assigned_to_fkey,
  DROP CONSTRAINT tickets_closed_by_fkey;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD CONSTRAINT tickets_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;