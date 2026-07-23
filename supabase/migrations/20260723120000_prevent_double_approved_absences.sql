-- Impedir que o mesmo colaborador fique com DOIS pedidos aprovados a ocupar o
-- mesmo dia.
--
-- Contexto: a regra anterior (20260706120000) so olhava para pedidos "pending"
-- e isentava administradores por completo. Resultado: bastava o primeiro pedido
-- ja estar aprovado -- ou a marcacao em massa ser corrida duas vezes -- para
-- ficarem dois registos aprovados nos mesmos dias. Alem do nome sair repetido no
-- calendario, o saldo de ferias era descontado a dobrar, porque
-- recalculate_vacation_used_days soma SUM(business_days) sem deduplicar datas.
--
-- Regra: dois periodos colidem quando partilham um dia de calendario. Dois
-- periodos PARCIAIS no mesmo dia sao permitidos desde que as horas nao se
-- cruzem (ex.: formacao 09:00-13:00 + consulta 16:00-17:00). Sem excecao para
-- administradores -- esta e a ultima linha de defesa.

-- ---------------------------------------------------------------------------
-- Devolve a primeira colisao entre os periodos aprovados de uma ausencia e os
-- periodos aprovados das restantes ausencias do mesmo colaborador.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.absence_day_conflict(p_absence_id uuid)
RETURNS TABLE (other_id uuid, other_type text, conflict_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH me AS (
    SELECT a.id, a.employee_id, a.status, a.start_date, a.end_date
    FROM absences a
    WHERE a.id = p_absence_id
  ),
  my_periods AS (
    SELECT ap.start_date, ap.end_date, ap.period_type, ap.start_time, ap.end_time
    FROM absence_periods ap
    JOIN me ON ap.absence_id = me.id
    WHERE COALESCE(ap.status, me.status) = 'approved'
    UNION ALL
    -- Ausencias antigas sem periodos: vale o intervalo principal.
    SELECT me.start_date, me.end_date, 'full_day', NULL::time, NULL::time
    FROM me
    WHERE me.status = 'approved'
      AND NOT EXISTS (SELECT 1 FROM absence_periods ap2 WHERE ap2.absence_id = me.id)
  ),
  other_periods AS (
    SELECT a.id, a.absence_type, ap.start_date, ap.end_date,
           ap.period_type, ap.start_time, ap.end_time
    FROM absences a
    JOIN me ON a.employee_id = me.employee_id AND a.id <> me.id
    JOIN absence_periods ap ON ap.absence_id = a.id
    WHERE a.status IN ('approved', 'partially_approved')
      AND COALESCE(ap.status, a.status) = 'approved'
    UNION ALL
    SELECT a.id, a.absence_type, a.start_date, a.end_date,
           'full_day', NULL::time, NULL::time
    FROM absences a
    JOIN me ON a.employee_id = me.employee_id AND a.id <> me.id
    WHERE a.status = 'approved'
      AND NOT EXISTS (SELECT 1 FROM absence_periods ap2 WHERE ap2.absence_id = a.id)
  )
  SELECT o.id, o.absence_type, GREATEST(m.start_date, o.start_date)::date
  FROM my_periods m
  JOIN other_periods o
    ON m.start_date <= o.end_date
   AND o.start_date <= m.end_date
   AND (
        -- basta um dos lados ocupar o dia inteiro
        m.period_type IS DISTINCT FROM 'partial'
     OR o.period_type IS DISTINCT FROM 'partial'
     OR m.start_time IS NULL OR m.end_time IS NULL
     OR o.start_time IS NULL OR o.end_time IS NULL
        -- ambos parciais: so colidem se as horas se cruzarem
     OR (m.start_time < o.end_time AND o.start_time < m.end_time)
   )
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- Disparado quando se cria/altera um periodo aprovado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_absence_period_conflict()
RETURNS TRIGGER AS $$
DECLARE
  v_absence_status text;
  v_conflict record;
BEGIN
  SELECT status INTO v_absence_status FROM public.absences WHERE id = NEW.absence_id;

  -- So interessa validar o que efetivamente ocupa o dia.
  IF v_absence_status IS NULL OR v_absence_status NOT IN ('approved', 'partially_approved') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.status, v_absence_status) <> 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_conflict FROM public.absence_day_conflict(NEW.absence_id);

  IF v_conflict.other_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este colaborador ja tem uma ausencia aprovada em %. Nao pode ter dois pedidos aprovados no mesmo dia.',
      to_char(v_conflict.conflict_date, 'DD/MM/YYYY');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- ---------------------------------------------------------------------------
-- Disparado quando uma ausencia passa a aprovada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_absence_status_conflict()
RETURNS TRIGGER AS $$
DECLARE
  v_conflict record;
BEGIN
  IF NEW.status NOT IN ('approved', 'partially_approved') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_conflict FROM public.absence_day_conflict(NEW.id);

  IF v_conflict.other_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este colaborador ja tem uma ausencia aprovada em %. Nao pode ter dois pedidos aprovados no mesmo dia.',
      to_char(v_conflict.conflict_date, 'DD/MM/YYYY');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS tr_absence_period_no_double_approval ON public.absence_periods;
CREATE TRIGGER tr_absence_period_no_double_approval
  AFTER INSERT OR UPDATE ON public.absence_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.check_absence_period_conflict();

DROP TRIGGER IF EXISTS tr_absence_no_double_approval ON public.absences;
CREATE TRIGGER tr_absence_no_double_approval
  AFTER INSERT OR UPDATE OF status ON public.absences
  FOR EACH ROW
  WHEN (NEW.status IN ('approved', 'partially_approved'))
  EXECUTE FUNCTION public.check_absence_status_conflict();
