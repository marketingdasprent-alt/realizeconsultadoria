CREATE TABLE IF NOT EXISTS public.site_domains (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    domain_name text NOT NULL,
    renewal_value numeric(10, 2) NOT NULL DEFAULT 0,
    renewal_date date NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.site_domains ENABLE ROW LEVEL SECURITY;

-- Policies (Admins only)
CREATE POLICY "Admins can manage site_domains" 
ON public.site_domains 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);
