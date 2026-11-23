-- Ensaio PR1 multi-organização (escalada de privilégios). NÃO altera nada de forma permanente: o bloco cria dados sintéticos, testa a regra e
-- termina SEMPRE com RAISE EXCEPTION, o que anula a transação inteira. O relatório vem na mensagem do
-- erro, entre FP_BEGIN e FP_END. A mensagem vermelha é o relatório, não um erro a corrigir.
--
-- ORDEM DE EXECUÇÃO (uma única chamada cada, p.ex. node scripts/run-sql.mjs):
--   1. este ensaio ANTES da migração 20261123100000_multiorg_p1_escalada.sql -> esperado: várias falhas
--      (prova que o ensaio não passa por acaso).
--   2. a migração.
--   3. este ensaio DEPOIS -> esperado: todos ok, 0 falhas (linha RESULTADO).
-- Qualquer falha ou "ERRO NA PREPARACAO" deve parar tudo.
-- Cenário: A e B empresas Realize-like, X externa, D descartável. adA admin de A (sem user_roles), adB
-- admin de B e D, ext admin de X, emA colaborador de A, leg só com papel admin antigo (sem pertença), gs
-- num grupo com is_super_admin (sem efeito), sa super admin (platform_admins).
--
-- Sem dados de pessoas reais: tudo é sintético (auth.users com email @invalid.example, empresas ZZ).

DO $t$
DECLARE
  sa uuid; adA uuid; adB uuid; emA uuid; ext uuid; leg uuid; gs uuid;
  cA uuid; cB uuid; cX uuid; cD uuid;
  gZ uuid; gR uuid; gQ uuid;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_k integer;
  v_nif text := 'ZZ' || substr(upper(md5(gen_random_uuid()::text)), 1, 8);
  v_defs text[];
  v_i integer;
  v_who uuid;
  v_got text;
  v_detail text;
  v_bool boolean;
  v_claims text;
  v_rep text := '';
  v_pass integer := 0;
  v_fail integer := 0;
  v_name text;
  v_expect text;
  v_frag text;
BEGIN
  BEGIN
    FOR v_k IN 1 .. 7 LOOP
      v_ids := v_ids || gen_random_uuid();
      INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
      VALUES (v_ids[v_k], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'zz-p1-' || v_k || '@invalid.example', now(), now());
    END LOOP;
    sa := v_ids[1]; adA := v_ids[2]; adB := v_ids[3]; emA := v_ids[4]; ext := v_ids[5]; leg := v_ids[6]; gs := v_ids[7];

    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P1 A', v_nif || 'A', 'a@invalid.example') RETURNING id INTO cA;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P1 B', v_nif || 'B', 'b@invalid.example') RETURNING id INTO cB;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P1 X externa', v_nif || 'X', 'x@invalid.example') RETURNING id INTO cX;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P1 D', v_nif || 'D', 'd@invalid.example') RETURNING id INTO cD;

    INSERT INTO public.platform_admins (user_id, active, mfa_required) VALUES (sa, true, false);
    INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES
      (cA, adA, 'admin', 'convite', 'ativo'), (cB, adB, 'admin', 'convite', 'ativo'),
      (cX, ext, 'admin', 'convite', 'ativo'), (cD, adB, 'admin', 'convite', 'ativo');
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, emA, 'ZZ Colab A', 'zz-p1-4@invalid.example');

    -- leg: papel admin global antigo, sem pertenca nenhuma. emA: colaborador.
    INSERT INTO public.user_roles (user_id, role) VALUES (leg, 'admin'), (emA, 'employee');

    -- gZ: grupo com is_super_admin (sem efeito), com gs dentro. gR: grupo normal com adA dentro.
    -- gQ: grupo normal sem adA, com permissoes (adA nao as deve ver).
    INSERT INTO public.admin_groups (name, is_super_admin, is_active) VALUES ('ZZ P1 super', true, true) RETURNING id INTO gZ;
    INSERT INTO public.admin_groups (name, is_super_admin, is_active) VALUES ('ZZ P1 RH', false, true) RETURNING id INTO gR;
    INSERT INTO public.admin_groups (name, is_super_admin, is_active) VALUES ('ZZ P1 outro', false, true) RETURNING id INTO gQ;
    INSERT INTO public.admin_group_members (group_id, user_id) VALUES (gZ, gs), (gR, adA), (gQ, adB);
    INSERT INTO public.admin_group_permissions (group_id, module_key, can_view) VALUES (gR, 'employees', true), (gQ, 'support', true);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FP_BEGIN%FP_END',
      'ERRO NA PREPARACAO: ' || regexp_replace(translate(SQLERRM, '<>"', '   '), '[^ -~]', '?', 'g');
  END;

  v_defs := ARRAY[
    ARRAY['super admin: rz_admin_company_ids tem todas as empresas', sa::text, 'q', 'authenticated', 'true', format('SELECT public.rz_admin_company_ids() @> ARRAY[%L, %L, %L]::uuid[]', cA, cB, cX), '', ''],
    ARRAY['admin de A: rz_admin_company_ids so a sua', adA::text, 'q', 'authenticated', 'true', format('SELECT public.rz_admin_company_ids() = ARRAY[%L]::uuid[]', cA), '', ''],
    ARRAY['admin da externa: so a sua', ext::text, 'q', 'authenticated', 'true', format('SELECT public.rz_admin_company_ids() = ARRAY[%L]::uuid[]', cX), '', ''],
    ARRAY['papel admin antigo sem pertenca: nenhuma empresa', leg::text, 'q', 'authenticated', 'true', format('SELECT cardinality(public.rz_admin_company_ids()) = 0'), '', ''],
    ARRAY['colaborador: nenhuma empresa', emA::text, 'q', 'authenticated', 'true', format('SELECT cardinality(public.rz_admin_company_ids()) = 0'), '', ''],
    ARRAY['funcoes de ambito: sem acesso para anon, com para authenticated', '', 'q', '', 'true', format('SELECT NOT has_function_privilege(''anon'', ''public.rz_admin_company_ids()'', ''EXECUTE'') AND has_function_privilege(''authenticated'', ''public.rz_admin_company_ids()'', ''EXECUTE'') AND NOT has_function_privilege(''anon'', ''public.rz_my_admin_company_ids()'', ''EXECUTE'')'), '', ''],
    ARRAY['grupo is_super_admin ja nao e super admin (is_super_admin_member)', gs::text, 'q', 'authenticated', 'true', format('SELECT NOT public.is_super_admin_member(%L)', gs), '', ''],
    ARRAY['platform_admins e super admin (is_super_admin_member)', sa::text, 'q', 'authenticated', 'true', format('SELECT public.is_super_admin_member(%L)', sa), '', ''],
    ARRAY['grupo is_super_admin nao da modulos (get_admin_permissions)', gs::text, 'q', 'authenticated', 'true', format('SELECT count(*) = 0 FROM public.get_admin_permissions(%L)', gs), '', ''],
    ARRAY['super admin tem marketing e companies', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.get_admin_permissions(%L) WHERE module_key IN (''marketing'',''companies'')) = 2', sa), '', ''],
    ARRAY['admin de empresa so por pertenca nao recebe modulos (get_admin_permissions)', ext::text, 'q', 'authenticated', 'true', format('SELECT count(*) = 0 FROM public.get_admin_permissions(%L)', ext), '', ''],
    ARRAY['admin de empresa so por pertenca nao tem has_module_permission (financas de outras empresas)', ext::text, 'q', 'authenticated', 'true', format('SELECT NOT public.has_module_permission(%L, ''employees'', ''view'', ''financial'') AND NOT public.has_module_permission(%L, ''employees'', ''view'')', ext, ext), '', ''],
    ARRAY['super admin: has_module_permission', sa::text, 'q', 'authenticated', 'true', format('SELECT public.has_module_permission(%L, ''employees'', ''view'')', sa), '', ''],
    ARRAY['authenticated nao tem TRUNCATE nas tabelas tocadas', '', 'q', '', 'true', format('SELECT NOT has_table_privilege(''authenticated'', ''public.user_roles'', ''TRUNCATE'') AND NOT has_table_privilege(''authenticated'', ''public.companies'', ''TRUNCATE'') AND NOT has_table_privilege(''authenticated'', ''public.admin_groups'', ''TRUNCATE'')'), '', ''],
    ARRAY['anon sem privilegios nas tabelas tocadas', '', 'q', '', 'true', format('SELECT NOT has_table_privilege(''anon'', ''public.user_roles'', ''SELECT'') AND NOT has_table_privilege(''anon'', ''public.companies'', ''INSERT'') AND NOT has_table_privilege(''anon'', ''public.admin_groups'', ''UPDATE'')'), '', ''],
    ARRAY['papel admin antigo sem pertenca nao tem modulos', leg::text, 'q', 'authenticated', 'true', format('SELECT count(*) = 0 FROM public.get_admin_permissions(%L)', leg), '', ''],
    ARRAY['grupo normal continua a dar o seu modulo', adA::text, 'q', 'authenticated', 'true', format('SELECT EXISTS (SELECT 1 FROM public.get_admin_permissions(%L) WHERE module_key = ''employees'')', adA), '', ''],
    ARRAY['user_roles: admin de empresa nao da admin a outra conta', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.user_roles (user_id, role) VALUES (%L, ''admin'')', emA), '', ''],
    ARRAY['user_roles: papel admin antigo nao escreve', leg::text, 'f', 'authenticated', '42501', format('INSERT INTO public.user_roles (user_id, role) VALUES (%L, ''admin'')', emA), '', ''],
    ARRAY['user_roles: admin de empresa nao promove o proprio papel', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.user_roles (user_id, role) VALUES (%L, ''admin'')', adA), '', ''],
    ARRAY['user_roles: admin de empresa nao altera papeis alheios', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.user_roles SET role = ''admin'' WHERE user_id = %L RETURNING 1) SELECT count(*) = 0 FROM u', emA), '', ''],
    ARRAY['user_roles: admin de empresa nao apaga papeis alheios', adA::text, 'q', 'authenticated', 'true', format('WITH d AS (DELETE FROM public.user_roles WHERE user_id = %L RETURNING 1) SELECT count(*) = 0 FROM d', leg), '', ''],
    ARRAY['user_roles: so ve os seus (nenhum)', adA::text, 'q', 'authenticated', 'true', format('SELECT count(*) = 0 FROM public.user_roles WHERE user_id <> %L', adA), '', ''],
    ARRAY['user_roles: colaborador ve o proprio papel', emA::text, 'q', 'authenticated', 'true', format('SELECT count(*) = 1 FROM public.user_roles WHERE user_id = %L', emA), '', ''],
    ARRAY['user_roles: super admin escreve', sa::text, 'f', 'authenticated', 'ok', format('INSERT INTO public.user_roles (user_id, role) VALUES (%L, ''admin'')', ext), '', ''],
    ARRAY['admin_groups: admin de empresa nao cria grupos', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.admin_groups (name, is_super_admin) VALUES (''ZZ P1 novo'', true)'), '', ''],
    ARRAY['admin_groups: membro de grupo is_super_admin nao cria grupos', gs::text, 'f', 'authenticated', '42501', format('INSERT INTO public.admin_groups (name, is_super_admin) VALUES (''ZZ P1 novo'', true)'), '', ''],
    ARRAY['admin_groups: papel admin antigo nao cria grupos', leg::text, 'f', 'authenticated', '42501', format('INSERT INTO public.admin_groups (name) VALUES (''ZZ P1 novo'')'), '', ''],
    ARRAY['admin_group_members: admin de empresa nao se mete no grupo super', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.admin_group_members (group_id, user_id) VALUES (%L, %L)', gZ, adA), '', ''],
    ARRAY['admin_groups: admin de empresa nao apaga grupos', adA::text, 'q', 'authenticated', 'true', format('WITH d AS (DELETE FROM public.admin_groups WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM d', gR), '', ''],
    ARRAY['admin_group_permissions: admin de empresa nao escreve', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.admin_group_permissions (group_id, module_key, can_view) VALUES (%L, ''marketing'', true)', gR), '', ''],
    ARRAY['admin_groups: ve so os grupos a que pertence', adA::text, 'q', 'authenticated', 'true', format('SELECT array_agg(id) = ARRAY[%L]::uuid[] FROM public.admin_groups WHERE id IN (%L, %L, %L)', gR, gZ, gR, gQ), '', ''],
    ARRAY['admin_group_members: ve so as suas pertencas', adA::text, 'q', 'authenticated', 'true', format('SELECT count(*) = 1 AND bool_and(user_id = %L) FROM public.admin_group_members WHERE group_id IN (%L, %L, %L)', adA, gZ, gR, gQ), '', ''],
    ARRAY['admin_group_permissions: ve so as dos seus grupos', adA::text, 'q', 'authenticated', 'true', format('SELECT count(*) = 1 AND bool_and(module_key = %L) FROM public.admin_group_permissions WHERE group_id IN (%L, %L)', 'employees', gR, gQ), '', ''],
    ARRAY['admin_groups: super admin cria', sa::text, 'f', 'authenticated', 'ok', format('INSERT INTO public.admin_groups (name, is_super_admin) VALUES (''ZZ P1 novo'', false)'), '', ''],
    ARRAY['admin_group_members: super admin acrescenta', sa::text, 'f', 'authenticated', 'ok', format('INSERT INTO public.admin_group_members (group_id, user_id) VALUES (%L, %L)', gQ, adA), '', ''],
    ARRAY['companies: admin de A ve so a sua', adA::text, 'q', 'authenticated', 'true', format('SELECT array_agg(id) = ARRAY[%L]::uuid[] FROM public.companies WHERE id IN (%L, %L, %L)', cA, cA, cB, cX), '', ''],
    ARRAY['companies: admin de A altera a sua', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.companies SET name = ''ZZ P1 A2'' WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', cA), '', ''],
    ARRAY['companies: admin de A nao altera outra empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.companies SET name = ''ZZ hack'' WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', cB), '', ''],
    ARRAY['companies: admin de A nao altera a externa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.companies SET name = ''ZZ hack'' WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', cX), '', ''],
    ARRAY['companies: admin nao apaga empresas', adA::text, 'q', 'authenticated', 'true', format('WITH d AS (DELETE FROM public.companies WHERE id IN (%L, %L) RETURNING 1) SELECT count(*) = 0 FROM d', cA, cB), '', ''],
    ARRAY['companies: admin nao cria empresas', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.companies (name, nif, email) VALUES (''ZZ P1 nova'', ''ZZ-NOVA-1'', ''n@invalid.example'')'), '', ''],
    ARRAY['companies: admin nao muda o estado da sua', adA::text, 'f', 'authenticated', '42501', format('UPDATE public.companies SET status = ''suspensa'' WHERE id = %L', cA), '', 'super admin'],
    ARRAY['companies: admin nao muda o NIF da sua', adA::text, 'f', 'authenticated', '42501', format('UPDATE public.companies SET nif = ''ZZ-OUTRO'' WHERE id = %L', cA), '', 'super admin'],
    ARRAY['companies: admin nao muda o plano da sua', adA::text, 'f', 'authenticated', '42501', format('UPDATE public.companies SET plan = ''premium'' WHERE id = %L', cA), '', 'super admin'],
    ARRAY['companies: admin nao muda o dominio da sua', adA::text, 'f', 'authenticated', '42501', format('UPDATE public.companies SET domain = ''x.example'' WHERE id = %L', cA), '', 'super admin'],
    ARRAY['companies: admin nao muda a data de registo da sua', adA::text, 'f', 'authenticated', '42501', format('UPDATE public.companies SET registered_at = now() - interval ''1 year'' WHERE id = %L', cA), '', 'super admin'],
    ARRAY['companies: admin nao muda o id da sua', adA::text, 'f', 'authenticated', '42501', format('UPDATE public.companies SET id = gen_random_uuid() WHERE id = %L', cA), '', ''],
    ARRAY['companies: admin nao desativa a sua', adA::text, 'f', 'authenticated', '42501', format('UPDATE public.companies SET is_active = false WHERE id = %L', cA), '', 'super admin'],
    ARRAY['companies: papel admin antigo sem pertenca nao ve empresas', leg::text, 'q', 'authenticated', 'true', format('SELECT count(*) = 0 FROM public.companies WHERE id IN (%L, %L, %L)', cA, cB, cX), '', ''],
    ARRAY['companies: papel admin antigo nao altera', leg::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.companies SET name = ''ZZ hack'' WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', cA), '', ''],
    ARRAY['companies: admin da externa ve so a sua', ext::text, 'q', 'authenticated', 'true', format('SELECT array_agg(id) = ARRAY[%L]::uuid[] FROM public.companies WHERE id IN (%L, %L, %L)', cX, cA, cB, cX), '', ''],
    ARRAY['companies: admin da externa altera a sua', ext::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.companies SET city = ''Porto'' WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', cX), '', ''],
    ARRAY['companies: colaborador ve a sua empresa e so essa', emA::text, 'q', 'authenticated', 'true', format('SELECT array_agg(id) = ARRAY[%L]::uuid[] FROM public.companies WHERE id IN (%L, %L, %L)', cA, cA, cB, cX), '', ''],
    ARRAY['companies: colaborador nao altera', emA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.companies SET name = ''ZZ hack'' WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', cA), '', ''],
    ARRAY['companies: admin de B nao ve A', adB::text, 'q', 'authenticated', 'true', format('SELECT count(*) = 0 FROM public.companies WHERE id = %L', cA), '', ''],
    ARRAY['companies: super admin ve todas', sa::text, 'q', 'authenticated', 'true', format('SELECT count(*) = 4 FROM public.companies WHERE id IN (%L, %L, %L, %L)', cA, cB, cX, cD), '', ''],
    ARRAY['companies: super admin altera estado e plano de qualquer', sa::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.companies SET status = ''ativa'', plan = ''base'' WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', cB), '', ''],
    ARRAY['companies: super admin cria', sa::text, 'f', 'authenticated', 'ok', format('INSERT INTO public.companies (name, nif, email) VALUES (''ZZ P1 nova'', ''ZZ-NOVA-2'', ''n@invalid.example'')'), '', ''],
    ARRAY['companies: super admin apaga', sa::text, 'q', 'authenticated', 'true', format('WITH d AS (DELETE FROM public.companies WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM d', cD), '', '']
  ];

  FOR v_i IN 1 .. array_length(v_defs, 1) LOOP
    v_name := v_defs[v_i][1];
    v_who := nullif(v_defs[v_i][2], '')::uuid;
    v_expect := v_defs[v_i][5];
    v_frag := v_defs[v_i][8];
    v_claims := CASE
      WHEN v_who IS NULL THEN '{}'
      WHEN v_defs[v_i][7] = '1' THEN
        '{"sub":"' || v_who::text || '","role":"authenticated","amr":[{"method":"password","timestamp":'
        || extract(epoch FROM now())::bigint::text || '}]}'
      ELSE '{"sub":"' || v_who::text || '","role":"authenticated"}'
    END;
    PERFORM set_config('request.jwt.claim.sub', coalesce(v_who::text, ''), true);
    PERFORM set_config('request.jwt.claims', v_claims, true);
    v_got := NULL;
    v_detail := '';
    BEGIN
      IF v_defs[v_i][4] = 'authenticated' THEN
        EXECUTE 'SET LOCAL ROLE authenticated';
      END IF;
      IF v_defs[v_i][3] = 'q' THEN
        EXECUTE v_defs[v_i][6] INTO v_bool;
        v_got := CASE WHEN v_bool THEN 'true' ELSE 'false' END;
      ELSE
        EXECUTE v_defs[v_i][6];
        v_got := 'ok';
      END IF;
      EXECUTE 'RESET ROLE';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
      v_got := SQLSTATE;
      EXECUTE 'RESET ROLE';
    END;
    IF v_got = v_expect AND coalesce(v_frag, '') <> ''
       AND position(v_frag IN coalesce(v_detail, '')) = 0 THEN
      v_fail := v_fail + 1;
      v_rep := v_rep || 'FALHA ' || v_i || ' ' || v_name || ' codigo=' || v_got || ' mas o texto nao contem ['
               || v_frag || '] texto=[' || coalesce(v_detail, '') || ']' || E'
';
    ELSIF v_got = v_expect THEN
      v_pass := v_pass + 1;
      v_rep := v_rep || 'OK    ' || v_i || ' ' || v_name || E'
';
    ELSE
      v_fail := v_fail + 1;
      v_rep := v_rep || 'FALHA ' || v_i || ' ' || v_name || ' esperado=' || v_expect || ' obtido=' || coalesce(v_got, 'null') || E'
';
    END IF;
  END LOOP;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);

  RAISE EXCEPTION 'FP_BEGIN%FP_END',
    E'
RESULTADO PR1: ' || v_pass || ' ok, ' || v_fail || ' falhas, ' || array_length(v_defs, 1) || ' testes' ||
    E'
' || regexp_replace(translate(v_rep, '<>"', '   '), '[^ -~' || E'
' || ']', '?', 'g');
END
$t$;
