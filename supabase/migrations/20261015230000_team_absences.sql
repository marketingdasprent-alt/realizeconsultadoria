-- Realize 2.0 · Calendário: ausências da equipa só do mesmo departamento, dia a dia pelos
-- períodos aprovados (um pedido com períodos em abril e dezembro não ocupa os meses do meio).
-- Sem o tipo de ausência (só "ausente") e sem expor colegas de outros departamentos.

CREATE OR REPLACE FUNCTION public.rz_team_absences(p_from date, p_to date)
RETURNS TABLE (employee_id uuid, user_id uuid, name text, start_date date, end_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT e.id, e.company_id, lower(trim(e.department)) AS dept
    FROM employees e
    WHERE e.user_id = auth.uid() AND e.is_active AND nullif(trim(e.department), '') IS NOT NULL
    LIMIT 1
  ),
  team AS (
    SELECT e.id, e.user_id, e.name
    FROM employees e, me
    WHERE e.company_id = me.company_id AND e.is_active AND e.id <> me.id
      AND lower(trim(e.department)) = me.dept
  )
  -- Períodos aprovados
  SELECT t.id, t.user_id, t.name, greatest(p.start_date, p_from), least(p.end_date, p_to)
  FROM team t
  JOIN absences a ON a.employee_id = t.id AND a.status IN ('approved', 'partially_approved')
  JOIN absence_periods p ON p.absence_id = a.id AND p.status = 'approved'
  WHERE p.start_date <= p_to AND p.end_date >= p_from
  UNION ALL
  -- Pedidos antigos sem períodos
  SELECT t.id, t.user_id, t.name, greatest(a.start_date, p_from), least(a.end_date, p_to)
  FROM team t
  JOIN absences a ON a.employee_id = t.id AND a.status = 'approved'
  WHERE a.start_date <= p_to AND a.end_date >= p_from
    AND NOT EXISTS (SELECT 1 FROM absence_periods p WHERE p.absence_id = a.id);
$$;
REVOKE ALL ON FUNCTION public.rz_team_absences(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_team_absences(date, date) TO authenticated;
