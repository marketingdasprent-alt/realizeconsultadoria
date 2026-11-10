-- O que o servidor de email não guarda num rascunho e o Realize precisa para o reabrir tal
-- como estava: Bcc, a conversa (inReplyTo), a citação em HTML, os anexos do email reencaminhado
-- (ficam na caixa de origem) e a assinatura escolhida. Uma linha por rascunho guardado.
CREATE TABLE IF NOT EXISTS public.mail_draft_meta (
  account_id uuid NOT NULL REFERENCES public.mail_accounts(id) ON DELETE CASCADE,
  draft_id text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, draft_id)
);
ALTER TABLE public.mail_draft_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Rascunhos: cada um os seus" ON public.mail_draft_meta;
CREATE POLICY "Rascunhos: cada um os seus" ON public.mail_draft_meta
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_draft_meta TO authenticated;

-- Limpeza: rascunhos com mais de 90 dias (já enviados ou apagados noutro sítio)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rz-mail-draft-meta-clean';
SELECT cron.schedule('rz-mail-draft-meta-clean', '17 4 * * *',
  $$DELETE FROM public.mail_draft_meta WHERE created_at < now() - interval '90 days'$$);
