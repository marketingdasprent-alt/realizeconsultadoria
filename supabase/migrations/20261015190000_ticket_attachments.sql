-- Realize 2.0 · Anexos dos tickets: o bucket ticket-attachments não tinha políticas, por
-- isso os uploads falhavam sempre (o bucket está vazio). Agora o colaborador envia e lê
-- os anexos dos seus tickets (no pedido e nas respostas) e os admins leem todos.
-- Caminho dos ficheiros: "<ticket_id>/<data>_<nome>".

CREATE OR REPLACE FUNCTION public.ticket_is_mine(p_ticket uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM support_tickets st
    JOIN employees e ON e.id = st.employee_id
    WHERE st.id = p_ticket AND e.user_id = auth.uid()
  );
$$;

-- Ticket a partir do caminho no bucket (null se a primeira pasta não for um uuid).
CREATE OR REPLACE FUNCTION public.ticket_path_ticket(p_name text)
RETURNS uuid
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN split_part(p_name, '/', 1)::uuid
  END;
$$;

REVOKE ALL ON FUNCTION public.ticket_is_mine(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_is_mine(uuid) TO authenticated;

-- As mesmas regras do formulário: imagens e PDF até 10 MB.
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
WHERE id = 'ticket-attachments';

DROP POLICY IF EXISTS "Tickets: ler anexos" ON storage.objects;
CREATE POLICY "Tickets: ler anexos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND (public.has_role(auth.uid(), 'admin') OR public.ticket_is_mine(public.ticket_path_ticket(name)))
  );

DROP POLICY IF EXISTS "Tickets: enviar anexos" ON storage.objects;
CREATE POLICY "Tickets: enviar anexos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND (public.has_role(auth.uid(), 'admin') OR public.ticket_is_mine(public.ticket_path_ticket(name)))
  );

-- Registo do anexo: só em tickets próprios (antes bastava uploaded_by = o próprio, em
-- qualquer ticket).
DROP POLICY IF EXISTS "Employees can insert ticket attachments" ON public.support_ticket_attachments;
CREATE POLICY "Employees can insert ticket attachments" ON public.support_ticket_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (public.ticket_is_mine(ticket_id) OR public.has_role(auth.uid(), 'admin'))
  );

-- Notificações dos tickets passam a abrir o próprio ticket (?t=id).
CREATE OR REPLACE FUNCTION public.notify_ticket_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM rz_notify(
      (SELECT e.user_id FROM employees e WHERE e.id = NEW.employee_id), 'ticket',
      CASE NEW.status
        WHEN 'in_progress' THEN 'Ticket em progresso'
        WHEN 'resolved' THEN 'Ticket resolvido'
        WHEN 'closed' THEN 'Ticket fechado'
        ELSE 'Ticket reaberto' END,
      NEW.subject, '/colaborador/tickets?t=' || NEW.id, auth.uid());
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.sender_role, '') <> 'employee' THEN
    PERFORM rz_notify(
      (SELECT e.user_id FROM support_tickets t JOIN employees e ON e.id = t.employee_id
        WHERE t.id = NEW.ticket_id), 'ticket',
      'Nova resposta dos RH',
      (SELECT t.subject FROM support_tickets t WHERE t.id = NEW.ticket_id),
      '/colaborador/tickets?t=' || NEW.ticket_id, NEW.user_id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
