-- Suporte na Realize Mail (clientes de fora, papel mail_client): abrem tickets que caem no
-- Suporte do admin normal. O ticket passa a ter, em vez da ficha de colaborador, um requerente
-- externo (a conta da app de email), com nome e email; a empresa escolhe-a o cliente.

ALTER TABLE public.support_tickets ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS requester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requester_name text,
  ADD COLUMN IF NOT EXISTS requester_email text;
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_has_requester;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_has_requester
  CHECK (employee_id IS NOT NULL OR requester_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS support_tickets_requester_idx ON public.support_tickets (requester_user_id);

-- "O ticket é meu": também do requerente externo (anexos e ficheiros já usam esta função)
CREATE OR REPLACE FUNCTION public.ticket_is_mine(p_ticket uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM support_tickets st
    LEFT JOIN employees e ON e.id = st.employee_id
    WHERE st.id = p_ticket AND (e.user_id = auth.uid() OR st.requester_user_id = auth.uid())
  );
$$;

-- Empresas para o cliente escolher (só id e nome; a tabela tem NIF, moradas…)
CREATE OR REPLACE FUNCTION public.mail_support_companies()
RETURNS TABLE(id uuid, name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.id, trim(c.name) FROM companies c WHERE coalesce(c.is_active, true) ORDER BY trim(c.name);
$$;
REVOKE ALL ON FUNCTION public.mail_support_companies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mail_support_companies() TO authenticated, mail_client;

-- Permissões do mail_client (só o que o Suporte precisa)
GRANT SELECT, INSERT ON public.support_tickets, public.support_ticket_replies,
  public.support_ticket_attachments TO mail_client;
GRANT SELECT ON public.support_ticket_subjects, public.support_departments TO mail_client;
GRANT EXECUTE ON FUNCTION public.ticket_is_mine(uuid) TO mail_client;
GRANT EXECUTE ON FUNCTION public.rz_is_admin() TO mail_client;
GRANT EXECUTE ON FUNCTION public.ticket_path_ticket(text) TO mail_client;

DROP POLICY IF EXISTS "Mail: ver os meus tickets" ON public.support_tickets;
CREATE POLICY "Mail: ver os meus tickets" ON public.support_tickets
  FOR SELECT TO mail_client USING (requester_user_id = auth.uid());
DROP POLICY IF EXISTS "Mail: abrir tickets" ON public.support_tickets;
CREATE POLICY "Mail: abrir tickets" ON public.support_tickets
  FOR INSERT TO mail_client
  WITH CHECK (requester_user_id = auth.uid() AND employee_id IS NULL AND status = 'open');

DROP POLICY IF EXISTS "Mail: ver respostas dos meus tickets" ON public.support_ticket_replies;
CREATE POLICY "Mail: ver respostas dos meus tickets" ON public.support_ticket_replies
  FOR SELECT TO mail_client USING (ticket_is_mine(ticket_id));
DROP POLICY IF EXISTS "Mail: responder aos meus tickets" ON public.support_ticket_replies;
CREATE POLICY "Mail: responder aos meus tickets" ON public.support_ticket_replies
  FOR INSERT TO mail_client
  WITH CHECK (user_id = auth.uid() AND sender_role = 'employee' AND ticket_is_mine(ticket_id));

DROP POLICY IF EXISTS "Mail: ver anexos dos meus tickets" ON public.support_ticket_attachments;
CREATE POLICY "Mail: ver anexos dos meus tickets" ON public.support_ticket_attachments
  FOR SELECT TO mail_client USING (ticket_is_mine(ticket_id));
ALTER POLICY "Employees can insert ticket attachments" ON public.support_ticket_attachments
  TO authenticated, mail_client;

DROP POLICY IF EXISTS "Mail: assuntos ativos" ON public.support_ticket_subjects;
CREATE POLICY "Mail: assuntos ativos" ON public.support_ticket_subjects
  FOR SELECT TO mail_client USING (is_active = true);
DROP POLICY IF EXISTS "Mail: departamentos ativos" ON public.support_departments;
CREATE POLICY "Mail: departamentos ativos" ON public.support_departments
  FOR SELECT TO mail_client USING (is_active = true);

ALTER POLICY "Tickets: enviar anexos" ON storage.objects TO authenticated, mail_client;
ALTER POLICY "Tickets: ler anexos" ON storage.objects TO authenticated, mail_client;

-- Fila do Suporte (equipas no Workspace): também os tickets de clientes de fora
CREATE OR REPLACE FUNCTION public.support_desk_tickets()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(
    to_jsonb(st)
      || jsonb_build_object(
        'employees', jsonb_build_object(
          'name', coalesce(e.name, st.requester_name),
          'email', coalesce(e.email, st.requester_email)),
        'companies', jsonb_build_object('name', c.name)
      )
    ORDER BY st.created_at DESC), '[]'::jsonb)
  FROM support_tickets st
  LEFT JOIN employees e ON e.id = st.employee_id
  LEFT JOIN companies c ON c.id = st.company_id
  WHERE st.department_id IN (SELECT public.rz_support_desk_departments())
    AND coalesce(e.user_id, st.requester_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
        <> auth.uid();
$$;

-- Avisos: quem abriu o ticket (colaborador ou cliente de fora) recebe as respostas e o estado
CREATE OR REPLACE FUNCTION public.rz_ticket_owner(p_ticket uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT coalesce(e.user_id, st.requester_user_id)
  FROM support_tickets st LEFT JOIN employees e ON e.id = st.employee_id
  WHERE st.id = p_ticket;
$$;

CREATE OR REPLACE FUNCTION public.rz_ticket_link(p_ticket uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  -- Cliente de fora: abre na Realize Mail (/?suporte=…); colaborador: nos seus tickets
  SELECT CASE WHEN st.employee_id IS NULL THEN '/?suporte=' || st.id
              ELSE '/colaborador/tickets?t=' || st.id END
  FROM support_tickets st WHERE st.id = p_ticket;
$$;

CREATE OR REPLACE FUNCTION public.notify_ticket_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM rz_notify(
      coalesce((SELECT e.user_id FROM employees e WHERE e.id = NEW.employee_id), NEW.requester_user_id),
      'ticket',
      CASE NEW.status
        WHEN 'in_progress' THEN 'Ticket em progresso'
        WHEN 'resolved' THEN 'Ticket resolvido'
        WHEN 'closed' THEN 'Ticket fechado'
        ELSE 'Ticket reaberto' END,
      NEW.subject, rz_ticket_link(NEW.id), auth.uid());
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_ticket_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(NEW.sender_role, '') <> 'employee' THEN
    PERFORM rz_notify(
      rz_ticket_owner(NEW.ticket_id), 'ticket', 'Nova resposta do suporte',
      (SELECT t.subject FROM support_tickets t WHERE t.id = NEW.ticket_id),
      rz_ticket_link(NEW.ticket_id), NEW.user_id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_support_desk()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_ticket support_tickets%ROWTYPE;
  v_author uuid;
  v_title text;
  v_agent uuid;
BEGIN
  IF TG_TABLE_NAME = 'support_tickets' THEN
    v_ticket := NEW;
    v_title := 'Novo ticket de suporte';
  ELSE
    IF coalesce(NEW.sender_role, '') <> 'employee' THEN RETURN NEW; END IF;
    SELECT * INTO v_ticket FROM support_tickets WHERE id = NEW.ticket_id;
    v_title := 'Nova resposta num ticket';
  END IF;
  v_author := coalesce(
    (SELECT e.user_id FROM employees e WHERE e.id = v_ticket.employee_id),
    v_ticket.requester_user_id);
  FOR v_agent IN
    SELECT DISTINCT e.user_id
    FROM support_department_teams t
    JOIN employees e ON e.department = t.department
    WHERE t.support_department_id = v_ticket.department_id
      AND e.user_id IS NOT NULL AND coalesce(e.is_active, true)
      AND e.user_id IS DISTINCT FROM v_author
  LOOP
    PERFORM rz_notify(v_agent, 'ticket', v_title, v_ticket.subject,
      '/colaborador/suporte-equipa?t=' || v_ticket.id, v_author);
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Regras antigas "para todos" que só servem utilizadores com sessão (consultam employees e davam
-- erro ao mail_client em vez de não se aplicarem): passam a authenticated
ALTER POLICY "Employees can create own tickets" ON public.support_tickets TO authenticated;
ALTER POLICY "Employees can view own tickets" ON public.support_tickets TO authenticated;
ALTER POLICY "Admins can manage all subjects" ON public.support_ticket_subjects TO authenticated;
ALTER POLICY "Authenticated users can view active subjects" ON public.support_ticket_subjects TO authenticated;
