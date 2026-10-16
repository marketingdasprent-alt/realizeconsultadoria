-- Realize 2.0 · Realize AI proativo: lembretes pedidos ao assistente, resumo diário opcional e
-- sugestões (conflitos de agenda, tarefas em atraso, convites por responder).
-- Tudo o que o assistente grava passa pelas regras normais de cada pessoa (a edge function
-- ai-chat corre com o JWT de quem pergunta). O resumo e as sugestões são calculados aqui,
-- sem modelo: são rápidos, previsíveis e gratuitos.

-- 1. Notificações do assistente ---------------------------------------------------------
ALTER TABLE public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_kind_check;
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_kind_check
  CHECK (kind = ANY (ARRAY['appreciation','feed_comment','absence','ticket','document','task',
                           'event','assistant']));

-- 2. Lembretes ("lembra-me de X na sexta") ----------------------------------------------
CREATE TABLE public.ai_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 280),
  remind_at timestamptz NOT NULL,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_reminders_due_idx ON public.ai_reminders (remind_at) WHERE notified_at IS NULL;
ALTER TABLE public.ai_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lembretes IA: ver os meus" ON public.ai_reminders
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Lembretes IA: criar os meus" ON public.ai_reminders
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Lembretes IA: apagar os meus" ON public.ai_reminders
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3. Preferências (resumo diário só para quem ativa) ------------------------------------
CREATE TABLE public.ai_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_digest boolean NOT NULL DEFAULT false,
  last_digest_on date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Preferências IA: ver as minhas" ON public.ai_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Preferências IA: criar as minhas" ON public.ai_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Preferências IA: editar as minhas" ON public.ai_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- O último dia de resumo é da função; a pessoa só liga ou desliga.
REVOKE UPDATE ON public.ai_preferences FROM authenticated;
GRANT UPDATE (daily_digest, updated_at) ON public.ai_preferences TO authenticated;
GRANT INSERT (user_id, daily_digest) ON public.ai_preferences TO authenticated;

-- 4. Eventos de uma pessoa num intervalo (com recorrência) — só uso interno -------------
CREATE OR REPLACE FUNCTION public.rz_ai_user_events(p_user uuid, p_from timestamptz, p_to timestamptz)
RETURNS TABLE (event_id uuid, title text, start_at timestamptz, end_at timestamptz, all_day boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.title, o.start_at, o.start_at + (e.ends_at - e.starts_at), e.all_day
  FROM calendar_events e
  CROSS JOIN LATERAL (
    SELECT e.starts_at + n * CASE e.recurrence
             WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days'
             WHEN 'monthly' THEN interval '1 month' WHEN 'yearly' THEN interval '1 year'
             ELSE interval '0' END AS start_at
    FROM generate_series(0, CASE WHEN e.recurrence IS NULL THEN 0 ELSE 1000 END) n
  ) o
  WHERE (e.owner_id = p_user
         OR EXISTS (SELECT 1 FROM calendar_event_attendees a
                    WHERE a.event_id = e.id AND a.user_id = p_user AND a.response <> 'declined'))
    AND o.start_at < p_to
    AND o.start_at + (e.ends_at - e.starts_at) > p_from
    AND (e.recurrence_until IS NULL OR o.start_at < (e.recurrence_until + 1)::timestamptz);
$$;
REVOKE ALL ON FUNCTION public.rz_ai_user_events(uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;

-- 5. Tarefas abertas de uma pessoa com prazo — só uso interno ---------------------------
CREATE OR REPLACE FUNCTION public.rz_ai_user_tasks(p_user uuid)
RETURNS TABLE (task_id uuid, title text, due_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.title, t.due_at
  FROM tasks t
  WHERE t.status <> 'done' AND t.parent_id IS NULL AND t.due_at IS NOT NULL
    AND (t.assignee_id = p_user
         OR (t.assignee_id IS NULL AND t.created_by = p_user)
         OR EXISTS (SELECT 1 FROM task_participants p WHERE p.task_id = t.id AND p.user_id = p_user));
$$;
REVOKE ALL ON FUNCTION public.rz_ai_user_tasks(uuid) FROM PUBLIC, anon, authenticated;

-- 6. Sugestões para a pessoa que pergunta -----------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_suggestions()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_out jsonb := '[]'::jsonb;
  v_late int;
  v_tomorrow int;
  v_pending int;
  v_clash record;
BEGIN
  IF v_user IS NULL THEN RETURN v_out; END IF;

  -- Reuniões que se sobrepõem nos próximos 7 dias
  FOR v_clash IN
    SELECT a.title AS a_title, b.title AS b_title, b.start_at
    FROM rz_ai_user_events(v_user, now(), now() + interval '7 days') a
    JOIN rz_ai_user_events(v_user, now(), now() + interval '7 days') b
      ON a.event_id < b.event_id AND a.start_at < b.end_at AND b.start_at < a.end_at
    WHERE NOT a.all_day AND NOT b.all_day
    ORDER BY b.start_at
    LIMIT 3
  LOOP
    v_out := v_out || jsonb_build_object(
      'kind', 'conflict',
      'text', format('«%s» e «%s» sobrepõem-se em %s.', v_clash.a_title, v_clash.b_title,
                     to_char(v_clash.start_at AT TIME ZONE 'Europe/Lisbon', 'DD/MM "às" HH24:MI')),
      'link', '/colaborador/calendario');
  END LOOP;

  SELECT count(*) FILTER (WHERE due_at < now()),
         count(*) FILTER (WHERE due_at >= now() AND due_at < now() + interval '24 hours')
    INTO v_late, v_tomorrow
  FROM rz_ai_user_tasks(v_user);
  IF v_late > 0 THEN
    v_out := v_out || jsonb_build_object('kind', 'late',
      'text', format('Tem %s %s em atraso.', v_late, CASE WHEN v_late = 1 THEN 'tarefa' ELSE 'tarefas' END),
      'link', '/colaborador/tarefas');
  END IF;
  IF v_tomorrow > 0 THEN
    v_out := v_out || jsonb_build_object('kind', 'due',
      'text', format('%s %s com prazo nas próximas 24 horas.', v_tomorrow,
                     CASE WHEN v_tomorrow = 1 THEN 'tarefa' ELSE 'tarefas' END),
      'link', '/colaborador/tarefas');
  END IF;

  SELECT count(*) INTO v_pending
  FROM calendar_event_attendees a
  JOIN calendar_events e ON e.id = a.event_id
  WHERE a.user_id = v_user AND a.response = 'pending'
    AND (e.recurrence IS NOT NULL OR e.ends_at > now());
  IF v_pending > 0 THEN
    v_out := v_out || jsonb_build_object('kind', 'invite',
      'text', format('Tem %s %s por responder.', v_pending,
                     CASE WHEN v_pending = 1 THEN 'convite' ELSE 'convites' END),
      'link', '/colaborador/calendario');
  END IF;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.ai_suggestions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_suggestions() TO authenticated;

-- 7. Lembretes e resumo diário (corre de 5 em 5 minutos) --------------------------------
CREATE OR REPLACE FUNCTION public.rz_ai_proactive()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rem record;
  v_user record;
  v_today date := (now() AT TIME ZONE 'Europe/Lisbon')::date;
  v_start timestamptz;
  v_end timestamptz;
  v_events int;
  v_first timestamptz;
  v_due int;
  v_late int;
  v_clash text;
  v_parts text[];
BEGIN
  -- Lembretes pedidos ao assistente (os de há mais de um dia perdem-se sem avisar)
  UPDATE ai_reminders SET notified_at = now()
   WHERE notified_at IS NULL AND remind_at < now() - interval '1 day';
  FOR v_rem IN
    SELECT id, user_id, text FROM ai_reminders
     WHERE notified_at IS NULL AND remind_at <= now()
  LOOP
    PERFORM rz_notify(v_rem.user_id, 'assistant', 'Lembrete', v_rem.text, '/colaborador/ai', NULL);
    UPDATE ai_reminders SET notified_at = now() WHERE id = v_rem.id;
  END LOOP;

  -- Resumo diário: dias úteis, a partir das 08:30 (Lisboa), só para quem o ativou
  IF (now() AT TIME ZONE 'Europe/Lisbon')::time < time '08:30'
     OR extract(isodow FROM v_today) > 5 THEN
    RETURN;
  END IF;
  v_start := v_today::timestamp AT TIME ZONE 'Europe/Lisbon';
  v_end := (v_today + 1)::timestamp AT TIME ZONE 'Europe/Lisbon';

  FOR v_user IN
    SELECT p.user_id, split_part(e.name, ' ', 1) AS first_name
    FROM ai_preferences p
    JOIN employees e ON e.user_id = p.user_id AND e.is_active
    WHERE p.daily_digest AND (p.last_digest_on IS NULL OR p.last_digest_on < v_today)
  LOOP
    UPDATE ai_preferences SET last_digest_on = v_today WHERE user_id = v_user.user_id;

    -- Quem está de férias ou ausente hoje não recebe o resumo
    IF EXISTS (
      SELECT 1 FROM employees e
      JOIN absences a ON a.employee_id = e.id AND a.status IN ('approved', 'partially_approved')
      JOIN absence_periods ap ON ap.absence_id = a.id AND ap.status = 'approved'
      WHERE e.user_id = v_user.user_id AND ap.start_date <= v_today AND ap.end_date >= v_today
    ) THEN
      CONTINUE;
    END IF;

    SELECT count(*), min(start_at) FILTER (WHERE NOT all_day)
      INTO v_events, v_first
    FROM rz_ai_user_events(v_user.user_id, v_start, v_end);

    SELECT count(*) FILTER (WHERE due_at >= v_start AND due_at < v_end),
           count(*) FILTER (WHERE due_at < v_start)
      INTO v_due, v_late
    FROM rz_ai_user_tasks(v_user.user_id);

    SELECT format('«%s» e «%s»', a.title, b.title) INTO v_clash
    FROM rz_ai_user_events(v_user.user_id, v_start, v_end) a
    JOIN rz_ai_user_events(v_user.user_id, v_start, v_end) b
      ON a.event_id < b.event_id AND a.start_at < b.end_at AND b.start_at < a.end_at
    WHERE NOT a.all_day AND NOT b.all_day
    LIMIT 1;

    v_parts := ARRAY[]::text[];
    IF v_events > 0 THEN
      v_parts := v_parts || format('%s %s hoje%s', v_events,
        CASE WHEN v_events = 1 THEN 'evento' ELSE 'eventos' END,
        CASE WHEN v_first IS NOT NULL
             THEN format(' (o primeiro às %s)', to_char(v_first AT TIME ZONE 'Europe/Lisbon', 'HH24:MI'))
             ELSE '' END);
    END IF;
    IF v_due > 0 THEN
      v_parts := v_parts || format('%s %s com prazo hoje', v_due,
        CASE WHEN v_due = 1 THEN 'tarefa' ELSE 'tarefas' END);
    END IF;
    IF v_late > 0 THEN
      v_parts := v_parts || format('%s em atraso', v_late);
    END IF;
    IF v_clash IS NOT NULL THEN
      v_parts := v_parts || format('atenção: %s sobrepõem-se', v_clash);
    END IF;

    IF array_length(v_parts, 1) > 0 THEN
      PERFORM rz_notify(v_user.user_id, 'assistant', 'Bom dia, ' || v_user.first_name || '!',
        initcap(left(array_to_string(v_parts, ' · '), 1)) || substr(array_to_string(v_parts, ' · '), 2) || '.',
        CASE WHEN v_events > 0 THEN '/colaborador/calendario' ELSE '/colaborador/tarefas' END, NULL);
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.rz_ai_proactive() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('rz-ai-proactive', '*/5 * * * *', 'SELECT public.rz_ai_proactive()');
