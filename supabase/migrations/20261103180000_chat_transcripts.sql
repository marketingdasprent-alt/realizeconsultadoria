-- Realize 2.0 · Transcrição das mensagens de voz do Mensagens
-- Quem tem acesso à conversa carrega em "Transcrever" e o texto fica guardado (uma só vez por
-- mensagem): todos os membros passam a ver o mesmo texto, sem repetir o pedido ao servidor de voz.
-- Só a edge function chat-transcribe lê e escreve esta tabela (verifica se a pessoa é membro).

CREATE TABLE IF NOT EXISTS public.chat_message_transcripts (
  message_id uuid PRIMARY KEY REFERENCES public.chat_messages (id) ON DELETE CASCADE,
  text text NOT NULL,
  model text,
  requested_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_message_transcripts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_message_transcripts FROM anon, authenticated;
GRANT ALL ON public.chat_message_transcripts TO service_role;
