-- Empresas: logo da empresa e gestão de super administradores.
--
-- 1. companies.logo_path + bucket público "company-logos" (<company_id>/<ficheiro>): só o super admin ou o
--    administrador dessa empresa escreve; a leitura é pública por URL (como "avatars"). O tipo e o tamanho do
--    ficheiro são limitados pelo bucket (webp/png/jpeg, 1 MiB); SVG não entra (o cliente rasteriza-o antes).
-- 2. Super admins: quem são (rz_list_super_admins), candidatos (rz_super_admin_candidates), adicionar e retirar.
--    Só um super admin gere super admins, com sessão aal2 (MFA) e confirmada há menos de 10 minutos; a plataforma
--    nunca fica sem super admin nem um super admin se retira a si próprio; tudo fica na auditoria cruzada.
--    "Retirar" desativa (active = false), não apaga, como na migração p3b. Não toca nas linhas de ninguém.
-- Rollback: supabase/rollbacks/20261125100000_empresas_logo_super_admins_rollback.sql

-- ============================================================================================ 1. Logo
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_path text;

ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_logo_path_check;
ALTER TABLE public.companies ADD CONSTRAINT companies_logo_path_check
  CHECK (logo_path IS NULL OR (logo_path ~ ('^' || id::text || '/[A-Za-z0-9._-]{1,100}[.](webp|png|jpe?g)$')
                               AND logo_path !~ '[.][.]'));

-- O administrador da empresa muda a logo da sua empresa: logo_path junta-se às colunas livres do guarda
-- (o resto do corpo da função mantém-se igual).
CREATE OR REPLACE FUNCTION public.rz_companies_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_free text[] := ARRAY['name', 'email', 'phone', 'address', 'city', 'postal_code', 'country', 'notes', 'updated_at',
                         'logo_path'];
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

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-logos', 'company-logos', true, 1048576, ARRAY['image/webp', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE
SET public = true, file_size_limit = 1048576,
    allowed_mime_types = ARRAY['image/webp', 'image/png', 'image/jpeg'];

-- Pode escrever o ficheiro "<empresa>/<nome>"? Só super admin ou administrador dessa empresa, só nessa pasta
-- (um nível) e só com nome simples e extensão webp, png ou jpg.
CREATE OR REPLACE FUNCTION public.rz_can_write_logo(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(
    CASE
      WHEN array_length(storage.foldername(p_name), 1) = 1
       AND (storage.foldername(p_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND storage.filename(p_name) ~ '^[A-Za-z0-9._-]{1,100}[.](webp|png|jpe?g)$'
       AND storage.filename(p_name) !~ '[.][.]'
      THEN public.rz_is_company_admin(((storage.foldername(p_name))[1])::uuid)
    END, false);
$function$;
REVOKE ALL ON FUNCTION public.rz_can_write_logo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_can_write_logo(text) TO authenticated;

DROP POLICY IF EXISTS "Logos: ver" ON storage.objects;
CREATE POLICY "Logos: ver" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'company-logos' AND public.rz_can_write_logo(name));
DROP POLICY IF EXISTS "Logos: enviar" ON storage.objects;
CREATE POLICY "Logos: enviar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND public.rz_can_write_logo(name));
DROP POLICY IF EXISTS "Logos: substituir" ON storage.objects;
CREATE POLICY "Logos: substituir" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos' AND public.rz_can_write_logo(name))
  WITH CHECK (bucket_id = 'company-logos' AND public.rz_can_write_logo(name));
DROP POLICY IF EXISTS "Logos: apagar" ON storage.objects;
CREATE POLICY "Logos: apagar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company-logos' AND public.rz_can_write_logo(name));

-- ============================================================================================ 2. Super admins
-- NOT VALID + VALIDATE: o ADD CONSTRAINT não varre a tabela; só o VALIDATE o faz (tudo na mesma transação).
ALTER TABLE public.cross_company_audit DROP CONSTRAINT IF EXISTS cross_company_audit_action_check;
ALTER TABLE public.cross_company_audit ADD CONSTRAINT cross_company_audit_action_check
  CHECK ((action = ANY (ARRAY['read'::text, 'write'::text, 'delete'::text, 'export'::text, 'reveal'::text,
    'support_read'::text, 'support_grant'::text, 'support_revoke'::text, 'share_request'::text,
    'share_approve'::text, 'share_revoke'::text, 'flag_change'::text, 'super_admin_access'::text,
    'group_create'::text, 'group_update'::text, 'group_members'::text, 'group_capabilities'::text,
    'group_dissolve'::text, 'super_admin_add'::text, 'super_admin_remove'::text]))) NOT VALID;
ALTER TABLE public.cross_company_audit VALIDATE CONSTRAINT cross_company_audit_action_check;

-- Quantos super admins ATIVOS E UTILIZÁVEIS há, sem contar p_except: conta apagada ou banida não conta, nem quem
-- tem o MFA obrigatório e nenhum fator TOTP verificado (nunca chegaria a aal2).
CREATE OR REPLACE FUNCTION public.rz_other_usable_super_admins(p_except uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT count(*)::integer
  FROM public.platform_admins pa
  JOIN auth.users u ON u.id = pa.user_id
  WHERE pa.active AND pa.user_id IS DISTINCT FROM p_except
    AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= now())
    AND (NOT pa.mfa_required
         OR EXISTS (SELECT 1 FROM auth.mfa_factors f
                     WHERE f.user_id = pa.user_id AND f.factor_type = 'totp' AND f.status = 'verified'));
$function$;
REVOKE ALL ON FUNCTION public.rz_other_usable_super_admins(uuid) FROM PUBLIC, anon, authenticated;

-- A plataforma nunca fica sem super admin utilizável, por NENHUM caminho (RPC, SQL direto, service_role, conta
-- apagada em auth.users, TRUNCATE): o trigger vale para todos. O advisory lock serializa as retiradas em paralelo.
CREATE OR REPLACE FUNCTION public.rz_platform_admins_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    PERFORM public.rz_fail('last_super_admin', 'Não se pode esvaziar a lista de super administradores.');
  END IF;
  IF TG_LEVEL = 'STATEMENT' THEN
    -- Antes de qualquer lock de linha (mesma ordem da RPC: advisory primeiro), para não haver deadlock.
    PERFORM pg_advisory_xact_lock(hashtextextended('rz_super_admins', 0));
    RETURN NULL;
  END IF;
  IF OLD.active AND (TG_OP = 'DELETE' OR NEW.active IS NOT TRUE OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    IF public.rz_other_usable_super_admins(OLD.user_id) < 1 THEN
      PERFORM public.rz_fail('last_super_admin', 'A plataforma tem de ter pelo menos um super administrador.');
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;
REVOKE ALL ON FUNCTION public.rz_platform_admins_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS rz_platform_admins_guard_row ON public.platform_admins;
CREATE TRIGGER rz_platform_admins_guard_row
  BEFORE UPDATE OF active, user_id OR DELETE ON public.platform_admins
  FOR EACH ROW EXECUTE FUNCTION public.rz_platform_admins_guard();
DROP TRIGGER IF EXISTS rz_platform_admins_guard_lock ON public.platform_admins;
CREATE TRIGGER rz_platform_admins_guard_lock
  BEFORE UPDATE OF active, user_id OR DELETE ON public.platform_admins
  FOR EACH STATEMENT EXECUTE FUNCTION public.rz_platform_admins_guard();
DROP TRIGGER IF EXISTS rz_platform_admins_guard_truncate ON public.platform_admins;
CREATE TRIGGER rz_platform_admins_guard_truncate
  BEFORE TRUNCATE ON public.platform_admins
  FOR EACH STATEMENT EXECUTE FUNCTION public.rz_platform_admins_guard();

-- Nome a mostrar de uma conta (ficha de colaborador, nome do registo ou início do email).
CREATE OR REPLACE FUNCTION public.rz_person_name(p_user uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- Só a ficha de colaborador ou o email: o nome do perfil da conta é editável por quem a tem.
  SELECT coalesce(nullif(trim(e.ename), ''), split_part(u.email::text, '@', 1))
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT emp.name AS ename FROM public.employees emp
    WHERE emp.user_id = u.id AND emp.is_active ORDER BY emp.name LIMIT 1
  ) e ON true
  WHERE u.id = p_user;
$function$;
REVOKE ALL ON FUNCTION public.rz_person_name(uuid) FROM PUBLIC, anon, authenticated;

-- Super admin PELA PRÓPRIA CONTA: quem herda o poder por uma ficha de colaborador ligada (rz_identity_ids) não
-- vê nem gere super admins. A sessão tem de passar também por rz_is_super_admin() (que aplica o mfa_required).
CREATE OR REPLACE FUNCTION public.rz_super_admin_direct()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.rz_is_super_admin()
     OR NOT EXISTS (SELECT 1 FROM public.platform_admins pa JOIN auth.users u ON u.id = pa.user_id
                     WHERE pa.user_id = auth.uid() AND pa.active
                       AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= now())
                       AND (NOT pa.mfa_required OR coalesce(auth.jwt() ->> 'aal', '') = 'aal2')) THEN
    PERFORM public.rz_fail('not_platform_admin');
  END IF;
  RETURN auth.uid();
END;
$function$;
REVOKE ALL ON FUNCTION public.rz_super_admin_direct() FROM PUBLIC, anon, authenticated;

-- Quem gere super admins: super admin, com MFA (aal2) e confirmação recente.
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
REVOKE ALL ON FUNCTION public.rz_super_admin_assert() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.rz_list_super_admins();
CREATE OR REPLACE FUNCTION public.rz_list_super_admins()
 RETURNS TABLE(user_id uuid, name text, email text, since timestamp with time zone, mfa_enabled boolean,
               added_by_name text, is_self boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.rz_super_admin_direct();
  RETURN QUERY
  SELECT pa.user_id,
         public.rz_person_name(pa.user_id),
         u.email::text,
         pa.created_at,
         EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = pa.user_id AND f.status = 'verified'),
         CASE WHEN pa.created_by IS NULL THEN NULL ELSE public.rz_person_name(pa.created_by) END,
         pa.user_id = auth.uid()
  FROM public.platform_admins pa
  JOIN auth.users u ON u.id = pa.user_id
  WHERE pa.active
  ORDER BY pa.created_at, 2;
END;
$function$;

-- Candidatos: quem já administra alguma empresa e ainda não é super admin.
DROP FUNCTION IF EXISTS public.rz_super_admin_candidates();
CREATE OR REPLACE FUNCTION public.rz_super_admin_candidates()
 RETURNS TABLE(user_id uuid, name text, email text, companies text, mfa_enabled boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.rz_super_admin_direct();
  RETURN QUERY
  SELECT cm.user_id, public.rz_person_name(cm.user_id), u.email::text,
         string_agg(c.name, ', ' ORDER BY c.name),
         EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = cm.user_id AND f.status = 'verified')
  FROM public.company_memberships cm
  JOIN auth.users u ON u.id = cm.user_id
  JOIN public.companies c ON c.id = cm.company_id
  WHERE cm.role = 'admin' AND cm.status = 'ativo'
    AND NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = cm.user_id AND pa.active)
  GROUP BY cm.user_id, u.email
  ORDER BY 2;
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

CREATE OR REPLACE FUNCTION public.rz_remove_super_admin(p_user uuid)
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
  v_actor := public.rz_super_admin_assert();
  IF p_user IS NULL THEN
    PERFORM public.rz_fail('invalid_argument');
  END IF;
  IF p_user = ANY (public.rz_identity_ids(v_actor)) THEN
    PERFORM public.rz_fail('invalid_argument',
      'Não pode retirar o seu próprio acesso. Peça a outro super administrador.');
  END IF;
  PERFORM 1 FROM public.platform_admins pa WHERE pa.user_id = p_user AND pa.active FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.rz_fail('not_found', 'Esta pessoa não é super administradora.');
  END IF;
  -- O trigger de platform_admins repete esta regra para qualquer caminho; aqui dá-se a mensagem certa.
  IF public.rz_other_usable_super_admins(p_user) < 1 THEN
    PERFORM public.rz_fail('last_super_admin', 'A plataforma tem de ter pelo menos um super administrador.');
  END IF;
  UPDATE public.platform_admins SET active = false WHERE user_id = p_user;
  PERFORM public.rz_audit_cross(v_actor, NULL, NULL, NULL, 'super_admin_remove', 'platform_admin', p_user);
  RETURN jsonb_build_object('user_id', p_user);
END;
$function$;

REVOKE ALL ON FUNCTION public.rz_list_super_admins(), public.rz_super_admin_candidates(),
  public.rz_add_super_admin(uuid), public.rz_remove_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_list_super_admins(), public.rz_super_admin_candidates(),
  public.rz_add_super_admin(uuid), public.rz_remove_super_admin(uuid) TO authenticated;
