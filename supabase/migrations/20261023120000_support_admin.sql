-- Suporte (admin): nota interna que o colaborador não vê e regras iguais para todos os
-- administradores (papel admin ou grupo de admin ativo), como no resto do admin.

CREATE TABLE IF NOT EXISTS public.support_ticket_internal_notes (
  ticket_id uuid PRIMARY KEY REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 10000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.support_ticket_internal_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Suporte: nota interna só admin" ON public.support_ticket_internal_notes;
CREATE POLICY "Suporte: nota interna só admin" ON public.support_ticket_internal_notes
  FOR ALL TO authenticated USING (public.rz_is_admin()) WITH CHECK (public.rz_is_admin());
REVOKE ALL ON public.support_ticket_internal_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_internal_notes TO authenticated;

-- Tickets e respostas: também os membros de grupos de admin (antes só o papel admin).
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.support_tickets;
CREATE POLICY "Admins can manage all tickets" ON public.support_tickets
  FOR ALL TO authenticated USING (public.rz_is_admin()) WITH CHECK (public.rz_is_admin());

DROP POLICY IF EXISTS "Admins can view all replies" ON public.support_ticket_replies;
CREATE POLICY "Admins can view all replies" ON public.support_ticket_replies
  FOR SELECT TO authenticated USING (public.rz_is_admin());

DROP POLICY IF EXISTS "Admins can reply to tickets" ON public.support_ticket_replies;
CREATE POLICY "Admins can reply to tickets" ON public.support_ticket_replies
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND sender_role = 'admin' AND public.rz_is_admin());

-- Anexos dos tickets: os admins de grupo também os veem (tabela e ficheiros).
DROP POLICY IF EXISTS "Employees can view own ticket attachments" ON public.support_ticket_attachments;
CREATE POLICY "Employees can view own ticket attachments" ON public.support_ticket_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets st JOIN employees e ON e.id = st.employee_id
      WHERE st.id = support_ticket_attachments.ticket_id AND e.user_id = auth.uid()
    )
    OR public.rz_is_admin()
  );

DROP POLICY IF EXISTS "Tickets: ler anexos" ON storage.objects;
CREATE POLICY "Tickets: ler anexos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND (public.rz_is_admin() OR public.ticket_is_mine(public.ticket_path_ticket(name)))
  );
