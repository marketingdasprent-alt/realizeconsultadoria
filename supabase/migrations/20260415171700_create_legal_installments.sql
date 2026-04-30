-- Create the table for legal payment installments
CREATE TABLE IF NOT EXISTS public.legal_installments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.legal_clients(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'Pendente', -- 'Pendente', 'Pago', 'Atrasado'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: RLS usually needs enabling if authentication is strictly enforced via policies
ALTER TABLE public.legal_installments ENABLE ROW LEVEL SECURITY;

-- Creating a permissive policy for testing (or adapt to your company_id structure later. Since client_id cascades, security is handled partially by the parent fetching)
CREATE POLICY "Enable all for authenticated users" ON public.legal_installments
    FOR ALL USING (auth.role() = 'authenticated');
