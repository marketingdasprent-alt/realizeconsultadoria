-- Realize 2.0 · "contabilidade" e "Contabilidade" são o mesmo departamento.
-- O texto do departamento é livre (escrito à mão no admin), por isso as regras que o comparam
-- (publicações do Feed para o departamento, ausências da equipa) ignoram maiúsculas, acentos
-- e espaços a mais.

CREATE OR REPLACE FUNCTION public.rz_norm(p_text text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT lower(regexp_replace(trim(translate(
    coalesce(p_text, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
  )), '\s+', ' ', 'g'));
$$;
GRANT EXECUTE ON FUNCTION public.rz_norm(text) TO authenticated;

-- Feed: quem vê as publicações de um departamento
CREATE OR REPLACE FUNCTION public.feed_can_see_row(
  _company_id uuid, _audience text, _department text, _author_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees me
    WHERE me.user_id = auth.uid() AND me.is_active AND me.company_id = _company_id
      AND (_audience = 'company'
           OR public.rz_norm(_department) = public.rz_norm(me.department)
           OR _author_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.feed_can_see(_post_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM feed_posts p
    JOIN employees me ON me.user_id = auth.uid() AND me.is_active AND me.company_id = p.company_id
    WHERE p.id = _post_id
      AND p.deleted_at IS NULL
      AND (p.audience = 'company'
           OR public.rz_norm(p.department) = public.rz_norm(me.department)
           OR p.author_id = auth.uid())
  );
$$;

-- Feed: publicar para o meu departamento
DROP POLICY IF EXISTS "Feed: publicar" ON public.feed_posts;
CREATE POLICY "Feed: publicar" ON public.feed_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM employees me
      WHERE me.user_id = auth.uid() AND me.is_active AND me.company_id = feed_posts.company_id
        AND (feed_posts.audience = 'company'
             OR public.rz_norm(feed_posts.department) = public.rz_norm(me.department))
    )
  );

-- Calendário: ausências de quem é do mesmo departamento
CREATE OR REPLACE FUNCTION public.rz_team_absences(p_from date, p_to date)
RETURNS TABLE (employee_id uuid, user_id uuid, name text, start_date date, end_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT e.id, e.company_id, public.rz_norm(e.department) AS dept
    FROM employees e
    WHERE e.user_id = auth.uid() AND e.is_active AND nullif(trim(e.department), '') IS NOT NULL
    LIMIT 1
  ),
  team AS (
    SELECT e.id, e.user_id, e.name
    FROM employees e, me
    WHERE e.company_id = me.company_id AND e.is_active AND e.id <> me.id
      AND public.rz_norm(e.department) = me.dept
  )
  SELECT t.id, t.user_id, t.name, greatest(p.start_date, p_from), least(p.end_date, p_to)
  FROM team t
  JOIN absences a ON a.employee_id = t.id AND a.status IN ('approved', 'partially_approved')
  JOIN absence_periods p ON p.absence_id = a.id AND p.status = 'approved'
  WHERE p.start_date <= p_to AND p.end_date >= p_from
  UNION ALL
  SELECT t.id, t.user_id, t.name, greatest(a.start_date, p_from), least(a.end_date, p_to)
  FROM team t
  JOIN absences a ON a.employee_id = t.id AND a.status = 'approved'
  WHERE a.start_date <= p_to AND a.end_date >= p_from
    AND NOT EXISTS (SELECT 1 FROM absence_periods p WHERE p.absence_id = a.id);
$$;
REVOKE ALL ON FUNCTION public.rz_team_absences(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_team_absences(date, date) TO authenticated;
