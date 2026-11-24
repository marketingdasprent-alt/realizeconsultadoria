-- Reverte a transição dos super admins (PR3b): reativa as 5 contas que a migração desativou
-- (identificadas pelo email, tal como na migração) e retira as pertenças de admin com origem 'legado'
-- das contas que a migração tratou. Aplicar numa única chamada.

UPDATE public.platform_admins pa
   SET active = true
 WHERE NOT pa.active
   AND EXISTS (SELECT 1 FROM auth.users u
                WHERE u.id = pa.user_id
                  AND lower(u.email) IN ('beatrizveloso@dasprent.pt', 'dinis.silva@dasprent.pt',
                                         'franciele.silva@dasprent.pt', 'paulosimao@dasprent.pt',
                                         'vania.sousa@dasprent.pt'));

DELETE FROM public.company_memberships m
 WHERE m.origin = 'legado' AND m.role = 'admin'
   AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = m.user_id AND ur.role = 'admin');
