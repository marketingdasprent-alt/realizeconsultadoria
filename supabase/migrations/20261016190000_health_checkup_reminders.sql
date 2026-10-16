-- Realize 2.0 · Aviso ao colaborador da consulta de higiene e segurança marcada: na véspera,
-- a partir das 09:00 (Lisboa), uma notificação na app (e no telemóvel, com push ligado).
-- O email do admin (send-safety-checkup-reminders) continua a ir para os RH.

CREATE TABLE public.health_reminders_sent (
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  checkup_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, checkup_date)
);
ALTER TABLE public.health_reminders_sent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.health_reminders_sent FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.rz_health_reminders()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_local timestamp := now() AT TIME ZONE 'Europe/Lisbon';
  v_tomorrow date := v_local::date + 1;
  r record;
BEGIN
  IF v_local::time < time '09:00' THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT e.id, e.user_id, e.safety_checkup_date
    FROM employees e
    WHERE e.is_active AND e.user_id IS NOT NULL
      AND e.safety_checkup_date = v_tomorrow
      AND NOT EXISTS (
        SELECT 1 FROM health_reminders_sent s
        WHERE s.employee_id = e.id AND s.checkup_date = e.safety_checkup_date)
  LOOP
    INSERT INTO health_reminders_sent (employee_id, checkup_date) VALUES (r.id, r.safety_checkup_date);
    PERFORM rz_notify(r.user_id, 'assistant', 'Consulta de higiene e segurança amanhã',
      format('Amanhã, %s, tem consulta de higiene e segurança no trabalho.',
             to_char(r.safety_checkup_date, 'DD/MM')),
      '/colaborador/calendario', NULL);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.rz_health_reminders() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('rz-health-reminders', '*/15 * * * *', 'SELECT public.rz_health_reminders()');
