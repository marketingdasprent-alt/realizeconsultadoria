-- Realize 2.0 · Caixas partilhadas: cada colaborador tem a sua assinatura e a sua cor na
-- caixa (ex.: rh@ assinada por quem escreve). A caixa em si continua gerida pelo admin.
-- As linhas de mail_account_members sobrevivem às sincronizações (mail_sync_access_members
-- só apaga quem perdeu o acesso e insere com ON CONFLICT DO NOTHING).

ALTER TABLE public.mail_account_members
  ADD COLUMN signature text CHECK (signature IS NULL OR char_length(signature) <= 5000),
  ADD COLUMN color text CHECK (color IS NULL OR color IN ('violet', 'sky', 'emerald', 'amber', 'rose', 'slate'));

CREATE POLICY "Mail: editar as minhas preferências da caixa partilhada"
  ON public.mail_account_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT UPDATE (signature, color) ON public.mail_account_members TO authenticated;
