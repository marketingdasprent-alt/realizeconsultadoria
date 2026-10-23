-- Jurídico só para administradores. Antes: qualquer colaborador com sessão via os clientes
-- jurídicos da sua empresa e lia/alterava/apagava prestações e documentos; a agenda estava
-- aberta até sem sessão. Também regista no repositório o que só existia à mão na BD
-- (legal_agenda_events, equipments.invoice_url).

/** Administrador: papel admin ou membro de um grupo de admin ativo. */
CREATE OR REPLACE FUNCTION public.rz_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM admin_group_members m
        JOIN admin_groups g ON g.id = m.group_id AND g.is_active
        WHERE m.user_id = auth.uid()
      );
$$;
REVOKE ALL ON FUNCTION public.rz_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_is_admin() TO authenticated;

-- Tabelas que existiam só na BD (feitas à mão): ficam no repositório.
CREATE TABLE IF NOT EXISTS public.legal_agenda_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  event_date date NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS invoice_url text;

ALTER TABLE public.legal_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_agenda_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert legal_clients to their company" ON public.legal_clients;
DROP POLICY IF EXISTS "Users can update legal_clients of their company" ON public.legal_clients;
DROP POLICY IF EXISTS "Users can view legal_clients from their company" ON public.legal_clients;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.legal_installments;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.legal_client_documents;
DROP POLICY IF EXISTS "Enable all access to legal_agenda_events" ON public.legal_agenda_events;

CREATE POLICY "Jurídico: só administradores" ON public.legal_clients
  FOR ALL TO authenticated USING (public.rz_is_admin()) WITH CHECK (public.rz_is_admin());
CREATE POLICY "Jurídico: só administradores" ON public.legal_installments
  FOR ALL TO authenticated USING (public.rz_is_admin()) WITH CHECK (public.rz_is_admin());
CREATE POLICY "Jurídico: só administradores" ON public.legal_client_documents
  FOR ALL TO authenticated USING (public.rz_is_admin()) WITH CHECK (public.rz_is_admin());
CREATE POLICY "Jurídico: só administradores" ON public.legal_agenda_events
  FOR ALL TO authenticated USING (public.rz_is_admin()) WITH CHECK (public.rz_is_admin());

REVOKE ALL ON public.legal_clients, public.legal_installments, public.legal_client_documents,
  public.legal_agenda_events FROM anon;
