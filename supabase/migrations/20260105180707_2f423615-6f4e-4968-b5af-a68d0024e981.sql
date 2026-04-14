-- Tabela de saldos de férias por ano
CREATE TABLE public.employee_vacation_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year integer NOT NULL,
  total_days integer NOT NULL DEFAULT 22,
  used_days integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, year)
);

-- Tabela de períodos de ausência (múltiplos por pedido)
CREATE TABLE public.absence_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  absence_id uuid NOT NULL REFERENCES public.absences(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  business_days integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de feriados
CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  name text NOT NULL,
  year integer NOT NULL,
  is_national boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_vacation_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- RLS: employee_vacation_balances
CREATE POLICY "Admins can manage all vacation balances"
ON public.employee_vacation_balances
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view own vacation balance"
ON public.employee_vacation_balances
FOR SELECT
USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

-- RLS: absence_periods
CREATE POLICY "Admins can manage all absence periods"
ON public.absence_periods
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view company absence periods"
ON public.absence_periods
FOR SELECT
USING (absence_id IN (
  SELECT id FROM public.absences 
  WHERE company_id = public.get_employee_company_id(auth.uid())
));

CREATE POLICY "Employees can create own absence periods"
ON public.absence_periods
FOR INSERT
WITH CHECK (absence_id IN (
  SELECT id FROM public.absences 
  WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
));

-- RLS: holidays (everyone can read, only admin can modify)
CREATE POLICY "Everyone can view holidays"
ON public.holidays
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage holidays"
ON public.holidays
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at on vacation balances
CREATE TRIGGER update_vacation_balances_updated_at
BEFORE UPDATE ON public.employee_vacation_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert Portuguese holidays for 2025-2028
INSERT INTO public.holidays (date, name, year) VALUES
-- 2025
('2025-01-01', 'Ano Novo', 2025),
('2025-04-18', 'Sexta-Feira Santa', 2025),
('2025-04-20', 'Páscoa', 2025),
('2025-04-25', 'Dia da Liberdade', 2025),
('2025-05-01', 'Dia do Trabalhador', 2025),
('2025-06-10', 'Dia de Portugal', 2025),
('2025-06-19', 'Corpo de Deus', 2025),
('2025-08-15', 'Assunção de Nossa Senhora', 2025),
('2025-10-05', 'Implantação da República', 2025),
('2025-11-01', 'Dia de Todos os Santos', 2025),
('2025-12-01', 'Restauração da Independência', 2025),
('2025-12-08', 'Imaculada Conceição', 2025),
('2025-12-25', 'Natal', 2025),
-- 2026
('2026-01-01', 'Ano Novo', 2026),
('2026-04-03', 'Sexta-Feira Santa', 2026),
('2026-04-05', 'Páscoa', 2026),
('2026-04-25', 'Dia da Liberdade', 2026),
('2026-05-01', 'Dia do Trabalhador', 2026),
('2026-06-04', 'Corpo de Deus', 2026),
('2026-06-10', 'Dia de Portugal', 2026),
('2026-08-15', 'Assunção de Nossa Senhora', 2026),
('2026-10-05', 'Implantação da República', 2026),
('2026-11-01', 'Dia de Todos os Santos', 2026),
('2026-12-01', 'Restauração da Independência', 2026),
('2026-12-08', 'Imaculada Conceição', 2026),
('2026-12-25', 'Natal', 2026),
-- 2027
('2027-01-01', 'Ano Novo', 2027),
('2027-03-26', 'Sexta-Feira Santa', 2027),
('2027-03-28', 'Páscoa', 2027),
('2027-04-25', 'Dia da Liberdade', 2027),
('2027-05-01', 'Dia do Trabalhador', 2027),
('2027-05-27', 'Corpo de Deus', 2027),
('2027-06-10', 'Dia de Portugal', 2027),
('2027-08-15', 'Assunção de Nossa Senhora', 2027),
('2027-10-05', 'Implantação da República', 2027),
('2027-11-01', 'Dia de Todos os Santos', 2027),
('2027-12-01', 'Restauração da Independência', 2027),
('2027-12-08', 'Imaculada Conceição', 2027),
('2027-12-25', 'Natal', 2027),
-- 2028
('2028-01-01', 'Ano Novo', 2028),
('2028-04-14', 'Sexta-Feira Santa', 2028),
('2028-04-16', 'Páscoa', 2028),
('2028-04-25', 'Dia da Liberdade', 2028),
('2028-05-01', 'Dia do Trabalhador', 2028),
('2028-06-10', 'Dia de Portugal', 2028),
('2028-06-15', 'Corpo de Deus', 2028),
('2028-08-15', 'Assunção de Nossa Senhora', 2028),
('2028-10-05', 'Implantação da República', 2028),
('2028-11-01', 'Dia de Todos os Santos', 2028),
('2028-12-01', 'Restauração da Independência', 2028),
('2028-12-08', 'Imaculada Conceição', 2028),
('2028-12-25', 'Natal', 2028);