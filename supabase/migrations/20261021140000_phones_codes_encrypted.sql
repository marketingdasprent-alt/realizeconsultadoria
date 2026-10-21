-- Cartões SIM: PIN e PUK cifrados (como as palavras-passe dos Acessos, mesma chave no Vault).
--
-- phones.pin / phones.puk ficam só com '••••'; o valor vai cifrado em pin_encrypted /
-- puk_encrypted. Quem escreve continua a escrever em pin/puk: o trigger cifra. Gravar com os
-- pontos (sem mexer) mantém o que está; gravar vazio apaga. Para ler: phone_codes() (só
-- administradores), ao "Mostrar"/"Copiar" e na declaração de entrega impressa.

ALTER TABLE public.phones
  ADD COLUMN IF NOT EXISTS pin_encrypted bytea,
  ADD COLUMN IF NOT EXISTS puk_encrypted bytea;

COMMENT ON COLUMN public.phones.pin_encrypted IS 'PIN cifrado (chave access_password_key). Ler com phone_codes().';
COMMENT ON COLUMN public.phones.puk_encrypted IS 'PUK cifrado (chave access_password_key). Ler com phone_codes().';

CREATE OR REPLACE FUNCTION public.phones_encrypt_codes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.pin IS NULL OR NEW.pin = '' THEN
    NEW.pin_encrypted := NULL;
    NEW.pin := NULL;
  ELSIF NEW.pin <> '••••' THEN
    NEW.pin_encrypted := extensions.pgp_sym_encrypt(NEW.pin, access_password_key());
    NEW.pin := '••••';
  END IF;
  IF NEW.puk IS NULL OR NEW.puk = '' THEN
    NEW.puk_encrypted := NULL;
    NEW.puk := NULL;
  ELSIF NEW.puk <> '••••' THEN
    NEW.puk_encrypted := extensions.pgp_sym_encrypt(NEW.puk, access_password_key());
    NEW.puk := '••••';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.phones_encrypt_codes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS phones_encrypt_codes ON public.phones;
CREATE TRIGGER phones_encrypt_codes
  BEFORE INSERT OR UPDATE ON public.phones
  FOR EACH ROW EXECUTE FUNCTION public.phones_encrypt_codes();

/** PIN e PUK em claro dos cartões pedidos (só administradores). */
CREATE OR REPLACE FUNCTION public.phone_codes(_phone_ids uuid[])
RETURNS TABLE (id uuid, pin text, puk text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Sem acesso aos códigos dos cartões' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id,
      CASE WHEN p.pin_encrypted IS NOT NULL
        THEN extensions.pgp_sym_decrypt(p.pin_encrypted, access_password_key()) END,
      CASE WHEN p.puk_encrypted IS NOT NULL
        THEN extensions.pgp_sym_decrypt(p.puk_encrypted, access_password_key()) END
    FROM phones p WHERE p.id = ANY(_phone_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.phone_codes(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phone_codes(uuid[]) TO authenticated;

-- Cifrar os que existem, sem mexer na data de alteração; confere-se que decifram iguais.
BEGIN;
CREATE TEMP TABLE phones_before ON COMMIT DROP AS
  SELECT id, md5(coalesce(pin, '')) AS pin_digest, md5(coalesce(puk, '')) AS puk_digest
  FROM public.phones
  WHERE (pin IS NOT NULL AND pin <> '••••') OR (puk IS NOT NULL AND puk <> '••••');
ALTER TABLE public.phones DISABLE TRIGGER update_phones_updated_at;
UPDATE public.phones SET pin = pin, puk = puk
WHERE id IN (SELECT id FROM phones_before);
ALTER TABLE public.phones ENABLE TRIGGER update_phones_updated_at;
DO $$
DECLARE
  v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad
  FROM phones_before b
  JOIN public.phones p ON p.id = b.id
  WHERE coalesce(p.pin, '') NOT IN ('', '••••')
     OR coalesce(p.puk, '') NOT IN ('', '••••')
     OR md5(coalesce(extensions.pgp_sym_decrypt(p.pin_encrypted, public.access_password_key()), '')) <> b.pin_digest
     OR md5(coalesce(extensions.pgp_sym_decrypt(p.puk_encrypted, public.access_password_key()), '')) <> b.puk_digest;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Cifra dos PIN/PUK falhou em % cartões', v_bad;
  END IF;
END;
$$;
COMMIT;
