-- Add invoice_date to legal_client_documents metadata
ALTER TABLE public.legal_client_documents 
ADD COLUMN IF NOT EXISTS invoice_date DATE DEFAULT CURRENT_DATE;

-- Update existing records to have a default invoice_date
UPDATE public.legal_client_documents 
SET invoice_date = created_at::DATE 
WHERE invoice_date IS NULL;
