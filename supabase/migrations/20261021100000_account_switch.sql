-- Login único e passagem entre o admin e o Workspace (Realize 2.0).
--
-- Quem é colaborador e administrador pode ter duas contas (dois logins). A ficha do
-- colaborador passa a guardar qual é a conta de admin dele (employees.admin_user_id).
-- Os logins de app.realizeconsultadoria.pt e de admin.realizeconsultadoria.pt aceitam
-- qualquer conta e cada site abre a área certa; quem tem as duas (ou uma conta que é as
-- duas coisas) passa de uma para a outra pelo botão do topo, sem voltar a pedir a
-- palavra-passe (função switch-account).
--
-- A ligação dá entrada na conta de admin, por isso só um super admin liga ou desliga.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS admin_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.employees.admin_user_id IS
  'Conta de administrador da mesma pessoa (login à parte). Só um super admin altera.';

/** Conta de administrador: papel admin ou membro de um grupo de admin ativo. */
CREATE OR REPLACE FUNCTION public.is_admin_account(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
      OR EXISTS (
        SELECT 1 FROM admin_group_members agm
        JOIN admin_groups ag ON ag.id = agm.group_id
        WHERE agm.user_id = _user_id AND ag.is_active
      );
$$;

-- Ligar/desligar: só o super admin (o SQL Editor e o service role, sem auth.uid(), passam)
-- e só a contas que são mesmo de administrador.
CREATE OR REPLACE FUNCTION public.employees_guard_admin_link()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_super_admin_member(auth.uid()) THEN
    RAISE EXCEPTION 'Só um super admin pode ligar contas de administrador'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.admin_user_id IS NOT NULL AND NOT is_admin_account(NEW.admin_user_id) THEN
    RAISE EXCEPTION 'Essa conta não é de administrador' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_admin_link_update ON public.employees;
CREATE TRIGGER employees_admin_link_update
  BEFORE UPDATE OF admin_user_id ON public.employees
  FOR EACH ROW WHEN (NEW.admin_user_id IS DISTINCT FROM OLD.admin_user_id)
  EXECUTE FUNCTION public.employees_guard_admin_link();

DROP TRIGGER IF EXISTS employees_admin_link_insert ON public.employees;
CREATE TRIGGER employees_admin_link_insert
  BEFORE INSERT ON public.employees
  FOR EACH ROW WHEN (NEW.admin_user_id IS NOT NULL)
  EXECUTE FUNCTION public.employees_guard_admin_link();

/**
 * Conta em que `_user_id` entra ao ir para 'admin' ou 'workspace': a própria, se já é
 * dessa área; senão a conta ligada na ficha do colaborador. NULL = não pode ir.
 * Só a função switch-account (service role) a chama.
 */
CREATE OR REPLACE FUNCTION public.account_switch_target(_user_id uuid, _to text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE _to
    WHEN 'admin' THEN COALESCE(
      CASE WHEN is_admin_account(_user_id) THEN _user_id END,
      (SELECT e.admin_user_id FROM employees e
        WHERE e.user_id = _user_id AND e.is_active AND e.admin_user_id IS NOT NULL
          AND is_admin_account(e.admin_user_id)
        LIMIT 1)
    )
    WHEN 'workspace' THEN COALESCE(
      (SELECT e.user_id FROM employees e WHERE e.user_id = _user_id AND e.is_active LIMIT 1),
      (SELECT e.user_id FROM employees e
        WHERE e.admin_user_id = _user_id AND e.is_active AND e.user_id IS NOT NULL
        LIMIT 1)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.account_switch_target(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_switch_target(uuid, text) TO service_role;

/** Áreas para onde a pessoa autenticada pode ir sem voltar a entrar ('admin', 'workspace'). */
CREATE OR REPLACE FUNCTION public.account_switch_targets()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN account_switch_target(auth.uid(), 'admin') IS NOT NULL THEN 'admin' END,
    CASE WHEN account_switch_target(auth.uid(), 'workspace') IS NOT NULL THEN 'workspace' END
  ], NULL);
$$;

REVOKE ALL ON FUNCTION public.account_switch_targets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_switch_targets() TO authenticated;

/**
 * Contas de administrador para ligar a fichas (só para super admins): a que ficha já estão
 * ligadas e se a conta é também a de um colaborador (conta única).
 */
CREATE OR REPLACE FUNCTION public.admin_link_candidates()
RETURNS TABLE (
  user_id uuid,
  name text,
  email text,
  linked_employee_id uuid,
  linked_employee_name text,
  is_employee_account boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.name, p.email, e.id, e.name,
         EXISTS (SELECT 1 FROM employees x WHERE x.user_id = p.user_id)
  FROM profiles p
  LEFT JOIN employees e ON e.admin_user_id = p.user_id
  WHERE is_super_admin_member(auth.uid()) AND is_admin_account(p.user_id)
  ORDER BY p.name;
$$;

REVOKE ALL ON FUNCTION public.admin_link_candidates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_link_candidates() TO authenticated;
