-- Ensaio do Lote 2 (gestão de grupos de empresas). NÃO altera nada de forma permanente: o bloco cria
-- dados sintéticos, testa as funções e termina SEMPRE com RAISE EXCEPTION, o que anula a transação
-- inteira. O relatório vem na mensagem do erro, entre FP_BEGIN e FP_END (ASCII simples).
-- A mensagem vermelha é o relatório, não um erro a corrigir.
--
-- ORDEM DE EXECUÇÃO (cada passo numa única chamada, no SQL Editor do Supabase):
--   1. este ensaio ANTES da migração    -> esperado: quase tudo falha (as funções e a coluna não existem).
--      Serve para provar que o ensaio não passa por acaso. A mensagem pode ser "ERRO NA PREPARACAO" se
--      faltar o que a migração cria; em qualquer caso nada fica gravado.
--   2. migração 20261119200000_multiempresa_lote2_grupos.sql
--   3. este ensaio DEPOIS da migração   -> esperado: todos ok, 0 falhas (ver a linha RESULTADO).
-- Qualquer falha, ou "ERRO NA PREPARACAO", deve parar tudo.
-- Pré-requisitos: migrações até à D2 e o gatilho employees_sync_membership da Fase B.
--
-- Sem ids nem emails de pessoas: os utilizadores criam-se em auth.users com email @invalid.example e
-- o super admin é uma linha sintética em platform_admins (tudo anulado no fim).

DO $t$
DECLARE
  sp uuid; a1 uuid; c1 uuid;
  cA uuid; cB uuid; cC uuid; cD uuid; cE uuid; cI uuid;
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
  v_pub text := 'ARRAY[''public.rz_create_group(text, uuid[], text[])'', ''public.rz_rename_group(uuid, text)'', ''public.rz_set_group_members(uuid, uuid[])'', ''public.rz_set_group_capabilities(uuid, text[])'', ''public.rz_dissolve_group(uuid)'', ''public.rz_list_groups()'', ''public.rz_list_group(uuid)'']';
  v_int text := 'ARRAY[''public.rz_group_assert_super()'', ''public.rz_group_name(text)'', ''public.rz_group_caps(text[])'', ''public.rz_group_clean_companies(uuid[])'', ''public.rz_group_check_companies(uuid[], uuid)'', ''public.rz_group_revoke_between(uuid, uuid[], uuid[], text)'', ''public.rz_group_audit(uuid, text, uuid, uuid[])'']';
BEGIN
  -- ---------------------------------------------------------------- preparação
  BEGIN
    INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'zz-l2-1@invalid.example', now(), now()) RETURNING id INTO sp;
    INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'zz-l2-2@invalid.example', now(), now()) RETURNING id INTO a1;
    INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'zz-l2-3@invalid.example', now(), now()) RETURNING id INTO c1;

    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ L2 A', v_nif || 'A', 'a@invalid.example') RETURNING id INTO cA;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ L2 B', v_nif || 'B', 'b@invalid.example') RETURNING id INTO cB;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ L2 C', v_nif || 'C', 'c@invalid.example') RETURNING id INTO cC;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ L2 D', v_nif || 'D', 'd@invalid.example') RETURNING id INTO cD;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ L2 E', v_nif || 'E', 'e@invalid.example') RETURNING id INTO cE;
    INSERT INTO public.companies (name, nif, email, is_active) VALUES ('ZZ L2 I', v_nif || 'I', 'i@invalid.example', false) RETURNING id INTO cI;

    -- sp é super admin; a1 administra A (sem poderes de plataforma); c1 é colaborador de A.
    INSERT INTO public.platform_admins (user_id, active, mfa_required) VALUES (sp, true, false);
    INSERT INTO public.company_memberships (company_id, user_id, role, origin, status)
    VALUES (cA, a1, 'admin', 'convite', 'ativo');
    INSERT INTO public.employees (company_id, user_id, name, email)
    VALUES (cA, c1, 'ZZ L2 Colaborador', 'zz-l2-3@invalid.example');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FP_BEGIN%FP_END',
      'ERRO NA PREPARACAO: ' || regexp_replace(translate(SQLERRM, '<>"', '   '), '[^ -~]', '?', 'g');
  END;

  -- ---------------------------------------------------------------- testes
  -- Cada linha: 1 nome, 2 quem chama (uuid ou vazio), 3 tipo (f = executar; q = consulta booleana),
  -- 4 papel (authenticated para chamar como a app), 5 esperado (ok, true, false ou SQLSTATE), 6 SQL,
  -- 7 login recente ('1' junta ao JWT um amr com a hora atual), 8 texto que o DETAIL do erro tem
  -- de conter (vazio: não se confere; só vale quando o esperado é um SQLSTATE).
  v_defs := ARRAY[
    -- ===== criar: quem pode
    ARRAY['criar: admin de empresa sem poderes de plataforma', a1::text, 'f', 'authenticated', '42501',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[])', 'ZZ L2 G1', cA, cB), '1', 'plataforma'],
    ARRAY['criar: colaborador', c1::text, 'f', 'authenticated', '42501',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[])', 'ZZ L2 G1', cA, cB), '1', ''],
    ARRAY['criar: super admin sem login recente pede reautenticacao', sp::text, 'f', 'authenticated', 'RZ401',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[])', 'ZZ L2 G1', cA, cB), '', 'palavra-passe'],
    -- ===== criar: argumentos
    ARRAY['criar: nome vazio', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[])', '   ', cA, cB), '1', 'nome do grupo'],
    ARRAY['criar: nome com mais de 80 caracteres', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_create_group(repeat(%L, 81), ARRAY[%L,%L]::uuid[])', 'x', cA, cB), '1', 'nome do grupo'],
    ARRAY['criar: uma so empresa', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_create_group(%L, ARRAY[%L]::uuid[])', 'ZZ L2 G1', cA), '1', 'pelo menos 2'],
    ARRAY['criar: a mesma empresa duas vezes conta como uma', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[])', 'ZZ L2 G1', cA, cA), '1', 'pelo menos 2'],
    ARRAY['criar: empresa inativa', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[])', 'ZZ L2 G1', cA, cI), '1', 'inativa'],
    ARRAY['criar: empresa inexistente', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_create_group(%L, ARRAY[%L, gen_random_uuid()]::uuid[])', 'ZZ L2 G1', cA), '1', 'encontrada'],
    -- ===== ajudantes do ensaio (anulados no fim)
    ARRAY['preparar: grupo ativo de uma empresa', '', 'f', '', 'ok',
      $s$CREATE FUNCTION public.zz_l2_gid(p uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $q$ SELECT group_id FROM public.company_group_members WHERE company_id = p AND status = 'ativo' LIMIT 1 $q$$s$, '', ''],
    ARRAY['preparar: uma capacidade de cada tipo do catalogo', '', 'f', '', 'ok',
      $s$CREATE FUNCTION public.zz_l2_cap(p text) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $q$ SELECT capability FROM public.capability_catalog WHERE CASE p WHEN 'write' THEN kind <> 'read' AND grantable AND NOT sensitive WHEN 'sensitive' THEN sensitive AND grantable WHEN 'nogrant' THEN NOT grantable END ORDER BY capability LIMIT 1 $q$$s$, '', ''],
    ARRAY['catalogo tem as 3 capacidades de teste (escrita, sensivel, nao partilhavel)', '', 'q', '', 'true',
      'SELECT public.zz_l2_cap(''write'') IS NOT NULL AND public.zz_l2_cap(''sensitive'') IS NOT NULL AND public.zz_l2_cap(''nogrant'') IS NOT NULL', '', ''],
    -- ===== criar: capacidades
    ARRAY['criar: capacidade desconhecida', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[], ARRAY[%L])', 'ZZ L2 G1', cA, cB, 'zz.nao_existe'), '1', ''],
    ARRAY['criar: capacidade de escrita', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[], ARRAY[public.zz_l2_cap(%L)])', 'ZZ L2 G1', cA, cB, 'write'), '1', 'leitura'],
    ARRAY['criar: capacidade sensivel', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[], ARRAY[public.zz_l2_cap(%L)])', 'ZZ L2 G1', cA, cB, 'sensitive'), '1', 'leitura'],
    ARRAY['criar: capacidade nao partilhavel', sp::text, 'f', 'authenticated', '42501',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[], ARRAY[public.zz_l2_cap(%L)])', 'ZZ L2 G1', cA, cB, 'nogrant'), '1', ''],
    -- ===== criar: sucesso
    ARRAY['criar: A e B com os modulos por defeito', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[])', 'ZZ L2 G1', cA, cB), '1', ''],
    ARRAY['criar: grupo com 2 empresas manuais, modulos directory.read e feed.read, sem empresa criadora', '', 'q', '', 'true',
      format('SELECT g.default_capabilities = ARRAY[%L,%L]::text[] AND g.created_by_company_id IS NULL AND (SELECT count(*) FROM public.company_group_members m WHERE m.group_id = g.id AND m.status = %L AND m.origin = %L) = 2 FROM public.company_groups g WHERE g.name = %L',
             'directory.read', 'feed.read', 'ativo', 'manual', 'ZZ L2 G1'), '', ''],
    ARRAY['criar: auditoria group_create (uma linha por empresa)', '', 'q', '', 'true',
      format('SELECT count(*) = 2 FROM public.cross_company_audit WHERE action = %L AND owner_company_id IN (%L,%L)', 'group_create', cA, cB), '', ''],
    ARRAY['criar: empresa que ja esta noutro grupo', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[])', 'ZZ L2 G9', cB, cC), '1', 'já pertence a um grupo'],
    ARRAY['criar: a recusa nao deixou nada para tras', '', 'q', '', 'true',
      format('SELECT NOT EXISTS (SELECT 1 FROM public.company_groups WHERE name = %L) AND NOT EXISTS (SELECT 1 FROM public.company_group_members WHERE company_id = %L)', 'ZZ L2 G9', cC), '', ''],
    -- ===== renomear
    ARRAY['renomear: admin de empresa', a1::text, 'f', 'authenticated', '42501',
      format('SELECT public.rz_rename_group(public.zz_l2_gid(%L), %L)', cA, 'ZZ L2 X'), '1', ''],
    ARRAY['renomear: sem login recente', sp::text, 'f', 'authenticated', 'RZ401',
      format('SELECT public.rz_rename_group(public.zz_l2_gid(%L), %L)', cA, 'ZZ L2 X'), '', 'palavra-passe'],
    ARRAY['renomear: nome vazio', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_rename_group(public.zz_l2_gid(%L), %L)', cA, '  '), '1', 'nome do grupo'],
    ARRAY['renomear: grupo inexistente', sp::text, 'f', 'authenticated', '02000',
      format('SELECT public.rz_rename_group(gen_random_uuid(), %L)', 'ZZ L2 X'), '1', ''],
    ARRAY['renomear: ok', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_rename_group(public.zz_l2_gid(%L), %L)', cA, '  ZZ L2 renomeado  '), '1', ''],
    ARRAY['renomear: nome sem espacos a volta e auditoria group_update (2 linhas)', '', 'q', '', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.company_groups WHERE id = public.zz_l2_gid(%L) AND name = %L) AND (SELECT count(*) FROM public.cross_company_audit WHERE action = %L AND owner_company_id IN (%L,%L)) = 2',
             cA, 'ZZ L2 renomeado', 'group_update', cA, cB), '', ''],
    -- ===== empresas do grupo
    ARRAY['empresas: admin de empresa', a1::text, 'f', 'authenticated', '42501',
      format('SELECT public.rz_set_group_members(public.zz_l2_gid(%L), ARRAY[%L,%L,%L]::uuid[])', cA, cA, cB, cC), '1', ''],
    ARRAY['empresas: sem login recente', sp::text, 'f', 'authenticated', 'RZ401',
      format('SELECT public.rz_set_group_members(public.zz_l2_gid(%L), ARRAY[%L,%L,%L]::uuid[])', cA, cA, cB, cC), '', 'palavra-passe'],
    ARRAY['empresas: junta C ao grupo', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_set_group_members(public.zz_l2_gid(%L), ARRAY[%L,%L,%L]::uuid[])', cA, cA, cB, cC), '1', ''],
    ARRAY['empresas: C ficou ativa com origem manual', '', 'q', '', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.company_group_members WHERE company_id = %L AND status = %L AND origin = %L AND left_at IS NULL)', cC, 'ativo', 'manual'), '', ''],
    ARRAY['preparar: partilha A->B aprovada', '', 'f', '', 'ok',
      format('INSERT INTO public.company_shares (owner_company_id, grantee_company_id, capability, status, origin, approved_at) VALUES (%L,%L,%L,%L,%L,now())', cA, cB, 'directory.read', 'aprovado', 'pedido'), '', ''],
    ARRAY['preparar: partilha B->C aprovada', '', 'f', '', 'ok',
      format('INSERT INTO public.company_shares (owner_company_id, grantee_company_id, capability, status, origin, approved_at) VALUES (%L,%L,%L,%L,%L,now())', cB, cC, 'directory.read', 'aprovado', 'pedido'), '', ''],
    ARRAY['preparar: partilha C->A aprovada', '', 'f', '', 'ok',
      format('INSERT INTO public.company_shares (owner_company_id, grantee_company_id, capability, status, origin, approved_at) VALUES (%L,%L,%L,%L,%L,now())', cC, cA, 'directory.read', 'aprovado', 'pedido'), '', ''],
    ARRAY['preparar: partilha C->D aprovada (D esta fora do grupo)', '', 'f', '', 'ok',
      format('INSERT INTO public.company_shares (owner_company_id, grantee_company_id, capability, status, origin, approved_at) VALUES (%L,%L,%L,%L,%L,now())', cC, cD, 'directory.read', 'aprovado', 'pedido'), '', ''],
    ARRAY['empresas: retira C do grupo', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_set_group_members(public.zz_l2_gid(%L), ARRAY[%L,%L]::uuid[])', cA, cA, cB), '1', ''],
    ARRAY['empresas: a partilha entre as que ficam (A->B) continua aprovada', '', 'q', '', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.company_shares WHERE owner_company_id = %L AND grantee_company_id = %L AND status = %L)', cA, cB, 'aprovado'), '', ''],
    ARRAY['empresas: B->C e C->A revogadas com motivo e autor', '', 'q', '', 'true',
      format('SELECT count(*) = 2 FROM public.company_shares WHERE status = %L AND revoke_reason = %L AND revoked_by = %L AND ((owner_company_id = %L AND grantee_company_id = %L) OR (owner_company_id = %L AND grantee_company_id = %L))',
             'revogado', 'Saída do grupo', sp, cB, cC, cC, cA), '', ''],
    ARRAY['empresas: a partilha de C com quem nunca esteve no grupo (D) nao se toca', '', 'q', '', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.company_shares WHERE owner_company_id = %L AND grantee_company_id = %L AND status = %L)', cC, cD, 'aprovado'), '', ''],
    ARRAY['empresas: C ficou com status saiu e data de saida; o grupo continua com A e B', '', 'q', '', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.company_group_members WHERE company_id = %L AND status = %L AND left_at IS NOT NULL) AND (SELECT count(*) FROM public.company_group_members WHERE group_id = public.zz_l2_gid(%L) AND status = %L) = 2',
             cC, 'saiu', cA, 'ativo'), '', ''],
    ARRAY['empresas: auditoria share_revoke e group_members', '', 'q', '', 'true',
      format('SELECT (SELECT count(*) FROM public.cross_company_audit WHERE action = %L AND owner_company_id IN (%L,%L)) = 2 AND (SELECT count(*) FROM public.cross_company_audit WHERE action = %L AND owner_company_id IN (%L,%L)) = 2',
             'share_revoke', cB, cC, 'group_members', cC, cC), '', ''],
    ARRAY['empresas: ficar com uma so empresa manda usar Dissolver', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_set_group_members(public.zz_l2_gid(%L), ARRAY[%L]::uuid[])', cA, cA), '1', 'Dissolver'],
    ARRAY['empresas: lista vazia manda usar Dissolver', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_set_group_members(public.zz_l2_gid(%L), ARRAY[]::uuid[])', cA), '1', 'Dissolver'],
    ARRAY['empresas: grupo inexistente', sp::text, 'f', 'authenticated', '02000',
      format('SELECT public.rz_set_group_members(gen_random_uuid(), ARRAY[%L,%L]::uuid[])', cA, cB), '1', ''],
    ARRAY['empresas: empresa inativa', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_set_group_members(public.zz_l2_gid(%L), ARRAY[%L,%L,%L]::uuid[])', cA, cA, cB, cI), '1', 'inativa'],
    ARRAY['criar: segundo grupo com D e E', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[], ARRAY[]::text[])', 'ZZ L2 G2', cD, cE), '1', ''],
    ARRAY['empresas: D ja esta noutro grupo', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_set_group_members(public.zz_l2_gid(%L), ARRAY[%L,%L,%L]::uuid[])', cA, cA, cB, cD), '1', 'já pertence a um grupo'],
    ARRAY['empresas: reativa C (tinha saido deste grupo)', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_set_group_members(public.zz_l2_gid(%L), ARRAY[%L,%L,%L]::uuid[])', cA, cA, cB, cC), '1', ''],
    ARRAY['empresas: C ativa outra vez, sem data de saida, sem linha duplicada', '', 'q', '', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.company_group_members WHERE company_id = %L AND status = %L AND left_at IS NULL) AND (SELECT count(*) FROM public.company_group_members WHERE company_id = %L AND group_id = public.zz_l2_gid(%L)) = 1',
             cC, 'ativo', cC, cA), '', ''],
    ARRAY['empresas: repetir o mesmo conjunto nao altera nada', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_set_group_members(public.zz_l2_gid(%L), ARRAY[%L,%L,%L]::uuid[])', cA, cC, cB, cA), '1', ''],
    -- ===== modulos do grupo
    ARRAY['modulos: admin de empresa', a1::text, 'f', 'authenticated', '42501',
      format('SELECT public.rz_set_group_capabilities(public.zz_l2_gid(%L), ARRAY[%L])', cA, 'directory.read'), '1', ''],
    ARRAY['modulos: sem login recente', sp::text, 'f', 'authenticated', 'RZ401',
      format('SELECT public.rz_set_group_capabilities(public.zz_l2_gid(%L), ARRAY[%L])', cA, 'directory.read'), '', 'palavra-passe'],
    ARRAY['modulos: so o diretorio', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_set_group_capabilities(public.zz_l2_gid(%L), ARRAY[%L])', cA, 'directory.read'), '1', ''],
    ARRAY['modulos: ficou so directory.read', '', 'q', '', 'true',
      format('SELECT default_capabilities = ARRAY[%L]::text[] FROM public.company_groups WHERE id = public.zz_l2_gid(%L)', 'directory.read', cA), '', ''],
    ARRAY['modulos: capacidade de escrita', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_set_group_capabilities(public.zz_l2_gid(%L), ARRAY[public.zz_l2_cap(%L)])', cA, 'write'), '1', 'leitura'],
    ARRAY['modulos: capacidade sensivel', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_set_group_capabilities(public.zz_l2_gid(%L), ARRAY[public.zz_l2_cap(%L)])', cA, 'sensitive'), '1', 'leitura'],
    ARRAY['modulos: capacidade nao partilhavel', sp::text, 'f', 'authenticated', '42501',
      format('SELECT public.rz_set_group_capabilities(public.zz_l2_gid(%L), ARRAY[public.zz_l2_cap(%L)])', cA, 'nogrant'), '1', ''],
    ARRAY['modulos: capacidade desconhecida', sp::text, 'f', 'authenticated', '22023',
      format('SELECT public.rz_set_group_capabilities(public.zz_l2_gid(%L), ARRAY[%L])', cA, 'zz.nao_existe'), '1', ''],
    ARRAY['modulos: a recusa nao mudou nada', '', 'q', '', 'true',
      format('SELECT default_capabilities = ARRAY[%L]::text[] FROM public.company_groups WHERE id = public.zz_l2_gid(%L)', 'directory.read', cA), '', ''],
    ARRAY['modulos: duplicados e desordem ficam normalizados', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_set_group_capabilities(public.zz_l2_gid(%L), ARRAY[%L,%L,%L])', cA, 'feed.read', 'directory.read', 'feed.read'), '1', ''],
    ARRAY['modulos: ficou directory.read e feed.read por ordem', '', 'q', '', 'true',
      format('SELECT default_capabilities = ARRAY[%L,%L]::text[] FROM public.company_groups WHERE id = public.zz_l2_gid(%L)', 'directory.read', 'feed.read', cA), '', ''],
    ARRAY['modulos: lista vazia e valida (nada por defeito)', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_set_group_capabilities(public.zz_l2_gid(%L), ARRAY[]::text[])', cA), '1', ''],
    ARRAY['modulos: ficou vazio', '', 'q', '', 'true',
      format('SELECT default_capabilities = ARRAY[]::text[] FROM public.company_groups WHERE id = public.zz_l2_gid(%L)', cA), '', ''],
    ARRAY['modulos: grupo inexistente', sp::text, 'f', 'authenticated', '02000',
      format('SELECT public.rz_set_group_capabilities(gen_random_uuid(), ARRAY[%L])', 'directory.read'), '1', ''],
    ARRAY['modulos: volta a directory.read e feed.read', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_set_group_capabilities(public.zz_l2_gid(%L), ARRAY[%L,%L])', cA, 'directory.read', 'feed.read'), '1', ''],
    ARRAY['modulos: auditoria group_capabilities (4 alteracoes x 3 empresas)', '', 'q', '', 'true',
      format('SELECT count(*) = 12 FROM public.cross_company_audit WHERE action = %L AND owner_company_id IN (%L,%L,%L)', 'group_capabilities', cA, cB, cC), '', ''],
    -- ===== rz_leave_group continua igual
    ARRAY['preparar: partilha C->B aprovada', '', 'f', '', 'ok',
      format('INSERT INTO public.company_shares (owner_company_id, grantee_company_id, capability, status, origin, approved_at) VALUES (%L,%L,%L,%L,%L,now())', cC, cB, 'directory.read', 'aprovado', 'pedido'), '', ''],
    ARRAY['sair do grupo: rz_leave_group(C) continua a funcionar', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_leave_group(%L)', cC), '1', ''],
    ARRAY['sair do grupo: C saiu, C->B revogada com motivo, o grupo fica com A e B, C->D intacta', '', 'q', '', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.company_group_members WHERE company_id = %L AND status = %L) AND EXISTS (SELECT 1 FROM public.company_shares WHERE owner_company_id = %L AND grantee_company_id = %L AND status = %L AND revoke_reason = %L) AND (SELECT count(*) FROM public.company_group_members WHERE group_id = public.zz_l2_gid(%L) AND status = %L) = 2 AND EXISTS (SELECT 1 FROM public.company_shares WHERE owner_company_id = %L AND grantee_company_id = %L AND status = %L)',
             cC, 'saiu', cC, cB, 'revogado', 'Saída do grupo', cA, 'ativo', cC, cD, 'aprovado'), '', ''],
    -- ===== dissolver
    ARRAY['dissolver: admin de empresa', a1::text, 'f', 'authenticated', '42501',
      format('SELECT public.rz_dissolve_group(public.zz_l2_gid(%L))', cD), '1', ''],
    ARRAY['dissolver: sem login recente', sp::text, 'f', 'authenticated', 'RZ401',
      format('SELECT public.rz_dissolve_group(public.zz_l2_gid(%L))', cD), '', 'palavra-passe'],
    ARRAY['dissolver: grupo inexistente', sp::text, 'f', 'authenticated', '02000',
      'SELECT public.rz_dissolve_group(gen_random_uuid())', '1', ''],
    ARRAY['preparar: partilha D->E aprovada', '', 'f', '', 'ok',
      format('INSERT INTO public.company_shares (owner_company_id, grantee_company_id, capability, status, origin, approved_at) VALUES (%L,%L,%L,%L,%L,now())', cD, cE, 'directory.read', 'aprovado', 'pedido'), '', ''],
    ARRAY['dissolver: grupo de D e E', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_dissolve_group(public.zz_l2_gid(%L))', cD), '1', ''],
    ARRAY['dissolver: D->E revogada com motivo; as pertencas ficam com status saiu (nada apagado)', '', 'q', '', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.company_shares WHERE owner_company_id = %L AND grantee_company_id = %L AND status = %L AND revoke_reason = %L) AND (SELECT count(*) FROM public.company_group_members WHERE company_id IN (%L,%L) AND status = %L AND left_at IS NOT NULL) = 2 AND NOT EXISTS (SELECT 1 FROM public.company_group_members WHERE company_id IN (%L,%L) AND status = %L)',
             cD, cE, 'revogado', 'Grupo dissolvido', cD, cE, 'saiu', cD, cE, 'ativo'), '', ''],
    ARRAY['dissolver: auditoria group_dissolve (2 linhas)', '', 'q', '', 'true',
      format('SELECT count(*) = 2 FROM public.cross_company_audit WHERE action = %L AND owner_company_id IN (%L,%L)', 'group_dissolve', cD, cE), '', ''],
    ARRAY['dissolver: dissolver outra vez ja nao encontra o grupo', sp::text, 'f', 'authenticated', '02000',
      format('SELECT public.rz_dissolve_group(public.zz_l2_gid(%L))', cD), '1', ''],
    ARRAY['dissolver: empresas de um grupo dissolvido podem entrar noutro', sp::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_create_group(%L, ARRAY[%L,%L]::uuid[])', 'ZZ L2 G3', cD, cE), '1', ''],
    -- ===== leituras
    ARRAY['listar grupos: super admin ve o grupo e os modulos por defeito', sp::text, 'q', '', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.rz_list_groups() WHERE group_name = %L AND default_capabilities = ARRAY[%L,%L]::text[])', 'ZZ L2 renomeado', 'directory.read', 'feed.read'), '1', ''],
    ARRAY['listar grupos: admin de empresa continua recusado', a1::text, 'f', 'authenticated', '42501',
      'SELECT * FROM public.rz_list_groups()', '1', ''],
    ARRAY['listar o meu grupo: admin de A ve A e B com os modulos', a1::text, 'q', '', 'true',
      format('SELECT (SELECT count(*) FROM public.rz_list_group(%L)) = 2 AND (SELECT bool_and(default_capabilities = ARRAY[%L,%L]::text[]) FROM public.rz_list_group(%L))', cA, 'directory.read', 'feed.read', cA), '1', ''],
    ARRAY['listar o meu grupo: colaborador de A nao ve o grupo de outra empresa', c1::text, 'f', 'authenticated', '42501',
      format('SELECT * FROM public.rz_list_group(%L)', cE), '1', ''],
    -- ===== permissoes e forma
    ARRAY['permissoes: anon sem EXECUTE nas 7 funcoes publicas', '', 'q', '', 'true',
      'SELECT bool_and(NOT has_function_privilege(''anon'', p, ''EXECUTE'')) FROM unnest(' || v_pub || ') p', '', ''],
    ARRAY['permissoes: authenticated e service_role com EXECUTE nas 7 funcoes publicas', '', 'q', '', 'true',
      'SELECT bool_and(has_function_privilege(''authenticated'', p, ''EXECUTE'') AND has_function_privilege(''service_role'', p, ''EXECUTE'')) FROM unnest(' || v_pub || ') p', '', ''],
    ARRAY['permissoes: internas so para service_role', '', 'q', '', 'true',
      'SELECT bool_and(NOT has_function_privilege(''anon'', p, ''EXECUTE'') AND NOT has_function_privilege(''authenticated'', p, ''EXECUTE'') AND has_function_privilege(''service_role'', p, ''EXECUTE'')) FROM unnest(' || v_int || ') p', '', ''],
    ARRAY['permissoes: rz_leave_group continua so para authenticated e service_role', '', 'q', '', 'true',
      'SELECT NOT has_function_privilege(''anon'', ''public.rz_leave_group(uuid)'', ''EXECUTE'') AND has_function_privilege(''authenticated'', ''public.rz_leave_group(uuid)'', ''EXECUTE'')', '', ''],
    ARRAY['forma: SECURITY DEFINER com search_path fixo nas 12 funcoes que consultam ou escrevem', '', 'q', '', 'true',
      'SELECT count(*) = 12 AND bool_and(p.prosecdef AND coalesce(p.proconfig::text, '''') LIKE ''%search_path=public%'') FROM pg_proc p WHERE p.pronamespace = ''public''::regnamespace AND p.proname IN (''rz_group_assert_super'', ''rz_group_caps'', ''rz_group_check_companies'', ''rz_group_revoke_between'', ''rz_group_audit'', ''rz_create_group'', ''rz_rename_group'', ''rz_set_group_members'', ''rz_set_group_capabilities'', ''rz_dissolve_group'', ''rz_list_groups'', ''rz_list_group'')', '', ''],
    ARRAY['forma: CHECKs alargados (origem manual e acoes group_*)', '', 'q', '', 'true',
      'SELECT (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = ''company_group_members_origin_check'' AND conrelid = ''public.company_group_members''::regclass) LIKE ''%manual%'' AND (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = ''cross_company_audit_action_check'' AND conrelid = ''public.cross_company_audit''::regclass) LIKE ''%group_dissolve%''', '', ''],
    ARRAY['forma: coluna default_capabilities nao nula, por defeito vazia', '', 'q', '', 'true',
      'SELECT is_nullable = ''NO'' AND column_default LIKE ''%{}%'' FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''company_groups'' AND column_name = ''default_capabilities''', '', '']
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
    E'\nRESULTADO LOTE 2: ' || v_pass || ' ok, ' || v_fail || ' falhas, ' || array_length(v_defs, 1) || ' testes' ||
    E'\n' || regexp_replace(translate(v_rep, '<>"', '   '), '[^ -~' || E'\n' || ']', '?', 'g');
END
$t$;
