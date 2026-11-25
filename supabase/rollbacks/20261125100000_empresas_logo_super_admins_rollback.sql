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
DROP TRIGGER IF EXISTS rz_platform_admins_guard_truncate ON public.platform_admins;
DROP TRIGGER IF EXISTS rz_platform_admins_guard_row ON public.platform_admins;
DROP FUNCTION IF EXISTS public.rz_platform_admins_guard();
DROP FUNCTION IF EXISTS public.rz_other_usable_super_admins(uuid);

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
