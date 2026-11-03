-- Realize 2.0 · Marcadores coloridos do Webmail (como as categorias do Outlook)
-- Pertencem à caixa: quem tem acesso a ela (dono ou membros de uma caixa partilhada) vê os mesmos
-- marcadores e o mesmo estado ("Por tratar", "Tratado"…). Um email pode ter vários. Cada pessoa
-- cria os seus. O marcador fica ligado ao Message-ID do email (não à pasta nem ao UID do
-- servidor IMAP), por isso sobrevive quando o email muda de pasta.
-- Só a edge function mail-api lê e escreve estas tabelas.

CREATE TABLE IF NOT EXISTS public.mail_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.mail_accounts (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> '' AND char_length(name) <= 40),
  color text NOT NULL DEFAULT 'blue',
  -- Automação ao pôr o marcador: { folder_id, folder_name, mark_read, remove_label_ids[] }
  on_apply jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mail_labels_account_name
  ON public.mail_labels (account_id, lower(name));

CREATE TABLE IF NOT EXISTS public.mail_message_labels (
  account_id uuid NOT NULL REFERENCES public.mail_accounts (id) ON DELETE CASCADE,
  -- Message-ID do email (minúsculas, sem <>); sem ele, "id:<id do email no fornecedor>"
  message_key text NOT NULL,
  label_id uuid NOT NULL REFERENCES public.mail_labels (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, message_key, label_id)
);

CREATE INDEX IF NOT EXISTS mail_message_labels_label ON public.mail_message_labels (label_id);

-- As regras passam a poder pôr marcadores (e a pasta deixa de ser obrigatória)
ALTER TABLE public.mail_rules ADD COLUMN IF NOT EXISTS label_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.mail_rules ALTER COLUMN folder_id DROP NOT NULL;
ALTER TABLE public.mail_rules ALTER COLUMN folder_name DROP NOT NULL;
ALTER TABLE public.mail_rules DROP CONSTRAINT IF EXISTS mail_rules_has_action;
ALTER TABLE public.mail_rules ADD CONSTRAINT mail_rules_has_action CHECK (
  coalesce(btrim(folder_id), '') <> '' OR cardinality(label_ids) > 0
);

ALTER TABLE public.mail_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_message_labels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mail_labels FROM anon, authenticated;
REVOKE ALL ON public.mail_message_labels FROM anon, authenticated;
GRANT ALL ON public.mail_labels TO service_role;
GRANT ALL ON public.mail_message_labels TO service_role;
