-- Realize 2.0 · Menos carga na BD (plano Nano): cada execução do pg_cron arranca um processo
-- na BD. A verificação do email passa a 1 minuto (era 30 s) e o "acordar" das funções vai na
-- mesma execução (deixa de haver um job à parte a cada 30 s).
CREATE OR REPLACE FUNCTION public.rz_mail_poll()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net
AS $$
DECLARE
  v_token text;
  v_fn text;
BEGIN
  v_token := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mail_system_token' LIMIT 1);
  IF v_token IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/mail-api',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-mail-system-token', v_token),
      body := jsonb_build_object('action', 'poll-new'),
      timeout_milliseconds := 60000
    );
  END IF;
  -- Mantém acordadas as funções que se abrem à mão (sem sessão: respondem logo 401).
  FOREACH v_fn IN ARRAY ARRAY['company-files', 'ai-chat'] LOOP
    PERFORM net.http_post(
      url := 'https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/' || v_fn,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.rz_mail_poll() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('rz-mail-poll', '* * * * *', 'SELECT public.rz_mail_poll()');
SELECT cron.unschedule('rz-keep-functions-warm');
