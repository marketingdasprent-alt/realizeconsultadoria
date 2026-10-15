-- Realize 2.0 · Caixas partilhadas criadas pela própria BD: o admin continua a ser o de
-- sempre (realize.dasprent.pt), que não conhece o Webmail. Quando um colaborador é
-- associado a um email departamental e o acesso ainda não tem caixa, a BD pede à edge
-- function mail-api (pg_net, assíncrono) para a criar: descobre os servidores, testa o
-- login e junta os membros. O token de sistema está no Vault ('mail_system_token') e nos
-- segredos das funções (MAIL_SYSTEM_TOKEN); não vai no repositório.

CREATE OR REPLACE FUNCTION public.mail_request_share(p_access uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net
AS $$
DECLARE
  v_token text := (SELECT decrypted_secret FROM vault.decrypted_secrets
                   WHERE name = 'mail_system_token' LIMIT 1);
BEGIN
  IF v_token IS NULL OR EXISTS (SELECT 1 FROM mail_accounts WHERE access_id = p_access) THEN
    RETURN;
  END IF;
  -- Só emails (o utilizador do acesso é um endereço).
  IF NOT EXISTS (SELECT 1 FROM accesses WHERE id = p_access AND username LIKE '%_@_%._%') THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/mail-api',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mail-system-token', v_token),
    body := jsonb_build_object('action', 'share-access', 'access_id', p_access),
    timeout_milliseconds := 30000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mail_request_share(uuid) FROM PUBLIC, anon, authenticated;

-- Uma chamada por acesso e por gravação (o admin apaga e volta a inserir todos de uma vez).
CREATE FUNCTION public.mail_department_emails_inserted()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_access uuid;
BEGIN
  FOR v_access IN SELECT DISTINCT access_id FROM new_rows LOOP
    PERFORM mail_request_share(v_access);
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear o ecrã de Acessos por causa do Webmail.
  RETURN NULL;
END;
$$;
CREATE TRIGGER mail_department_emails_inserted
  AFTER INSERT ON public.employee_department_emails
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.mail_department_emails_inserted();
REVOKE ALL ON FUNCTION public.mail_department_emails_inserted() FROM PUBLIC, anon, authenticated;

-- Palavra-passe corrigida num acesso que ainda não tinha caixa (o login falhou antes):
-- tenta outra vez.
CREATE OR REPLACE FUNCTION public.mail_access_changed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account uuid := (SELECT id FROM mail_accounts WHERE access_id = NEW.id);
BEGIN
  IF v_account IS NULL THEN
    IF (NEW.password IS DISTINCT FROM OLD.password OR NEW.username IS DISTINCT FROM OLD.username)
       AND EXISTS (SELECT 1 FROM employee_department_emails WHERE access_id = NEW.id) THEN
      PERFORM mail_request_share(NEW.id);
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.password IS DISTINCT FROM OLD.password OR NEW.username IS DISTINCT FROM OLD.username THEN
    PERFORM mail_secret_set(
      v_account,
      json_build_object('username', lower(trim(NEW.username)), 'password', NEW.password)::text
    );
    UPDATE mail_accounts
    SET email = lower(trim(NEW.username)), status = 'active', last_error = NULL
    WHERE id = v_account;
  END IF;
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    UPDATE mail_accounts SET display_name = left(NEW.title, 120) WHERE id = v_account;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
