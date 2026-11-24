-- Reverte o PR4: o Feed volta a depender só da ficha de colaborador. Aplicar numa única chamada.

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
  );
$function$;

DROP POLICY IF EXISTS "Feed: publicar" ON public.feed_posts;
CREATE POLICY "Feed: publicar" ON public.feed_posts
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((author_id = auth.uid()) AND (EXISTS (SELECT 1 FROM employees me
    WHERE ((me.user_id = auth.uid()) AND me.is_active AND (me.company_id = feed_posts.company_id)
      AND ((feed_posts.audience = 'company'::text) OR (rz_norm(feed_posts.department) = rz_norm(me.department)))))));

DO $fx$
DECLARE
  v_def text;
  v_old text := '(SELECT e.name FROM employees e WHERE e.user_id = p.author_id
           ORDER BY (e.company_id = p.company_id) DESC, e.is_active DESC, e.created_at LIMIT 1)';
BEGIN
  SELECT pg_get_functiondef('public.feed_list_posts(timestamptz,integer)'::regprocedure) INTO v_def;
  EXECUTE replace(v_def, 'coalesce(' || v_old || ', (SELECT btrim(pr.name) FROM public.profiles pr WHERE pr.user_id = p.author_id))', v_old);
END
$fx$;
