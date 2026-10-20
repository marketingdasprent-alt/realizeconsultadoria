-- Serviços pagos: os domínios passam a ir no mesmo lembrete diário dos serviços
-- (send-service-renewal-reminders). O job antigo só dos domínios sai.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'domain-renewal-reminder') THEN
    PERFORM cron.unschedule('domain-renewal-reminder');
  END IF;
END
$$;
