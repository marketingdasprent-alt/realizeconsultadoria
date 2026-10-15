-- Realize 2.0 · Webmail (briefing §9): contas de email ligadas por OAuth (Google/Microsoft)
-- ou IMAP. Os tokens e palavras-passe ficam no Supabase Vault; só as edge functions
-- (service role) os leem. As mensagens não são guardadas: as funções vão buscá-las ao
-- fornecedor a pedido.

-- 1. Contas ----------------------------------------------------------------------------

CREATE TABLE public.mail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN
    ('gmail', 'outlook', 'office365', 'exchange', 'icloud', 'yahoo', 'aol', 'imap')),
  auth_method text NOT NULL CHECK (auth_method IN ('oauth-google', 'oauth-microsoft', 'imap')),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 320),
  display_name text CHECK (display_name IS NULL OR char_length(display_name) <= 120),
  signature text CHECK (signature IS NULL OR char_length(signature) <= 5000),
  imap_host text,
  imap_port int,
  smtp_host text,
  smtp_port int,
  -- vault.secrets.id; nunca exposto aos clientes (ver GRANTs abaixo).
  secret_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'reauth')),
  last_error text,
  last_sync_at timestamptz,
  is_default boolean NOT NULL DEFAULT false,
  color text NOT NULL DEFAULT 'violet'
    CHECK (color IN ('violet', 'sky', 'emerald', 'amber', 'rose', 'slate')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);
CREATE UNIQUE INDEX mail_accounts_one_default ON public.mail_accounts (user_id) WHERE is_default;

ALTER TABLE public.mail_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mail: ver as próprias contas" ON public.mail_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Mail: editar as próprias contas" ON public.mail_accounts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Criar e apagar só pelas edge functions (que tratam também do segredo no Vault).

REVOKE ALL ON public.mail_accounts FROM anon, authenticated;
GRANT SELECT (id, user_id, company_id, provider, auth_method, email, display_name, signature,
  imap_host, imap_port, smtp_host, smtp_port, status, last_error, last_sync_at, is_default,
  color, created_at, updated_at) ON public.mail_accounts TO authenticated;
GRANT UPDATE (display_name, signature, is_default, color) ON public.mail_accounts TO authenticated;

-- Uma só conta predefinida por pessoa; updated_at automático.
CREATE FUNCTION public.mail_accounts_before_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.is_default AND (TG_OP = 'INSERT' OR NOT OLD.is_default) THEN
    UPDATE mail_accounts SET is_default = false
    WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER mail_accounts_before_write
  BEFORE INSERT OR UPDATE ON public.mail_accounts
  FOR EACH ROW EXECUTE FUNCTION public.mail_accounts_before_write();

-- Ao apagar uma conta (também em cascata, ao apagar o utilizador) apaga-se o segredo.
CREATE FUNCTION public.mail_accounts_after_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
BEGIN
  IF OLD.secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = OLD.secret_id;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER mail_accounts_after_delete
  AFTER DELETE ON public.mail_accounts
  FOR EACH ROW EXECUTE FUNCTION public.mail_accounts_after_delete();

-- 2. Estados OAuth (só service role) ---------------------------------------------------

CREATE TABLE public.mail_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  oauth_provider text NOT NULL CHECK (oauth_provider IN ('google', 'microsoft')),
  mail_provider text NOT NULL,
  redirect_to text NOT NULL,
  code_verifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mail_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mail_oauth_states FROM anon, authenticated;

-- 3. Segredos no Vault (só service role) -----------------------------------------------

CREATE FUNCTION public.mail_secret_set(p_account uuid, p_secret text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret uuid;
BEGIN
  SELECT secret_id INTO v_secret FROM mail_accounts WHERE id = p_account FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta de email % não existe', p_account;
  END IF;
  IF v_secret IS NULL THEN
    v_secret := vault.create_secret(p_secret, 'mail:' || p_account::text, 'Webmail Realize');
    UPDATE mail_accounts SET secret_id = v_secret WHERE id = p_account;
  ELSE
    PERFORM vault.update_secret(v_secret, p_secret);
  END IF;
END;
$$;

CREATE FUNCTION public.mail_secret_get(p_account uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault
AS $$
  SELECT s.decrypted_secret
  FROM mail_accounts a
  JOIN vault.decrypted_secrets s ON s.id = a.secret_id
  WHERE a.id = p_account;
$$;

CREATE FUNCTION public.mail_account_delete(p_account uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM mail_accounts WHERE id = p_account;
$$;

REVOKE ALL ON FUNCTION public.mail_secret_set(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mail_secret_get(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mail_account_delete(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mail_accounts_before_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mail_accounts_after_delete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mail_secret_set(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mail_secret_get(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mail_account_delete(uuid) TO service_role;
GRANT ALL ON public.mail_accounts, public.mail_oauth_states TO service_role;

