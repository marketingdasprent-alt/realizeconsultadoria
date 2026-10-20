-- Serviços pagos: em vez de escrever a data da próxima renovação, indica-se a data de início
-- e o ciclo (mensal, trimestral, semestral, anual); a renovação calcula-se a partir daí.
ALTER TABLE public.recurring_services ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.site_domains ADD COLUMN IF NOT EXISTS start_date date;

ALTER TABLE public.recurring_services DROP CONSTRAINT IF EXISTS recurring_services_billing_cycle_check;
ALTER TABLE public.recurring_services
  ADD CONSTRAINT recurring_services_billing_cycle_check
  CHECK (billing_cycle IN ('monthly', 'quarterly', 'semiannual', 'yearly'));
