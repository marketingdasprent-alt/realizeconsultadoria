CREATE OR REPLACE FUNCTION public.reschedule_vacation(
  p_absence_id uuid,
  p_periods jsonb,
  p_notes text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_absence public.absences%ROWTYPE;
  v_employee_user_id uuid;
  v_is_admin boolean;
  v_target_status text;
  v_start_date date;
  v_end_date date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É necessário iniciar sessão para remarcar férias.';
  END IF;

  SELECT a.*
  INTO v_absence
  FROM public.absences a
  WHERE a.id = p_absence_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de férias não encontrado.';
  END IF;

  SELECT e.user_id
  INTO v_employee_user_id
  FROM public.employees e
  WHERE e.id = v_absence.employee_id;

  v_is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);

  IF NOT v_is_admin AND v_employee_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Não tem permissão para remarcar este pedido.';
  END IF;

  IF v_absence.absence_type <> 'vacation'
     OR v_absence.status NOT IN ('approved', 'pending') THEN
    RAISE EXCEPTION 'Apenas férias aprovadas ou ainda pendentes podem ser alteradas por esta operação.';
  END IF;

  IF jsonb_typeof(p_periods) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Os períodos devem ser enviados como uma lista.';
  END IF;

  IF jsonb_array_length(p_periods) = 0 THEN
    RAISE EXCEPTION 'É necessário indicar pelo menos um período.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_periods) AS p(
      start_date date,
      end_date date,
      period_type text,
      start_time time,
      end_time time
    )
    WHERE p.start_date IS NULL
       OR p.end_date IS NULL
       OR p.end_date < p.start_date
       OR p.period_type NOT IN ('full_day', 'partial')
       OR (
         p.period_type = 'partial'
         AND (
           p.start_date <> p.end_date
           OR p.start_time IS NULL
           OR p.end_time IS NULL
           OR p.end_time <= p.start_time
         )
       )
  ) THEN
    RAISE EXCEPTION 'Existe um período com datas, tipo ou horas inválidas.';
  END IF;

  IF NOT EXISTS (
    (
      SELECT p.start_date, p.end_date
      FROM jsonb_to_recordset(p_periods) AS p(start_date date, end_date date)
      EXCEPT ALL
      SELECT ap.start_date, ap.end_date
      FROM public.absence_periods ap
      WHERE ap.absence_id = p_absence_id
    )
    UNION ALL
    (
      SELECT ap.start_date, ap.end_date
      FROM public.absence_periods ap
      WHERE ap.absence_id = p_absence_id
      EXCEPT ALL
      SELECT p.start_date, p.end_date
      FROM jsonb_to_recordset(p_periods) AS p(start_date date, end_date date)
    )
  ) THEN
    RAISE EXCEPTION 'Escolha datas diferentes das que já estão marcadas.';
  END IF;

  SELECT min(p.start_date), max(p.end_date)
  INTO v_start_date, v_end_date
  FROM jsonb_to_recordset(p_periods) AS p(start_date date, end_date date);

  IF NOT v_is_admin AND v_absence.start_date <= CURRENT_DATE THEN
    RAISE EXCEPTION 'Só é possível remarcar férias que ainda não começaram.';
  END IF;

  IF NOT v_is_admin AND v_start_date < CURRENT_DATE + 2 THEN
    RAISE EXCEPTION 'As novas férias devem começar com pelo menos 48 horas de antecedência.';
  END IF;

  IF EXISTS (
    WITH periods AS (
      SELECT p.*, row_number() OVER () AS position
      FROM jsonb_to_recordset(p_periods) AS p(
        start_date date,
        end_date date,
        period_type text,
        start_time time,
        end_time time
      )
    )
    SELECT 1
    FROM periods first_period
    JOIN periods second_period ON first_period.position < second_period.position
    WHERE first_period.start_date <= second_period.end_date
      AND second_period.start_date <= first_period.end_date
      AND (
        first_period.period_type <> 'partial'
        OR second_period.period_type <> 'partial'
        OR first_period.start_time < second_period.end_time
           AND second_period.start_time < first_period.end_time
      )
  ) THEN
    RAISE EXCEPTION 'Os novos períodos não podem ficar sobrepostos.';
  END IF;

  IF EXISTS (
    WITH candidate_periods AS (
      SELECT *
      FROM jsonb_to_recordset(p_periods) AS p(
        start_date date,
        end_date date,
        period_type text,
        start_time time,
        end_time time
      )
    ),
    occupied_periods AS (
      SELECT ap.start_date, ap.end_date, ap.period_type, ap.start_time, ap.end_time
      FROM public.absences a
      JOIN public.absence_periods ap ON ap.absence_id = a.id
      WHERE a.employee_id = v_absence.employee_id
        AND a.id <> p_absence_id
        AND a.status IN ('approved', 'partially_approved')
        AND ap.status = 'approved'
      UNION ALL
      SELECT a.start_date, a.end_date, 'full_day', NULL::time, NULL::time
      FROM public.absences a
      WHERE a.employee_id = v_absence.employee_id
        AND a.id <> p_absence_id
        AND a.status = 'approved'
        AND NOT EXISTS (
          SELECT 1 FROM public.absence_periods ap WHERE ap.absence_id = a.id
        )
    )
    SELECT 1
    FROM candidate_periods candidate
    JOIN occupied_periods occupied
      ON candidate.start_date <= occupied.end_date
     AND occupied.start_date <= candidate.end_date
     AND (
       candidate.period_type <> 'partial'
       OR occupied.period_type <> 'partial'
       OR candidate.start_time IS NULL
       OR occupied.start_time IS NULL
       OR candidate.start_time < occupied.end_time
          AND occupied.start_time < candidate.end_time
     )
  ) THEN
    RAISE EXCEPTION 'O colaborador já tem uma ausência aprovada nas novas datas.';
  END IF;

  IF NOT v_is_admin AND EXISTS (
    SELECT 1
    FROM public.absences a
    WHERE a.employee_id = v_absence.employee_id
      AND a.id <> p_absence_id
      AND a.status = 'pending'
      AND v_start_date <= a.end_date
      AND v_end_date >= a.start_date
  ) THEN
    RAISE EXCEPTION 'Já existe outro pedido pendente para as novas datas.';
  END IF;

  v_target_status := CASE
    WHEN v_is_admin AND v_absence.status = 'approved' THEN 'approved'
    ELSE 'pending'
  END;

  UPDATE public.absences
  SET start_date = v_start_date,
      end_date = v_end_date,
      notes = p_notes,
      status = v_target_status,
      approved_by = CASE WHEN v_target_status = 'approved' THEN approved_by ELSE NULL END,
      approved_at = CASE WHEN v_target_status = 'approved' THEN approved_at ELSE NULL END,
      rejection_reason = NULL,
      updated_at = now()
  WHERE id = p_absence_id;

  DELETE FROM public.absence_periods WHERE absence_id = p_absence_id;

  INSERT INTO public.absence_periods (
    absence_id,
    start_date,
    end_date,
    business_days,
    period_type,
    start_time,
    end_time,
    status
  )
  SELECT
    p_absence_id,
    period.start_date,
    period.end_date,
    CASE
      WHEN period.period_type = 'partial' THEN
        round((extract(epoch FROM period.end_time - period.start_time) / 3600 / 8) * 4) / 4
      ELSE (
        SELECT count(*)
        FROM generate_series(
          period.start_date,
          period.end_date,
          interval '1 day'
        ) AS dates(day)
        WHERE extract(isodow FROM dates.day) < 6
          AND NOT EXISTS (
            SELECT 1 FROM public.holidays holiday WHERE holiday.date = dates.day::date
          )
      )
    END,
    period.period_type,
    CASE WHEN period.period_type = 'partial' THEN period.start_time ELSE NULL END,
    CASE WHEN period.period_type = 'partial' THEN period.end_time ELSE NULL END,
    v_target_status
  FROM jsonb_to_recordset(p_periods) AS period(
    start_date date,
    end_date date,
    period_type text,
    start_time time,
    end_time time
  );

  IF EXISTS (
    SELECT 1
    FROM public.absence_periods
    WHERE absence_id = p_absence_id AND business_days <= 0
  ) THEN
    RAISE EXCEPTION 'Cada período deve incluir pelo menos um dia útil.';
  END IF;

  RETURN v_target_status;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_vacation(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_vacation(uuid, jsonb, text) TO authenticated;

-- A anterior só cobria férias aprovadas e deixou de ser chamada.
DROP FUNCTION IF EXISTS public.reschedule_approved_vacation(uuid, jsonb, text);
