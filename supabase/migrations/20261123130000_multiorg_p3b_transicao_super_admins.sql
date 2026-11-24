-- Multi-organização, PR3b: transição dos super admins.
--
-- Decisão do João: só ele e o Thiago são super admins. Hoje há 7 contas ativas em platform_admins (as outras
-- 5 vieram da migração do grupo "Super Admin"). Esta migração:
--   1. desativa (active = false, NÃO apaga) as que não são o João nem o Thiago: ficam reativáveis com
--      UPDATE platform_admins SET active = true (ver rollback);
--   2. dá pertença de admin (origem 'legado') na empresa com mais colaboradores (a Realize) às contas de
--      admin antigas (user_roles admin ou grupo de admin) que, sem poder de super admin, ficariam sem
--      nenhuma pertença ativa: mantêm na Realize o acesso que já tinham, e perdem o das outras empresas.
--      Quem já tem pertenças (por exemplo administradores de várias empresas do grupo) não é tocado.
--
-- ANTES de aplicar: confirma-se que o João e o Thiago existem e estão ativos em platform_admins (senão a
-- migração pára e nada muda). Aplicar depois do PR3 (20261123120000), numa única chamada.

DO $pre$
DECLARE
  v_keep uuid[];
BEGIN
  SELECT coalesce(array_agg(pa.user_id), ARRAY[]::uuid[]) INTO v_keep
  FROM public.platform_admins pa
  JOIN auth.users u ON u.id = pa.user_id
  WHERE pa.active AND lower(u.email) IN ('joao.bahia@dasprent.pt', 'thiago.sousa@dasprent.pt');
  IF cardinality(v_keep) <> 2 THEN
    RAISE EXCEPTION 'p3b_super_admins: o Joao e o Thiago tem de estar ativos em platform_admins (encontrados: %)', cardinality(v_keep);
  END IF;
END
$pre$;

UPDATE public.platform_admins pa
   SET active = false
 WHERE pa.active
   AND NOT EXISTS (SELECT 1 FROM auth.users u
                    WHERE u.id = pa.user_id
                      AND lower(u.email) IN ('joao.bahia@dasprent.pt', 'thiago.sousa@dasprent.pt'));

DO $d$
DECLARE
  v_realize uuid;
BEGIN
  SELECT c.id INTO v_realize
  FROM public.companies c
  ORDER BY (SELECT count(*) FROM public.employees e WHERE e.company_id = c.id) DESC, c.created_at
  LIMIT 1;

  INSERT INTO public.company_memberships (company_id, user_id, role, origin, status)
  SELECT v_realize, u.user_id, 'admin', 'legado', 'ativo'
  FROM (
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
    UNION
    SELECT agm.user_id FROM public.admin_group_members agm
      JOIN public.admin_groups ag ON ag.id = agm.group_id AND ag.is_active
  ) u
  WHERE NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.active AND pa.user_id = u.user_id)
    AND NOT EXISTS (SELECT 1 FROM public.company_memberships m
                     WHERE m.user_id = u.user_id AND m.status = 'ativo')
    AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.user_id)
  ON CONFLICT (company_id, user_id) DO NOTHING;
END
$d$;

-- Depois: duas contas super admin, nenhuma empresa sem administrador.
DO $post$
BEGIN
  IF (SELECT count(*) FROM public.platform_admins WHERE active) <> 2 THEN
    RAISE EXCEPTION 'p3b_pos: esperava 2 super admins ativos';
  END IF;
  IF EXISTS (SELECT 1 FROM public.companies c
              WHERE NOT EXISTS (SELECT 1 FROM public.company_memberships m
                                 WHERE m.company_id = c.id AND m.role = 'admin' AND m.status = 'ativo')) THEN
    RAISE EXCEPTION 'p3b_pos: ha empresas sem administrador ativo';
  END IF;
END
$post$;
