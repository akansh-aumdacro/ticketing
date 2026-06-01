
-- Add priority enum
CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Add priority column to tickets
ALTER TABLE public.tickets ADD COLUMN priority public.ticket_priority NOT NULL DEFAULT 'medium';
