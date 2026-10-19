-- Realize 2.0 · Webmail: ordem das caixas na barra lateral, escolhida por cada pessoa
-- (arrastar ou "ordenar por ordem alfabética") e igual em todos os dispositivos.
-- Uma linha por pessoa e caixa (as suas e as partilhadas com ela). As caixas sem posição
-- aparecem depois das ordenadas, pela ordem de antes (data de ligação).

CREATE TABLE public.mail_account_order (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.mail_accounts(id) ON DELETE CASCADE,
  position int NOT NULL CHECK (position >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, account_id)
);
CREATE INDEX mail_account_order_account ON public.mail_account_order (account_id);

ALTER TABLE public.mail_account_order ENABLE ROW LEVEL SECURITY;

-- Cada pessoa lê e grava só a sua ordem, e só de caixas que vê (o EXISTS corre com o RLS de
-- mail_accounts: as próprias e as partilhadas com ela).
CREATE POLICY "Mail: a minha ordem das caixas" ON public.mail_account_order
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.mail_accounts a WHERE a.id = account_id)
  );

REVOKE ALL ON public.mail_account_order FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_account_order TO authenticated;
GRANT ALL ON public.mail_account_order TO service_role;
