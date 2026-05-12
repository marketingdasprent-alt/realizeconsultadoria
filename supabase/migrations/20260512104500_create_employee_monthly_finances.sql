-- Tabela mensal de valores financeiros por colaborador (gerida pela equipa RH)
-- Valor transferido = valor_recebido - valor_subsidio_alimentacao (calculado na app)

CREATE TABLE public.employee_monthly_finances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  valor_recebido NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_subsidio_alimentacao NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_cartao_da NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, month)
);

CREATE INDEX idx_emp_monthly_finances_period
  ON public.employee_monthly_finances (year DESC, month DESC);

CREATE INDEX idx_emp_monthly_finances_employee
  ON public.employee_monthly_finances (employee_id);

-- Trigger reutilizando o helper existente public.update_updated_at_column()
CREATE TRIGGER update_employee_monthly_finances_updated_at
  BEFORE UPDATE ON public.employee_monthly_finances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: pertence ao grupo "RH" activo? (SECURITY DEFINER → ignora RLS)
CREATE OR REPLACE FUNCTION public.is_rh_member(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_group_members agm
    JOIN admin_groups ag ON ag.id = agm.group_id
    WHERE agm.user_id = _user_id
      AND ag.name = 'RH'
      AND ag.is_active = true
  )
$$;

-- RLS
ALTER TABLE public.employee_monthly_finances ENABLE ROW LEVEL SECURITY;

-- VIEW: qualquer admin com acesso ao módulo employees vê os valores
CREATE POLICY "Admins with employees access can view finances"
ON public.employee_monthly_finances FOR SELECT
TO authenticated
USING (
  public.has_module_permission(auth.uid(), 'employees', 'view')
  OR public.has_module_permission(auth.uid(), 'employees', 'execute')
);

-- WRITE (insert/update/delete): apenas membros do grupo RH
CREATE POLICY "RH can insert employee finances"
ON public.employee_monthly_finances FOR INSERT
TO authenticated
WITH CHECK (public.is_rh_member(auth.uid()));

CREATE POLICY "RH can update employee finances"
ON public.employee_monthly_finances FOR UPDATE
TO authenticated
USING (public.is_rh_member(auth.uid()))
WITH CHECK (public.is_rh_member(auth.uid()));

CREATE POLICY "RH can delete employee finances"
ON public.employee_monthly_finances FOR DELETE
TO authenticated
USING (public.is_rh_member(auth.uid()));

-- Cada colaborador pode ver os SEUS próprios registos (útil para
-- expor o histórico no portal do colaborador no futuro)
CREATE POLICY "Employees can view own monthly finances"
ON public.employee_monthly_finances FOR SELECT
TO authenticated
USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);
