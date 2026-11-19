-- Reverte o Lote 2 (gestão de grupos): remove as funções novas, repõe rz_list_groups e rz_list_group
-- como eram e tira a coluna default_capabilities.
--
-- Não toca em rz_leave_group (nunca foi alterado). Não apaga grupos nem pertenças criados à mão.
-- Duas coisas ficam de propósito:
--   * O CHECK de cross_company_audit.action fica alargado: a auditoria é imutável e pode já ter linhas
--     group_*; um CHECK mais largo não faz mal a ninguém.
--   * O CHECK company_group_members_origin_check só volta a recusar 'manual' se não houver pertenças
--     com origin 'manual'. Se houver, o rollback pára com um aviso (e nada é revertido): decida primeiro
--     o que fazer com esses grupos (ex.: dissolvê-los antes de reverter, ou aceitar manter o CHECK).
--
-- Aplicar no SQL Editor, numa única chamada.

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.company_group_members WHERE origin = 'manual') THEN
    RAISE EXCEPTION 'Rollback do Lote 2 recusado: existem pertenças de grupo com origin manual. Decida o que fazer com esses grupos antes de reverter.';
  END IF;
END
$guard$;

DROP FUNCTION IF EXISTS public.rz_create_group(text, uuid[], text[]);
DROP FUNCTION IF EXISTS public.rz_rename_group(uuid, text);
DROP FUNCTION IF EXISTS public.rz_set_group_members(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.rz_set_group_capabilities(uuid, text[]);
DROP FUNCTION IF EXISTS public.rz_dissolve_group(uuid);

DROP FUNCTION IF EXISTS public.rz_group_audit(uuid, text, uuid, uuid[]);
DROP FUNCTION IF EXISTS public.rz_group_revoke_between(uuid, uuid[], uuid[], text);
DROP FUNCTION IF EXISTS public.rz_group_check_companies(uuid[], uuid);
DROP FUNCTION IF EXISTS public.rz_group_clean_companies(uuid[]);
DROP FUNCTION IF EXISTS public.rz_group_caps(text[]);
DROP FUNCTION IF EXISTS public.rz_group_name(text);
DROP FUNCTION IF EXISTS public.rz_group_assert_super();

DROP FUNCTION IF EXISTS public.rz_list_groups();

CREATE FUNCTION public.rz_list_groups()
 RETURNS TABLE(group_id uuid, group_name text, group_created_at timestamp with time zone, company_id uuid, company_name text, joined_at timestamp with time zone, origin text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.rz_is_super_admin() THEN
    PERFORM public.rz_fail('not_platform_admin');
  END IF;
  RETURN QUERY
  SELECT g.id, g.name, g.created_at, c.id, c.name, m.joined_at, m.origin
  FROM public.company_groups g
  JOIN public.company_group_members m ON m.group_id = g.id AND m.status = 'ativo'
  JOIN public.companies c ON c.id = m.company_id
  ORDER BY g.name, c.name;
END;
$function$;

DROP FUNCTION IF EXISTS public.rz_list_group(uuid);

CREATE FUNCTION public.rz_list_group(p_company uuid)
 RETURNS TABLE(group_id uuid, company_id uuid, name text, joined_at timestamp with time zone, origin text, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.rz_uid();
  IF p_company IS NULL OR NOT (p_company = ANY (public.rz_my_company_ids()) OR public.rz_is_super_admin()) THEN
    PERFORM public.rz_fail('forbidden');
  END IF;
  RETURN QUERY
  SELECT m.group_id, m.company_id, c.name, m.joined_at, m.origin, (m.company_id = p_company)
  FROM public.company_group_members m
  JOIN public.companies c ON c.id = m.company_id
  WHERE m.status = 'ativo'
    AND m.group_id IN (SELECT g.group_id FROM public.company_group_members g
                        WHERE g.company_id = p_company AND g.status = 'ativo')
  ORDER BY m.group_id, c.name;
END;
$function$;

REVOKE ALL ON FUNCTION public.rz_list_groups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_list_groups() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rz_list_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_list_group(uuid) TO authenticated, service_role;

ALTER TABLE public.company_groups DROP COLUMN IF EXISTS default_capabilities;

ALTER TABLE public.company_group_members
  DROP CONSTRAINT IF EXISTS company_group_members_origin_check;
ALTER TABLE public.company_group_members
  ADD CONSTRAINT company_group_members_origin_check
  CHECK ((origin = ANY (ARRAY['pedido'::text, 'migracao'::text])));
