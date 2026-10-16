-- Realize 2.0 · Férias e ausências por período. Hoje só se remarca o pedido inteiro, e só se
-- ele ainda não começou: um pedido com um período em abril (já passou) e outro em dezembro
-- não deixa mexer em nenhum. Estas funções mexem num período de cada vez. As regras de
-- negócio são as mesmas de reschedule_vacation (que fica como está, para o admin):
-- período que ainda não começou, novas datas com 48 h de antecedência, sem sobreposição com
-- outros períodos nem com ausências aprovadas ou pedidos pendentes, e dias úteis > 0.
-- Remarcar um período aprovado: o período novo fica pendente num pedido novo (os outros
-- períodos ficam aprovados no pedido original); um pedido pendente ou com um só período
-- altera-se no próprio pedido, que fica pendente (como acontece hoje).

CREATE OR REPLACE FUNCTION public.reschedule_vacation_period(
  p_period_id uuid,
  p_start_date date,
  p_end_date date,
  p_period_type text DEFAULT 'full_day',
  p_start_time time DEFAULT NULL,
  p_end_time time DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_period absence_periods%ROWTYPE;
  v_absence absences%ROWTYPE;
  v_owner uuid;
  v_count int;
  v_days numeric;
  v_target uuid;
  v_split boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É necessário iniciar sessão para alterar as férias.';
  END IF;

  SELECT * INTO v_period FROM absence_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Período não encontrado.';
  END IF;
  SELECT * INTO v_absence FROM absences WHERE id = v_period.absence_id FOR UPDATE;
  SELECT e.user_id INTO v_owner FROM employees e WHERE e.id = v_absence.employee_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Não tem permissão para alterar este período.';
  END IF;

  IF v_absence.absence_type <> 'vacation'
     OR v_absence.status NOT IN ('approved', 'pending', 'partially_approved')
     OR v_period.status NOT IN ('approved', 'pending') THEN
    RAISE EXCEPTION 'Só se alteram férias aprovadas ou ainda pendentes.';
  END IF;
  IF v_period.start_date <= CURRENT_DATE THEN
    RAISE EXCEPTION 'Só é possível alterar períodos que ainda não começaram.';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date
     OR p_period_type NOT IN ('full_day', 'partial')
     OR (p_period_type = 'partial'
         AND (p_start_date <> p_end_date OR p_start_time IS NULL OR p_end_time IS NULL
              OR p_end_time <= p_start_time)) THEN
    RAISE EXCEPTION 'Datas, tipo ou horas inválidas.';
  END IF;
  IF p_start_date < CURRENT_DATE + 2 THEN
    RAISE EXCEPTION 'As novas férias devem começar com pelo menos 48 horas de antecedência.';
  END IF;
  IF p_start_date = v_period.start_date AND p_end_date = v_period.end_date
     AND p_period_type = coalesce(v_period.period_type, 'full_day')
     AND p_start_time IS NOT DISTINCT FROM v_period.start_time
     AND p_end_time IS NOT DISTINCT FROM v_period.end_time THEN
    RAISE EXCEPTION 'Escolha datas diferentes das que já estão marcadas.';
  END IF;

  -- Sobreposição com os outros períodos do mesmo pedido.
  IF EXISTS (
    SELECT 1 FROM absence_periods o
    WHERE o.absence_id = v_period.absence_id AND o.id <> p_period_id AND o.status <> 'rejected'
      AND p_start_date <= o.end_date AND o.start_date <= p_end_date
      AND (p_period_type <> 'partial' OR coalesce(o.period_type, 'full_day') <> 'partial'
           OR (p_start_time < o.end_time AND o.start_time < p_end_time))
  ) THEN
    RAISE EXCEPTION 'As novas datas não podem ficar sobrepostas a outro período do pedido.';
  END IF;

  -- Ausências já aprovadas noutros pedidos.
  IF EXISTS (
    SELECT 1
    FROM absences a
    JOIN absence_periods ap ON ap.absence_id = a.id
    WHERE a.employee_id = v_absence.employee_id AND a.id <> v_absence.id
      AND a.status IN ('approved', 'partially_approved') AND ap.status = 'approved'
      AND p_start_date <= ap.end_date AND ap.start_date <= p_end_date
      AND (p_period_type <> 'partial' OR coalesce(ap.period_type, 'full_day') <> 'partial'
           OR (p_start_time < ap.end_time AND ap.start_time < p_end_time))
  ) THEN
    RAISE EXCEPTION 'Já tem uma ausência aprovada nas novas datas.';
  END IF;

  -- Outros pedidos pendentes.
  IF EXISTS (
    SELECT 1 FROM absences a
    WHERE a.employee_id = v_absence.employee_id AND a.id <> v_absence.id
      AND a.status = 'pending'
      AND p_start_date <= a.end_date AND p_end_date >= a.start_date
  ) THEN
    RAISE EXCEPTION 'Já existe outro pedido pendente para as novas datas.';
  END IF;

  v_days := CASE
    WHEN p_period_type = 'partial' THEN
      round((extract(epoch FROM p_end_time - p_start_time) / 3600 / 8) * 4) / 4
    ELSE (
      SELECT count(*) FROM generate_series(p_start_date, p_end_date, interval '1 day') AS d(day)
      WHERE extract(isodow FROM d.day) < 6
        AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = d.day::date)
    )
  END;
  IF v_days <= 0 THEN
    RAISE EXCEPTION 'Cada período deve incluir pelo menos um dia útil.';
  END IF;

  SELECT count(*) INTO v_count FROM absence_periods WHERE absence_id = v_period.absence_id;

  IF v_absence.status = 'pending' OR v_count = 1 THEN
    -- No próprio pedido (que fica pendente).
    UPDATE absence_periods
    SET start_date = p_start_date, end_date = p_end_date, business_days = v_days,
        period_type = p_period_type,
        start_time = CASE WHEN p_period_type = 'partial' THEN p_start_time END,
        end_time = CASE WHEN p_period_type = 'partial' THEN p_end_time END,
        status = 'pending'
    WHERE id = p_period_id;
    UPDATE absences
    SET start_date = (SELECT min(start_date) FROM absence_periods WHERE absence_id = v_absence.id),
        end_date = (SELECT max(end_date) FROM absence_periods WHERE absence_id = v_absence.id),
        status = 'pending', approved_by = NULL, approved_at = NULL, rejection_reason = NULL,
        updated_at = now()
    WHERE id = v_absence.id;
    v_target := v_absence.id;
  ELSE
    -- Aprovado com outros períodos: o período novo vai num pedido novo e pendente; o pedido
    -- original e os restantes períodos ficam como estavam.
    INSERT INTO absences (employee_id, company_id, absence_type, start_date, end_date, status,
                          notes, created_by_role)
    VALUES (v_absence.employee_id, v_absence.company_id, 'vacation', p_start_date, p_end_date,
            'pending', v_absence.notes, 'employee')
    RETURNING id INTO v_target;
    INSERT INTO absence_periods (absence_id, start_date, end_date, business_days, period_type,
                                 start_time, end_time, status)
    VALUES (v_target, p_start_date, p_end_date, v_days, p_period_type,
            CASE WHEN p_period_type = 'partial' THEN p_start_time END,
            CASE WHEN p_period_type = 'partial' THEN p_end_time END, 'pending');
    DELETE FROM absence_periods WHERE id = p_period_id;
    UPDATE absences
    SET start_date = (SELECT min(start_date) FROM absence_periods WHERE absence_id = v_absence.id),
        end_date = (SELECT max(end_date) FROM absence_periods WHERE absence_id = v_absence.id),
        updated_at = now()
    WHERE id = v_absence.id;
    v_split := true;
  END IF;

  RETURN jsonb_build_object('absence_id', v_target, 'status', 'pending', 'split', v_split,
                            'business_days', v_days);
END;
$$;

-- Cancelar um período de um pedido pendente ou rejeitado (como hoje, mas por período; se for
-- o único, o pedido todo, com os anexos).
CREATE OR REPLACE FUNCTION public.cancel_absence_period(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_period absence_periods%ROWTYPE;
  v_absence absences%ROWTYPE;
  v_owner uuid;
  v_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É necessário iniciar sessão.';
  END IF;
  SELECT * INTO v_period FROM absence_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Período não encontrado.';
  END IF;
  SELECT * INTO v_absence FROM absences WHERE id = v_period.absence_id FOR UPDATE;
  SELECT e.user_id INTO v_owner FROM employees e WHERE e.id = v_absence.employee_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Não tem permissão para cancelar este período.';
  END IF;
  IF v_absence.status NOT IN ('pending', 'rejected') OR v_period.status = 'approved' THEN
    RAISE EXCEPTION 'Só se cancelam pedidos pendentes ou rejeitados.';
  END IF;

  SELECT count(*) INTO v_count FROM absence_periods WHERE absence_id = v_absence.id;
  IF v_count <= 1 THEN
    DELETE FROM absence_documents WHERE absence_id = v_absence.id;
    DELETE FROM absence_periods WHERE absence_id = v_absence.id;
    DELETE FROM absences WHERE id = v_absence.id;
    RETURN jsonb_build_object('removed_request', true);
  END IF;

  DELETE FROM absence_periods WHERE id = p_period_id;
  UPDATE absences
  SET start_date = (SELECT min(start_date) FROM absence_periods WHERE absence_id = v_absence.id),
      end_date = (SELECT max(end_date) FROM absence_periods WHERE absence_id = v_absence.id),
      updated_at = now()
  WHERE id = v_absence.id;
  RETURN jsonb_build_object('removed_request', false);
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_vacation_period(uuid, date, date, text, time, time)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_absence_period(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_vacation_period(uuid, date, date, text, time, time)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_absence_period(uuid) TO authenticated;
