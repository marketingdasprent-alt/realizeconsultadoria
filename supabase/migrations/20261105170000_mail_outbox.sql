-- Caixa de saída do Webmail (ver supabase/functions/mail-api/outbox.ts): Enviar guarda o pedido
-- aqui e o envio corre num pedido próprio; repete-se de minuto a minuto se falhar antes de sair.
CREATE TABLE IF NOT EXISTS public.mail_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.mail_accounts (id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  -- O pedido de envio (some quando o email sai ou falha de vez)
  payload jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS mail_outbox_status ON public.mail_outbox (status, updated_at);
CREATE INDEX IF NOT EXISTS mail_outbox_user ON public.mail_outbox (user_id, created_at);

ALTER TABLE public.mail_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mail_outbox FROM anon, authenticated;
GRANT ALL ON public.mail_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.rz_mail_outbox()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault', 'net'
AS $$
DECLARE
  v_token text;
BEGIN
  -- Só chama a função quando há alguma coisa na fila (sem pedidos à toa)
  IF NOT EXISTS (SELECT 1 FROM public.mail_outbox WHERE status IN ('queued', 'sending')) THEN
    RETURN;
  END IF;
  v_token := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mail_system_token' LIMIT 1);
  IF v_token IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/mail-api',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mail-system-token', v_token),
    body := jsonb_build_object('action', 'outbox-retry'),
    timeout_milliseconds := 60000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rz_mail_outbox() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('rz-mail-outbox') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rz-mail-outbox');
SELECT cron.schedule('rz-mail-outbox', '* * * * *', 'SELECT public.rz_mail_outbox()');
