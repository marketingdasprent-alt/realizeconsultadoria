-- Reações aos comunicados (notifications) no Feed. Uma reação por pessoa e comunicado,
-- para dar para votações ("reaja com 🎃 para a equipa A, 👻 para a B"): mudar de emoji
-- troca o voto. Os admins veem quem reagiu com quê no histórico de comunicados.

CREATE TABLE IF NOT EXISTS public.notice_reactions (
  notification_id uuid NOT NULL REFERENCES public.notifications (id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

ALTER TABLE public.notice_reactions ENABLE ROW LEVEL SECURITY;

-- Vê as reações quem vê o comunicado (a RLS de notifications aplica-se no EXISTS) e os admins.
CREATE POLICY "Comunicados: ver reações" ON public.notice_reactions
  FOR SELECT TO authenticated
  USING (
    public.rz_is_admin()
    OR EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = notification_id)
  );

CREATE POLICY "Comunicados: reagir" ON public.notice_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = notification_id)
  );

CREATE POLICY "Comunicados: mudar a reação" ON public.notice_reactions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = notification_id)
  );

CREATE POLICY "Comunicados: retirar a reação" ON public.notice_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notice_reactions TO authenticated;
