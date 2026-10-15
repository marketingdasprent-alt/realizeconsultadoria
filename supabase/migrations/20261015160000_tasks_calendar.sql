-- Realize 2.0 · Fase 4 — Tarefas (§15) e Calendário (§10)
--
-- * Tarefas: responsável, participantes, prazo, prioridade, subtarefas, lista de verificação,
--   comentários, anexos (bucket task-files) e recorrência. Vê-as quem as criou, o
--   responsável e os participantes (da mesma empresa).
-- * Calendário: eventos com convidados (resposta aceito/recuso/talvez), recorrência,
--   localização, ligação de reunião, lembretes e visibilidade (privado / convidados /
--   toda a empresa).
-- * Notificações novas (task, event) e lembretes automáticos de 5 em 5 minutos (pg_cron):
--   prazo de tarefa nas próximas 24 h e lembrete de evento.

ALTER TABLE public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_kind_check;
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_kind_check
  CHECK (kind IN ('appreciation', 'feed_comment', 'absence', 'ticket', 'document', 'task', 'event'));

/** Empresa do colaborador autenticado (ativo). */
CREATE OR REPLACE FUNCTION public.rz_my_company()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM employees WHERE user_id = auth.uid() AND is_active LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.rz_my_company() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_my_company() TO authenticated;

-- 1. Tarefas ------------------------------------------------------------------------------

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 5000),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recurrence text CHECK (recurrence IN ('daily', 'weekly', 'monthly')),
  -- Origem: mensagem do Messenger, email ou evento ("conversa:mensagem", id, …).
  source_type text CHECK (source_type IN ('message', 'email', 'event')),
  source_ref text,
  position double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  due_notified_at timestamptz
);
CREATE INDEX tasks_company ON public.tasks (company_id);
CREATE INDEX tasks_assignee ON public.tasks (assignee_id);
CREATE INDEX tasks_creator ON public.tasks (created_by);
CREATE INDEX tasks_parent ON public.tasks (parent_id);

CREATE TABLE public.task_participants (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX task_participants_user ON public.task_participants (user_id);

CREATE TABLE public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 300),
  done boolean NOT NULL DEFAULT false,
  position double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_checklist_task ON public.task_checklist_items (task_id);

CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_comments_task ON public.task_comments (task_id, created_at);

CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  path text NOT NULL,
  name text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  mime text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_attachments_task ON public.task_attachments (task_id);

CREATE OR REPLACE FUNCTION public.task_is_participant(_task_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM task_participants WHERE task_id = _task_id AND user_id = auth.uid());
$$;

/** Pode ver a tarefa (já gravada): criou, é responsável ou participante — ou vê a tarefa-mãe. */
CREATE OR REPLACE FUNCTION public.task_can_see(_task_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = _task_id AND t.company_id = public.rz_my_company()
      AND (
        t.created_by = auth.uid() OR t.assignee_id = auth.uid()
        OR public.task_is_participant(t.id)
        OR EXISTS (
          SELECT 1 FROM tasks p
          WHERE p.id = t.parent_id
            AND (p.created_by = auth.uid() OR p.assignee_id = auth.uid() OR public.task_is_participant(p.id))
        )
      )
  );
$$;

/** Responsável válido: ninguém, o próprio ou um colega ativo da mesma empresa. */
CREATE OR REPLACE FUNCTION public.task_valid_assignee(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NULL OR _user_id = auth.uid() OR public.chat_is_colleague(_user_id);
$$;

REVOKE ALL ON FUNCTION public.task_is_participant(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.task_can_see(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.task_valid_assignee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_is_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.task_can_see(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.task_valid_assignee(uuid) TO authenticated;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Lida pelos campos da própria linha (no INSERT … RETURNING a linha ainda não existe).
CREATE POLICY "Tarefas: ver" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    company_id = public.rz_my_company()
    AND (
      created_by = auth.uid() OR assignee_id = auth.uid() OR public.task_is_participant(id)
      OR (parent_id IS NOT NULL AND public.task_can_see(parent_id))
    )
  );
CREATE POLICY "Tarefas: criar" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND company_id = public.rz_my_company()
    AND public.task_valid_assignee(assignee_id)
    AND (parent_id IS NULL OR public.task_can_see(parent_id))
  );
CREATE POLICY "Tarefas: editar (criador, responsável, participantes)" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    company_id = public.rz_my_company()
    AND (created_by = auth.uid() OR assignee_id = auth.uid() OR public.task_is_participant(id)
         OR (parent_id IS NOT NULL AND public.task_can_see(parent_id)))
  )
  WITH CHECK (company_id = public.rz_my_company() AND public.task_valid_assignee(assignee_id));
CREATE POLICY "Tarefas: o criador elimina" ON public.tasks
  FOR DELETE TO authenticated USING (created_by = auth.uid());
REVOKE UPDATE ON public.tasks FROM authenticated;
GRANT UPDATE (title, description, status, priority, due_at, assignee_id, recurrence, position)
  ON public.tasks TO authenticated;

CREATE POLICY "Tarefas: ver participantes" ON public.task_participants
  FOR SELECT TO authenticated USING (public.task_can_see(task_id));
CREATE POLICY "Tarefas: adicionar participantes" ON public.task_participants
  FOR INSERT TO authenticated
  WITH CHECK (public.task_can_see(task_id) AND public.chat_is_colleague(user_id));
CREATE POLICY "Tarefas: retirar participantes" ON public.task_participants
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.created_by = auth.uid()));

CREATE POLICY "Tarefas: lista de verificação" ON public.task_checklist_items
  FOR ALL TO authenticated
  USING (public.task_can_see(task_id)) WITH CHECK (public.task_can_see(task_id));

CREATE POLICY "Tarefas: ver comentários" ON public.task_comments
  FOR SELECT TO authenticated USING (public.task_can_see(task_id));
CREATE POLICY "Tarefas: comentar" ON public.task_comments
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND public.task_can_see(task_id));
CREATE POLICY "Tarefas: apagar o meu comentário" ON public.task_comments
  FOR DELETE TO authenticated USING (author_id = auth.uid());

CREATE POLICY "Tarefas: ver anexos" ON public.task_attachments
  FOR SELECT TO authenticated USING (public.task_can_see(task_id));
CREATE POLICY "Tarefas: anexar" ON public.task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.task_can_see(task_id)
              AND public.chat_path_conversation(path) = task_id);
CREATE POLICY "Tarefas: retirar anexos" ON public.task_attachments
  FOR DELETE TO authenticated USING (uploaded_by = auth.uid());

-- Datas automáticas e recorrência (ao concluir, cria a próxima).
CREATE OR REPLACE FUNCTION public.tasks_before_write()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.completed_at := CASE WHEN NEW.status = 'done' THEN now() END;
    NEW.due_notified_at := NULL;
  ELSE
    IF NEW.status = 'done' AND OLD.status <> 'done' THEN NEW.completed_at := now(); END IF;
    IF NEW.status <> 'done' THEN NEW.completed_at := NULL; END IF;
    IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN NEW.due_notified_at := NULL; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER tasks_before_write BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_before_write();

CREATE OR REPLACE FUNCTION public.tasks_after_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_step interval;
BEGIN
  -- Responsável novo
  IF NEW.assignee_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) THEN
    PERFORM rz_notify(NEW.assignee_id, 'task',
      rz_first_name(auth.uid()) || ' atribuiu-lhe uma tarefa', NEW.title,
      '/colaborador/tarefas?tarefa=' || NEW.id, auth.uid());
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'done' AND OLD.status <> 'done' THEN
    PERFORM rz_notify(NEW.created_by, 'task',
      rz_first_name(auth.uid()) || ' concluiu uma tarefa', NEW.title,
      '/colaborador/tarefas?tarefa=' || NEW.id, auth.uid());
    -- Recorrência: a próxima ocorrência nasce por fazer, com o prazo deslocado.
    IF NEW.recurrence IS NOT NULL AND NEW.parent_id IS NULL THEN
      v_step := CASE NEW.recurrence WHEN 'daily' THEN interval '1 day'
                                    WHEN 'weekly' THEN interval '7 days'
                                    ELSE interval '1 month' END;
      INSERT INTO tasks (company_id, title, description, priority, due_at, created_by,
                         assignee_id, recurrence, source_type, source_ref)
      VALUES (NEW.company_id, NEW.title, NEW.description, NEW.priority,
              coalesce(NEW.due_at, now()) + v_step, NEW.created_by, NEW.assignee_id,
              NEW.recurrence, NEW.source_type, NEW.source_ref);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tasks_after_write AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_after_write();

CREATE OR REPLACE FUNCTION public.notify_task_participant()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM rz_notify(NEW.user_id, 'task',
    rz_first_name(auth.uid()) || ' adicionou-o a uma tarefa',
    (SELECT title FROM tasks WHERE id = NEW.task_id),
    '/colaborador/tarefas?tarefa=' || NEW.task_id, auth.uid());
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_task_participant AFTER INSERT ON public.task_participants
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_participant();

CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_user uuid;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = NEW.task_id;
  FOR v_user IN
    SELECT DISTINCT u FROM (
      SELECT v_task.created_by AS u UNION SELECT v_task.assignee_id
      UNION SELECT user_id FROM task_participants WHERE task_id = NEW.task_id
    ) x WHERE u IS NOT NULL
  LOOP
    PERFORM rz_notify(v_user, 'task', rz_first_name(NEW.author_id) || ' comentou uma tarefa',
      v_task.title || ': ' || NEW.body, '/colaborador/tarefas?tarefa=' || NEW.task_id, NEW.author_id);
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_task_comment AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_comment();

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('task-files', 'task-files', false, 26214400)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Tarefas: ver ficheiros" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'task-files' AND public.task_can_see(public.chat_path_conversation(name)));
CREATE POLICY "Tarefas: enviar ficheiros" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-files' AND public.task_can_see(public.chat_path_conversation(name)));

-- 2. Calendário -------------------------------------------------------------------------

CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 5000),
  location text CHECK (location IS NULL OR char_length(location) <= 300),
  meeting_url text CHECK (meeting_url IS NULL OR char_length(meeting_url) <= 500),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'participants'
    CHECK (visibility IN ('private', 'participants', 'company')),
  recurrence text CHECK (recurrence IN ('daily', 'weekly', 'monthly', 'yearly')),
  recurrence_until date,
  reminder_minutes integer CHECK (reminder_minutes IS NULL OR reminder_minutes BETWEEN 0 AND 10080),
  color text NOT NULL DEFAULT 'violet'
    CHECK (color IN ('violet', 'sky', 'emerald', 'amber', 'rose', 'slate')),
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at >= starts_at)
);
CREATE INDEX calendar_events_company_start ON public.calendar_events (company_id, starts_at);
CREATE INDEX calendar_events_owner ON public.calendar_events (owner_id);

CREATE TABLE public.calendar_event_attendees (
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response text NOT NULL DEFAULT 'pending'
    CHECK (response IN ('pending', 'accepted', 'declined', 'tentative')),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX calendar_attendees_user ON public.calendar_event_attendees (user_id);

-- Lembretes já enviados (por ocorrência), para não repetir.
CREATE TABLE public.calendar_reminders_sent (
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  occurrence_start timestamptz NOT NULL,
  PRIMARY KEY (event_id, occurrence_start)
);
ALTER TABLE public.calendar_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.event_is_attendee(_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM calendar_event_attendees WHERE event_id = _event_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.event_can_see(_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM calendar_events e
    WHERE e.id = _event_id AND e.company_id = public.rz_my_company()
      AND (e.owner_id = auth.uid() OR e.visibility = 'company'
           OR (e.visibility = 'participants' AND public.event_is_attendee(e.id)))
  );
$$;

REVOKE ALL ON FUNCTION public.event_is_attendee(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.event_can_see(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_is_attendee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.event_can_see(uuid) TO authenticated;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Calendário: ver eventos" ON public.calendar_events
  FOR SELECT TO authenticated
  USING (
    company_id = public.rz_my_company()
    AND (owner_id = auth.uid() OR visibility = 'company'
         OR (visibility = 'participants' AND public.event_is_attendee(id)))
  );
CREATE POLICY "Calendário: criar eventos" ON public.calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND company_id = public.rz_my_company()
              AND (task_id IS NULL OR public.task_can_see(task_id)));
CREATE POLICY "Calendário: o organizador edita" ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND company_id = public.rz_my_company());
CREATE POLICY "Calendário: o organizador elimina" ON public.calendar_events
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Calendário: ver convidados" ON public.calendar_event_attendees
  FOR SELECT TO authenticated USING (public.event_can_see(event_id));
CREATE POLICY "Calendário: o organizador convida" ON public.calendar_event_attendees
  FOR INSERT TO authenticated
  WITH CHECK (public.chat_is_colleague(user_id) AND EXISTS (
    SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.owner_id = auth.uid()));
CREATE POLICY "Calendário: responder ao convite" ON public.calendar_event_attendees
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Calendário: retirar convidado" ON public.calendar_event_attendees
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.owner_id = auth.uid()));
REVOKE UPDATE ON public.calendar_event_attendees FROM authenticated;
GRANT UPDATE (response) ON public.calendar_event_attendees TO authenticated;

CREATE OR REPLACE FUNCTION public.calendar_events_before_write()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER calendar_events_before_write BEFORE INSERT OR UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.calendar_events_before_write();

CREATE OR REPLACE FUNCTION public.notify_event_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
     OR NEW.title IS DISTINCT FROM OLD.title OR NEW.location IS DISTINCT FROM OLD.location THEN
    FOR v_user IN SELECT user_id FROM calendar_event_attendees WHERE event_id = NEW.id AND response <> 'declined' LOOP
      PERFORM rz_notify(v_user, 'event', 'Evento alterado: ' || NEW.title,
        to_char(NEW.starts_at AT TIME ZONE 'Europe/Lisbon', 'DD/MM "às" HH24:MI'),
        '/colaborador/calendario?evento=' || NEW.id, NEW.owner_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_event_change AFTER UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_change();

CREATE OR REPLACE FUNCTION public.notify_event_attendee()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event calendar_events%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM calendar_events WHERE id = NEW.event_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM rz_notify(NEW.user_id, 'event',
      rz_first_name(v_event.owner_id) || ' convidou-o para ' || v_event.title,
      to_char(v_event.starts_at AT TIME ZONE 'Europe/Lisbon', 'DD/MM "às" HH24:MI'),
      '/colaborador/calendario?evento=' || NEW.event_id, v_event.owner_id);
  ELSIF NEW.response IS DISTINCT FROM OLD.response AND NEW.response <> 'pending' THEN
    PERFORM rz_notify(v_event.owner_id, 'event',
      rz_first_name(NEW.user_id) || CASE NEW.response
        WHEN 'accepted' THEN ' aceitou ' WHEN 'declined' THEN ' recusou ' ELSE ' talvez vá a ' END
        || v_event.title,
      NULL, '/colaborador/calendario?evento=' || NEW.event_id, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_event_attendee AFTER INSERT OR UPDATE ON public.calendar_event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_attendee();

-- 3. Lembretes (pg_cron, de 5 em 5 minutos) -----------------------------------------------

CREATE OR REPLACE FUNCTION public.rz_send_reminders()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task record;
  v_occ record;
  v_user uuid;
BEGIN
  -- Prazos de tarefas nas próximas 24 h (uma vez por prazo).
  FOR v_task IN
    SELECT id, title, due_at, coalesce(assignee_id, created_by) AS user_id
      FROM tasks
     WHERE status <> 'done' AND due_at IS NOT NULL AND due_notified_at IS NULL
       AND due_at BETWEEN now() AND now() + interval '24 hours'
  LOOP
    PERFORM rz_notify(v_task.user_id, 'task', 'Prazo a aproximar-se', v_task.title || ' — ' ||
      to_char(v_task.due_at AT TIME ZONE 'Europe/Lisbon', 'DD/MM "às" HH24:MI'),
      '/colaborador/tarefas?tarefa=' || v_task.id, NULL);
    UPDATE tasks SET due_notified_at = now() WHERE id = v_task.id;
  END LOOP;

  -- Lembretes de eventos (ocorrências que começam dentro do tempo de lembrete).
  FOR v_occ IN
    SELECT e.id, e.title, e.owner_id, o.start_at
      FROM calendar_events e
      CROSS JOIN LATERAL (
        SELECT s AS start_at
          FROM generate_series(
                 e.starts_at,
                 least(now() + make_interval(mins => e.reminder_minutes) + interval '5 minutes',
                       coalesce(e.recurrence_until + 1, 'infinity'::date)::timestamptz),
                 CASE e.recurrence WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days'
                                   WHEN 'monthly' THEN interval '1 month' WHEN 'yearly' THEN interval '1 year'
                                   ELSE interval '100 years' END) s
      ) o
     WHERE e.reminder_minutes IS NOT NULL
       AND o.start_at - make_interval(mins => e.reminder_minutes) <= now()
       AND o.start_at > now() - interval '5 minutes'
       AND NOT EXISTS (SELECT 1 FROM calendar_reminders_sent r
                        WHERE r.event_id = e.id AND r.occurrence_start = o.start_at)
  LOOP
    INSERT INTO calendar_reminders_sent (event_id, occurrence_start) VALUES (v_occ.id, v_occ.start_at);
    FOR v_user IN
      SELECT v_occ.owner_id UNION
      SELECT user_id FROM calendar_event_attendees WHERE event_id = v_occ.id AND response <> 'declined'
    LOOP
      PERFORM rz_notify(v_user, 'event', 'Lembrete: ' || v_occ.title,
        to_char(v_occ.start_at AT TIME ZONE 'Europe/Lisbon', 'DD/MM "às" HH24:MI'),
        '/colaborador/calendario?evento=' || v_occ.id, NULL);
    END LOOP;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.rz_send_reminders() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('rz-reminders', '*/5 * * * *', $$SELECT public.rz_send_reminders()$$);

-- 4. Tempo real ------------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime
  ADD TABLE public.tasks, public.task_comments, public.task_checklist_items, public.calendar_events,
            public.calendar_event_attendees;
