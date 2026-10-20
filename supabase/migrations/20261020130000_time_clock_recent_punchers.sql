-- Quadro "Hoje" (Ponto, no admin): quem usa o ponto — registou nos últimos dias — para
-- mostrar quem ainda não começou o dia. Só para quem pode ver o ponto.
CREATE OR REPLACE FUNCTION public.time_clock_recent_punchers(_days integer DEFAULT 30)
RETURNS TABLE (employee_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT e.employee_id
  FROM public.time_clock_entries e
  WHERE public.has_timeclock_permission(auth.uid(), 'view')
    AND e.status <> 'voided'
    AND e.punched_at > now() - make_interval(days => greatest(1, least(coalesce(_days, 30), 90)));
$$;

REVOKE ALL ON FUNCTION public.time_clock_recent_punchers(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.time_clock_recent_punchers(integer) TO authenticated;
