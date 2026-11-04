-- Emails reencaminhados pelo Webmail: aparece uma marca na lista. Chave do email como nos
-- marcadores (Message-ID normalizado; sem ele, "id:<id no fornecedor>").
CREATE TABLE IF NOT EXISTS public.mail_forwarded (
  account_id uuid NOT NULL REFERENCES public.mail_accounts (id) ON DELETE CASCADE,
  message_key text NOT NULL,
  forwarded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  forwarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, message_key)
);

ALTER TABLE public.mail_forwarded ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mail_forwarded FROM anon, authenticated;
GRANT ALL ON public.mail_forwarded TO service_role;
