-- Rollback de 20261125110000_super_admin_identidade.sql: volta a só aceitar a conta própria.

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
