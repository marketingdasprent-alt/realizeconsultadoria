-- Reverte o PR2 multi-organização: volta a permitir INSERT/DELETE direto em companies pelo super admin,
-- repõe rz_create_company com origem 'pedido' no grupo e retira rz_delete_company e o gatilho de
-- "um administrador, uma empresa". ORDEM: se o frontend do PR2 já estiver em produção, reverte-o primeiro
-- (chama rz_delete_company e o novo fluxo de criação). Aplicar numa única chamada.

DROP TRIGGER IF EXISTS company_memberships_one_admin ON public.company_memberships;
DROP FUNCTION IF EXISTS public.rz_membership_one_admin_company();
DROP FUNCTION IF EXISTS public.rz_delete_company(uuid);

CREATE POLICY "Empresas: só o super admin cria" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.rz_is_super_admin()));
CREATE POLICY "Empresas: só o super admin apaga" ON public.companies
  FOR DELETE TO authenticated
  USING ((SELECT public.rz_is_super_admin()));

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
    INSERT INTO public.company_group_members (group_id, company_id, origin)
    VALUES (v_group, v_company, 'pedido');
  END IF;
  PERFORM public.rz_audit_cross(v_caller, v_company, v_company, NULL, 'write', 'company_create', v_company);
  RETURN jsonb_build_object('company_id', v_company, 'group_id', v_group, 'admin_user_id', p_admin_user);
END;
$function$;
