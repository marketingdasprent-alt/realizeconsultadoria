-- Super admins: o segundo passo (TOTP) deixa de ser obrigatório para gerir super admins (decisão do João).
-- 1. rz_super_admin_assert deixa de exigir aal2: adicionar e retirar passam a exigir só super admin pela conta
--    (própria ou ficha ligada), login recente (palavra-passe confirmada há menos de 10 min), auditoria e as
--    regras de sempre (nunca zero super admins, ninguém se retira a si próprio, elegibilidade do promovido).
-- 2. rz_add_super_admin deixa de exigir um fator TOTP verificado ao promovido (ver o ponto 4 para o mfa_required).
--    "Utilizável" (último super admin) só exclui quem tem o MFA OBRIGATÓRIO e nenhum fator verificado.
-- 3. Login recente = PALAVRA-PASSE confirmada há menos de 10 minutos (rz_assert_password_auth). O amr de uma sessão
--    obtida por link mágico/OTP (ex.: switch-account) não conta: sem aal2, uma sessão roubada não pode promover
--    super admins sem saber a palavra-passe.
-- 4. Quem é promovido com um fator TOTP verificado fica com mfa_required = true (o segundo passo que ativou protege-o);
--    sem fator fica false. O TOTP continua opcional, só deixa de ser exigido.
-- Só funções. Rollback: supabase/rollbacks/20261125130000_super_admin_sem_totp_rollback.sql

-- Palavra-passe confirmada há menos de 10 minutos: só conta uma entrada amr com method 'password'.
CREATE OR REPLACE FUNCTION public.rz_assert_password_auth()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_last bigint;
BEGIN
  BEGIN
    SELECT max((a ->> 'timestamp')::bigint) INTO v_last
    FROM jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
    WHERE a ->> 'method' = 'password';
  EXCEPTION WHEN OTHERS THEN
    v_last := NULL;
  END;
  IF v_last IS NULL OR to_timestamp(v_last) < now() - interval '10 minutes' THEN
    PERFORM public.rz_fail('reauth_required');
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.rz_assert_password_auth() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rz_super_admin_assert()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid;
BEGIN
  PERFORM public.rz_super_admin_direct();
  v_user := public.rz_uid();
  -- Sem aal2: o segundo passo (TOTP) nao e obrigatorio para gerir super admins. Fica o login recente
  -- (palavra-passe confirmada ha menos de 10 minutos), que nao depende de TOTP.
  PERFORM public.rz_assert_password_auth();
  RETURN v_user;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_add_super_admin(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid;
  v_totp boolean;
BEGIN
  v_actor := public.rz_super_admin_assert();
  PERFORM pg_advisory_xact_lock(hashtextextended('rz_super_admins', 0));
  -- Quem esperava pelo lock pode ter sido retirado entretanto: confirma outra vez, já com o estado final.
  v_actor := public.rz_super_admin_assert();
  IF p_user IS NULL THEN
    PERFORM public.rz_fail('invalid_argument');
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = p_user AND pa.active) THEN
    PERFORM public.rz_fail('already_super_admin', 'Esta pessoa já é super administradora.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_memberships cm
                  WHERE cm.user_id = p_user AND cm.role = 'admin' AND cm.status = 'ativo') THEN
    PERFORM public.rz_fail('invalid_argument', 'Só se pode promover quem já administra uma empresa.');
  END IF;
  -- A conta tem de existir, estar confirmada e ativa, e não ser de correio nem anónima.
  IF NOT EXISTS (SELECT 1 FROM auth.users u
                  WHERE u.id = p_user AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
                    AND (u.banned_until IS NULL OR u.banned_until <= now())
                    AND coalesce(u.is_anonymous, false) = false
                    AND coalesce(u.raw_app_meta_data ->> 'mail_only', '') <> 'true') THEN
    PERFORM public.rz_fail('account_not_eligible', 'Esta conta não está confirmada ou está bloqueada.');
  END IF;
  SELECT EXISTS (SELECT 1 FROM auth.mfa_factors f
                  WHERE f.user_id = p_user AND f.factor_type = 'totp' AND f.status = 'verified') INTO v_totp;
  INSERT INTO public.platform_admins (user_id, active, mfa_required, created_by, created_at)
  VALUES (p_user, true, v_totp, v_actor, now())
  ON CONFLICT (user_id) DO UPDATE
    SET active = true, mfa_required = EXCLUDED.mfa_required, created_by = v_actor, created_at = now();
  PERFORM public.rz_audit_cross(v_actor, NULL, NULL, NULL, 'super_admin_add', 'platform_admin', p_user);
  RETURN jsonb_build_object('user_id', p_user);
END;
$function$;
