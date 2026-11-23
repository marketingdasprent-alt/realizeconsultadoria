-- Reverte o PR1 multi-organização (escalada de privilégios): volta às policies e funções anteriores.
-- ATENÇÃO: repõe o modelo em que qualquer admin (has_role admin) gere papéis, grupos de admin e todas
-- as empresas, e em que o grupo com is_super_admin conta como super admin. Só para emergência.
-- ORDEM: se o frontend novo já estiver em produção, reverte-o primeiro (chama rz_my_admin_company_ids e
-- rz_admin_company_ids, que este rollback apaga).
-- Aplicar numa única chamada.

GRANT ALL ON public.companies, public.user_roles, public.admin_groups, public.admin_group_members,
  public.admin_group_permissions, public.admin_group_support_departments TO anon;
GRANT TRUNCATE, TRIGGER, REFERENCES ON public.companies, public.user_roles, public.admin_groups,
  public.admin_group_members, public.admin_group_permissions, public.admin_group_support_departments
  TO authenticated;

DROP POLICY IF EXISTS "Admins can manage equipment categories" ON public.equipment_categories;
CREATE POLICY "Admins can manage equipment categories" ON public.equipment_categories
  FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role) OR (EXISTS (SELECT 1 FROM admin_group_members agm JOIN admin_groups ag ON ag.id = agm.group_id WHERE agm.user_id = auth.uid() AND ag.is_super_admin = true)))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (EXISTS (SELECT 1 FROM admin_group_members agm JOIN admin_groups ag ON ag.id = agm.group_id WHERE agm.user_id = auth.uid() AND ag.is_super_admin = true)));
DROP POLICY IF EXISTS "Admins can manage equipments" ON public.equipments;
CREATE POLICY "Admins can manage equipments" ON public.equipments
  FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role) OR (EXISTS (SELECT 1 FROM admin_group_members agm JOIN admin_groups ag ON ag.id = agm.group_id WHERE agm.user_id = auth.uid() AND ag.is_super_admin = true)))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (EXISTS (SELECT 1 FROM admin_group_members agm JOIN admin_groups ag ON ag.id = agm.group_id WHERE agm.user_id = auth.uid() AND ag.is_super_admin = true)));

DROP TRIGGER IF EXISTS companies_guard ON public.companies;
DROP FUNCTION IF EXISTS public.rz_companies_guard();

DROP POLICY IF EXISTS "Empresas: só o super admin apaga" ON public.companies;
DROP POLICY IF EXISTS "Empresas: só o super admin cria" ON public.companies;
DROP POLICY IF EXISTS "Empresas: o admin da empresa altera" ON public.companies;
DROP POLICY IF EXISTS "Empresas: ver as minhas" ON public.companies;
CREATE POLICY "Admins can manage all companies" ON public.companies
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Departamentos de grupos de admin: ver os dos meus" ON public.admin_group_support_departments;
DROP POLICY IF EXISTS "Departamentos de grupos de admin: só o super admin gere" ON public.admin_group_support_departments;
CREATE POLICY "Admins can manage all group departments" ON public.admin_group_support_departments
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Permissões de grupos de admin: ver as dos meus" ON public.admin_group_permissions;
DROP POLICY IF EXISTS "Permissões de grupos de admin: só o super admin gere" ON public.admin_group_permissions;
CREATE POLICY "Admins can manage all group permissions" ON public.admin_group_permissions
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Membros de grupos de admin: ver as minhas" ON public.admin_group_members;
DROP POLICY IF EXISTS "Membros de grupos de admin: só o super admin gere" ON public.admin_group_members;
CREATE POLICY "Admins can manage all group members" ON public.admin_group_members
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Grupos de admin: ver os meus" ON public.admin_groups;
DROP POLICY IF EXISTS "Grupos de admin: só o super admin gere" ON public.admin_groups;
CREATE POLICY "Admins can manage all groups" ON public.admin_groups
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Papéis: só o super admin gere" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_admin_permissions(_user_id uuid)
 RETURNS TABLE(module_key text, topic_key text, can_view boolean, can_edit boolean, can_execute boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin_member(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM admin_group_members agm
    JOIN admin_groups ag ON ag.id = agm.group_id
    WHERE agm.user_id = ANY (public.rz_identity_ids(_user_id))
      AND ag.is_super_admin = true AND ag.is_active = true
  )
$function$;

DROP FUNCTION IF EXISTS public.rz_admin_company_ids();
DROP FUNCTION IF EXISTS public.rz_my_admin_company_ids();
