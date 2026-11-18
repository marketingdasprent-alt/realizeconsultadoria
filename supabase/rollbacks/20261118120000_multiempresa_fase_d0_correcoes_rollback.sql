-- Reversão da Fase D0 multiempresa. NÃO é uma migração: não corre sozinha; executar à mão.
-- Repõe as funções como estavam antes (migração-base e Fase C1). Cada passo é repetível.

-- 5 (inverso). rz_transfer_employees como na C1.
CREATE OR REPLACE FUNCTION public.rz_transfer_employees(p_employees uuid[], p_to_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user    uuid := public.rz_uid();
  v_ids     uuid[];
  v_id      uuid;
  v_res     jsonb;
  v_results jsonb := '[]'::jsonb;
  v_ok      integer := 0;
  v_failed  integer := 0;
  v_code    text;
  v_detail  text;
BEGIN
  IF p_to_company IS NULL OR p_employees IS NULL OR cardinality(p_employees) = 0 THEN
    PERFORM public.rz_fail('invalid_argument', 'Indique os colaboradores e a empresa de destino.');
  END IF;
  SELECT coalesce(array_agg(DISTINCT x), ARRAY[]::uuid[]) INTO v_ids
    FROM unnest(p_employees) AS x WHERE x IS NOT NULL;
  IF cardinality(v_ids) = 0 OR cardinality(v_ids) > 200 THEN
    PERFORM public.rz_fail('invalid_argument', 'Indique entre 1 e 200 colaboradores.');
  END IF;

  PERFORM public.rz_assert_admin(p_to_company);

  FOREACH v_id IN ARRAY v_ids LOOP
    BEGIN
      v_res := public.rz_transfer_employee(v_id, p_to_company);
      v_ok := v_ok + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('employee_id', v_id, 'ok', true, 'result', v_res));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
      v_code := SQLERRM;
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('employee_id', v_id, 'ok', false, 'error', v_code, 'detail', v_detail));
    END;
  END LOOP;

  RETURN jsonb_build_object('total', cardinality(v_ids), 'ok', v_ok, 'failed', v_failed, 'results', v_results);
END;
$function$;

-- 2, 3 e 4 (inverso). rz_add_company_admin e rz_remove_company_admin como na C1.
CREATE OR REPLACE FUNCTION public.rz_add_company_admin(p_company uuid, p_user uuid, p_role text DEFAULT 'admin'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid;
  v_prev   text;
BEGIN
  v_caller := public.rz_assert_admin(p_company);
  IF p_role IS NULL OR p_role NOT IN ('admin', 'gestor') THEN
    PERFORM public.rz_fail('invalid_argument', 'O papel tem de ser admin ou gestor.');
  END IF;
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user) THEN
    PERFORM public.rz_fail('not_found', 'Utilizador não encontrado.');
  END IF;

  SELECT m.role INTO v_prev FROM public.company_memberships m
   WHERE m.company_id = p_company AND m.user_id = p_user FOR UPDATE;

  -- Uma só pertença por (empresa, conta): se já era colaborador, promove-a em vez de duplicar.
  -- A origem da pertença existente mantém-se.
  INSERT INTO public.company_memberships (company_id, user_id, role, origin, status, created_by)
  VALUES (p_company, p_user, p_role, 'convite', 'ativo', v_caller)
  ON CONFLICT (company_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'ativo';

  PERFORM public.rz_audit_cross(v_caller, p_company, p_company, NULL, 'write', 'company_admin', p_user);
  RETURN jsonb_build_object('company_id', p_company, 'user_id', p_user, 'role', p_role,
                            'previous_role', v_prev);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_remove_company_admin(p_company uuid, p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid;
  v_m      public.company_memberships%ROWTYPE;
  v_still_employee boolean;
  v_new_role   text;
  v_new_status text;
BEGIN
  v_caller := public.rz_assert_admin(p_company);
  IF p_user IS NULL THEN
    PERFORM public.rz_fail('invalid_argument', 'Indique o utilizador.');
  END IF;

  SELECT * INTO v_m FROM public.company_memberships m
   WHERE m.company_id = p_company AND m.user_id = p_user FOR UPDATE;
  IF NOT FOUND OR v_m.role NOT IN ('admin', 'gestor') OR v_m.status = 'removido' THEN
    PERFORM public.rz_fail('not_found', 'Este utilizador não é administrador desta empresa.');
  END IF;

  -- Mensagem clara quando o próprio retira o seu acesso e a empresa ficaria sem administrador.
  IF v_m.role = 'admin' AND v_m.status = 'ativo'
     AND NOT EXISTS (SELECT 1 FROM public.company_memberships o
                      WHERE o.company_id = p_company AND o.role = 'admin' AND o.status = 'ativo'
                        AND o.id <> v_m.id) THEN
    IF p_user = v_caller THEN
      PERFORM public.rz_fail('last_admin',
        'Não pode retirar o seu próprio acesso: a empresa ficaria sem administrador.');
    ELSE
      PERFORM public.rz_fail('last_admin',
        'Não pode retirar o último administrador da empresa. Adicione outro administrador primeiro.');
    END IF;
  END IF;

  -- Se a pessoa é também colaborador ativo desta empresa, passa a colaborador (não perde o acesso
  -- como colaborador); caso contrário a pertença fica 'removido'.
  SELECT EXISTS (SELECT 1 FROM public.employees e
                  WHERE e.company_id = p_company AND e.user_id = p_user AND e.is_active)
    INTO v_still_employee;
  IF v_still_employee THEN
    v_new_role := 'colaborador'; v_new_status := 'ativo';
  ELSE
    v_new_role := v_m.role;      v_new_status := 'removido';
  END IF;

  -- O gatilho rz_membership_guard volta a recusar com last_admin se for o último (corrida).
  UPDATE public.company_memberships
     SET role = v_new_role, status = v_new_status
   WHERE id = v_m.id;

  PERFORM public.rz_audit_cross(v_caller, p_company, p_company, NULL, 'write', 'company_admin', p_user);
  RETURN jsonb_build_object('company_id', p_company, 'user_id', p_user,
                            'previous_role', v_m.role, 'role', v_new_role, 'status', v_new_status);
END;
$function$;

-- 1 (inverso). rz_company_viewers como na migração-base (sem is_company_admin).
DROP FUNCTION IF EXISTS public.rz_company_viewers(uuid);

CREATE FUNCTION public.rz_company_viewers(p_company uuid)
 RETURNS TABLE(user_id uuid, name text, email text, kind text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.rz_assert_admin(p_company);
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company) THEN
    PERFORM public.rz_fail('not_found');
  END IF;
  RETURN QUERY
  WITH people AS (
    SELECT pa.user_id AS uid, 'super_admin'::text AS k, 'super_admin'::text AS r, 1 AS rk
    FROM public.platform_admins pa
    WHERE pa.active
    UNION ALL
    SELECT cm.user_id, CASE cm.role WHEN 'admin' THEN 'admin_empresa' ELSE 'gestor' END,
           cm.role, CASE cm.role WHEN 'admin' THEN 2 ELSE 3 END
    FROM public.company_memberships cm
    WHERE cm.company_id = p_company AND cm.status = 'ativo' AND cm.role IN ('admin', 'gestor')
  ),
  best AS (
    SELECT DISTINCT ON (p.uid) p.uid, p.k, p.r, p.rk
    FROM people p ORDER BY p.uid, p.rk
  )
  SELECT b.uid,
         coalesce(nullif(trim(e.ename), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
                  split_part(u.email::text, '@', 1)) AS vname,
         u.email::text, b.k, b.r
  FROM best b
  JOIN auth.users u ON u.id = b.uid
  LEFT JOIN LATERAL (
    SELECT emp.name AS ename FROM public.employees emp
    WHERE emp.user_id = b.uid AND emp.is_active ORDER BY emp.name LIMIT 1
  ) e ON true
  ORDER BY b.rk, vname;
END;
$function$;

REVOKE ALL ON FUNCTION public.rz_company_viewers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_company_viewers(uuid) TO authenticated, service_role;
