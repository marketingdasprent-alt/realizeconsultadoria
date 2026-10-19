-- Realize 2.0 · Avisos de email novo
-- A cada 2 minutos a BD pede à mail-api que veja as caixas de entrada; os emails novos por ler
-- viram avisos (user_notifications, tipo 'mail'), que seguem para o telemóvel pelo push.

-- Até onde já se avisou em cada conta (a primeira passagem só marca o ponto de partida).
ALTER TABLE public.mail_accounts ADD COLUMN IF NOT EXISTS notified_until timestamptz;

ALTER TABLE public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_kind_check;
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (
  kind = ANY (ARRAY[
    'appreciation', 'feed_comment', 'absence', 'ticket', 'document', 'task', 'event',
    'assistant', 'mail'
  ])
);

CREATE OR REPLACE FUNCTION public.rz_mail_poll()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net
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
    body := jsonb_build_object('action', 'poll-new'),
    timeout_milliseconds := 60000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rz_mail_poll() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('rz-mail-poll', '*/2 * * * *', 'SELECT public.rz_mail_poll()');
