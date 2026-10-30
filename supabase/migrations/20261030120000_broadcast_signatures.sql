-- Comunicados assinados com a assinatura de email de quem envia. A pessoa pode ter duas contas
-- (a de admin ligada à de colaborador por employees.admin_user_id): as assinaturas do Webmail
-- estão na de colaborador, por isso vêm as das duas. Primeiro a da caixa com o mesmo endereço
-- da conta com que entrou (ex.: thiago.sousa@… → "Thiago Sousa"), depois as predefinidas.

CREATE OR REPLACE FUNCTION public.broadcast_signatures()
RETURNS TABLE (id uuid, name text, html text, is_default boolean, account_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid, (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()) AS email
  ),
  owners AS (
    SELECT uid FROM me
    UNION
    SELECT e.user_id FROM employees e, me WHERE e.admin_user_id = me.uid AND e.user_id IS NOT NULL
    UNION
    SELECT e.admin_user_id FROM employees e, me WHERE e.user_id = me.uid AND e.admin_user_id IS NOT NULL
  )
  SELECT s.id, s.name, s.html, s.is_default, a.email
  FROM mail_signatures s
  JOIN mail_accounts a ON a.id = s.account_id
  WHERE s.user_id IN (SELECT uid FROM owners)
  ORDER BY (lower(a.email) = lower((SELECT email FROM me))) DESC, s.is_default DESC, s.name;
$$;

REVOKE ALL ON FUNCTION public.broadcast_signatures() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_signatures() TO authenticated;
