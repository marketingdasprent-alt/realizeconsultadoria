ALTER TABLE IF EXISTS public.legal_clients 
ADD COLUMN IF NOT EXISTS deadline_date DATE;
