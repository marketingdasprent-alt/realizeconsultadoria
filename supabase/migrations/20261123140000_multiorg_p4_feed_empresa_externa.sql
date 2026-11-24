-- Multi-organização, PR4: Feed de uma empresa externa para o seu administrador (com ou sem ficha).
--
-- O Feed partia sempre de employees: um administrador sem ficha de colaborador não via nem publicava.
-- Agora o administrador da empresa (rz_is_company_admin: pertença admin ativa, ou super admin) vê as
-- publicações "para toda a empresa" dessa empresa e publica nela (publicações de departamento continuam a
-- precisar de ficha: não há departamento sem ficha). Quem tem ficha mantém exatamente as regras de hoje.
-- feed_list_posts passa a mostrar o nome (perfil) de quem escreve sem ficha.
--
-- Não toca nos dados. Aplicar numa única chamada, depois do PR3.

CREATE OR REPLACE FUNCTION public.feed_can_see(_post_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM feed_posts p
    JOIN employees me ON me.user_id = auth.uid() AND me.is_active AND me.company_id = p.company_id
    WHERE p.id = _post_id
      AND p.deleted_at IS NULL
      AND (p.audience = 'company'
           OR public.rz_norm(p.department) = public.rz_norm(me.department)
           OR p.author_id = auth.uid())
  )
  -- Administrador da empresa sem ficha (ou com ficha noutra empresa): publicações para toda a empresa.
  OR EXISTS (
    SELECT 1 FROM feed_posts p
    WHERE p.id = _post_id AND p.deleted_at IS NULL AND p.audience = 'company'
      AND public.rz_is_company_admin(p.company_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.feed_can_see_row(_company_id uuid, _audience text, _department text, _author_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM employees me
    WHERE me.user_id = auth.uid() AND me.is_active AND me.company_id = _company_id
      AND (_audience = 'company'
           OR public.rz_norm(_department) = public.rz_norm(me.department)
           OR _author_id = auth.uid())
  )
  OR (_audience = 'company' AND public.rz_is_company_admin(_company_id));
$function$;

DROP POLICY IF EXISTS "Feed: publicar" ON public.feed_posts;
CREATE POLICY "Feed: publicar" ON public.feed_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM employees me
               WHERE me.user_id = auth.uid() AND me.is_active AND me.company_id = feed_posts.company_id
                 AND (feed_posts.audience = 'company'
                      OR rz_norm(feed_posts.department) = rz_norm(me.department)))
      OR (feed_posts.audience = 'company' AND public.rz_is_company_admin(feed_posts.company_id))
    )
  );

-- Nome de quem escreve sem ficha: o do perfil.
DO $fx$
DECLARE
  v_def text;
  v_old text := '(SELECT e.name FROM employees e WHERE e.user_id = p.author_id
           ORDER BY (e.company_id = p.company_id) DESC, e.is_active DESC, e.created_at LIMIT 1)';
BEGIN
  SELECT pg_get_functiondef('public.feed_list_posts(timestamptz,integer)'::regprocedure) INTO v_def;
  IF position(v_old IN v_def) = 0 THEN RAISE EXCEPTION 'p4: feed_list_posts mudou'; END IF;
  EXECUTE replace(v_def, v_old, 'coalesce(' || v_old || ', (SELECT btrim(pr.name) FROM public.profiles pr WHERE pr.user_id = p.author_id))');
END
$fx$;
