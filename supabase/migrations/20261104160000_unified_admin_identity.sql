-- Contas unificadas: quem tem conta de colaborador E conta de admin ligada à ficha
-- (employees.admin_user_id, que só um super admin liga) passa a ter os poderes de admin também
-- quando entra com a conta de colaborador. Assim o Workspace mostra as partes de admin (ex.: o
-- separador "Equipa" no Ponto) sem trocar de conta, e as regras de acesso (RLS) deixam ler.
--
-- Só num sentido: a conta de colaborador herda da de admin; a de admin não muda. O login (papel
-- lido em user_roles pela app) não muda.

-- A própria conta e a conta de admin ligada à ficha (se houver).
CREATE OR REPLACE FUNCTION public.rz_identity_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ARRAY[_user_id] || COALESCE(
    (SELECT array_agg(e.admin_user_id) FROM employees e
      WHERE e.user_id = _user_id AND e.admin_user_id IS NOT NULL),
    ARRAY[]::uuid[]
  );
$$;

REVOKE ALL ON FUNCTION public.rz_identity_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_identity_ids(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = ANY (public.rz_identity_ids(_user_id)) AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_group_members agm
    JOIN admin_groups ag ON ag.id = agm.group_id
    WHERE agm.user_id = ANY (public.rz_identity_ids(_user_id))
      AND ag.is_super_admin = true AND ag.is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_account(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = ANY (public.rz_identity_ids(_user_id)) AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM admin_group_members agm
      JOIN admin_groups ag ON ag.id = agm.group_id
      WHERE agm.user_id = ANY (public.rz_identity_ids(_user_id)) AND ag.is_active
    );
$$;

CREATE OR REPLACE FUNCTION public.rz_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin_account(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_admin_permissions(_user_id uuid)
RETURNS TABLE(module_key text, topic_key text, can_view boolean, can_edit boolean, can_execute boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ids AS (SELECT unnest(public.rz_identity_ids(_user_id)) AS id),
  super AS (
    SELECT EXISTS (
      SELECT 1 FROM admin_group_members agm JOIN admin_groups ag ON ag.id = agm.group_id
      WHERE agm.user_id IN (SELECT id FROM ids) AND ag.is_super_admin = true AND ag.is_active = true
    ) AS yes
  )
  SELECT m.module_key, NULL::text, true, true, true
  FROM (SELECT unnest(ARRAY['dashboard', 'companies', 'employees', 'requests', 'support', 'calendar', 'settings', 'marketing']) AS module_key) m
  WHERE (SELECT yes FROM super)
  UNION ALL
  SELECT agp.module_key, agp.topic_key, bool_or(agp.can_view), bool_or(agp.can_edit), bool_or(agp.can_execute)
  FROM admin_group_members agm
  JOIN admin_groups ag ON ag.id = agm.group_id
  JOIN admin_group_permissions agp ON agp.group_id = ag.id
  WHERE agm.user_id IN (SELECT id FROM ids) AND ag.is_active = true AND ag.is_super_admin = false
    AND NOT (SELECT yes FROM super)
  GROUP BY agp.module_key, agp.topic_key;
$$;
