-- Remetente dos comunicados: nome e departamento de quem envia ("Thiago Sousa · Desenvolvimento").
-- O departamento (curto) em vez do cargo, para o "De:" não ficar comprido.

CREATE OR REPLACE FUNCTION public.broadcast_sender()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object('name', e.name, 'department', nullif(btrim(e.department), ''))
      FROM employees e
      WHERE (e.user_id = auth.uid() OR e.admin_user_id = auth.uid()) AND e.is_active
      ORDER BY (e.user_id = auth.uid()) DESC LIMIT 1),
    jsonb_build_object('name', public.broadcast_sender_name(), 'department', null)
  );
$$;

REVOKE ALL ON FUNCTION public.broadcast_sender() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_sender() TO authenticated;
