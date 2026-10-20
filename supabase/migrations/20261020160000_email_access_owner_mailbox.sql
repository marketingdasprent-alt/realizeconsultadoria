-- Acessos → Emails: o acesso de email passa a ser o que liga a caixa às pessoas no Webmail.
--  * Email pessoal (accesses.employee_id): a caixa aparece no Webmail do dono, como já
--    acontecia com os departamentais (employee_department_emails).
--  * Só acessos de categoria de email, com um endereço como utilizador (um "Servidor" com
--    utilizador em forma de email não cria caixa).
--  * Quem já ligou essa mesma caixa por conta própria no Webmail não a recebe em duplicado.
--  * Desativar o colaborador (ou tirar-lhe a conta) tira-lhe as caixas; reativar devolve.
-- Os acessos pessoais que já existem não se ligam sozinhos: liga-os o admin (Acessos → Emails).

CREATE OR REPLACE FUNCTION public.mail_is_email_access(p_access uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM accesses a
    JOIN access_categories c ON c.id = a.category_id
    WHERE a.id = p_access AND c.name ILIKE '%email%' AND a.username LIKE '%_@_%._%'
  );
$$;
REVOKE ALL ON FUNCTION public.mail_is_email_access(uuid) FROM PUBLIC, anon, authenticated;

-- Quem deve ter a caixa de um acesso: as pessoas do email departamental e o dono do pessoal.
CREATE OR REPLACE FUNCTION public.mail_access_wanted_members(p_access uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.user_id
  FROM employee_department_emails d
  JOIN employees e ON e.id = d.employee_id
  WHERE d.access_id = p_access AND e.user_id IS NOT NULL AND e.is_active
  UNION
  SELECT e.user_id
  FROM accesses a
  JOIN employees e ON e.id = a.employee_id
  WHERE a.id = p_access AND e.user_id IS NOT NULL AND e.is_active
    AND mail_is_email_access(a.id)
    AND NOT EXISTS (
      SELECT 1 FROM mail_accounts own
      WHERE own.user_id = e.user_id AND own.access_id IS NULL
        AND lower(own.email) = lower(trim(a.username))
    );
$$;
REVOKE ALL ON FUNCTION public.mail_access_wanted_members(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mail_sync_access_members(p_access uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account uuid := (SELECT id FROM mail_accounts WHERE access_id = p_access);
BEGIN
  IF v_account IS NULL THEN
    RETURN;
  END IF;
  DELETE FROM mail_account_members m
  WHERE m.account_id = v_account
    AND m.user_id NOT IN (SELECT mail_access_wanted_members(p_access));
  INSERT INTO mail_account_members (account_id, user_id)
  SELECT v_account, u FROM mail_access_wanted_members(p_access) AS u
  ON CONFLICT DO NOTHING;
END;
$$;

-- Acesso alterado: palavra-passe/utilizador seguem para a caixa; mudar o dono ou a
-- categoria atualiza quem a tem; sem caixa ainda, pede-se (se houver a quem a dar).
CREATE OR REPLACE FUNCTION public.mail_access_changed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account uuid := (SELECT id FROM mail_accounts WHERE access_id = NEW.id);
  v_login_changed boolean :=
    NEW.password IS DISTINCT FROM OLD.password OR NEW.username IS DISTINCT FROM OLD.username;
  v_owner_changed boolean :=
    NEW.employee_id IS DISTINCT FROM OLD.employee_id OR NEW.category_id IS DISTINCT FROM OLD.category_id;
BEGIN
  IF v_account IS NULL THEN
    IF (v_login_changed OR v_owner_changed)
       AND (EXISTS (SELECT 1 FROM employee_department_emails WHERE access_id = NEW.id)
            OR (NEW.employee_id IS NOT NULL AND mail_is_email_access(NEW.id))) THEN
      PERFORM mail_request_share(NEW.id);
    END IF;
    RETURN NEW;
  END IF;
  IF v_login_changed THEN
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
  IF v_owner_changed THEN
    PERFORM mail_sync_access_members(NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Email pessoal novo, já com dono: cria a caixa.
CREATE OR REPLACE FUNCTION public.mail_access_inserted()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NOT NULL AND mail_is_email_access(NEW.id) THEN
    PERFORM mail_request_share(NEW.id);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.mail_access_inserted() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS mail_access_inserted ON public.accesses;
CREATE TRIGGER mail_access_inserted
  AFTER INSERT ON public.accesses
  FOR EACH ROW EXECUTE FUNCTION public.mail_access_inserted();

-- Colaborador desativado, reativado ou com outra conta: acerta as caixas dele.
CREATE OR REPLACE FUNCTION public.mail_employee_changed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_access uuid;
BEGIN
  FOR v_access IN
    SELECT a.id FROM accesses a WHERE a.employee_id = NEW.id
    UNION
    SELECT d.access_id FROM employee_department_emails d WHERE d.employee_id = NEW.id
  LOOP
    IF EXISTS (SELECT 1 FROM mail_accounts WHERE access_id = v_access) THEN
      PERFORM mail_sync_access_members(v_access);
    ELSIF NEW.is_active AND NEW.user_id IS NOT NULL THEN
      PERFORM mail_request_share(v_access);
    END IF;
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.mail_employee_changed() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS mail_employee_changed ON public.employees;
CREATE TRIGGER mail_employee_changed
  AFTER UPDATE OF is_active, user_id ON public.employees
  FOR EACH ROW
  WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active OR OLD.user_id IS DISTINCT FROM NEW.user_id)
  EXECUTE FUNCTION public.mail_employee_changed();

-- Pedir a caixa só para acessos de email (antes bastava o utilizador parecer um endereço).
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
  IF NOT EXISTS (SELECT 1 FROM accesses WHERE id = p_access AND username LIKE '%_@_%._%') THEN
    RETURN;
  END IF;
  IF NOT mail_is_email_access(p_access)
     AND NOT EXISTS (SELECT 1 FROM employee_department_emails WHERE access_id = p_access) THEN
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
