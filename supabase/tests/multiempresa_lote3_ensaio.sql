-- Ensaio do Lote 3 (leitura do Feed pelo grupo de empresas). NÃO altera nada de forma permanente: o bloco
-- cria dados sintéticos, testa a regra e termina SEMPRE com RAISE EXCEPTION, o que anula a transação
-- inteira. O relatório vem na mensagem do erro, entre FP_BEGIN e FP_END (ASCII simples).
-- A mensagem vermelha é o relatório, não um erro a corrigir.
--
-- ORDEM DE EXECUÇÃO (cada passo numa única chamada, no SQL Editor do Supabase):
--   1. este ensaio ANTES da migração    -> esperado: quase tudo falha (as funções novas não existem).
--      Serve para provar que o ensaio não passa por acaso. Pode vir "ERRO NA PREPARACAO" se faltar
--      o que a migração cria; em qualquer caso nada fica gravado.
--   2. migração 20261120120000_multiempresa_lote3_feed_grupo.sql
--   3. este ensaio DEPOIS da migração   -> esperado: todos ok, 0 falhas (ver a linha RESULTADO).
-- Qualquer falha, ou "ERRO NA PREPARACAO", deve parar tudo.
-- Pré-requisitos: migrações até ao Lote 2 e o gatilho employees_sync_membership da Fase B.
-- Uma conta admin precisa de role admin em user_roles; o ensaio cria-a.
--
-- Sem ids nem emails de pessoas: os utilizadores criam-se em auth.users com email @invalid.example e o
-- super admin é uma linha sintética em platform_admins (tudo anulado no fim).
--
-- Inclui os aniversários dos pares (visíveis) e a função feed_post_people.
-- Cenário: grupo G1 = {A, B, C} com feed.read; C está inativa. D fora de grupos. E sozinha num grupo
-- (o outro membro já saiu). Grupo G3 = {H, I} com feed.read DESLIGADO.

DO $t$
DECLARE
  uA1 uuid; uA2 uuid; uB1 uuid; uD1 uuid; uE1 uuid; uH1 uuid; uAdm uuid; uCf uuid; uAf uuid; uSp uuid;
  cA uuid; cB uuid; cC uuid; cD uuid; cE uuid; cF uuid; cH uuid; cI uuid;
  g1 uuid; g2 uuid; g3 uuid;
  pA uuid; pAd uuid; pB uuid; pBd uuid; pBx uuid; pBb uuid; pC uuid; pD uuid; pE uuid; pI uuid; pDb uuid; pIb uuid;
  v_nif text := 'ZZ' || substr(upper(md5(gen_random_uuid()::text)), 1, 8);
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
  v_newu text[] := ARRAY['a1','a2','b1','d1','e1','h1','adm','cf','af','sp'];
  v_ids uuid[];
  v_k integer;
  v_pub text := 'ARRAY[''public.feed_can_read(uuid)'', ''public.feed_can_read_row(uuid, text, text, uuid)'', ''public.feed_list_posts(timestamptz, integer)'', ''public.feed_post_people(uuid)'']';
BEGIN
  -- ---------------------------------------------------------------- preparação
  BEGIN
    v_ids := ARRAY[]::uuid[];
    FOR v_k IN 1 .. array_length(v_newu, 1) LOOP
      v_ids := v_ids || gen_random_uuid();
      INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
      VALUES (v_ids[v_k], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'zz-l3-' || v_newu[v_k] || '@invalid.example', now(), now());
    END LOOP;
    uA1 := v_ids[1]; uA2 := v_ids[2]; uB1 := v_ids[3]; uD1 := v_ids[4]; uE1 := v_ids[5];
    uH1 := v_ids[6]; uAdm := v_ids[7]; uCf := v_ids[8]; uAf := v_ids[9]; uSp := v_ids[10];

    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ L3 A', v_nif || 'A', 'a@invalid.example') RETURNING id INTO cA;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ L3 B', v_nif || 'B', 'b@invalid.example') RETURNING id INTO cB;
    INSERT INTO public.companies (name, nif, email, is_active) VALUES ('ZZ L3 C', v_nif || 'C', 'c@invalid.example', false) RETURNING id INTO cC;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ L3 D', v_nif || 'D', 'd@invalid.example') RETURNING id INTO cD;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ L3 E', v_nif || 'E', 'e@invalid.example') RETURNING id INTO cE;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ L3 F', v_nif || 'F', 'f@invalid.example') RETURNING id INTO cF;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ L3 H', v_nif || 'H', 'h@invalid.example') RETURNING id INTO cH;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ L3 I', v_nif || 'I', 'i@invalid.example') RETURNING id INTO cI;

    INSERT INTO public.company_groups (name, default_capabilities) VALUES ('ZZ L3 G1', ARRAY['feed.read']) RETURNING id INTO g1;
    INSERT INTO public.company_groups (name, default_capabilities) VALUES ('ZZ L3 G2', ARRAY['feed.read']) RETURNING id INTO g2;
    INSERT INTO public.company_groups (name, default_capabilities) VALUES ('ZZ L3 G3', ARRAY[]::text[]) RETURNING id INTO g3;
    INSERT INTO public.company_group_members (group_id, company_id, status, origin)
    VALUES (g1, cA, 'ativo', 'manual'), (g1, cB, 'ativo', 'manual'), (g1, cC, 'ativo', 'manual'),
           (g2, cE, 'ativo', 'manual'), (g2, cF, 'saiu', 'manual'),
           (g3, cH, 'ativo', 'manual'), (g3, cI, 'ativo', 'manual');

    -- Pessoas. uAf é a conta de admin ligada à ficha de uCf (conta fundida); uAdm é admin de A sem ficha.
    INSERT INTO public.employees (company_id, user_id, name, email, department)
    VALUES (cA, uA1, 'ZZ L3 A1', 'zz-l3-a1@invalid.example', 'Vendas'),
           (cA, uA2, 'ZZ L3 A2', 'zz-l3-a2@invalid.example', 'Vendas'),
           (cB, uB1, 'ZZ L3 B1', 'zz-l3-b1@invalid.example', 'Vendas'),
           (cD, uD1, 'ZZ L3 D1', 'zz-l3-d1@invalid.example', 'Vendas'),
           (cE, uE1, 'ZZ L3 E1', 'zz-l3-e1@invalid.example', 'Vendas'),
           (cH, uH1, 'ZZ L3 H1', 'zz-l3-h1@invalid.example', 'Vendas');
    INSERT INTO public.user_roles (user_id, role) VALUES (uAf, 'admin');
    INSERT INTO public.employees (company_id, user_id, admin_user_id, name, email, department)
    VALUES (cD, uCf, uAf, 'ZZ L3 CF', 'zz-l3-cf@invalid.example', 'Compras');
    INSERT INTO public.company_memberships (company_id, user_id, role, origin, status)
    VALUES (cA, uAdm, 'admin', 'convite', 'ativo'),
           (cB, uAf, 'admin', 'convite', 'ativo');
    INSERT INTO public.platform_admins (user_id, active, mfa_required) VALUES (uSp, true, false);

    -- Publicações (as escritas sem RLS: o bloco corre como dono).
    INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (cA, uA2, 'A toda', 'company') RETURNING id INTO pA;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience, department) VALUES (cA, uA2, 'A dept', 'department', 'Vendas') RETURNING id INTO pAd;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (cB, uB1, 'B toda', 'company') RETURNING id INTO pB;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience, department) VALUES (cB, uB1, 'B dept', 'department', 'Vendas') RETURNING id INTO pBd;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (cB, uB1, 'B apagada', 'company') RETURNING id INTO pBx;
    UPDATE public.feed_posts SET deleted_at = now() WHERE id = pBx;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience, kind, subject_id, subject_day)
    VALUES (cB, NULL, 'B parabens', 'company', 'birthday', uB1, current_date) RETURNING id INTO pBb;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience, kind, subject_id, subject_day)
    VALUES (cD, NULL, 'D parabens', 'company', 'birthday', uD1, current_date) RETURNING id INTO pDb;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience, kind, subject_id, subject_day)
    VALUES (cI, NULL, 'I parabens', 'company', 'birthday', uH1, current_date) RETURNING id INTO pIb;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (cC, uB1, 'C inativa', 'company') RETURNING id INTO pC;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (cD, uD1, 'D toda', 'company') RETURNING id INTO pD;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (cE, uE1, 'E toda', 'company') RETURNING id INTO pE;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (cI, uH1, 'I toda', 'company') RETURNING id INTO pI;

    -- Um comentário e um ficheiro na publicação de B; a última visita de A1 ao Feed (para a contagem).
    INSERT INTO public.feed_comments (post_id, author_id, body) VALUES (pB, uB1, 'comentario de B');
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('feed-files', pB::text || '/ficheiro.png', uB1);
    INSERT INTO public.feed_seen (user_id, seen_at) VALUES (uA1, now() - interval '1 hour');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FP_BEGIN%FP_END',
      'ERRO NA PREPARACAO: ' || regexp_replace(translate(SQLERRM, '<>"', '   '), '[^ -~]', '?', 'g');
  END;

  -- ---------------------------------------------------------------- testes
  -- Cada linha: 1 nome, 2 quem chama (uuid ou vazio), 3 tipo (f = executar; q = consulta booleana),
  -- 4 papel (authenticated para chamar como a app), 5 esperado (ok, true, false ou SQLSTATE), 6 SQL.
  v_defs := ARRAY[
    -- ===== ler: a regra
    ARRAY['ler: mesma empresa (toda e departamento)', uA1::text, 'q', 'authenticated', 'true',
      format('SELECT (SELECT count(*) FROM public.feed_posts WHERE id IN (%L,%L)) = 2', pA, pAd)],
    ARRAY['ler: empresa do mesmo grupo, publicacao de toda a empresa', uA1::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pB)],
    ARRAY['ler: o par tambem ve a de A (simetrico)', uB1::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pA)],
    ARRAY['ler: departamento de outra empresa do grupo nao sai', uA1::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pBd)],
    ARRAY['ler: publicacao apagada do par nao aparece', uA1::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pBx)],
    ARRAY['ler: aniversario do par aparece (e como um post)', uA1::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pBb)],
    ARRAY['ler: aniversario de empresa fora do grupo nao aparece', uA1::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pDb)],
    ARRAY['ler: aniversario de empresa do grupo com feed.read desligado nao aparece', uH1::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pIb)],
    ARRAY['ler: o corpo do aniversario nao traz ano nem idade', uA1::text, 'q', 'authenticated', 'true',
      format('SELECT (SELECT body FROM public.feed_posts WHERE id = %L) !~ ''[0-9]{4}'' AND (SELECT subject_day FROM public.feed_posts WHERE id = %L) = current_date', pBb, pBb)],
    ARRAY['ler: empresa inativa do grupo nao aparece', uA1::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pC)],
    ARRAY['ler: empresa fora do grupo nao aparece', uA1::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pD)],
    ARRAY['ler: empresa fora de grupos nao ve as do grupo', uD1::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id IN (%L,%L))', pA, pB)],
    ARRAY['ler: empresa fora de grupos ve a sua', uD1::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pD)],
    ARRAY['ler: grupo de uma so empresa ve so a sua', uE1::text, 'q', 'authenticated', 'true',
      format('SELECT (SELECT count(*) FROM public.feed_posts WHERE id IN (%L,%L,%L,%L,%L,%L)) = 0 AND EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pA, pAd, pB, pD, pI, pC, pE)],
    ARRAY['ler: grupo com feed.read desligado nao expoe nada', uH1::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pI)],
    ARRAY['ler: admin sem ficha ve os pares (pertencas ativas)', uAdm::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pB)],
    ARRAY['ler: admin sem ficha continua a nao ver a propria empresa (regra atual)', uAdm::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pA)],
    ARRAY['ler: conta fundida ve os pares da empresa da conta de admin', uCf::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pA)],
    ARRAY['ler: conta fundida nao ve o que nao e do grupo', uCf::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pE)],
    ARRAY['ler: super admin sem pertencas nao ve publicacoes de empresas', uSp::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id IN (%L,%L))', pA, pB)],
    ARRAY['ler: sem sessao nao ve nada', '', 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id IN (%L,%L))', pA, pB)],
    -- ===== ler: comentarios, reacoes, ficheiros
    ARRAY['ler comentarios do par', uA1::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_comments WHERE post_id = %L)', pB)],
    ARRAY['ler comentarios: fora do grupo nao', uD1::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_comments WHERE post_id = %L)', pB)],
    ARRAY['ler ficheiro da publicacao do par', uA1::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = ''feed-files'' AND name = %L)', pB::text || '/ficheiro.png')],
    ARRAY['ler ficheiro: fora do grupo nao', uD1::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = ''feed-files'' AND name = %L)', pB::text || '/ficheiro.png')],
    -- ===== listar e contar
    ARRAY['listar: feed_list_posts traz o par com empresa', uA1::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_list_posts(NULL, 50) WHERE id = %L AND company_id = %L AND company_name = %L)', pB, cB, 'ZZ L3 B')],
    ARRAY['listar: o autor da publicacao do par vem com o nome', uA1::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_list_posts(NULL, 50) WHERE id = %L AND author_name = %L)', pB, 'ZZ L3 B1')],
    ARRAY['listar: traz o aniversario do par', uA1::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_list_posts(NULL, 50) WHERE id = %L AND kind = ''birthday'' AND company_name = %L)', pBb, 'ZZ L3 B')],
    ARRAY['listar: nao traz departamento, apagada, inativa nem fora do grupo (nem o aniversario de fora)', uA1::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_list_posts(NULL, 50) WHERE id IN (%L,%L,%L,%L,%L,%L))', pBd, pBx, pC, pD, pDb, pIb)],
    ARRAY['listar: a propria empresa continua la com o nome', uA1::text, 'q', 'authenticated', 'true',
      format('SELECT (SELECT count(*) FROM public.feed_list_posts(NULL, 50) WHERE id IN (%L,%L) AND company_name = %L) = 2', pA, pAd, 'ZZ L3 A')],
    ARRAY['listar: empresa fora do grupo so ve a sua', uD1::text, 'q', 'authenticated', 'true',
      format('SELECT (SELECT count(*) FROM public.feed_list_posts(NULL, 50) WHERE id IN (%L,%L,%L,%L)) = 1', pA, pB, pD, pE)],
    ARRAY['contar novidades: inclui o par (A toda, A dept, B toda e o aniversario de B)', uA1::text, 'q', 'authenticated', 'true',
      'SELECT public.feed_unread_count() = 4'],
    -- ===== quem escreveu, comentou ou reagiu
    ARRAY['pessoas: post do par devolve so nome e empresa de quem la esta', uA1::text, 'q', 'authenticated', 'true',
      format('SELECT count(*) = 1 AND bool_and(name = %L AND company_name = %L AND company_id = %L) FROM public.feed_post_people(%L)', 'ZZ L3 B1', 'ZZ L3 B', cB, pB)],
    ARRAY['pessoas: a minha empresa tambem', uA1::text, 'q', 'authenticated', 'true',
      format('SELECT count(*) = 1 AND bool_and(name = %L AND company_name = %L) FROM public.feed_post_people(%L)', 'ZZ L3 A2', 'ZZ L3 A', pA)],
    ARRAY['pessoas: nada se o post nao for legivel (fora do grupo)', uD1::text, 'q', 'authenticated', 'true',
      format('SELECT count(*) = 0 FROM public.feed_post_people(%L)', pB)],
    ARRAY['pessoas: nada para um post de departamento do par', uA1::text, 'q', 'authenticated', 'true',
      format('SELECT count(*) = 0 FROM public.feed_post_people(%L)', pBd)],
    ARRAY['pessoas: nada com feed.read desligado', uH1::text, 'q', 'authenticated', 'true',
      format('SELECT count(*) = 0 FROM public.feed_post_people(%L)', pI)],
    ARRAY['pessoas: sem sessao nao devolve nada', '', 'q', 'authenticated', 'true',
      format('SELECT count(*) = 0 FROM public.feed_post_people(%L)', pB)],
    ARRAY['pessoas: so 4 colunas (sem email, telefone, cargo nem departamento)', '', 'q', '', 'true',
      'SELECT pg_get_function_result(''public.feed_post_people(uuid)''::regprocedure) = ''TABLE(user_id uuid, name text, company_id uuid, company_name text)'''],
    -- ===== escrever: so na propria empresa
    ARRAY['escrever: comentar na propria empresa continua a funcionar', uA1::text, 'f', 'authenticated', 'ok',
      format('INSERT INTO public.feed_comments (post_id, author_id, body) VALUES (%L, %L, %L)', pA, uA1, 'ola')],
    ARRAY['escrever: reagir na propria empresa continua a funcionar', uA1::text, 'f', 'authenticated', 'ok',
      format('INSERT INTO public.feed_reactions (post_id, user_id, emoji) VALUES (%L, %L, %L)', pA, uA1, 'x')],
    ARRAY['escrever: comentar numa publicacao do par FALHA', uA1::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.feed_comments (post_id, author_id, body) VALUES (%L, %L, %L)', pB, uA1, 'ola')],
    ARRAY['escrever: reagir a uma publicacao do par FALHA', uA1::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.feed_reactions (post_id, user_id, emoji) VALUES (%L, %L, %L)', pB, uA1, 'x')],
    ARRAY['escrever: enviar ficheiro para a publicacao do par FALHA', uA1::text, 'f', 'authenticated', '42501',
      format('INSERT INTO storage.objects (bucket_id, name, owner) VALUES (''feed-files'', %L, %L)', pB::text || '/outro.png', uA1)],
    ARRAY['escrever: publicar na empresa do par FALHA', uA1::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (%L, %L, %L, ''company'')', cB, uA1, 'intruso')],
    ARRAY['escrever: o par nao pode editar a publicacao (0 linhas)', uA1::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.feed_posts SET body = %L WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', 'x', pB)],
    -- ===== permissoes e forma
    ARRAY['permissoes: anon sem EXECUTE nas funcoes de leitura', '', 'q', '', 'true',
      'SELECT bool_and(NOT has_function_privilege(''anon'', p, ''EXECUTE'')) FROM unnest(' || v_pub || ' || ARRAY[''public.rz_group_peer_companies(text)'']) p'],
    ARRAY['permissoes: authenticated com EXECUTE nas funcoes de leitura', '', 'q', '', 'true',
      'SELECT bool_and(has_function_privilege(''authenticated'', p, ''EXECUTE'')) FROM unnest(' || v_pub || ') p'],
    ARRAY['permissoes: a funcao de pares so para service_role', '', 'q', '', 'true',
      'SELECT NOT has_function_privilege(''authenticated'', ''public.rz_group_peer_companies(text)'', ''EXECUTE'') AND has_function_privilege(''service_role'', ''public.rz_group_peer_companies(text)'', ''EXECUTE'')'],
    ARRAY['permissoes: anon nao executa feed_can_see nem feed_can_see_row', '', 'q', '', 'true',
      'SELECT NOT has_function_privilege(''anon'', ''public.feed_can_see(uuid)'', ''EXECUTE'') AND NOT has_function_privilege(''anon'', ''public.feed_can_see_row(uuid, text, text, uuid)'', ''EXECUTE'')'],
    ARRAY['forma: SECURITY DEFINER com search_path fixo nas funcoes novas', '', 'q', '', 'true',
      'SELECT count(*) = 5 AND bool_and(p.prosecdef AND coalesce(p.proconfig::text, '''') LIKE ''%search_path=public%'') FROM pg_proc p WHERE p.pronamespace = ''public''::regnamespace AND p.proname IN (''rz_group_peer_companies'', ''feed_can_read'', ''feed_can_read_row'', ''feed_list_posts'', ''feed_post_people'')'],
    ARRAY['forma: a regra de escrever nao foi alargada (feed_can_see sem grupos)', '', 'q', '', 'true',
      'SELECT bool_and(p.prosrc NOT LIKE ''%peer%'' AND p.prosrc NOT LIKE ''%feed_can_read%'') FROM pg_proc p WHERE p.pronamespace = ''public''::regnamespace AND p.proname IN (''feed_can_see'', ''feed_can_see_row'')'],
    ARRAY['forma: policies de INSERT ainda usam feed_can_see', '', 'q', '', 'true',
      'SELECT (SELECT pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE polname = ''Feed: comentar'' AND polrelid = ''public.feed_comments''::regclass) LIKE ''%feed_can_see(%'' AND (SELECT pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE polname = ''Feed: reagir'' AND polrelid = ''public.feed_reactions''::regclass) LIKE ''%feed_can_see(%'''],
    ARRAY['forma: policies de SELECT usam feed_can_read', '', 'q', '', 'true',
      'SELECT (SELECT count(*) FROM pg_policy WHERE polname IN (''Feed: ver publicações'', ''Feed: ver comentários'', ''Feed: ver reações'', ''Feed: ver ficheiros'') AND pg_get_expr(polqual, polrelid) LIKE ''%feed_can_read%'') = 4'],
    ARRAY['forma: grupos novos nascem com feed.read', '', 'q', '', 'true',
      'SELECT column_default LIKE ''%feed.read%'' FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''company_groups'' AND column_name = ''default_capabilities'''],
    ARRAY['forma: feed.read e uma capacidade elegivel para o grupo', '', 'q', '', 'true',
      'SELECT public.rz_group_caps(ARRAY[''feed.read'']) = ARRAY[''feed.read'']']
  ];

  FOR v_i IN 1 .. array_length(v_defs, 1) LOOP
    v_name := v_defs[v_i][1];
    v_who := nullif(v_defs[v_i][2], '')::uuid;
    v_expect := v_defs[v_i][5];
    v_claims := CASE WHEN v_who IS NULL THEN '{}'
      ELSE '{"sub":"' || v_who::text || '","role":"authenticated"}' END;
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
    E'\nRESULTADO LOTE 3: ' || v_pass || ' ok, ' || v_fail || ' falhas, ' || array_length(v_defs, 1) || ' testes' ||
    E'\n' || regexp_replace(translate(v_rep, '<>"', '   '), '[^ -~' || E'\n' || ']', '?', 'g');
END
$t$;
