-- Ensaio do ROLLBACK e da re-execução de 20261125100000. Corre na mesma chamada, por esta ordem:
--   migração, migração outra vez (tem de ser idempotente), rollback, este ficheiro.
-- Verifica que o rollback tirou funções, políticas, coluna e repôs o guarda de empresas, e que o CHECK da
-- auditoria ficou alargado. Termina SEMPRE com RAISE EXCEPTION (anula a transação inteira).
DO $t$
DECLARE
  v_rep text := '';
  v_fail integer := 0;
  v_n integer;
  v_src text;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('rz_list_super_admins', 'rz_super_admin_candidates',
     'rz_add_super_admin', 'rz_remove_super_admin', 'rz_super_admin_assert', 'rz_person_name', 'rz_can_write_logo');
  v_rep := v_rep || CASE WHEN v_n = 0 THEN 'OK    ' ELSE 'FALHA ' END || 'funções removidas (restam ' || v_n || E')\n';
  v_fail := v_fail + (v_n <> 0)::int;
  SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'Logos:%';
  v_rep := v_rep || CASE WHEN v_n = 0 THEN 'OK    ' ELSE 'FALHA ' END || 'políticas do storage removidas (restam ' || v_n || E')\n';
  v_fail := v_fail + (v_n <> 0)::int;
  SELECT count(*) INTO v_n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'logo_path';
  v_rep := v_rep || CASE WHEN v_n = 0 THEN 'OK    ' ELSE 'FALHA ' END || 'coluna logo_path removida' || E'\n';
  v_fail := v_fail + (v_n <> 0)::int;
  SELECT pg_get_functiondef('public.rz_companies_guard()'::regprocedure) INTO v_src;
  v_rep := v_rep || CASE WHEN v_src NOT LIKE '%logo_path%' THEN 'OK    ' ELSE 'FALHA ' END || 'guarda de empresas reposto (sem logo_path)' || E'\n';
  v_fail := v_fail + (v_src LIKE '%logo_path%')::int;
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid = 'public.cross_company_audit'::regclass
     AND conname = 'cross_company_audit_action_check' AND pg_get_constraintdef(oid) LIKE '%super_admin_add%';
  v_rep := v_rep || CASE WHEN v_n = 1 THEN 'OK    ' ELSE 'FALHA ' END || 'CHECK da auditoria continua alargado' || E'\n';
  v_fail := v_fail + (v_n <> 1)::int;
  SELECT count(*) INTO v_n FROM public.platform_admins WHERE active;
  v_rep := v_rep || CASE WHEN v_n >= 1 THEN 'OK    ' ELSE 'FALHA ' END || 'os super admins ativos não foram tocados (' || v_n || E')\n';
  v_fail := v_fail + (v_n < 1)::int;
  RAISE EXCEPTION 'FP_BEGIN%FP_END', E'\n' || v_rep || 'TOTAL falhas=' || v_fail || E'\n';
END
$t$;
