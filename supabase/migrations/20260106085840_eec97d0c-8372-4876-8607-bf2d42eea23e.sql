-- Update the status check constraint to allow 'partially_approved'
ALTER TABLE public.absences DROP CONSTRAINT IF EXISTS absences_status_check;
ALTER TABLE public.absences ADD CONSTRAINT absences_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'partially_approved'::text]));