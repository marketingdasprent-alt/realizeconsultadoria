-- Multi-organização, PR2: criar e apagar empresas só pelas funções do super admin.
--
-- Antes: a UI inseria direto em companies (a empresa nascia sem administrador e sem grupo) e apagava direto.
-- Agora:
--   1. companies deixa de ter policies de INSERT e DELETE: só as RPC (SECURITY DEFINER) criam/apagam.
--   2. rz_create_company (já existia) passa a juntar a empresa ao grupo com origem 'manual' (grupo escolhido
--      ou criado pelo super admin; com 'pedido' o Feed do grupo ignorava-o, Lote 3).
--   3. rz_delete_company(p_company): só super admin, só empresas SEM colaboradores (não apaga fichas em
--      cascata), regista na auditoria.
--   4. Um administrador só gere UMA empresa: o gatilho company_memberships_one_admin recusa tornar admin ativo
--      de uma empresa quem já é admin ativo de outra (o super admin não está sujeito). Só vale para pertenças
--      novas ou que passam a admin ativo: as que já existem não são tocadas.
-- Dados: nenhuma linha é alterada.
-- Aplicar numa única chamada.

DROP POLICY IF EXISTS "Empresas: só o super admin cria" ON public.companies;
DROP POLICY IF EXISTS "Empresas: só o super admin apaga" ON public.companies;

-- ------------------------------------------------------------------ um administrador, uma empresa
CREATE OR REPLACE FUNCTION public.rz_membership_one_admin_company()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.role = 'admin' AND NEW.status = 'ativo'
     AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'admin' OR OLD.status IS DISTINCT FROM 'ativo') THEN
    IF NOT public.rz_is_super_admin_for(NEW.user_id)
       AND EXISTS (
         SELECT 1 FROM public.company_memberships m
         WHERE m.user_id = ANY (public.rz_identity_ids(NEW.user_id))
           AND m.role = 'admin' AND m.status = 'ativo'
           AND m.company_id <> NEW.company_id
       ) THEN
      RAISE EXCEPTION 'admin_other_company'
        USING ERRCODE = '23514',
              DETAIL = 'Esta conta já administra outra empresa. Um administrador só gere uma empresa.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS company_memberships_one_admin ON public.company_memberships;
CREATE TRIGGER company_memberships_one_admin
  BEFORE INSERT OR UPDATE ON public.company_memberships
  FOR EACH ROW EXECUTE FUNCTION public.rz_membership_one_admin_company();

-- ------------------------------------------------------------------ criar empresa (grupo com origem 'manual')
CREATE OR REPLACE FUNCTION public.rz_create_company(p_name text, p_nif text, p_email text, p_group uuid DEFAULT NULL::uuid, p_group_name text DEFAULT NULL::text, p_admin_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := public.rz_uid();
  v_name   text := btrim(coalesce(p_name, ''));
  v_nif    text := btrim(coalesce(p_nif, ''));
  v_email  text := btrim(coalesce(p_email, ''));
  v_gname  text := btrim(coalesce(p_group_name, ''));
  v_company uuid;
  v_group   uuid;
BEGIN
  IF NOT public.rz_is_super_admin() THEN
    PERFORM public.rz_fail('not_platform_admin');
  END IF;
  IF v_name = '' OR v_nif = '' OR v_email = '' OR position('@' IN v_email) = 0 THEN
    PERFORM public.rz_fail('invalid_argument', 'Indique o nome, o NIF e um email válido.');
  END IF;
  IF p_admin_user IS NULL THEN
    PERFORM public.rz_fail('invalid_argument', 'Indique o primeiro administrador da empresa.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_admin_user) THEN
    PERFORM public.rz_fail('not_found', 'O utilizador escolhido para administrador não existe.');
  END IF;
  IF p_group IS NOT NULL AND v_gname <> '' THEN
    PERFORM public.rz_fail('invalid_argument',
      'Indique o grupo existente ou o nome de um grupo novo, não os dois.');
  END IF;
  IF p_group IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.company_groups g WHERE g.id = p_group) THEN
    PERFORM public.rz_fail('not_found', 'Grupo não encontrado.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.companies c WHERE c.nif = v_nif) THEN
    PERFORM public.rz_fail('invalid_argument', 'Já existe uma empresa com este NIF.');
  END IF;
  BEGIN
    INSERT INTO public.companies (name, nif, email, status, registered_at)
    VALUES (v_name, v_nif, v_email, 'ativa', now())
    RETURNING id INTO v_company;
  EXCEPTION WHEN unique_violation THEN
    PERFORM public.rz_fail('invalid_argument', 'Já existe uma empresa com este NIF.');
  END;
  INSERT INTO public.company_memberships (company_id, user_id, role, origin, status, created_by)
  VALUES (v_company, p_admin_user, 'admin', 'convite', 'ativo', v_caller);
  IF p_group IS NOT NULL THEN
    v_group := p_group;
  ELSIF v_gname <> '' THEN
    INSERT INTO public.company_groups (name, created_by_company_id)
    VALUES (v_gname, v_company)
    RETURNING id INTO v_group;
  END IF;
  IF v_group IS NOT NULL THEN
    -- Grupo escolhido ou criado pelo super admin: origem 'manual' (partilha o Feed, Lote 3).
    INSERT INTO public.company_group_members (group_id, company_id, origin)
    VALUES (v_group, v_company, 'manual');
  END IF;
  PERFORM public.rz_audit_cross(v_caller, v_company, v_company, NULL, 'write', 'company_create', v_company);
  RETURN jsonb_build_object('company_id', v_company, 'group_id', v_group, 'admin_user_id', p_admin_user);
END;
$function$;

-- ------------------------------------------------------------------ apagar empresa (só sem colaboradores)
CREATE OR REPLACE FUNCTION public.rz_delete_company(p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := public.rz_uid();
BEGIN
  IF NOT public.rz_is_super_admin() THEN
    PERFORM public.rz_fail('not_platform_admin');
  END IF;
  IF p_company IS NULL OR NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company) THEN
    PERFORM public.rz_fail('not_found', 'Empresa não encontrada.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.employees e WHERE e.company_id = p_company) THEN
    PERFORM public.rz_fail('invalid_argument',
      'A empresa ainda tem colaboradores. Transfira-os ou elimine-os primeiro.');
  END IF;
  PERFORM public.rz_audit_cross(v_caller, p_company, p_company, NULL, 'write', 'company_delete', p_company);
  DELETE FROM public.companies WHERE id = p_company;
  RETURN jsonb_build_object('company_id', p_company, 'deleted', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.rz_delete_company(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_delete_company(uuid) TO authenticated, service_role;
