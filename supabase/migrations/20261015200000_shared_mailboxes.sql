-- Realize 2.0 · Caixas partilhadas: um email departamental dos Acessos (admin) passa a
-- aparecer no Webmail dos colaboradores escolhidos. Uma só conta por acesso
-- (mail_accounts.access_id, sem dono), com a palavra-passe no Vault, e uma lista de membros
-- que segue employee_department_emails. O admin controla tudo: tirar o colaborador corta o
-- acesso, mudar a palavra-passe atualiza a caixa, apagar o acesso apaga a caixa.
-- A conta é criada pela edge function mail-api (ação share-access), que descobre os
-- servidores e testa o login; daí em diante os triggers mantêm tudo em sincronia.

-- 1. Contas sem dono, ligadas a um acesso ------------------------------------------------

ALTER TABLE public.mail_accounts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.mail_accounts
  ADD COLUMN access_id uuid UNIQUE REFERENCES public.accesses(id) ON DELETE CASCADE;
ALTER TABLE public.mail_accounts
  ADD CONSTRAINT mail_accounts_owner_or_access CHECK (user_id IS NOT NULL OR access_id IS NOT NULL);

GRANT SELECT (access_id) ON public.mail_accounts TO authenticated;

-- 2. Membros ------------------------------------------------------------------------------

CREATE TABLE public.mail_account_members (
  account_id uuid NOT NULL REFERENCES public.mail_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, user_id)
);
CREATE INDEX mail_account_members_user ON public.mail_account_members (user_id);
ALTER TABLE public.mail_account_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mail: ver as próprias partilhas" ON public.mail_account_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
-- Escritas só pelos triggers e pela edge function.
REVOKE ALL ON public.mail_account_members FROM anon, authenticated;
GRANT SELECT ON public.mail_account_members TO authenticated;
GRANT ALL ON public.mail_account_members TO service_role;

CREATE FUNCTION public.mail_is_member(p_account uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM mail_account_members WHERE account_id = p_account AND user_id = p_user);
$$;
REVOKE ALL ON FUNCTION public.mail_is_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mail_is_member(uuid, uuid) TO authenticated, service_role;

-- O colaborador vê as suas contas e as partilhadas com ele (editar continua só o dono).
DROP POLICY "Mail: ver as próprias contas" ON public.mail_accounts;
CREATE POLICY "Mail: ver as próprias contas" ON public.mail_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.mail_is_member(id, auth.uid()));

-- 3. Sincronização com os Acessos ---------------------------------------------------------

-- Membros a partir das escolhas do admin (employee_department_emails).
CREATE FUNCTION public.mail_sync_access_members(p_access uuid)
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
    AND m.user_id NOT IN (
      SELECT e.user_id FROM employee_department_emails d
      JOIN employees e ON e.id = d.employee_id
      WHERE d.access_id = p_access AND e.user_id IS NOT NULL AND e.is_active
    );
  INSERT INTO mail_account_members (account_id, user_id)
  SELECT v_account, e.user_id FROM employee_department_emails d
  JOIN employees e ON e.id = d.employee_id
  WHERE d.access_id = p_access AND e.user_id IS NOT NULL AND e.is_active
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.mail_sync_access_members(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mail_sync_access_members(uuid) TO service_role;

CREATE FUNCTION public.mail_department_emails_changed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM mail_sync_access_members(coalesce(NEW.access_id, OLD.access_id));
  RETURN coalesce(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear o ecrã de Acessos por causa do Webmail.
  RETURN coalesce(NEW, OLD);
END;
$$;
CREATE TRIGGER mail_department_emails_changed
  AFTER INSERT OR DELETE ON public.employee_department_emails
  FOR EACH ROW EXECUTE FUNCTION public.mail_department_emails_changed();

-- Palavra-passe ou endereço mudados nos Acessos → a caixa acompanha.
CREATE FUNCTION public.mail_access_changed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account uuid := (SELECT id FROM mail_accounts WHERE access_id = NEW.id);
BEGIN
  IF v_account IS NULL THEN
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
CREATE TRIGGER mail_access_changed
  AFTER UPDATE ON public.accesses
  FOR EACH ROW EXECUTE FUNCTION public.mail_access_changed();

REVOKE ALL ON FUNCTION public.mail_department_emails_changed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mail_access_changed() FROM PUBLIC, anon, authenticated;
