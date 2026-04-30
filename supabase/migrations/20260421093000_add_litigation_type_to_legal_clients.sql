-- Add litigation_type to legal_clients table
ALTER TABLE public.legal_clients 
ADD COLUMN IF NOT EXISTS litigation_type VARCHAR(50) DEFAULT 'Contencioso';

-- Update existing records (if any)
UPDATE public.legal_clients 
SET litigation_type = 'Contencioso' 
WHERE litigation_type IS NULL;
