-- Realize 2.0 · Pedidos para eliminar nos Documentos da empresa (SRVDC, D:\Shares)
-- Quem tem edição numa pasta pode pedir para eliminar um ficheiro ou subpasta; os
-- administradores recebem um aviso e aprovam ou recusam. Só depois de aprovado é que a edge
-- function company-files pede ao agente do servidor para mover para o lixo (_Lixo_Realize).
-- Só a edge function (service role) lê e escreve esta tabela.

CREATE TABLE IF NOT EXISTS public.file_delete_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  name text NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('file', 'dir')),
  requested_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  requester_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'rejected', 'done', 'failed')),
  decided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  decided_at timestamptz,
  trash_path text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Um só pedido pendente por caminho
CREATE UNIQUE INDEX IF NOT EXISTS file_delete_requests_pending_path
  ON public.file_delete_requests (path) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS file_delete_requests_created
  ON public.file_delete_requests (created_at DESC);

ALTER TABLE public.file_delete_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.file_delete_requests FROM anon, authenticated;
