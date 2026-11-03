-- Realize 2.0 · Regras do Webmail: cada regra trata um email uma só vez
-- Uma regra que só põe marcadores deixa o email na Entrada; sem este registo voltava a ser
-- aplicada a cada 2 minutos (e repunha o marcador que a pessoa tinha tirado de propósito).

CREATE TABLE IF NOT EXISTS public.mail_rule_hits (
  rule_id uuid NOT NULL REFERENCES public.mail_rules (id) ON DELETE CASCADE,
  message_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, message_key)
);

ALTER TABLE public.mail_rule_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mail_rule_hits FROM anon, authenticated;
GRANT ALL ON public.mail_rule_hits TO service_role;
