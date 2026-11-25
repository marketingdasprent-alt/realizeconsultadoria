-- Rollback de 20261125120000_super_admin_nomes.sql

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
         CASE WHEN b.k = 'super_admin' AND NOT public.rz_is_super_admin()
              THEN coalesce(nullif(trim(e.ename), ''), 'Super administrador')
              ELSE coalesce(nullif(trim(e.ename), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
                            split_part(u.email::text, '@', 1)) END AS vname,
         CASE WHEN b.k = 'super_admin' AND NOT public.rz_is_super_admin() THEN ''::text ELSE u.email::text END, b.k, b.r,
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
