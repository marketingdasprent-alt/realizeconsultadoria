-- Reverte a transição dos super admins (PR3b): reativa as contas de platform_admins que a migração
-- desativou e retira as pertenças de admin com origem 'legado'. Aplicar numa única chamada.
-- (As contas desativadas são todas as que estão inativas em platform_admins e não são o João nem o Thiago.)

UPDATE public.platform_admins
   SET active = true
 WHERE NOT active;

DELETE FROM public.company_memberships
 WHERE origin = 'legado' AND role = 'admin';
