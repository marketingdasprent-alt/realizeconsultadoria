-- Realize 2.0 · Webmail: várias assinaturas por caixa (como no Outlook), uma predefinida,
-- e escolha da assinatura ao escrever. Cada pessoa tem as suas, também nas caixas partilhadas.
-- As colunas antigas (mail_accounts.signature e mail_account_members.signature) ficam como
-- cópia de segurança: a app deixa de as ler e as assinaturas atuais passam para aqui.

CREATE TABLE public.mail_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.mail_accounts(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  html text NOT NULL CHECK (char_length(html) <= 20000),
  is_default boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mail_signatures_owner ON public.mail_signatures (user_id, account_id, position);
-- No máximo uma predefinida por pessoa e caixa.
CREATE UNIQUE INDEX mail_signatures_one_default
  ON public.mail_signatures (user_id, account_id) WHERE is_default;

ALTER TABLE public.mail_signatures ENABLE ROW LEVEL SECURITY;

-- Cada pessoa lê e grava só as suas, e só de caixas que vê (o EXISTS corre com o RLS de
-- mail_accounts: as próprias e as partilhadas com ela).
CREATE POLICY "Mail: as minhas assinaturas" ON public.mail_signatures
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.mail_accounts a WHERE a.id = account_id)
  );

REVOKE ALL ON public.mail_signatures FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_signatures TO authenticated;
GRANT ALL ON public.mail_signatures TO service_role;

-- Caixas próprias: a assinatura da caixa passa a "Assinatura" predefinida do dono.
INSERT INTO public.mail_signatures (user_id, account_id, name, html, is_default)
SELECT a.user_id, a.id, 'Assinatura', a.signature, true
FROM public.mail_accounts a
WHERE a.access_id IS NULL AND a.signature IS NOT NULL AND btrim(a.signature) <> '';

-- Caixas partilhadas: a de cada pessoa.
INSERT INTO public.mail_signatures (user_id, account_id, name, html, is_default)
SELECT m.user_id, m.account_id, 'Assinatura', m.signature, true
FROM public.mail_account_members m
JOIN public.mail_accounts a ON a.id = m.account_id AND a.access_id IS NOT NULL
WHERE m.signature IS NOT NULL AND btrim(m.signature) <> ''
ON CONFLICT DO NOTHING;
