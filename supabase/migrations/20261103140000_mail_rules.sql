-- Realize 2.0 · Regras do Webmail
-- "Se o remetente / a palavra-chave for X, move o email para a pasta Y (e marca como lido)".
-- Pertencem à caixa (também às partilhadas: quem a usa partilha as regras). Quem as aplica é a
-- edge function mail-api: a cada passagem de "email novo" (2 minutos) e quando se cria uma regra
-- (aos emails que já estão na Entrada). O browser nunca lê esta tabela: passa pela função.

CREATE TABLE IF NOT EXISTS public.mail_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.mail_accounts (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  from_contains text,
  keyword text,
  folder_id text NOT NULL,
  folder_name text NOT NULL,
  mark_read boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mail_rules_has_condition CHECK (
    coalesce(btrim(from_contains), '') <> '' OR coalesce(btrim(keyword), '') <> ''
  )
);

CREATE INDEX IF NOT EXISTS mail_rules_account ON public.mail_rules (account_id) WHERE is_active;

ALTER TABLE public.mail_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mail_rules FROM anon, authenticated;
GRANT ALL ON public.mail_rules TO service_role;
