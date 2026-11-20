-- Chefe de equipa (contrato em docs/chefe-de-equipa.md, secção Servidor).
-- 1. employees.manager_id: responsável direto (mesma empresa, sem ciclos).
-- 2. admin_group_permissions.scope: alcance 'all' (todos) ou 'team' (só a equipa). Padrão 'all':
--    os grupos atuais ficam exatamente como estão.
-- 3. rz_my_team_employee_ids(): colaboradores abaixo de quem pergunta, em todos os níveis.
-- 4. chat_directory() devolve também manager_employee_id (o organograma segue a chefia real).
-- Sem políticas RLS novas.
--
-- Reversão:
--   DROP FUNCTION public.rz_my_team_employee_ids();
--   DROP TRIGGER employees_manager_guard ON public.employees;
--   DROP TRIGGER employees_manager_company_moved ON public.employees;
--   DROP FUNCTION public.rz_employees_manager_guard();
--   DROP FUNCTION public.rz_employees_manager_company_moved();
--   ALTER TABLE public.employees DROP COLUMN manager_id;
--   ALTER TABLE public.admin_group_permissions DROP COLUMN scope;
--   chat_directory(): recriar a versão de 20261016200000_directory_work_contacts.sql.

-- 1. Responsável direto ---------------------------------------------------------------------

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS manager_id uuid NULL REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_manager_not_self;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_manager_not_self CHECK (manager_id IS NULL OR manager_id <> id);

CREATE INDEX IF NOT EXISTS employees_manager_id_idx ON public.employees (manager_id);

COMMENT ON COLUMN public.employees.manager_id IS
  'Responsável direto (chefe de equipa). Mesma empresa, sem ciclos (gatilho employees_manager_guard).';

-- Recusa responsável de outra empresa e ciclos. Se a ficha mudar de empresa sem escolher um
-- responsável novo, o responsável antigo é retirado em vez de bloquear a mudança.
CREATE OR REPLACE FUNCTION public.rz_employees_manager_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  manager_company uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.company_id IS DISTINCT FROM OLD.company_id
     AND NEW.manager_id IS NOT DISTINCT FROM OLD.manager_id THEN
    NEW.manager_id := NULL;
  END IF;

  IF NEW.manager_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.manager_id = NEW.id THEN
    RAISE EXCEPTION 'Esta escolha criava um ciclo na chefia.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT m.company_id INTO manager_company FROM employees m WHERE m.id = NEW.manager_id;
  IF manager_company IS NULL THEN
    -- Ficha inexistente: a chave estrangeira devolve o erro próprio.
    RETURN NEW;
  END IF;
  IF manager_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'O responsável direto tem de ser da mesma empresa.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Duas alterações ao mesmo tempo (A→B e B→A) podiam fechar um ciclo: serializa por empresa.
  PERFORM pg_advisory_xact_lock(hashtext('rz_employees_manager'), hashtext(NEW.company_id::text));

  IF EXISTS (
    WITH RECURSIVE chain(id) AS (
      SELECT NEW.manager_id
      UNION
      SELECT e.manager_id FROM employees e JOIN chain c ON e.id = c.id
      WHERE e.manager_id IS NOT NULL
    )
    SELECT 1 FROM chain WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Esta escolha criava um ciclo na chefia.' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_manager_guard ON public.employees;
CREATE TRIGGER employees_manager_guard
  BEFORE INSERT OR UPDATE OF manager_id, company_id ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.rz_employees_manager_guard();

-- Quem muda de empresa deixa de ser responsável dos colegas que ficam na empresa antiga.
CREATE OR REPLACE FUNCTION public.rz_employees_manager_company_moved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE employees SET manager_id = NULL
  WHERE manager_id = NEW.id AND company_id IS DISTINCT FROM NEW.company_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS employees_manager_company_moved ON public.employees;
CREATE TRIGGER employees_manager_company_moved
  AFTER UPDATE OF company_id ON public.employees
  FOR EACH ROW WHEN (NEW.company_id IS DISTINCT FROM OLD.company_id)
  EXECUTE FUNCTION public.rz_employees_manager_company_moved();

REVOKE ALL ON FUNCTION public.rz_employees_manager_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rz_employees_manager_company_moved() FROM PUBLIC, anon, authenticated;

-- 2. Alcance das permissões -----------------------------------------------------------------

ALTER TABLE public.admin_group_permissions
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'all';

ALTER TABLE public.admin_group_permissions
  DROP CONSTRAINT IF EXISTS admin_group_permissions_scope_check;
ALTER TABLE public.admin_group_permissions
  ADD CONSTRAINT admin_group_permissions_scope_check CHECK (scope IN ('all', 'team'));

COMMENT ON COLUMN public.admin_group_permissions.scope IS
  'Alcance: all = todos os colaboradores; team = só a equipa (rz_my_team_employee_ids). Aplicado nos ecrãs.';

-- 3. A minha equipa -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rz_my_team_employee_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE mine AS (
    SELECT e.id FROM employees e
    WHERE auth.uid() IS NOT NULL
      AND (e.user_id = ANY (public.rz_identity_ids(auth.uid()))
           OR e.admin_user_id = ANY (public.rz_identity_ids(auth.uid())))
  ),
  team(id) AS (
    SELECT e.id FROM employees e WHERE e.manager_id IN (SELECT id FROM mine)
    UNION
    SELECT e.id FROM employees e JOIN team t ON e.manager_id = t.id
  )
  SELECT t.id FROM team t WHERE t.id NOT IN (SELECT id FROM mine);
$$;

REVOKE ALL ON FUNCTION public.rz_my_team_employee_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_my_team_employee_ids() TO authenticated;

-- 4. Diretório com a chefia -----------------------------------------------------------------
-- Igual à versão de 20261016200000_directory_work_contacts.sql, mais manager_employee_id no fim.

DROP FUNCTION IF EXISTS public.chat_directory();
CREATE FUNCTION public.chat_directory()
RETURNS TABLE (
  user_id uuid,
  employee_id uuid,
  name text,
  "position" text,
  department text,
  email text,
  company_id uuid,
  company_name text,
  avatar_path text,
  phone text,
  manager_employee_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.user_id, e.id, e.name, e.position, e.department,
         (SELECT a.username FROM accesses a
          JOIN access_categories ac ON ac.id = a.category_id
          WHERE a.employee_id = e.id AND ac.name = 'Email Pessoal' AND a.username LIKE '%_@_%'
          ORDER BY a.created_at LIMIT 1),
         e.company_id, c.name,
         p.avatar_path,
         (SELECT ph.phone_number FROM phones ph
          WHERE ph.employee_id = e.id
          ORDER BY ph.created_at LIMIT 1),
         e.manager_id
  FROM employees e
  JOIN companies c ON c.id = e.company_id
  LEFT JOIN user_profiles p ON p.user_id = e.user_id
  WHERE e.is_active
    AND e.user_id IS NOT NULL
    AND e.company_id = (SELECT me.company_id FROM employees me
                        WHERE me.user_id = auth.uid() AND me.is_active LIMIT 1)
  ORDER BY e.name;
$$;
REVOKE ALL ON FUNCTION public.chat_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_directory() TO authenticated;
