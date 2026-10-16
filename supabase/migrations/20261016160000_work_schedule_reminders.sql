-- Realize 2.0 · Lembretes de ponto. Cada colaborador define o seu horário (entrada, almoço e
-- saída); de 5 em 5 minutos o servidor vê quem passou a hora (mais a tolerância) sem picar e
-- manda um aviso. Não avisa em feriados nacionais nem a quem está de férias/ausente nesse
-- dia, e cada aviso sai no máximo uma vez por dia.
-- Notificações push: subscrições do telemóvel/browser de cada pessoa; cada notificação nova
-- é enviada pela edge function push-send (chamada com pg_net, como o mail-api).

-- 1. Horário de cada pessoa --------------------------------------------------------------
CREATE TABLE public.work_schedules (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reminders boolean NOT NULL DEFAULT true,
  days smallint[] NOT NULL DEFAULT '{1,2,3,4,5}' CHECK (days <@ '{1,2,3,4,5,6,7}'::smallint[]),
  start_time time NOT NULL,
  end_time time NOT NULL,
  lunch_start time,
  lunch_end time,
  tolerance_min smallint NOT NULL DEFAULT 10 CHECK (tolerance_min BETWEEN 0 AND 120),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK ((lunch_start IS NULL) = (lunch_end IS NULL)),
  CHECK (lunch_start IS NULL OR (lunch_start > start_time AND lunch_end > lunch_start AND lunch_end < end_time))
);
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Horário: ver o meu" ON public.work_schedules
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Horário: criar o meu" ON public.work_schedules
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Horário: editar o meu" ON public.work_schedules
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Avisos já enviados (um por momento do dia).
CREATE TABLE public.punch_reminders_sent (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  slot text NOT NULL CHECK (slot IN ('entrada', 'almoco', 'regresso', 'saida')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day, slot)
);
ALTER TABLE public.punch_reminders_sent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.punch_reminders_sent FROM anon, authenticated;

-- 2. Lembretes (corre de 5 em 5 minutos) -------------------------------------------------
CREATE OR REPLACE FUNCTION public.rz_punch_reminders()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_local timestamp := now() AT TIME ZONE 'Europe/Lisbon';
  v_today date := v_local::date;
  v_time time := v_local::time;
  r record;
  v_state text;
  v_paused boolean;
  v_slot record;
BEGIN
  IF EXISTS (SELECT 1 FROM holidays WHERE date = v_today AND is_national) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT s.*, e.id AS employee_id, split_part(e.name, ' ', 1) AS first_name
    FROM work_schedules s
    JOIN employees e ON e.user_id = s.user_id AND e.is_active
    WHERE s.reminders AND extract(isodow FROM v_today)::smallint = ANY (s.days)
  LOOP
    -- De férias ou ausente hoje (dia completo aprovado): sem lembretes.
    IF EXISTS (
      SELECT 1 FROM absences a
      JOIN absence_periods p ON p.absence_id = a.id AND p.status = 'approved'
      WHERE a.employee_id = r.employee_id AND a.status IN ('approved', 'partially_approved')
        AND coalesce(p.period_type, 'full_day') <> 'partial'
        AND p.start_date <= v_today AND p.end_date >= v_today
    ) THEN
      CONTINUE;
    END IF;

    -- Estado pelo último registo de hoje: sem registos, a trabalhar, em pausa ou terminado.
    SELECT CASE
             WHEN t.entry_type = 'out' AND t.kind = 'work' THEN 'terminado'
             WHEN t.entry_type = 'out' AND t.kind = 'break' THEN 'pausa'
             ELSE 'trabalho'
           END
      INTO v_state
    FROM time_clock_entries t
    WHERE t.employee_id = r.employee_id
      AND (t.punched_at AT TIME ZONE 'Europe/Lisbon')::date = v_today
    ORDER BY t.punched_at DESC
    LIMIT 1;
    v_state := coalesce(v_state, 'nada');
    v_paused := EXISTS (
      SELECT 1 FROM time_clock_entries t
      WHERE t.employee_id = r.employee_id AND t.entry_type = 'out' AND t.kind = 'break'
        AND (t.punched_at AT TIME ZONE 'Europe/Lisbon')::date = v_today
    );

    FOR v_slot IN
      SELECT * FROM (VALUES
        ('entrada', r.start_time, v_state = 'nada',
         'Já registou a entrada?', format('O seu horário começa às %s.', to_char(r.start_time, 'HH24:MI'))),
        ('almoco', r.lunch_start, v_state = 'trabalho' AND NOT v_paused,
         'Hora de almoço', format('Não se esqueça de registar a pausa (%s).', to_char(r.lunch_start, 'HH24:MI'))),
        ('regresso', r.lunch_end, v_state = 'pausa',
         'Regresso do almoço', format('Registe o regresso ao trabalho (%s).', to_char(r.lunch_end, 'HH24:MI'))),
        ('saida', r.end_time, v_state IN ('trabalho', 'pausa'),
         'Fim do dia', format('Ainda está a trabalhar? Registe a saída (%s).', to_char(r.end_time, 'HH24:MI')))
      ) AS s(slot, at, missing, title, body)
      WHERE s.at IS NOT NULL
    LOOP
      IF v_slot.missing
         AND v_time >= v_slot.at + make_interval(mins => r.tolerance_min)
         AND v_time < v_slot.at + make_interval(mins => r.tolerance_min + 90)
         AND NOT EXISTS (
           SELECT 1 FROM punch_reminders_sent x
           WHERE x.user_id = r.user_id AND x.day = v_today AND x.slot = v_slot.slot)
      THEN
        INSERT INTO punch_reminders_sent (user_id, day, slot) VALUES (r.user_id, v_today, v_slot.slot);
        PERFORM rz_notify(r.user_id, 'assistant', v_slot.title, v_slot.body, '/colaborador/ponto', NULL);
      END IF;
    END LOOP;
  END LOOP;

  DELETE FROM punch_reminders_sent WHERE day < v_today - 7;
END;
$$;
REVOKE ALL ON FUNCTION public.rz_punch_reminders() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('rz-punch-reminders', '*/5 * * * *', 'SELECT public.rz_punch_reminders()');

-- 3. Notificações push -------------------------------------------------------------------
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1000),
  p256dh text NOT NULL CHECK (char_length(p256dh) <= 200),
  auth text NOT NULL CHECK (char_length(auth) <= 100),
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions (user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Push: ver as minhas" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Push: registar as minhas" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Push: apagar as minhas" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Cada notificação nova segue para o telemóvel de quem tem push ligado.
CREATE OR REPLACE FUNCTION public.rz_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;
  v_token := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mail_system_token' LIMIT 1);
  IF v_token IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-system-token', v_token),
    body := jsonb_build_object('notification_id', NEW.id),
    timeout_milliseconds := 15000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.rz_push_on_notification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rz_push_on_notification
  AFTER INSERT ON public.user_notifications
  FOR EACH ROW EXECUTE FUNCTION public.rz_push_on_notification();

-- Voltar a ativar no mesmo dispositivo atualiza a subscrição (upsert pelo endpoint).
CREATE POLICY "Push: atualizar as minhas" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
