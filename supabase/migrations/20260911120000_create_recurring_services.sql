-- Serviços recorrentes: instalações de internet e assinaturas (Microsoft 365, Claude, ...).
--
-- Segue o modelo de public.site_domains, mas generalizado:
--   * service_type distingue uma instalação de internet de uma assinatura;
--   * billing_cycle permite ciclos mensais (internet) além dos anuais (domínios/assinaturas);
--   * last_paid_date substitui o last_paid_year dos domínios, porque um ano não chega
--     para identificar o período pago quando a cobrança é mensal.
--
-- Considera-se o ciclo actual pago quando last_paid_date = renewal_date menos um período,
-- ou seja, quando a renovação já foi avançada ao marcar o pagamento.

CREATE TABLE IF NOT EXISTS public.recurring_services (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    service_type text NOT NULL CHECK (service_type IN ('internet', 'subscription')),
    name text NOT NULL,
    provider text,
    company_id uuid REFERENCES public.companies (id) ON DELETE SET NULL,
    -- Morada da instalação. Só se aplica a service_type = 'internet'.
    location text,
    amount numeric(10, 2) NOT NULL DEFAULT 0,
    billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    -- Data da próxima renovação/débito. Avança um período quando marcado como pago.
    renewal_date date NOT NULL,
    -- Data de renovação do último período pago. NULL quando o ciclo actual está pendente.
    last_paid_date date,
    -- Fim do período de fidelização. NULL quando não há fidelização.
    fidelity_end date,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.recurring_services.renewal_date IS
  'Data da próxima renovação. Avança um mês ou um ano (conforme billing_cycle) quando é marcado como pago.';
COMMENT ON COLUMN public.recurring_services.last_paid_date IS
  'Data de renovação do último período pago. Pago quando last_paid_date = renewal_date menos um período.';

-- Listagens e o email de avisos ordenam/filtram sempre por data de renovação.
CREATE INDEX IF NOT EXISTS recurring_services_renewal_date_idx
  ON public.recurring_services (renewal_date);
CREATE INDEX IF NOT EXISTS recurring_services_company_id_idx
  ON public.recurring_services (company_id);

DROP TRIGGER IF EXISTS update_recurring_services_updated_at ON public.recurring_services;
CREATE TRIGGER update_recurring_services_updated_at
  BEFORE UPDATE ON public.recurring_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: apenas admins, tal como em site_domains.
ALTER TABLE public.recurring_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage recurring_services" ON public.recurring_services;
CREATE POLICY "Admins can manage recurring_services"
ON public.recurring_services
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Agendamento do email de avisos (requer pg_cron e pg_net activos).
-- Correr manualmente depois de fazer deploy da edge function:
--
-- SELECT cron.schedule(
--   'service-renewal-reminder',
--   '0 8 * * *',
--   $$
--     select net.http_post(
--         url:='https://jvvnsoasylusbmyfotci.supabase.co/functions/v1/send-service-renewal-reminders',
--         headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
--         body:='{}'::jsonb
--     )
--   $$
-- );
