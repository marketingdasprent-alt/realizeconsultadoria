-- Acessos — fase 4: palavras-passe cifradas.
--
-- accesses.password guardava as palavras-passe em texto. Passam a ficar cifradas
-- (pgp_sym_encrypt, pgcrypto) em password_encrypted, com a chave no Vault; a coluna password
-- fica só com '••••••••'. Quem escreve — admin novo, admin antigo, SQL — continua a escrever
-- em password: o trigger cifra e apaga o texto antes de gravar. Para ler há access_password()
-- (só administradores e o service role), chamada ao "Mostrar"/"Copiar" e pela mail-api.
-- O admin antigo (realize.dasprent.pt) deixa de mostrar as palavras-passe (mostra os pontos);
-- continua a poder criar e alterar.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.accesses ADD COLUMN IF NOT EXISTS password_encrypted bytea;

COMMENT ON COLUMN public.accesses.password IS
  'Escreve-se aqui a palavra-passe; o trigger cifra-a em password_encrypted e deixa ••••••••.';
COMMENT ON COLUMN public.accesses.password_encrypted IS
  'Palavra-passe cifrada (pgp_sym_encrypt, chave access_password_key no Vault). Ler com access_password().';

-- Chave própria no Vault (nunca sai da BD).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'access_password_key') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'access_password_key',
      'Chave das palavras-passe dos Acessos (accesses.password_encrypted)'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.access_password_key()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'access_password_key';
$$;
REVOKE ALL ON FUNCTION public.access_password_key() FROM PUBLIC, anon, authenticated;

/** A palavra-passe em claro de uma linha (cifrada, ou ainda em texto se for antiga). */
CREATE OR REPLACE FUNCTION public.access_plain_password(_password text, _encrypted bytea)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN _encrypted IS NOT NULL THEN extensions.pgp_sym_decrypt(_encrypted, access_password_key())
    ELSE NULLIF(_password, '••••••••')
  END;
$$;
REVOKE ALL ON FUNCTION public.access_plain_password(text, bytea) FROM PUBLIC, anon, authenticated;

-- Antes de gravar: o texto escrito em password vai cifrado e a coluna fica com os pontos.
-- Gravar sem mudar a palavra-passe (o admin antigo devolve os pontos) mantém a cifrada.
CREATE OR REPLACE FUNCTION public.accesses_encrypt_password()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.password IS NOT NULL AND NEW.password <> '' AND NEW.password <> '••••••••' THEN
    NEW.password_encrypted := extensions.pgp_sym_encrypt(NEW.password, access_password_key());
  END IF;
  NEW.password := '••••••••';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.accesses_encrypt_password() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS accesses_encrypt_password ON public.accesses;
CREATE TRIGGER accesses_encrypt_password
  BEFORE INSERT OR UPDATE ON public.accesses
  FOR EACH ROW EXECUTE FUNCTION public.accesses_encrypt_password();

/** Palavra-passe de um acesso, para "Mostrar"/"Copiar" no admin e para a mail-api. */
CREATE OR REPLACE FUNCTION public.access_password(_access_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Sem acesso às palavras-passe' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT access_plain_password(a.password, a.password_encrypted)
    FROM accesses a WHERE a.id = _access_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.access_password(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.access_password(uuid) TO authenticated, service_role;

-- A caixa no Webmail usa a palavra-passe em claro (antes lia NEW.password).
CREATE OR REPLACE FUNCTION public.mail_access_changed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account uuid := (SELECT id FROM mail_accounts WHERE access_id = NEW.id);
  v_password text := access_plain_password(NEW.password, NEW.password_encrypted);
  v_login_changed boolean :=
    v_password IS DISTINCT FROM access_plain_password(OLD.password, OLD.password_encrypted)
    OR NEW.username IS DISTINCT FROM OLD.username;
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
      json_build_object('username', lower(trim(NEW.username)), 'password', v_password)::text
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

-- Cifrar as que já existem (pelo trigger acima), sem mexer na data de alteração nem no Webmail
-- (a palavra-passe é a mesma).
-- Confere-se no fim que todas voltam iguais ao decifrar; se não, nada fica gravado.
BEGIN;
CREATE TEMP TABLE accesses_before ON COMMIT DROP AS
  SELECT id, md5(password) AS digest FROM public.accesses
  WHERE password_encrypted IS NULL AND password <> '••••••••';
ALTER TABLE public.accesses DISABLE TRIGGER update_accesses_updated_at;
ALTER TABLE public.accesses DISABLE TRIGGER mail_access_changed;
UPDATE public.accesses
SET password = password
WHERE password_encrypted IS NULL AND password <> '••••••••';
ALTER TABLE public.accesses ENABLE TRIGGER update_accesses_updated_at;
ALTER TABLE public.accesses ENABLE TRIGGER mail_access_changed;
DO $$
DECLARE
  v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad
  FROM accesses_before b
  JOIN public.accesses a ON a.id = b.id
  WHERE a.password <> '••••••••'
     OR md5(public.access_plain_password(a.password, a.password_encrypted)) <> b.digest;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Cifra das palavras-passe falhou em % acessos', v_bad;
  END IF;
END;
$$;
COMMIT;
