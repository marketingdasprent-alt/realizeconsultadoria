-- Registo de envios do Webmail e relatório diário do email (aviso na app aos super admins,
-- todos os dias às 08:00): caixas com erro, envios falhados e lentos nas últimas 24 h.
CREATE TABLE IF NOT EXISTS public.mail_send_log (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.mail_accounts (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ok boolean NOT NULL,
  code text,
  message text,
  ms integer NOT NULL DEFAULT 0,
  attachments integer NOT NULL DEFAULT 0,
  recipients integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mail_send_log_created ON public.mail_send_log (created_at);

ALTER TABLE public.mail_send_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mail_send_log FROM anon, authenticated;
GRANT ALL ON public.mail_send_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.mail_send_log_id_seq TO service_role;

-- Pede o relatório à função mail-api (o mesmo token de sistema da verificação de email novo)
CREATE OR REPLACE FUNCTION public.rz_mail_report()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault', 'net'
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mail_system_token' LIMIT 1);
  IF v_token IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/mail-api',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mail-system-token', v_token),
    body := jsonb_build_object('action', 'daily-report'),
    timeout_milliseconds := 60000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rz_mail_report() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('rz-mail-report') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rz-mail-report');
SELECT cron.schedule('rz-mail-report', '0 8 * * *', 'SELECT public.rz_mail_report()');
