-- Suporte em tempo real: tickets e respostas novas aparecem sem recarregar (admin e colaborador).
-- A RLS continua a decidir quem recebe o quê.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'support_tickets') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'support_ticket_replies') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_replies;
  END IF;
END $$;
