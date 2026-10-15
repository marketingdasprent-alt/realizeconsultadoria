-- Feed: a regra de leitura das publicações passa a olhar para os campos da própria linha.
-- A versão anterior procurava a publicação pelo id (feed_can_see), o que falha logo ao
-- publicar: no INSERT … RETURNING a linha nova ainda não é visível para essa procura.

CREATE OR REPLACE FUNCTION public.feed_can_see_row(
  _company_id uuid, _audience text, _department text, _author_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees me
    WHERE me.user_id = auth.uid() AND me.is_active AND me.company_id = _company_id
      AND (_audience = 'company' OR _department = me.department OR _author_id = auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.feed_can_see_row(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_can_see_row(uuid, text, text, uuid) TO authenticated;

DROP POLICY IF EXISTS "Feed: ver publicações" ON public.feed_posts;
CREATE POLICY "Feed: ver publicações" ON public.feed_posts
  FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR author_id = auth.uid())
    AND public.feed_can_see_row(company_id, audience, department, author_id)
  );
