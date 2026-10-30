-- Comunicados: o remetente por omissão é quem envia (não "Recursos Humanos"). Nome da ficha de
-- colaborador (também a ligada à conta de admin), senão o do perfil, senão o início do email.

CREATE OR REPLACE FUNCTION public.broadcast_sender_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT e.name FROM employees e
      WHERE (e.user_id = auth.uid() OR e.admin_user_id = auth.uid()) AND e.is_active
      ORDER BY (e.user_id = auth.uid()) DESC LIMIT 1),
    (SELECT nullif(btrim(p.name), '') FROM profiles p WHERE p.id = auth.uid()),
    (SELECT split_part(u.email, '@', 1) FROM auth.users u WHERE u.id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.broadcast_sender_name() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_sender_name() TO authenticated;
