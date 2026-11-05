-- Cópia local dos últimos 30 dias (caixas IMAP): onde ficou cada caixa e a tarefa de 2 em 2 minutos (nos minutos ímpares, fora da verificação de email novo)
-- que a vai enchendo aos poucos (ver supabase/functions/mail-api/backfill.ts).
CREATE TABLE IF NOT EXISTS public.mail_cache_state (
  account_id uuid PRIMARY KEY REFERENCES public.mail_accounts (id) ON DELETE CASCADE,
  page_token text,
  done boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mail_cache_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mail_cache_state FROM anon, authenticated;
GRANT ALL ON public.mail_cache_state TO service_role;

CREATE OR REPLACE FUNCTION public.rz_mail_backfill()
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
    body := jsonb_build_object('action', 'cache-backfill'),
    timeout_milliseconds := 60000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rz_mail_backfill() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('rz-mail-backfill') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rz-mail-backfill');
SELECT cron.schedule('rz-mail-backfill', '1-59/2 * * * *', 'SELECT public.rz_mail_backfill()');
