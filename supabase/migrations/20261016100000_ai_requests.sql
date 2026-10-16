-- Realize 2.0 · Realize AI: registo dos pedidos ao modelo, só para limitar o uso por pessoa
-- (a edge function ai-chat conta os últimos minutos e o último dia). Sem políticas: só a
-- função, com service role, lê e escreve; os colaboradores não veem nada desta tabela.

CREATE TABLE public.ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_requests_user_created_idx ON public.ai_requests (user_id, created_at DESC);
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_requests FROM anon, authenticated;
