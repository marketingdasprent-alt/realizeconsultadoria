-- Lembretes diários por email (aniversários e renovação de serviços pagos): o agendador da base de
-- dados passa a enviar o token de sistema, que já está no Vault ('mail_system_token', o mesmo do
-- push-send e do mail-api). As funções passam a recusar quem não leve esse token (ou a chave de
-- serviço), para ninguém de fora as poder disparar e mandar email a todos.
--
-- ORDEM DE PUBLICAÇÃO: aplicar ESTA migração primeiro. Antes de as funções novas estarem no ar, as
-- antigas ignoram o cabeçalho, por isso nada se parte. Depois, publicar as funções.
--
-- Aditiva: só troca o comando dos dois agendamentos existentes e cria uma função auxiliar. Não
-- altera dados nem tabelas. O agendamento "enviar-lembretes-juridicos-diarios" (que tem um
-- endereço e uma chave de exemplo, e por isso nunca funcionou) fica como está: ligá-lo passaria a
-- enviar emails que hoje não são enviados.

CREATE OR REPLACE FUNCTION public.rz_call_system_function(p_name text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net
AS $$
DECLARE
  v_token text := (SELECT decrypted_secret FROM vault.decrypted_secrets
                   WHERE name = 'mail_system_token' LIMIT 1);
BEGIN
  IF v_token IS NULL THEN
    RAISE WARNING 'rz_call_system_function: sem mail_system_token no Vault; % não foi chamada', p_name;
    RETURN;
  END IF;
  -- Só funções de lembrete conhecidas (nunca um nome vindo de fora)
  IF p_name NOT IN ('send-birthday-reminders', 'send-service-renewal-reminders') THEN
    RAISE EXCEPTION 'Função não permitida: %', p_name;
  END IF;
  PERFORM net.http_post(
    url := 'https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-system-token', v_token),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rz_call_system_function(text) FROM PUBLIC, anon, authenticated;

-- Mesmos nomes e horas de hoje (08:00 UTC); só muda o comando
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'send-birthday-reminders';
SELECT cron.schedule(
  'send-birthday-reminders', '0 8 * * *',
  $$SELECT public.rz_call_system_function('send-birthday-reminders')$$
);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'service-renewal-reminder';
SELECT cron.schedule(
  'service-renewal-reminder', '0 8 * * *',
  $$SELECT public.rz_call_system_function('send-service-renewal-reminders')$$
);
