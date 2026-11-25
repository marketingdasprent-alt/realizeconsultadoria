-- Rollback de 20261125100000_empresas_logo_super_admins.sql
--
-- Remove as funções e políticas novas, a coluna companies.logo_path e repõe o guarda de empresas.
-- ATENÇÃO: apagar a coluna perde os caminhos das logos já escolhidas (os ficheiros ficam no bucket).
-- O bucket "company-logos" NÃO se apaga aqui (o Supabase recusa se tiver ficheiros); se estiver vazio:
--   DELETE FROM storage.buckets WHERE id = 'company-logos';
-- As linhas de platform_admins não são tocadas. Quem foi promovido por esta funcionalidade continua
-- super admin; para o retirar: UPDATE public.platform_admins SET active = false WHERE user_id = '<id>';
-- A auditoria não se toca (é imutável): o CHECK com as 2 ações novas fica como está.

DROP FUNCTION IF EXISTS public.rz_remove_super_admin(uuid);
DROP FUNCTION IF EXISTS public.rz_add_super_admin(uuid);
DROP FUNCTION IF EXISTS public.rz_super_admin_candidates();
DROP FUNCTION IF EXISTS public.rz_list_super_admins();
DROP FUNCTION IF EXISTS public.rz_super_admin_assert();
DROP FUNCTION IF EXISTS public.rz_super_admin_direct();
DROP FUNCTION IF EXISTS public.rz_person_name(uuid);

-- O trigger que impede a plataforma de ficar sem super admin sai com a migração.
DROP TRIGGER IF EXISTS rz_platform_admins_guard_lock ON public.platform_admins;
DROP TRIGGER IF EXISTS rz_platform_admins_guard_truncate ON public.platform_admins;
DROP TRIGGER IF EXISTS rz_platform_admins_guard_row ON public.platform_admins;
DROP FUNCTION IF EXISTS public.rz_platform_admins_guard();
DROP FUNCTION IF EXISTS public.rz_other_usable_super_admins(uuid);

-- rz_company_viewers volta a devolver o email dos super admins a qualquer administrador de empresa.
CREATE OR REPLACE FUNCTION public.rz_company_viewers(p_company uuid)
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

-- O CHECK da auditoria fica alargado (as ações 'super_admin_add'/'super_admin_remove' já gravadas não se
-- apagam: a auditoria é imutável) e é inofensivo.

DROP POLICY IF EXISTS "Logos: apagar" ON storage.objects;
DROP POLICY IF EXISTS "Logos: substituir" ON storage.objects;
DROP POLICY IF EXISTS "Logos: enviar" ON storage.objects;
DROP POLICY IF EXISTS "Logos: ver" ON storage.objects;
DROP FUNCTION IF EXISTS public.rz_can_write_logo(text);

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

ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_logo_path_check;
ALTER TABLE public.companies DROP COLUMN IF EXISTS logo_path;
