
-- Fix ticket_history performed_by FK to point to profiles
ALTER TABLE public.ticket_history DROP CONSTRAINT IF EXISTS ticket_history_performed_by_fkey;
ALTER TABLE public.ticket_history ADD CONSTRAINT ticket_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.profiles(user_id);

-- Fix ticket_ratings rated_by FK to point to profiles
ALTER TABLE public.ticket_ratings DROP CONSTRAINT IF EXISTS ticket_ratings_rated_by_fkey;
ALTER TABLE public.ticket_ratings ADD CONSTRAINT ticket_ratings_rated_by_fkey FOREIGN KEY (rated_by) REFERENCES public.profiles(user_id);

-- Fix ticket_attachments uploaded_by FK to point to profiles
ALTER TABLE public.ticket_attachments DROP CONSTRAINT IF EXISTS ticket_attachments_uploaded_by_fkey;
ALTER TABLE public.ticket_attachments ADD CONSTRAINT ticket_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(user_id);
