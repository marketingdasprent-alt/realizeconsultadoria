-- Ensaio das Fases D0 e D0.1 (multiempresa). NÃO altera nada de forma permanente: o bloco cria
-- dados sintéticos, testa as funções e termina SEMPRE com RAISE EXCEPTION, o que anula a transação
-- inteira. O relatório vem na mensagem do erro, entre FP_BEGIN e FP_END (ASCII simples).
-- A mensagem vermelha é o relatório, não um erro a corrigir.
--
-- ORDEM DE EXECUÇÃO (cada passo numa única chamada, no SQL Editor do Supabase):
--   1. este ensaio ANTES da D0            -> esperado: 10 falhas (testes 1, 3, 4, 6, 7, 8, 9, 16, 21, 22)
--   2. migração 20261118120000 (D0)
--   3. migração 20261118120500 (D0.1)     -> pode correr-se logo a seguir à D0
--   4. este ensaio DEPOIS da D0.1         -> esperado: 22 ok, 0 falhas
--   (Se parares entre 2 e 3: este ensaio dá 20 ok e 2 falhas, os testes 8 e 9, que são o que a D0.1 corrige.)
-- Qualquer outra falha, ou "ERRO NA PREPARACAO", deve parar tudo.
-- Pré-requisitos: migrações até à C1 e o gatilho employees_sync_membership da Fase B. Sem ele os
-- testes que dependem de pertenças podem falhar (o relatório avisa).
--
-- Sem ids nem emails de pessoas: utilizadores reais lidos de user_roles (sem ficha, sem pertenças,
-- sem papel admin); os que faltarem criam-se em auth.users com email @invalid.example.

DO $t$
DECLARE
  v_users uuid[] := ARRAY[]::uuid[];
  v_real  integer := 0;
  v_u     uuid;
  v_n     integer;
  a1 uuid; a2 uuid; sp uuid; o1 uuid; g1 uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid;
  cA uuid; cB uuid; cE uuid;
  f1 uuid; f2 uuid; f3 uuid; f4 uuid; f5 uuid; f6 uuid;
  v_nif text := 'ZZ' || substr(upper(md5(gen_random_uuid()::text)), 1, 8);
  v_sync boolean;
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
  -- ---------------------------------------------------------------- preparação
  BEGIN
    FOR v_u IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
       WHERE NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.user_id = ur.user_id OR e.admin_user_id = ur.user_id)
         AND NOT EXISTS (SELECT 1 FROM public.company_memberships m WHERE m.user_id = ur.user_id)
         AND NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = ur.user_id)
         AND NOT EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id = ur.user_id AND x.role = 'admin')
       LIMIT 11
    LOOP
      v_users := v_users || v_u;
    END LOOP;
    v_real := cardinality(v_users);
    v_n := 0;
    WHILE cardinality(v_users) < 11 LOOP
      v_n := v_n + 1;
      INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'zz-d0-' || v_n || '@invalid.example', now(), now())
      RETURNING id INTO v_u;
      v_users := v_users || v_u;
    END LOOP;
    a1 := v_users[1]; a2 := v_users[2]; sp := v_users[3]; o1 := v_users[4]; g1 := v_users[5];
    c1 := v_users[6]; c2 := v_users[7]; c3 := v_users[8]; c4 := v_users[9]; c5 := v_users[10]; c6 := v_users[11];

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
    -- c5 teve ficha em A e foi movido para B (o gatilho deixa a pertença de A 'removido').
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, c5, 'ZZ Cinco', 'zz-d0-5@invalid.example') RETURNING id INTO f5;
    UPDATE public.employees SET company_id = cB WHERE id = f5;
    -- c6: ficha ativa em A usada para provocar um erro técnico no ramo de erro do mover em massa.
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, c6, 'ZZ Seis', 'zz-d0-boom@invalid.example') RETURNING id INTO f6;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FP_BEGIN%FP_END',
      'ERRO NA PREPARACAO: ' || regexp_replace(translate(SQLERRM, '<>"', '   '), '[^ -~]', '?', 'g');
  END;

  -- ---------------------------------------------------------------- testes
  -- Cada linha: 1 nome, 2 quem chama (uuid ou vazio), 3 tipo (f = executar; q = consulta booleana),
  -- 4 papel (authenticated para RLS), 5 esperado (ok, true, false ou SQLSTATE), 6 SQL,
  -- 7 login recente ('1' junta ao JWT um amr com a hora atual), 8 texto que o DETAIL do erro tem
  -- de conter (vazio: não se confere; só vale quando o esperado é um SQLSTATE).
  v_defs := ARRAY[
    ARRAY['viewers: super admin com pertenca conta como administrador', a1::text, 'q', '', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.rz_company_viewers(%L) v WHERE v.user_id = %L AND v.kind = %L AND v.is_company_admin) AND EXISTS (SELECT 1 FROM public.rz_company_viewers(%L) v WHERE v.user_id = %L AND v.kind = %L AND v.is_company_admin)',
             cA, sp, 'super_admin', cA, a1, 'admin_empresa'), '', ''],
    ARRAY['viewers: sem acesso para anon, com acesso para authenticated', '', 'q', '', 'true',
      format('SELECT NOT has_function_privilege(%L, %L, %L) AND has_function_privilege(%L, %L, %L)',
             'anon', 'public.rz_company_viewers(uuid)', 'EXECUTE',
             'authenticated', 'public.rz_company_viewers(uuid)', 'EXECUTE'), '', ''],
    ARRAY['add: sem login recente pede reautenticacao', a1::text, 'f', '', 'RZ401',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cA, c1, 'gestor'), '', 'palavra-passe'],
    ARRAY['remove: sem login recente pede reautenticacao', a1::text, 'f', '', 'RZ401',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cA, a2), '', 'palavra-passe'],
    ARRAY['add: ficha ativa na empresa', a1::text, 'f', '', 'ok',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cA, c1, 'gestor'), '1', ''],
    ARRAY['add: utilizador de outra empresa (mesma resposta que inexistente)', a1::text, 'f', '', '02000',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cA, c2, 'admin'), '1', 'encontrado nesta empresa'],
    ARRAY['add: utilizador inexistente (mesma resposta)', a1::text, 'f', '', '02000',
      format('SELECT public.rz_add_company_admin(%L,gen_random_uuid(),%L)', cA, 'admin'), '1', 'encontrado nesta empresa'],
    ARRAY['add: ficha inativa nao serve (D0.1)', a1::text, 'f', '', '02000',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cA, c3, 'admin'), '1', 'encontrado nesta empresa'],
    ARRAY['add: pessoa ja movida para outra empresa nao serve (D0.1)', a1::text, 'f', '', '02000',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cA, c5, 'admin'), '1', 'encontrado nesta empresa'],
    ARRAY['add: gestor removido que volta serve', a1::text, 'f', '', 'ok',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cA, g1, 'gestor'), '1', ''],
    ARRAY['add: quem nao e admin da empresa', a2::text, 'f', '', '42501',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cB, c2, 'admin'), '1', ''],
    ARRAY['remove: gestor com ficha ativa passa a colaborador', a1::text, 'f', '', 'ok',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cA, c1), '1', ''],
    ARRAY['remove: ficou colaborador ativo', '', 'q', '', 'true',
      format('SELECT role = %L AND status = %L FROM public.company_memberships WHERE company_id = %L AND user_id = %L',
             'colaborador', 'ativo', cA, c1), '', ''],
    -- Cenário do 23505: c4 é admin de A (com ficha ativa em A) e já colaborador ativo em E.
    ARRAY['preparar: c4 passa a administrador de A', '', 'f', '', 'ok',
      format('UPDATE public.company_memberships SET role = %L WHERE company_id = %L AND user_id = %L', 'admin', cA, c4), '', ''],
    ARRAY['preparar: c4 colaborador ativo em E', '', 'f', '', 'ok',
      format('INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES (%L,%L,%L,%L,%L)',
             cE, c4, 'colaborador', 'migracao', 'ativo'), '', ''],
    ARRAY['remove: aviso em portugues em vez do 23505', a1::text, 'f', '', '22023',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cA, c4), '1', 'colaborador ativo noutra empresa'],
    ARRAY['remove: ultimo administrador continua protegido', a1::text, 'f', '', '55000',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cB, a1), '1', ''],
    ARRAY['em massa: erro de regra traz codigo e texto em portugues', a1::text, 'q', '', 'true',
      format('WITH r AS (SELECT public.rz_transfer_employees(ARRAY[%L]::uuid[], %L) AS j) SELECT (j -> %L -> 0 ->> %L) = %L AND (j -> %L -> 0 ->> %L) IS NOT NULL FROM r',
             f3, cB, 'results', 'error', 'invalid_argument', 'results', 'detail'), '', ''],
    -- Erro técnico: um gatilho de teste (anulado no fim) rebenta o UPDATE da ficha f6.
    ARRAY['preparar: funcao que provoca um erro tecnico', '', 'f', '', 'ok',
      $s$CREATE FUNCTION public.zz_d0_boom() RETURNS trigger LANGUAGE plpgsql AS $q$ BEGIN RAISE EXCEPTION 'boom_tecnico' USING ERRCODE = 'XX001', DETAIL = 'detalhe tecnico interno'; END; $q$$s$, '', ''],
    ARRAY['preparar: gatilho de teste em employees', '', 'f', '', 'ok',
      $s$CREATE TRIGGER zz_d0_boom BEFORE UPDATE OF company_id ON public.employees FOR EACH ROW WHEN (NEW.email = 'zz-d0-boom@invalid.example') EXECUTE FUNCTION public.zz_d0_boom()$s$, '', ''],
    ARRAY['em massa: erro tecnico vira unknown com texto geral (sem boom_tecnico nem detalhe interno)', a1::text, 'q', '', 'true',
      format('WITH r AS (SELECT public.rz_transfer_employees(ARRAY[%L]::uuid[], %L) AS j) SELECT (j -> %L -> 0 ->> %L) = %L AND position(%L IN coalesce(j -> %L -> 0 ->> %L, %L)) = 0 AND position(%L IN coalesce(j -> %L -> 0 ->> %L, %L)) > 0 FROM r',
             f6, cB, 'results', 'error', 'unknown', 'tecnico', 'results', 'detail', '', 'Tente outra vez', 'results', 'detail', ''), '', ''],
    ARRAY['em massa: unknown consta do corpo da funcao', '', 'q', '', 'true',
      format('SELECT position(%L IN prosrc) > 0 FROM pg_proc WHERE proname = %L AND pronamespace = %L::regnamespace',
             '''unknown''', 'rz_transfer_employees', 'public'), '', '']
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
               || v_frag || '] texto=[' || coalesce(v_detail, '') || ']' || E'\n';
    ELSIF v_got = v_expect THEN
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
    E'\nRESULTADO D0/D0.1: ' || v_pass || ' ok, ' || v_fail || ' falhas, ' || array_length(v_defs, 1) || ' testes' ||
    E'\nutilizadores reais usados: ' || v_real || ' de 11 (os restantes sinteticos)' ||
    E'\ngatilho employees_sync_membership: ' || CASE WHEN v_sync THEN 'presente' ELSE 'AUSENTE (os testes de pertencas podem falhar)' END ||
    E'\n' || regexp_replace(translate(v_rep, '<>"', '   '), '[^ -~' || E'\n' || ']', '?', 'g');
END
$t$;
