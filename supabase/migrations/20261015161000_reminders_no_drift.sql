-- Lembretes de eventos recorrentes: cada ocorrência calcula-se a partir da primeira
-- (início + n × passo), como na app. Antes, o generate_series somava o passo à ocorrência
-- anterior e um evento mensal a 31 passava a 28, depois 28, …

CREATE OR REPLACE FUNCTION public.rz_send_reminders()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task record;
  v_occ record;
  v_user uuid;
BEGIN
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

  FOR v_occ IN
    SELECT e.id, e.title, e.owner_id, o.start_at
      FROM calendar_events e
      CROSS JOIN LATERAL (
        SELECT e.starts_at + n * CASE e.recurrence
                 WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days'
                 WHEN 'monthly' THEN interval '1 month' WHEN 'yearly' THEN interval '1 year'
                 ELSE interval '0' END AS start_at
          FROM generate_series(0, CASE WHEN e.recurrence IS NULL THEN 0 ELSE 1000 END) n
      ) o
     WHERE e.reminder_minutes IS NOT NULL
       AND (e.recurrence IS NOT NULL OR e.starts_at > now() - interval '5 minutes')
       AND o.start_at - make_interval(mins => e.reminder_minutes) <= now()
       AND o.start_at > now() - interval '5 minutes'
       AND (e.recurrence_until IS NULL OR o.start_at < (e.recurrence_until + 1)::timestamptz)
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
