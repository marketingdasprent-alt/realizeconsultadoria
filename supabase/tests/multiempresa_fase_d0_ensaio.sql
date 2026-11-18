-- Ensaio da Fase D0 (multiempresa). NÃO altera nada de forma permanente: o bloco cria dados
-- sintéticos, testa as funções corrigidas e termina SEMPRE com RAISE EXCEPTION, o que anula a
-- transação inteira. O relatório vem na mensagem do erro, entre FP_BEGIN e FP_END (ASCII simples).
--
-- COMO CORRER: depois de aplicada a migração 20261118120000 (ou, para ver a diferença, antes dela:
-- os testes da D0 devem falhar na base antiga e passar na nova). Numa única chamada (uma só
-- transação), por exemplo no SQL Editor do Supabase ou pela API de consulta com uma ligação de
-- escrita; o RAISE final anula tudo. Pré-requisitos: migrações até à D0 (incluindo a C1 e o gatilho
-- employees_sync_membership da Fase B). Sem ids nem emails de pessoas: utilizadores reais lidos de
-- user_roles (sem ficha, sem pertenças, sem papel admin); os que faltarem criam-se em auth.users
-- com email @invalid.example (anulado no fim).

DO $t$
DECLARE
  v_users uuid[] := ARRAY[]::uuid[];
  v_real  integer := 0;
  v_u     uuid;
  v_n     integer;
  a1 uuid; a2 uuid; sp uuid; o1 uuid; g1 uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid;
  cA uuid; cB uuid; cE uuid;
  f1 uuid; f2 uuid; f3 uuid; f4 uuid;
  v_nif text := 'ZZ' || substr(upper(md5(gen_random_uuid()::text)), 1, 8);
  v_sync boolean;
  v_defs text[];
  v_i integer;
  v_who uuid;
  v_got text;
  v_bool boolean;
  v_claims text;
  v_rep text := '';
  v_pass integer := 0;
  v_fail integer := 0;
  v_name text;
  v_expect text;
BEGIN
  -- ---------------------------------------------------------------- preparação
  BEGIN
    FOR v_u IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
       WHERE NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.user_id = ur.user_id OR e.admin_user_id = ur.user_id)
         AND NOT EXISTS (SELECT 1 FROM public.company_memberships m WHERE m.user_id = ur.user_id)
         AND NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = ur.user_id)
         AND NOT EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id = ur.user_id AND x.role = 'admin')
       LIMIT 9
    LOOP
      v_users := v_users || v_u;
    END LOOP;
    v_real := cardinality(v_users);
    v_n := 0;
    WHILE cardinality(v_users) < 9 LOOP
      v_n := v_n + 1;
      INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'zz-d0-' || v_n || '@invalid.example', now(), now())
      RETURNING id INTO v_u;
      v_users := v_users || v_u;
    END LOOP;
    a1 := v_users[1]; a2 := v_users[2]; sp := v_users[3]; o1 := v_users[4]; g1 := v_users[5];
    c1 := v_users[6]; c2 := v_users[7]; c3 := v_users[8]; c4 := v_users[9];

    v_sync := EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'employees_sync_membership' AND NOT tgisinternal);

    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ D0 A', v_nif || 'A', 'a@invalid.example') RETURNING id INTO cA;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ D0 B', v_nif || 'B', 'b@invalid.example') RETURNING id INTO cB;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ D0 E', v_nif || 'E', 'e@invalid.example') RETURNING id INTO cE;

    -- a1 administra A e B; a2 só A; sp é super admin E administrador de A; g1 foi gestor de A (removido).
    INSERT INTO public.platform_admins (user_id, active, mfa_required) VALUES (sp, true, false);
    INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES
      (cA, a1, 'admin', 'convite', 'ativo'), (cB, a1, 'admin', 'convite', 'ativo'),
      (cA, a2, 'admin', 'convite', 'ativo'), (cA, sp, 'admin', 'convite', 'ativo'),
      (cA, g1, 'gestor', 'convite', 'removido');

    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, c1, 'ZZ Um', 'zz-d0-1@invalid.example') RETURNING id INTO f1;
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cB, c2, 'ZZ Dois', 'zz-d0-2@invalid.example') RETURNING id INTO f2;
    INSERT INTO public.employees (company_id, user_id, name, email, is_active) VALUES (cA, c3, 'ZZ Tres', 'zz-d0-3@invalid.example', false) RETURNING id INTO f3;
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, c4, 'ZZ Quatro', 'zz-d0-4@invalid.example') RETURNING id INTO f4;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FP_BEGIN%FP_END',
      'ERRO NA PREPARACAO: ' || regexp_replace(translate(SQLERRM, '<>"', '   '), '[^ -~]', '?', 'g');
  END;

  -- ---------------------------------------------------------------- testes
  -- Cada linha: nome, quem chama (uuid ou vazio), tipo (f = executar; q = consulta booleana),
  -- papel (authenticated para RLS), esperado (ok, true, false ou SQLSTATE), SQL,
  -- login recente ('1' junta ao JWT um amr com a hora atual; vazio não junta).
  v_defs := ARRAY[
    ARRAY['viewers: super admin com pertenca conta como administrador', a1::text, 'q', '', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.rz_company_viewers(%L) v WHERE v.user_id = %L AND v.kind = %L AND v.is_company_admin) AND EXISTS (SELECT 1 FROM public.rz_company_viewers(%L) v WHERE v.user_id = %L AND v.kind = %L AND v.is_company_admin)',
             cA, sp, 'super_admin', cA, a1, 'admin_empresa'), ''],
    ARRAY['viewers: sem acesso para anon, com acesso para authenticated', '', 'q', '', 'true',
      format('SELECT NOT has_function_privilege(%L, %L, %L) AND has_function_privilege(%L, %L, %L)',
             'anon', 'public.rz_company_viewers(uuid)', 'EXECUTE',
             'authenticated', 'public.rz_company_viewers(uuid)', 'EXECUTE'), ''],
    ARRAY['add: sem login recente pede reautenticacao', a1::text, 'f', '', 'RZ401',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cA, c1, 'gestor'), ''],
    ARRAY['remove: sem login recente pede reautenticacao', a1::text, 'f', '', 'RZ401',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cA, a2), ''],
    ARRAY['add: ficha ativa na empresa', a1::text, 'f', '', 'ok',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cA, c1, 'gestor'), '1'],
    ARRAY['add: utilizador de outra empresa (mesma resposta que inexistente)', a1::text, 'f', '', '02000',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cA, c2, 'admin'), '1'],
    ARRAY['add: utilizador inexistente', a1::text, 'f', '', '02000',
      format('SELECT public.rz_add_company_admin(%L,gen_random_uuid(),%L)', cA, 'admin'), '1'],
    ARRAY['add: ficha inativa nao serve', a1::text, 'f', '', '02000',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cA, c3, 'admin'), '1'],
    ARRAY['add: pertenca ja existente (gestor removido) serve', a1::text, 'f', '', 'ok',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cA, g1, 'gestor'), '1'],
    ARRAY['add: quem nao e admin da empresa', a2::text, 'f', '', '42501',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cB, c2, 'admin'), '1'],
    ARRAY['remove: gestor com ficha ativa passa a colaborador', a1::text, 'f', '', 'ok',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cA, c1), '1'],
    ARRAY['remove: ficou colaborador ativo', '', 'q', '', 'true',
      format('SELECT role = %L AND status = %L FROM public.company_memberships WHERE company_id = %L AND user_id = %L',
             'colaborador', 'ativo', cA, c1), ''],
    -- Cenário do 23505: c4 é admin de A (com ficha ativa em A) e já colaborador ativo em E.
    ARRAY['preparar: c4 passa a administrador de A', '', 'f', '', 'ok',
      format('UPDATE public.company_memberships SET role = %L WHERE company_id = %L AND user_id = %L', 'admin', cA, c4), ''],
    ARRAY['preparar: c4 colaborador ativo em E', '', 'f', '', 'ok',
      format('INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES (%L,%L,%L,%L,%L)',
             cE, c4, 'colaborador', 'migracao', 'ativo'), ''],
    ARRAY['remove: aviso em portugues em vez do 23505', a1::text, 'f', '', '22023',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cA, c4), '1'],
    ARRAY['remove: ultimo administrador continua protegido', a1::text, 'f', '', '55000',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cB, a1), '1'],
    ARRAY['em massa: erro de regra traz codigo e texto em portugues', a1::text, 'q', '', 'true',
      format('WITH r AS (SELECT public.rz_transfer_employees(ARRAY[%L]::uuid[], %L) AS j) SELECT (j -> %L -> 0 ->> %L) = %L AND (j -> %L -> 0 ->> %L) IS NOT NULL FROM r',
             f3, cB, 'results', 'error', 'invalid_argument', 'results', 'detail'), ''],
    ARRAY['em massa: erros tecnicos ficam como unknown (codigo no corpo da funcao)', '', 'q', '', 'true',
      format('SELECT position(%L IN prosrc) > 0 FROM pg_proc WHERE proname = %L AND pronamespace = %L::regnamespace',
             '''unknown''', 'rz_transfer_employees', 'public'), '']
  ];

  FOR v_i IN 1 .. array_length(v_defs, 1) LOOP
    v_name := v_defs[v_i][1];
    v_who := nullif(v_defs[v_i][2], '')::uuid;
    v_expect := v_defs[v_i][5];
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
      v_got := SQLSTATE;
      EXECUTE 'RESET ROLE';
    END;
    IF v_got = v_expect THEN
      v_pass := v_pass + 1;
      v_rep := v_rep || 'OK    ' || v_i || ' ' || v_name || E'\n';
    ELSE
      v_fail := v_fail + 1;
      v_rep := v_rep || 'FALHA ' || v_i || ' ' || v_name || ' esperado=' || v_expect || ' obtido=' || coalesce(v_got, 'null') || E'\n';
    END IF;
  END LOOP;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);

  RAISE EXCEPTION 'FP_BEGIN%FP_END',
    E'\nRESULTADO D0: ' || v_pass || ' ok, ' || v_fail || ' falhas, ' || array_length(v_defs, 1) || ' testes' ||
    E'\nutilizadores reais usados: ' || v_real || ' de 9 (os restantes sinteticos)' ||
    E'\ngatilho employees_sync_membership: ' || CASE WHEN v_sync THEN 'presente' ELSE 'AUSENTE (os testes de pertencas podem falhar)' END ||
    E'\n' || regexp_replace(translate(v_rep, '<>"', '   '), '[^ -~' || E'\n' || ']', '?', 'g');
END
$t$;
