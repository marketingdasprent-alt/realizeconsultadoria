CREATE TABLE IF NOT EXISTS public.legal_clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Main info
    name VARCHAR(255) NOT NULL,
    nif VARCHAR(50),
    litigation_value NUMERIC(10, 2) DEFAULT 0,
    description TEXT,
    client_type VARCHAR(50) DEFAULT 'Desconhecido', -- TVDE / Rent a Car
    status VARCHAR(50) DEFAULT 'Ativo',
    
    -- Dados Pessoais
    address VARCHAR(255),
    postal_code VARCHAR(50),
    city VARCHAR(100),
    iban VARCHAR(100),
    
    -- Identificação
    id_type VARCHAR(50),      -- CC, Passaporte, etc.
    id_number VARCHAR(100),
    id_validity DATE,
    
    -- TVDE License (Conditional)
    tvde_license_number VARCHAR(100),
    tvde_license_validity DATE,
    
    -- Contactos
    phone VARCHAR(50),
    email VARCHAR(255),
    
    -- Carta de Condução
    driver_license_number VARCHAR(100),
    driver_license_categories VARCHAR(100),
    driver_license_validity DATE,
    
    -- Resumo Financeiro
    total_credits NUMERIC(10, 2) DEFAULT 0,
    total_debits NUMERIC(10, 2) DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.legal_clients ENABLE ROW LEVEL SECURITY;

-- Policies for logical isolation based on company (SaaS)
CREATE POLICY "Users can view legal_clients from their company"
    ON public.legal_clients FOR SELECT
    USING (
      company_id IN (
        SELECT id FROM public.companies WHERE id = legal_clients.company_id
      )
    );

CREATE POLICY "Users can insert legal_clients to their company"
    ON public.legal_clients FOR INSERT
    WITH CHECK (
      company_id IN (
        SELECT id FROM public.companies WHERE id = legal_clients.company_id
      )
    );

CREATE POLICY "Users can update legal_clients of their company"
    ON public.legal_clients FOR UPDATE
    USING (
      company_id IN (
        SELECT id FROM public.companies WHERE id = legal_clients.company_id
      )
    );

-- Trigger for updated_at
CREATE TRIGGER handle_updated_at_legal_clients
    BEFORE UPDATE ON public.legal_clients
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Note to apply this to standard Supabase setup...
