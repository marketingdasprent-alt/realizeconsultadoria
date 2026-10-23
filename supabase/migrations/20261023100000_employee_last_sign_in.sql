-- Admin: última entrada de cada colaborador na app (para ver quem nunca entrou ou deixou de
-- entrar e reenviar o convite). Só para administradores (papel admin ou grupo de admin ativo).
CREATE OR REPLACE FUNCTION public.admin_employee_last_sign_in()
RETURNS TABLE (employee_id uuid, last_sign_in_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, u.last_sign_in_at
  FROM employees e
  LEFT JOIN auth.users u ON u.id = e.user_id
  WHERE has_role(auth.uid(), 'admin')
     OR EXISTS (
       SELECT 1 FROM admin_group_members m
       JOIN admin_groups g ON g.id = m.group_id AND g.is_active
       WHERE m.user_id = auth.uid()
     );
$$;
REVOKE ALL ON FUNCTION public.admin_employee_last_sign_in() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_employee_last_sign_in() TO authenticated;
