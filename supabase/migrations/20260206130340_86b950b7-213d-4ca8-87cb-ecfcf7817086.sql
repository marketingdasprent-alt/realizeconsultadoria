-- 1. Adicionar coluna domain à tabela companies existente
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS domain text;

-- 2. Criar tabela access_categories
CREATE TABLE public.access_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text DEFAULT 'Key',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.access_categories ENABLE ROW LEVEL SECURITY;

-- RLS policy for admins
CREATE POLICY "Admins can manage all access categories"
ON public.access_categories
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Criar tabela accesses
CREATE TABLE public.accesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.access_categories(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  title text NOT NULL,
  username text NOT NULL,
  password text NOT NULL,
  url text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accesses ENABLE ROW LEVEL SECURITY;

-- RLS policy for admins
CREATE POLICY "Admins can manage all accesses"
ON public.accesses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_accesses_updated_at
BEFORE UPDATE ON public.accesses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Criar tabela employee_department_emails
CREATE TABLE public.employee_department_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  access_id uuid NOT NULL REFERENCES public.accesses(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (employee_id, access_id)
);

-- Enable RLS
ALTER TABLE public.employee_department_emails ENABLE ROW LEVEL SECURITY;

-- RLS policy for admins
CREATE POLICY "Admins can manage all employee department emails"
ON public.employee_department_emails
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));