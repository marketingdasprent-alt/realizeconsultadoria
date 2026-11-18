-- Multiempresa, Fase D0: correções da revisão ao PR #53 (pontos 1 a 4, mais o ramo de erro do bloco).
--
--   1. rz_company_viewers devolve também is_company_admin (pertença de administrador ativa, mesmo
--      que a pessoa apareça como super admin): o ecrã conta o último administrador por aí.
--      A função muda de tipo de retorno, por isso é recriada (DROP + CREATE) e as permissões repõem-se.
--   2. rz_add_company_admin e rz_remove_company_admin exigem login recente (rz_assert_recent_auth).
--   3. rz_add_company_admin só aceita quem tem ficha ativa na empresa ou já tem pertença nela,
--      com a mesma resposta para "não existe" e "é de outra empresa".
--   4. rz_remove_company_admin avisa em português antes do 23505 do índice "um colaborador, uma empresa".
--   5. rz_transfer_employees deixa de devolver SQLERRM/DETAIL crus: erros desconhecidos viram 'unknown'.
--
-- Só funções (CREATE OR REPLACE; rz_company_viewers por DROP + CREATE). Não altera tabelas nem
-- restringe leituras. Repetível. Reversão: supabase/rollbacks/20261118120000_multiempresa_fase_d0_correcoes_rollback.sql

-- ============================================================================================
-- 1. rz_company_viewers: acrescenta is_company_admin
-- ============================================================================================
DROP FUNCTION IF EXISTS public.rz_company_viewers(uuid);

CREATE FUNCTION public.rz_company_viewers(p_company uuid)
 RETURNS TABLE(user_id uuid, name text, email text, kind text, role text, is_company_admin boolean)
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
         u.email::text, b.k, b.r,
         -- Tem pertença de administrador ativa nesta empresa (mesmo que apareça como super admin):
         -- é por aqui que se conta o último administrador.
         EXISTS (SELECT 1 FROM public.company_memberships am
                  WHERE am.company_id = p_company AND am.user_id = b.uid
                    AND am.role = 'admin' AND am.status = 'ativo') AS adm
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

-- ============================================================================================
-- 2, 3 e 4. rz_add_company_admin e rz_remove_company_admin (mesma assinatura e permissões)
-- ============================================================================================
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
  -- Dar acesso de administração é sensível: exige login recente (como as partilhas sensíveis).
  PERFORM public.rz_assert_recent_auth();
  IF p_role IS NULL OR p_role NOT IN ('admin', 'gestor') THEN
    PERFORM public.rz_fail('invalid_argument', 'O papel tem de ser admin ou gestor.');
  END IF;
  -- Só quem tem ficha ativa nesta empresa, ou já tem pertença nela. A resposta é a mesma para
  -- "não existe" e "é de outra empresa": não revela se o utilizador existe.
  IF p_user IS NULL OR NOT (
       EXISTS (SELECT 1 FROM public.employees e
                WHERE e.user_id = p_user AND e.company_id = p_company AND e.is_active)
       OR EXISTS (SELECT 1 FROM public.company_memberships m
                   WHERE m.company_id = p_company AND m.user_id = p_user)
     ) THEN
    PERFORM public.rz_fail('not_found', 'Utilizador não encontrado nesta empresa.');
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
  -- Retirar acesso de administração também exige login recente.
  PERFORM public.rz_assert_recent_auth();
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
    -- Ao passar a colaborador, a regra "uma só empresa" pode recusar: avisa antes, em português.
    IF EXISTS (SELECT 1 FROM public.company_memberships o
                WHERE o.user_id = p_user AND o.role = 'colaborador' AND o.status = 'ativo'
                  AND o.company_id <> p_company) THEN
      PERFORM public.rz_fail('invalid_argument',
        'Esta pessoa já é colaborador ativo noutra empresa. Mova-a ou desative a outra ficha.');
    END IF;
    v_new_role := 'colaborador'; v_new_status := 'ativo';
  ELSE
    v_new_role := v_m.role;      v_new_status := 'removido';
  END IF;

  -- O gatilho rz_membership_guard volta a recusar com last_admin se for o último (corrida).
  BEGIN
    UPDATE public.company_memberships
       SET role = v_new_role, status = v_new_status
     WHERE id = v_m.id;
  EXCEPTION WHEN unique_violation THEN
    PERFORM public.rz_fail('invalid_argument',
      'Esta pessoa já é colaborador ativo noutra empresa. Mova-a ou desative a outra ficha.');
  END;

  PERFORM public.rz_audit_cross(v_caller, p_company, p_company, NULL, 'write', 'company_admin', p_user);
  RETURN jsonb_build_object('company_id', p_company, 'user_id', p_user,
                            'previous_role', v_m.role, 'role', v_new_role, 'status', v_new_status);
END;
$function$;

-- ============================================================================================
-- 5. rz_transfer_employees: sem erros técnicos em cru
-- ============================================================================================
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
      -- Só os erros do próprio contrato (rz_fail) passam com o seu texto em português. Qualquer
      -- outro (erro técnico da base) não se devolve em cru: vira 'unknown' com texto geral.
      IF v_code NOT IN ('not_authenticated', 'forbidden', 'not_company_admin', 'not_platform_admin',
                        'reauth_required', 'invalid_argument', 'not_found', 'last_admin',
                        'cross_company_violation') THEN
        v_code := 'unknown';
        v_detail := 'Não foi possível mover este colaborador. Tente outra vez.';
      END IF;
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('employee_id', v_id, 'ok', false, 'error', v_code, 'detail', v_detail));
    END;
  END LOOP;

  RETURN jsonb_build_object('total', cardinality(v_ids), 'ok', v_ok, 'failed', v_failed, 'results', v_results);
END;
$function$;
