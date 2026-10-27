-- Tarefas: quem é posto como participante vê a tarefa logo (antes só aparecia ao recarregar,
-- porque a tarefa é gravada antes dos participantes e esta tabela não estava no tempo real).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'task_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_participants;
  END IF;
END $$;
