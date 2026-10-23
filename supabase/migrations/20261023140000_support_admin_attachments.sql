-- Suporte: o admin responde com anexos. Quem é admin por grupo (rz_is_admin) também pode
-- enviar ficheiros para o ticket, não só quem tem o papel 'admin'.
DROP POLICY IF EXISTS "Tickets: enviar anexos" ON storage.objects;
CREATE POLICY "Tickets: enviar anexos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND (public.rz_is_admin() OR public.ticket_is_mine(public.ticket_path_ticket(name)))
  );

DROP POLICY IF EXISTS "Employees can insert ticket attachments" ON public.support_ticket_attachments;
CREATE POLICY "Employees can insert ticket attachments" ON public.support_ticket_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (public.ticket_is_mine(ticket_id) OR public.rz_is_admin())
  );

-- Anexos novos aparecem logo na conversa aberta (dos dois lados).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_ticket_attachments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_attachments;
  END IF;
END $$;
