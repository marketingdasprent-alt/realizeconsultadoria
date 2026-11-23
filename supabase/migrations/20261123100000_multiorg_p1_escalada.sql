-- Multi-organização, PR1: fim da escalada de privilégios entre empresas.
--
-- Problema: um admin de uma empresa passava nas regras de dados de TODAS (has_role(admin) é global):
-- gerir papéis (user_roles) e dar admin a qualquer conta, mexer nos grupos de admin (um grupo com
-- is_super_admin dava poder total, incluindo apagar empresas em cascata) e editar/apagar qualquer empresa.
-- E o "super admin" existia em dois sítios que podiam divergir (platform_admins na BD,
-- admin_groups.is_super_admin no ecrã e nas regras de finanças/ponto/equipamentos).
--
-- O que muda:
--   1. Super admin passa a ser só platform_admins (rz_is_super_admin_for). is_super_admin_member e
--      get_admin_permissions deixam de olhar para admin_groups.is_super_admin: esse campo fica sem
--      efeito na BD (pôr alguém no grupo "Super Admin" já não dá poder nenhum). Ainda o leem, fora desta
--      migração: get_user_support_departments e as edge functions mail-api/sendLog, _shared/admin-caller e
--      company-files/deleteRequests; hoje todos os membros desse grupo são platform_admins, por isso sem
--      efeito prático, e saem nos PR seguintes.
--   2. O administrador de empresa (pertença admin ativa) NÃO recebe módulos de get_admin_permissions:
--      has_module_permission alimenta policies ainda sem âmbito por empresa (finanças, ponto) e abria
--      os dados de todas as empresas. O ecrã reconhece-o por rz_my_admin_company_ids() (frontend).
--   3. user_roles, admin_groups, admin_group_permissions, admin_group_members e
--      admin_group_support_departments: só o super admin escreve. Cada pessoa continua a ler as suas
--      pertenças a grupos (o ecrã precisa delas).
--   4. companies: deixa de haver "admin gere tudo". Ver: as minhas empresas (ou super admin). Alterar: admin
--      da própria empresa (rz_is_company_admin, que inclui o super admin). Criar e apagar: só super admin.
--      Um admin de empresa só altera os dados de contacto (lista branca no gatilho); NIF, estado, plano,
--      registo, domínio e colunas futuras só o super admin.
--   5. Funções novas rz_my_admin_company_ids() e rz_admin_company_ids() para as regras por empresa dos
--      PR seguintes (a segunda devolve todas as empresas ao super admin).
--
-- Pré-verificação: a migração pára se alguém ficasse sem poder (super admin só de grupo) ou se não houver
-- nenhum platform_admin ativo.
-- Também: tira o ramo do grupo is_super_admin das policies de equipamentos e retira TRUNCATE/TRIGGER/
-- REFERENCES (e tudo ao anónimo) nas tabelas tocadas.
--
-- NÃO muda: rz_is_admin() / is_admin_account() / has_role(...,'admin') continuam como estão (os PR
-- seguintes trocam-nas tabela a tabela). Dados: nenhuma linha é alterada nesta migração.
--
-- Todas as policies antigas são removidas na MESMA transação em que as novas nascem (policies
-- permissivas somam-se com OR: a antiga continuaria a abrir tudo).
-- Aplicar numa única chamada (um só pedido = uma transação).

-- ------------------------------------------------------------------ 0. pré-verificação
-- Quem hoje é super admin só por estar num grupo is_super_admin e não está em platform_admins perderia
-- todo o poder. Se houver alguém assim (ou se não houver nenhum super admin ativo), a migração pára
-- e nada é aplicado: promovam-se primeiro essas contas a platform_admins.
DO $pre$
DECLARE
  v_orfaos text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE active) THEN
    RAISE EXCEPTION 'p1_sem_super_admin: nao ha nenhum super admin ativo em platform_admins';
  END IF;
  SELECT string_agg(DISTINCT agm.user_id::text, ',') INTO v_orfaos
  FROM public.admin_group_members agm
  JOIN public.admin_groups ag ON ag.id = agm.group_id AND ag.is_super_admin AND ag.is_active
  WHERE NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.active AND pa.user_id = agm.user_id);
  IF v_orfaos IS NOT NULL THEN
    RAISE EXCEPTION 'p1_super_admin_so_de_grupo: contas num grupo is_super_admin sem platform_admins: %', v_orfaos;
  END IF;
END
$pre$;

-- ------------------------------------------------------------------ 1. funções de âmbito
CREATE OR REPLACE FUNCTION public.rz_my_admin_company_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(array_agg(DISTINCT cm.company_id), ARRAY[]::uuid[])
  FROM public.company_memberships cm
  WHERE auth.uid() IS NOT NULL
    AND cm.role = 'admin' AND cm.status = 'ativo'
    AND cm.user_id = ANY (public.rz_identity_ids(auth.uid()));
$function$;

CREATE OR REPLACE FUNCTION public.rz_admin_company_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE WHEN public.rz_is_super_admin()
              THEN (SELECT coalesce(array_agg(c.id), ARRAY[]::uuid[]) FROM public.companies c)
              ELSE public.rz_my_admin_company_ids()
         END;
$function$;

REVOKE ALL ON FUNCTION public.rz_my_admin_company_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rz_admin_company_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_my_admin_company_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rz_admin_company_ids() TO authenticated, service_role;

-- ------------------------------------------------------------------ 2. super admin = platform_admins
CREATE OR REPLACE FUNCTION public.is_super_admin_member(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.rz_is_super_admin_for(_user_id)
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_permissions(_user_id uuid)
 RETURNS TABLE(module_key text, topic_key text, can_view boolean, can_edit boolean, can_execute boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH ids AS (SELECT unnest(public.rz_identity_ids(_user_id)) AS id),
  super AS (SELECT public.rz_is_super_admin_for(_user_id) AS yes)
  -- Super admin (platform_admins): todos os módulos.
  SELECT m.module_key, NULL::text, true, true, true
  FROM (SELECT unnest(ARRAY['dashboard', 'companies', 'employees', 'requests', 'support', 'calendar', 'settings', 'marketing']) AS module_key) m
  WHERE (SELECT yes FROM super)
  UNION ALL
  -- Grupos de admin (RH, Jurídico, ...): o campo is_super_admin já não conta para nada.
  -- O administrador de empresa NÃO ganha módulos aqui: has_module_permission é usada por policies que
  -- ainda não têm âmbito por empresa (finanças, ponto) e abriria os dados de todas as empresas. O acesso
  -- ao ecrã do administrador de empresa vem de rz_my_admin_company_ids() (ver accessService).
  SELECT agp.module_key, agp.topic_key, bool_or(agp.can_view), bool_or(agp.can_edit), bool_or(agp.can_execute)
  FROM public.admin_group_members agm
  JOIN public.admin_groups ag ON ag.id = agm.group_id
  JOIN public.admin_group_permissions agp ON agp.group_id = ag.id
  WHERE agm.user_id IN (SELECT id FROM ids) AND ag.is_active = true AND ag.is_super_admin = false
    AND NOT (SELECT yes FROM super)
  GROUP BY agp.module_key, agp.topic_key;
$function$;

-- ------------------------------------------------------------------ 3. user_roles e grupos de admin
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Papéis: só o super admin gere" ON public.user_roles
  FOR ALL TO authenticated
  USING ((SELECT public.rz_is_super_admin()))
  WITH CHECK ((SELECT public.rz_is_super_admin()));

DROP POLICY IF EXISTS "Admins can manage all groups" ON public.admin_groups;
CREATE POLICY "Grupos de admin: só o super admin gere" ON public.admin_groups
  FOR ALL TO authenticated
  USING ((SELECT public.rz_is_super_admin()))
  WITH CHECK ((SELECT public.rz_is_super_admin()));
CREATE POLICY "Grupos de admin: ver os meus" ON public.admin_groups
  FOR SELECT TO authenticated
  USING (id IN (SELECT agm.group_id FROM public.admin_group_members agm
                 WHERE agm.user_id = ANY ((SELECT public.rz_identity_ids((SELECT auth.uid())))::uuid[])));

DROP POLICY IF EXISTS "Admins can manage all group members" ON public.admin_group_members;
CREATE POLICY "Membros de grupos de admin: só o super admin gere" ON public.admin_group_members
  FOR ALL TO authenticated
  USING ((SELECT public.rz_is_super_admin()))
  WITH CHECK ((SELECT public.rz_is_super_admin()));
CREATE POLICY "Membros de grupos de admin: ver as minhas" ON public.admin_group_members
  FOR SELECT TO authenticated
  USING (user_id = ANY ((SELECT public.rz_identity_ids((SELECT auth.uid())))::uuid[]));

DROP POLICY IF EXISTS "Admins can manage all group permissions" ON public.admin_group_permissions;
CREATE POLICY "Permissões de grupos de admin: só o super admin gere" ON public.admin_group_permissions
  FOR ALL TO authenticated
  USING ((SELECT public.rz_is_super_admin()))
  WITH CHECK ((SELECT public.rz_is_super_admin()));
CREATE POLICY "Permissões de grupos de admin: ver as dos meus" ON public.admin_group_permissions
  FOR SELECT TO authenticated
  USING (group_id IN (SELECT agm.group_id FROM public.admin_group_members agm
                       WHERE agm.user_id = ANY ((SELECT public.rz_identity_ids((SELECT auth.uid())))::uuid[])));

DROP POLICY IF EXISTS "Admins can manage all group departments" ON public.admin_group_support_departments;
CREATE POLICY "Departamentos de grupos de admin: só o super admin gere" ON public.admin_group_support_departments
  FOR ALL TO authenticated
  USING ((SELECT public.rz_is_super_admin()))
  WITH CHECK ((SELECT public.rz_is_super_admin()));
CREATE POLICY "Departamentos de grupos de admin: ver os dos meus" ON public.admin_group_support_departments
  FOR SELECT TO authenticated
  USING (group_id IN (SELECT agm.group_id FROM public.admin_group_members agm
                       WHERE agm.user_id = ANY ((SELECT public.rz_identity_ids((SELECT auth.uid())))::uuid[])));

-- ------------------------------------------------------------------ 4. companies
DROP POLICY IF EXISTS "Admins can manage all companies" ON public.companies;

CREATE POLICY "Empresas: ver as minhas" ON public.companies
  FOR SELECT TO authenticated
  USING (id = ANY ((SELECT public.rz_my_company_ids())::uuid[]) OR (SELECT public.rz_is_super_admin()));

CREATE POLICY "Empresas: o admin da empresa altera" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.rz_is_company_admin(id))
  WITH CHECK (public.rz_is_company_admin(id));

CREATE POLICY "Empresas: só o super admin cria" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.rz_is_super_admin()));

CREATE POLICY "Empresas: só o super admin apaga" ON public.companies
  FOR DELETE TO authenticated
  USING ((SELECT public.rz_is_super_admin()));

-- O admin de uma empresa edita só os dados de contacto da empresa (lista branca): nome, email, telefone,
-- morada, cidade, código postal, país e notas. NIF, estado, ativa/inativa, plano, registo, domínio e
-- qualquer coluna futura só o super admin altera.
CREATE OR REPLACE FUNCTION public.rz_companies_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_free text[] := ARRAY['name', 'email', 'phone', 'address', 'city', 'postal_code', 'country', 'notes', 'updated_at'];
BEGIN
  -- Sem sessão de utilizador (migrações, funções de serviço, SQL Editor) ou super admin: sem limite.
  IF auth.uid() IS NULL OR public.rz_is_super_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR (to_jsonb(NEW) - v_free) IS DISTINCT FROM (to_jsonb(OLD) - v_free) THEN
    RAISE EXCEPTION 'company_field_super_admin_only'
      USING ERRCODE = '42501',
            DETAIL = 'O NIF, o estado, o plano, o registo e o domínio da empresa só os altera um super admin.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS companies_guard ON public.companies;
CREATE TRIGGER companies_guard
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.rz_companies_guard();

-- ------------------------------------------------------------------ 5. equipamentos: o grupo is_super_admin deixa de contar
-- (o âmbito por empresa dos equipamentos vem no PR3; aqui só sai o ramo do grupo is_super_admin)
DROP POLICY IF EXISTS "Admins can manage equipments" ON public.equipments;
CREATE POLICY "Admins can manage equipments" ON public.equipments
  FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role) OR public.rz_is_super_admin())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR public.rz_is_super_admin());

DROP POLICY IF EXISTS "Admins can manage equipment categories" ON public.equipment_categories;
CREATE POLICY "Admins can manage equipment categories" ON public.equipment_categories
  FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role) OR public.rz_is_super_admin())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR public.rz_is_super_admin());

-- ------------------------------------------------------------------ 6. privilégios de tabela
-- O RLS não cobre TRUNCATE nem TRIGGER/REFERENCES; o anónimo não precisa de nada nestas tabelas.
REVOKE ALL ON public.companies, public.user_roles, public.admin_groups, public.admin_group_members,
  public.admin_group_permissions, public.admin_group_support_departments FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.companies, public.user_roles, public.admin_groups,
  public.admin_group_members, public.admin_group_permissions, public.admin_group_support_departments
  FROM authenticated;
