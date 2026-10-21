-- Pessoas → Comunicados (admin 2.0): email a muitos colaboradores e, se escolhido, o mesmo
-- comunicado na app (Feed → Comunicados, tabela notifications) com notificação no telemóvel.
--
-- 1. O histórico (marketing_emails) passa a guardar o que foi entregue: a quem se pediu, quantos
--    saíram, os que falharam, para quem era e se também foi para a app. Escreve-o a função
--    broadcast-send (service role), já com os números reais.
-- 2. Os avisos da app (notifications) passam a mandar notificação ao telemóvel de quem os vê —
--    os do Comunicados e também os de Definições → Avisos e da ficha do colaborador.

ALTER TABLE public.marketing_emails
  ADD COLUMN IF NOT EXISTS requested_count integer,
  ADD COLUMN IF NOT EXISTS failed_emails text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audience_label text,
  ADD COLUMN IF NOT EXISTS published_in_app boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.marketing_emails.recipients_count IS 'Emails entregues ao Brevo com sucesso.';
COMMENT ON COLUMN public.marketing_emails.requested_count IS 'Emails pedidos (com endereço válido).';
COMMENT ON COLUMN public.marketing_emails.audience_label IS 'Para quem era: "Todos", empresas, departamentos ou "N pessoas".';

/** Aviso novo (ativo) → notificação no telemóvel de quem o vê (push-send { notice_id }). */
CREATE OR REPLACE FUNCTION public.rz_push_on_notice()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;
  v_token := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mail_system_token' LIMIT 1);
  IF v_token IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-system-token', v_token),
    body := jsonb_build_object('notice_id', NEW.id),
    timeout_milliseconds := 15000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push do aviso falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.rz_push_on_notice() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS rz_push_on_notice ON public.notifications;
CREATE TRIGGER rz_push_on_notice
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.rz_push_on_notice();
