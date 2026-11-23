-- Ensaio PR4 multi-organização (Feed e organograma de empresa externa). NÃO altera nada de forma permanente: o bloco cria dados sintéticos, testa a regra e
-- termina SEMPRE com RAISE EXCEPTION, o que anula a transação inteira. O relatório vem na mensagem do
-- erro, entre FP_BEGIN e FP_END. A mensagem vermelha é o relatório, não um erro a corrigir.
--
-- ORDEM: ensaio ANTES das migrações PR1..PR4 -> falhas; depois de PR1, PR2, PR3 e PR4 -> todos ok.
-- Cenário: A e B no mesmo grupo (feed.read), X externa. adA admin de A SEM ficha; ext admin de X COM ficha
-- (como cria o invite-admin); emA, emX, peerB colaboradores; leg só com user_roles admin; sa super admin.
--
-- Sem dados de pessoas reais: tudo é sintético (auth.users com email @invalid.example, empresas ZZ).

DO $t$
DECLARE
  sa uuid; adA uuid; adB uuid; ext uuid; emA uuid; emX uuid; peerB uuid; leg uuid;
  cA uuid; cB uuid; cX uuid; gG uuid; eA uuid; eX uuid; eXa uuid; eP uuid;
  pA uuid; pAd uuid; pB uuid; pX uuid;
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
              'zz-p4-' || v_k || '@invalid.example', now(), now());
    END LOOP;
    sa := v_ids[1]; adA := v_ids[2]; adB := v_ids[3]; ext := v_ids[4]; emA := v_ids[5]; emX := v_ids[6]; peerB := v_ids[7]; leg := v_ids[8];
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P4 A', v_nif || 'A', 'a@invalid.example') RETURNING id INTO cA;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P4 B', v_nif || 'B', 'b@invalid.example') RETURNING id INTO cB;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P4 X externa', v_nif || 'X', 'x@invalid.example') RETURNING id INTO cX;
    INSERT INTO public.platform_admins (user_id, active, mfa_required) VALUES (sa, true, false);
    INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES
      (cA, adA, 'admin', 'convite', 'ativo'), (cB, adB, 'admin', 'convite', 'ativo'), (cX, ext, 'admin', 'convite', 'ativo');
    INSERT INTO public.company_groups (name, default_capabilities) VALUES ('ZZ P4 grupo', ARRAY['feed.read']) RETURNING id INTO gG;
    INSERT INTO public.company_group_members (group_id, company_id, origin) VALUES (gG, cA, 'manual'), (gG, cB, 'manual');
    -- a ficha do primeiro admin da empresa externa (como cria o invite-admin): a pertenca admin tem de se manter
    INSERT INTO public.employees (company_id, user_id, name, email, position, department) VALUES (cX, ext, 'ZZ Admin X', 'zz-p4-4@invalid.example', 'Administrador', 'Direção') RETURNING id INTO eXa;
    INSERT INTO public.employees (company_id, user_id, name, email, department) VALUES (cA, emA, 'ZZ Colab A', 'zz-p4-5@invalid.example', 'Vendas') RETURNING id INTO eA;
    INSERT INTO public.employees (company_id, user_id, name, email, department) VALUES (cX, emX, 'ZZ Colab X', 'zz-p4-6@invalid.example', 'Operações') RETURNING id INTO eX;
    INSERT INTO public.employees (company_id, user_id, name, email, department) VALUES (cB, peerB, 'ZZ Par B', 'zz-p4-7@invalid.example', 'Vendas') RETURNING id INTO eP;
    INSERT INTO public.user_roles (user_id, role) VALUES (leg, 'admin');
    INSERT INTO public.profiles (user_id, name, email) VALUES (adA, 'ZZ Admin A', 'zz-p4-2@invalid.example');
    INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (cA, emA, 'ZZ post A', 'company') RETURNING id INTO pA;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience, department) VALUES (cA, emA, 'ZZ post dep A', 'department', 'Vendas') RETURNING id INTO pAd;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (cB, peerB, 'ZZ post B', 'company') RETURNING id INTO pB;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (cX, emX, 'ZZ post X', 'company') RETURNING id INTO pX;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FP_BEGIN%FP_END',
      'ERRO NA PREPARACAO: ' || regexp_replace(translate(SQLERRM, '<>"', '   '), '[^ -~]', '?', 'g');
  END;

  v_defs := ARRAY[
    ARRAY['feed: admin de A sem ficha ve a publicacao para toda a empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.feed_posts WHERE id = %L) = 1', pA), '', ''],
    ARRAY['feed: admin de A sem ficha nao ve a de departamento (sem ficha, sem departamento)', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.feed_posts WHERE id = %L) = 0', pAd), '', ''],
    ARRAY['feed: admin de A nao ve a da empresa externa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.feed_posts WHERE id = %L) = 0', pX), '', ''],
    ARRAY['feed: admin de A ve a do par B so em leitura (grupo feed.read)', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.feed_posts WHERE id = %L) = 1', pB), '', ''],
    ARRAY['feed: admin de A sem ficha publica para toda a empresa', adA::text, 'f', 'authenticated', 'ok', format('INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (%L, %L, ''ZZ do admin'', ''company'')', cA, adA), '', ''],
    ARRAY['feed: admin de A nao publica em B', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (%L, %L, ''ZZ x'', ''company'')', cB, adA), '', ''],
    ARRAY['feed: admin de A nao publica na externa', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (%L, %L, ''ZZ x'', ''company'')', cX, adA), '', ''],
    ARRAY['feed: admin de A sem ficha nao publica em nome de outro', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (%L, %L, ''ZZ x'', ''company'')', cA, emA), '', ''],
    ARRAY['feed: admin de A sem ficha nao publica para um departamento', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.feed_posts (company_id, author_id, body, audience, department) VALUES (%L, %L, ''ZZ x'', ''department'', ''Vendas'')', cA, adA), '', ''],
    ARRAY['feed: a lista mostra o nome do perfil de quem publica sem ficha', adA::text, 'q', 'authenticated', 'true', format('SELECT EXISTS (SELECT 1 FROM public.feed_list_posts() WHERE author_name = ''ZZ Admin A'')'), '', ''],
    ARRAY['feed: colaborador da externa ve so o feed da sua empresa', emX::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.feed_posts WHERE id = %L) = 1 AND (SELECT count(*) FROM public.feed_posts WHERE id IN (%L, %L, %L)) = 0', pX, pA, pAd, pB), '', ''],
    ARRAY['feed: admin da externa (com ficha) ve so o da externa', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.feed_posts WHERE id = %L) = 1 AND (SELECT count(*) FROM public.feed_posts WHERE id IN (%L, %L, %L)) = 0', pX, pA, pAd, pB), '', ''],
    ARRAY['feed: admin da externa publica na sua empresa', ext::text, 'f', 'authenticated', 'ok', format('INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (%L, %L, ''ZZ ext'', ''company'')', cX, ext), '', ''],
    ARRAY['feed: admin da externa nao publica na Realize', ext::text, 'f', 'authenticated', '42501', format('INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (%L, %L, ''ZZ x'', ''company'')', cA, ext), '', ''],
    ARRAY['feed: par B (mesmo grupo) ve o feed de A so a empresa toda, em leitura', peerB::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.feed_posts WHERE id = %L) = 1 AND (SELECT count(*) FROM public.feed_posts WHERE id IN (%L, %L)) = 0', pA, pAd, pX), '', ''],
    ARRAY['feed: par B nao publica em A', peerB::text, 'f', 'authenticated', '42501', format('INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (%L, %L, ''ZZ x'', ''company'')', cA, peerB), '', ''],
    ARRAY['feed: papel admin antigo sem pertenca nao ve nada', leg::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.feed_posts WHERE id IN (%L, %L, %L, %L)) = 0', pA, pAd, pB, pX), '', ''],
    ARRAY['feed: super admin ve as publicacoes para toda a empresa de todas', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.feed_posts WHERE id IN (%L, %L, %L)) = 3', pA, pB, pX), '', ''],
    ARRAY['organograma: diretorio da externa so tem pessoas da externa', emX::text, 'q', 'authenticated', 'true', format('SELECT count(*) >= 2 AND bool_and(company_id = %L) FROM public.chat_directory()', cX), '', ''],
    ARRAY['organograma: diretorio da Realize-like nao mostra a externa', emA::text, 'q', 'authenticated', 'true', format('SELECT count(*) >= 1 AND bool_and(company_id = %L) FROM public.chat_directory()', cA), '', ''],
    ARRAY['ficha do primeiro admin nao baixa a pertenca de admin', '', 'q', '', 'true', format('SELECT EXISTS (SELECT 1 FROM public.company_memberships WHERE company_id = %L AND user_id = %L AND role = ''admin'' AND status = ''ativo'')', cX, ext), '', '']
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
RESULTADO PR4: ' || v_pass || ' ok, ' || v_fail || ' falhas, ' || array_length(v_defs, 1) || ' testes' ||
    E'
' || regexp_replace(translate(v_rep, '<>"', '   '), '[^ -~' || E'
' || ']', '?', 'g');
END
$t$;
