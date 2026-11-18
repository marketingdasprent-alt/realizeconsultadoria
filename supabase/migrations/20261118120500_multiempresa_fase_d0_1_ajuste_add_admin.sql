-- Multiempresa, Fase D0.1: ajuste a rz_add_company_admin (revisão da Visão à D0, achado médio).
--
-- A D0 aceitava "pertença existente em qualquer estado": deixava passar fichas inativas (pertença
-- 'suspenso' criada pelo gatilho employees_sync_membership) e pessoas já movidas para outra empresa
-- (pertença 'removido'). Agora a segunda condição exige pertença com role admin ou gestor, em
-- qualquer estado (mantém o caso do gestor removido que volta).
--
-- Só CREATE OR REPLACE de rz_add_company_admin: mesma assinatura, SECURITY DEFINER, search_path
-- fixo, chamada a rz_assert_recent_auth e permissões (EXECUTE só authenticated e service_role,
-- que o CREATE OR REPLACE preserva). Não altera tabelas. Repetível.
-- Reversão: supabase/rollbacks/20261118120500_multiempresa_fase_d0_1_ajuste_add_admin_rollback.sql

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
  -- Só quem tem ficha ATIVA nesta empresa, ou já foi administrador ou gestor dela (em qualquer
  -- estado: um gestor removido pode voltar). Uma pertença de colaborador não chega: o gatilho
  -- employees_sync_membership deixa-a 'suspenso' (ficha inativa) ou 'removido' (pessoa movida
  -- para outra empresa), e essas pessoas não se promovem aqui. A resposta é a mesma para
  -- "não existe" e "é de outra empresa": não revela se o utilizador existe.
  IF p_user IS NULL OR NOT (
       EXISTS (SELECT 1 FROM public.employees e
                WHERE e.user_id = p_user AND e.company_id = p_company AND e.is_active)
       OR EXISTS (SELECT 1 FROM public.company_memberships m
                   WHERE m.company_id = p_company AND m.user_id = p_user
                     AND m.role IN ('admin', 'gestor'))
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

-- Por segurança (repõe, sem efeito se já estiver assim): nunca anon nem PUBLIC.
REVOKE ALL ON FUNCTION public.rz_add_company_admin(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_add_company_admin(uuid, uuid, text) TO authenticated, service_role;
