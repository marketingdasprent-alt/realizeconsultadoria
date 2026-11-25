-- Rollback de 20261125130000_super_admin_sem_totp.sql: volta a exigir aal2 e fator TOTP verificado.

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
  IF coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'mfa_required' USING ERRCODE = 'RZ402',
      DETAIL = 'Confirme com o código da autenticação em dois passos.';
  END IF;
  PERFORM public.rz_assert_recent_auth();
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
  -- Sem segundo passo verificado a conta nunca chegaria a aal2: ficaria super admin sem poder usá-lo.
  IF NOT EXISTS (SELECT 1 FROM auth.mfa_factors f
                  WHERE f.user_id = p_user AND f.factor_type = 'totp' AND f.status = 'verified') THEN
    PERFORM public.rz_fail('mfa_not_enabled', 'Esta pessoa ainda não ativou o segundo passo (autenticador).');
  END IF;
  INSERT INTO public.platform_admins (user_id, active, mfa_required, created_by, created_at)
  VALUES (p_user, true, true, v_actor, now())
  ON CONFLICT (user_id) DO UPDATE
    SET active = true, mfa_required = true, created_by = v_actor, created_at = now();
  PERFORM public.rz_audit_cross(v_actor, NULL, NULL, NULL, 'super_admin_add', 'platform_admin', p_user);
  RETURN jsonb_build_object('user_id', p_user);
END;
$function$;

DROP FUNCTION IF EXISTS public.rz_assert_password_auth();
