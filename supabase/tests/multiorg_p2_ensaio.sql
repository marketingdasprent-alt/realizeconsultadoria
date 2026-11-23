-- Ensaio PR2 multi-organização (criar/apagar empresa). NÃO altera nada de forma permanente: o bloco cria dados sintéticos, testa a regra e
-- termina SEMPRE com RAISE EXCEPTION, o que anula a transação inteira. O relatório vem na mensagem do
-- erro, entre FP_BEGIN e FP_END. A mensagem vermelha é o relatório, não um erro a corrigir.
--
-- ORDEM: ensaio ANTES das migrações PR1 (20261123100000) e PR2 (20261123110000) -> várias falhas; depois
-- das duas -> todos ok. O PR2 depende do PR1 (rz_is_super_admin com policies novas).
-- Cenário: A, B, E (vazia), sa super admin, adA/adB/adE admins de A/B/E, emA colaborador de A (e admin de B
-- para testar o gatilho), nu/nu2/nu3 contas sem pertenças, gM grupo existente.
--
-- Sem dados de pessoas reais: tudo é sintético (auth.users com email @invalid.example, empresas ZZ).

DO $t$
DECLARE
  sa uuid; adA uuid; adB uuid; adE uuid; nu uuid; nu2 uuid; nu3 uuid; emA uuid;
  cA uuid; cB uuid; cE uuid; gM uuid;
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
    FOR v_k IN 1 .. 8 LOOP
      v_ids := v_ids || gen_random_uuid();
      INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
      VALUES (v_ids[v_k], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'zz-p2-' || v_k || '@invalid.example', now(), now());
    END LOOP;
    sa := v_ids[1]; adA := v_ids[2]; adB := v_ids[3]; adE := v_ids[4]; nu := v_ids[5]; nu2 := v_ids[6]; nu3 := v_ids[7]; emA := v_ids[8];

    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P2 A', v_nif || 'A', 'a@invalid.example') RETURNING id INTO cA;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P2 B', v_nif || 'B', 'b@invalid.example') RETURNING id INTO cB;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P2 Vazia', v_nif || 'E', 'e@invalid.example') RETURNING id INTO cE;
    INSERT INTO public.platform_admins (user_id, active, mfa_required) VALUES (sa, true, false);
    INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES
      (cA, adA, 'admin', 'convite', 'ativo'), (cB, adB, 'admin', 'convite', 'ativo'), (cE, adE, 'admin', 'convite', 'ativo');
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, emA, 'ZZ Colab A', 'zz-p2-8@invalid.example');
    INSERT INTO public.company_groups (name) VALUES ('ZZ P2 grupo') RETURNING id INTO gM;
    INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES (cB, emA, 'admin', 'convite', 'ativo')
      ON CONFLICT (company_id, user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FP_BEGIN%FP_END',
      'ERRO NA PREPARACAO: ' || regexp_replace(translate(SQLERRM, '<>"', '   '), '[^ -~]', '?', 'g');
  END;

  v_defs := ARRAY[
    ARRAY['criar: so o super admin (admin de empresa recusado)', adA::text, 'f', 'authenticated', '42501', format('SELECT public.rz_create_company(''ZZ P2 X'', %L, ''x@invalid.example'', NULL, NULL, %L)', v_nif || 'X1', nu), '', ''],
    ARRAY['criar: colaborador recusado', emA::text, 'f', 'authenticated', '42501', format('SELECT public.rz_create_company(''ZZ P2 X'', %L, ''x@invalid.example'', NULL, NULL, %L)', v_nif || 'X2', nu), '', ''],
    ARRAY['criar: super admin cria empresa com primeiro admin', sa::text, 'f', 'authenticated', 'ok', format('SELECT public.rz_create_company(''ZZ P2 N1'', %L, ''n1@invalid.example'', NULL, NULL, %L)', v_nif || 'N1', nu), '', ''],
    ARRAY['criar: o primeiro admin ficou ligado a empresa nova (so a ela)', '', 'q', '', 'true', format('SELECT (SELECT count(*) FROM public.company_memberships m JOIN public.companies c ON c.id = m.company_id WHERE m.user_id = %L AND m.role = ''admin'' AND m.status = ''ativo'') = 1 AND EXISTS (SELECT 1 FROM public.companies c WHERE c.nif = %L AND c.status = ''ativa'')', nu, v_nif || 'N1'), '', ''],
    ARRAY['criar: o admin da empresa nova ve so a sua', nu::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.companies WHERE id IN (%L, %L)) = 0 AND (SELECT count(*) FROM public.companies WHERE nif = %L) = 1', cA, cB, v_nif || 'N1'), '', ''],
    ARRAY['criar: NIF repetido', sa::text, 'f', 'authenticated', '22023', format('SELECT public.rz_create_company(''ZZ P2 N1b'', %L, ''n1@invalid.example'', NULL, NULL, %L)', v_nif || 'N1', nu2), '', ''],
    ARRAY['criar: conta que ja administra outra empresa nao pode ser primeiro admin', sa::text, 'f', 'authenticated', '23514', format('SELECT public.rz_create_company(''ZZ P2 N2'', %L, ''n2@invalid.example'', NULL, NULL, %L)', v_nif || 'N2', adA), '', 'só gere uma empresa'],
    ARRAY['criar: sem admin indicado', sa::text, 'f', 'authenticated', '22023', format('SELECT public.rz_create_company(''ZZ P2 N3'', %L, ''n3@invalid.example'', NULL, NULL, NULL)', v_nif || 'N3'), '', ''],
    ARRAY['criar: com grupo novo (origem manual)', sa::text, 'f', 'authenticated', 'ok', format('SELECT public.rz_create_company(''ZZ P2 N4'', %L, ''n4@invalid.example'', NULL, ''ZZ P2 grupo novo'', %L)', v_nif || 'N4', nu2), '', ''],
    ARRAY['criar: a empresa entrou no grupo novo com origem manual', '', 'q', '', 'true', format('SELECT EXISTS (SELECT 1 FROM public.company_group_members m JOIN public.companies c ON c.id = m.company_id WHERE c.nif = %L AND m.origin = ''manual'' AND m.status = ''ativo'')', v_nif || 'N4'), '', ''],
    ARRAY['criar: com grupo existente (origem manual)', sa::text, 'f', 'authenticated', 'ok', format('SELECT public.rz_create_company(''ZZ P2 N5'', %L, ''n5@invalid.example'', %L, NULL, %L)', v_nif || 'N5', gM, nu3), '', ''],
    ARRAY['criar: a empresa entrou no grupo existente com origem manual', '', 'q', '', 'true', format('SELECT EXISTS (SELECT 1 FROM public.company_group_members m JOIN public.companies c ON c.id = m.company_id WHERE c.nif = %L AND m.group_id = %L AND m.origin = ''manual'')', v_nif || 'N5', gM), '', ''],
    ARRAY['criar: grupo e nome ao mesmo tempo', sa::text, 'f', 'authenticated', '22023', format('SELECT public.rz_create_company(''ZZ P2 N6'', %L, ''n6@invalid.example'', %L, ''ZZ nome'', %L)', v_nif || 'N6', gM, emA), '', ''],
    ARRAY['criar: INSERT direto em companies fechado ate ao super admin', sa::text, 'f', 'authenticated', '42501', format('INSERT INTO public.companies (name, nif, email) VALUES (''ZZ P2 direto'', %L, ''d@invalid.example'')', v_nif || 'D1'), '', ''],
    ARRAY['apagar: DELETE direto fechado ate ao super admin', sa::text, 'q', 'authenticated', 'true', format('WITH d AS (DELETE FROM public.companies WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM d', cB), '', ''],
    ARRAY['apagar: admin de empresa recusado', adA::text, 'f', 'authenticated', '42501', format('SELECT public.rz_delete_company(%L)', cE), '', ''],
    ARRAY['apagar: com colaboradores recusado', sa::text, 'f', 'authenticated', '22023', format('SELECT public.rz_delete_company(%L)', cA), '', 'colaboradores'],
    ARRAY['apagar: inexistente', sa::text, 'f', 'authenticated', '02000', format('SELECT public.rz_delete_company(gen_random_uuid())'), '', ''],
    ARRAY['apagar: super admin apaga empresa vazia (com o seu admin)', sa::text, 'f', 'authenticated', 'ok', format('SELECT public.rz_delete_company(%L)', cE), '', ''],
    ARRAY['apagar: a empresa e as pertencas desapareceram', '', 'q', '', 'true', format('SELECT NOT EXISTS (SELECT 1 FROM public.companies WHERE id = %L) AND NOT EXISTS (SELECT 1 FROM public.company_memberships WHERE company_id = %L)', cE, cE), '', ''],
    ARRAY['apagar: ficou registado na auditoria', '', 'q', '', 'true', format('SELECT EXISTS (SELECT 1 FROM public.cross_company_audit WHERE resource_type = ''company_delete'' AND resource_id = %L)', cE), '', ''],
    ARRAY['funcoes: anon sem EXECUTE em rz_delete_company, authenticated com', '', 'q', '', 'true', format('SELECT NOT has_function_privilege(''anon'', ''public.rz_delete_company(uuid)'', ''EXECUTE'') AND has_function_privilege(''authenticated'', ''public.rz_delete_company(uuid)'', ''EXECUTE'')'), '', ''],
    ARRAY['1 admin/1 empresa: admin de A nao passa a admin de B', '', 'f', '', '23514', format('INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES (%L, %L, ''admin'', ''convite'', ''ativo'')', cB, adA), '', 'só gere uma empresa'],
    ARRAY['1 admin/1 empresa: colaborador de B promovido a admin de A fica recusado se ja for admin de B', '', 'f', '', '23514', format('UPDATE public.company_memberships SET role = ''admin'' WHERE company_id = %L AND user_id = %L', cA, emA), '', 'só gere uma empresa'],
    ARRAY['1 admin/1 empresa: super admin pode ter varias', '', 'f', '', 'ok', format('INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES (%L, %L, ''admin'', ''convite'', ''ativo''), (%L, %L, ''admin'', ''convite'', ''ativo'')', cA, sa, cB, sa), '', ''],
    ARRAY['1 admin/1 empresa: pertenca de colaborador nao e afetada', '', 'f', '', 'ok', format('INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES (%L, %L, ''colaborador'', ''convite'', ''ativo'')', cB, adA), '', ''],
    ARRAY['1 admin/1 empresa: admin existente continua a poder ser editado (mesmo estado)', '', 'f', '', 'ok', format('UPDATE public.company_memberships SET updated_at = now() WHERE company_id = %L AND user_id = %L', cA, adA), '', '']
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
RESULTADO PR2: ' || v_pass || ' ok, ' || v_fail || ' falhas, ' || array_length(v_defs, 1) || ' testes' ||
    E'
' || regexp_replace(translate(v_rep, '<>"', '   '), '[^ -~' || E'
' || ']', '?', 'g');
END
$t$;
