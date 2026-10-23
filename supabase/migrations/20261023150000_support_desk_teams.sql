-- Suporte no Workspace: quem é de um departamento da empresa ligado a um departamento de
-- suporte (ex.: Desenvolvimento → "Marketing | TI") atende esses tickets sem ser admin.
CREATE TABLE IF NOT EXISTS public.support_department_teams (
  support_department_id uuid NOT NULL REFERENCES public.support_departments(id) ON DELETE CASCADE,
  department text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (support_department_id, department)
);
ALTER TABLE public.support_department_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suporte: ver equipas" ON public.support_department_teams;
CREATE POLICY "Suporte: ver equipas" ON public.support_department_teams
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Suporte: gerir equipas" ON public.support_department_teams;
CREATE POLICY "Suporte: gerir equipas" ON public.support_department_teams
  FOR ALL TO authenticated USING (public.rz_is_admin()) WITH CHECK (public.rz_is_admin());
REVOKE ALL ON public.support_department_teams FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_department_teams TO authenticated;

-- Os departamentos de suporte que o utilizador atual atende pela sua equipa.
CREATE OR REPLACE FUNCTION public.rz_support_desk_departments()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT t.support_department_id
  FROM support_department_teams t
  JOIN employees e ON e.department = t.department
  WHERE e.user_id = auth.uid() AND coalesce(e.is_active, true);
$$;

-- Pode tratar o ticket: admin, ou da equipa do departamento do ticket (e não é o autor).
CREATE OR REPLACE FUNCTION public.rz_can_handle_ticket(p_ticket uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.rz_is_admin() OR EXISTS (
    SELECT 1 FROM support_tickets st
    WHERE st.id = p_ticket
      AND st.department_id IN (SELECT public.rz_support_desk_departments())
      AND NOT public.ticket_is_mine(st.id)
  );
$$;
REVOKE ALL ON FUNCTION public.rz_support_desk_departments() FROM anon, public;
REVOKE ALL ON FUNCTION public.rz_can_handle_ticket(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rz_support_desk_departments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rz_can_handle_ticket(uuid) TO authenticated;

-- Tickets
DROP POLICY IF EXISTS "Suporte: equipa vê tickets" ON public.support_tickets;
CREATE POLICY "Suporte: equipa vê tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (public.rz_can_handle_ticket(id));
DROP POLICY IF EXISTS "Suporte: equipa muda estado" ON public.support_tickets;
CREATE POLICY "Suporte: equipa muda estado" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.rz_can_handle_ticket(id)) WITH CHECK (public.rz_can_handle_ticket(id));

-- Respostas (a equipa responde como suporte)
DROP POLICY IF EXISTS "Suporte: equipa vê respostas" ON public.support_ticket_replies;
CREATE POLICY "Suporte: equipa vê respostas" ON public.support_ticket_replies
  FOR SELECT TO authenticated USING (public.rz_can_handle_ticket(ticket_id));
DROP POLICY IF EXISTS "Suporte: equipa responde" ON public.support_ticket_replies;
CREATE POLICY "Suporte: equipa responde" ON public.support_ticket_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND sender_role = 'admin' AND public.rz_can_handle_ticket(ticket_id)
  );

-- Anexos (tabela e ficheiros)
DROP POLICY IF EXISTS "Suporte: equipa vê anexos" ON public.support_ticket_attachments;
CREATE POLICY "Suporte: equipa vê anexos" ON public.support_ticket_attachments
  FOR SELECT TO authenticated USING (public.rz_can_handle_ticket(ticket_id));
DROP POLICY IF EXISTS "Suporte: equipa envia anexos" ON public.support_ticket_attachments;
CREATE POLICY "Suporte: equipa envia anexos" ON public.support_ticket_attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.rz_can_handle_ticket(ticket_id));

DROP POLICY IF EXISTS "Suporte: equipa lê ficheiros" ON storage.objects;
CREATE POLICY "Suporte: equipa lê ficheiros" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND public.rz_can_handle_ticket(public.ticket_path_ticket(name))
  );
DROP POLICY IF EXISTS "Suporte: equipa envia ficheiros" ON storage.objects;
CREATE POLICY "Suporte: equipa envia ficheiros" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND public.rz_can_handle_ticket(public.ticket_path_ticket(name))
  );

-- Nota interna: admin ou equipa do ticket
DROP POLICY IF EXISTS "Suporte: nota interna só admin" ON public.support_ticket_internal_notes;
DROP POLICY IF EXISTS "Suporte: nota interna da equipa" ON public.support_ticket_internal_notes;
CREATE POLICY "Suporte: nota interna da equipa" ON public.support_ticket_internal_notes
  FOR ALL TO authenticated
  USING (public.rz_can_handle_ticket(ticket_id))
  WITH CHECK (public.rz_can_handle_ticket(ticket_id));

-- A fila da equipa, com nome/email de quem pediu e a empresa (sem abrir a tabela employees).
CREATE OR REPLACE FUNCTION public.support_desk_tickets()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(
    to_jsonb(st)
      || jsonb_build_object(
        'employees', jsonb_build_object('name', e.name, 'email', e.email),
        'companies', jsonb_build_object('name', c.name)
      )
    ORDER BY st.created_at DESC), '[]'::jsonb)
  FROM support_tickets st
  JOIN employees e ON e.id = st.employee_id
  LEFT JOIN companies c ON c.id = st.company_id
  WHERE st.department_id IN (SELECT public.rz_support_desk_departments())
    AND coalesce(e.user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid();
$$;
REVOKE ALL ON FUNCTION public.support_desk_tickets() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.support_desk_tickets() TO authenticated;

-- Avisos (app + push) à equipa: ticket novo e resposta do colaborador.
CREATE OR REPLACE FUNCTION public.notify_support_desk()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
  SELECT e.user_id INTO v_author FROM employees e WHERE e.id = v_ticket.employee_id;
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

DROP TRIGGER IF EXISTS notify_support_desk_ticket ON public.support_tickets;
CREATE TRIGGER notify_support_desk_ticket AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_desk();
DROP TRIGGER IF EXISTS notify_support_desk_reply ON public.support_ticket_replies;
CREATE TRIGGER notify_support_desk_reply AFTER INSERT ON public.support_ticket_replies
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_desk();

-- O aviso ao colaborador já não diz "RH" (há tickets de outros departamentos).
CREATE OR REPLACE FUNCTION public.notify_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.sender_role, '') <> 'employee' THEN
    PERFORM rz_notify(
      (SELECT e.user_id FROM support_tickets t JOIN employees e ON e.id = t.employee_id
        WHERE t.id = NEW.ticket_id), 'ticket',
      'Nova resposta do suporte',
      (SELECT t.subject FROM support_tickets t WHERE t.id = NEW.ticket_id),
      '/colaborador/tickets?t=' || NEW.ticket_id, NEW.user_id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Primeira equipa: o Desenvolvimento atende "Marketing | TI" (tickets do Realize).
INSERT INTO public.support_department_teams (support_department_id, department)
SELECT id, 'Desenvolvimento' FROM public.support_departments WHERE name = 'Marketing | TI'
ON CONFLICT DO NOTHING;
