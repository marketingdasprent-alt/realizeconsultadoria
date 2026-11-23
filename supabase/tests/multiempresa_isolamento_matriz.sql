-- Matriz de isolamento entre empresas (QA). NÃO altera nada de forma permanente: cria dados sintéticos,
-- corre a matriz como utilizador "authenticated" e termina SEMPRE com RAISE EXCEPTION (anula a transação).
-- O relatório vem na mensagem do erro, entre FP_BEGIN e FP_END. A mensagem vermelha é o relatório.
--
-- COMO LER: cada teste descreve o comportamento CORRETO (depois dos PRs multi-empresa). Hoje falham os
-- que provam as falhas conhecidas (admin da empresa A mexe na B em companies, employees, absences,
-- user_roles, admin_groups*; qualquer admin cria empresas/grupos). Prefixos: [CTRL] controlo positivo
-- (tem de passar sempre: prova que a matriz não passa só por bloquear tudo), [ISOL] isolamento,
-- [ESC] escalada de privilégios, [SUPER] super admin, [GRUPO] partilha do feed, [EXT] empresa externa,
-- [FORMA] estado das policies.
--
-- Cenário: A e B no mesmo grupo (feed.read); C externa, sem grupo; D vazia (para criar grupos).
-- Cada empresa tem dados em employees, absences, absence_periods, employee_monthly_finances,
-- employee_documents, time_clock_entries e feed_posts. Papéis:
--   sa = super admin (platform_admins)      adA / adB / adC = admin da empresa (role admin + pertença admin)
--   adM = admin de A só com pertença (sem user_roles)     adN = admin de A sem ficha (feed)
--   cA / cB / cC = colaboradores
-- Cada teste corre isolado (o efeito é desfeito no fim). Esperado DEPOIS dos PRs: 0 falhas.
-- Pré-requisitos: migrações até 20261120160000. 'ERR' como esperado = qualquer erro SQL é o resultado certo.

DO $t$
DECLARE
  sa uuid; adA uuid; adB uuid; adC uuid; adM uuid; adN uuid; cA uuid; cB uuid; cC uuid;
  kA uuid; kB uuid; kC uuid; kD uuid;   -- empresas
  eA uuid; eB uuid; eC uuid;            -- fichas dos colaboradores
  abA uuid; abB uuid; abC uuid;         -- ausências
  fA uuid; fB uuid; fC uuid;            -- finanças
  dA uuid; dB uuid; dC uuid;            -- documentos
  tA uuid; tB uuid; tC uuid;            -- ponto
  pA uuid; pB uuid; pC uuid;            -- publicações do feed
  gShare uuid; gSuper uuid;
  v_nif text := 'ZZ' || substr(upper(md5(gen_random_uuid()::text)), 1, 8);
  v_defs text[];
  v_i integer; v_k integer;
  v_who uuid; v_got text; v_bool boolean; v_claims text;
  v_rep text := ''; v_pass integer := 0; v_fail integer := 0;
  v_name text; v_expect text;
  v_names text[] := ARRAY['sa','adA','adB','adC','adM','adN','cA','cB','cC'];
  v_ids uuid[];
BEGIN
  -- ---------------------------------------------------------------- preparação
  BEGIN
    v_ids := ARRAY[]::uuid[];
    FOR v_k IN 1 .. array_length(v_names, 1) LOOP
      v_ids := v_ids || gen_random_uuid();
      INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
      VALUES (v_ids[v_k], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'zz-iso-' || lower(v_names[v_k]) || '@invalid.example', now(), now());
    END LOOP;
    sa := v_ids[1]; adA := v_ids[2]; adB := v_ids[3]; adC := v_ids[4]; adM := v_ids[5]; adN := v_ids[6];
    cA := v_ids[7]; cB := v_ids[8]; cC := v_ids[9];

    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ ISO A', v_nif || 'A', 'a@invalid.example') RETURNING id INTO kA;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ ISO B', v_nif || 'B', 'b@invalid.example') RETURNING id INTO kB;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ ISO C', v_nif || 'C', 'c@invalid.example') RETURNING id INTO kC;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ ISO D', v_nif || 'D', 'd@invalid.example') RETURNING id INTO kD;
    INSERT INTO public.company_groups (name, default_capabilities) VALUES ('ZZ ISO G', ARRAY['feed.read']) RETURNING id INTO gShare;
    INSERT INTO public.company_group_members (group_id, company_id, status, origin)
    VALUES (gShare, kA, 'ativo', 'manual'), (gShare, kB, 'ativo', 'manual');

    -- Fichas (o gatilho da Fase B cria as pertenças de colaborador).
    INSERT INTO public.employees (company_id, user_id, name, email, department) VALUES (kA, cA, 'ZZ ISO cA', 'zz-iso-ca@invalid.example', 'Vendas') RETURNING id INTO eA;
    INSERT INTO public.employees (company_id, user_id, name, email, department) VALUES (kB, cB, 'ZZ ISO cB', 'zz-iso-cb@invalid.example', 'Vendas') RETURNING id INTO eB;
    INSERT INTO public.employees (company_id, user_id, name, email, department) VALUES (kC, cC, 'ZZ ISO cC', 'zz-iso-cc@invalid.example', 'Vendas') RETURNING id INTO eC;
    INSERT INTO public.employees (company_id, user_id, name, email, department) VALUES (kA, adA, 'ZZ ISO adA', 'zz-iso-ada@invalid.example', 'Gestao');
    INSERT INTO public.employees (company_id, user_id, name, email, department) VALUES (kB, adB, 'ZZ ISO adB', 'zz-iso-adb@invalid.example', 'Gestao');
    INSERT INTO public.employees (company_id, user_id, name, email, department) VALUES (kC, adC, 'ZZ ISO adC', 'zz-iso-adc@invalid.example', 'Gestao');

    -- Papéis. adA/adB/adC: role admin global (modelo antigo) + pertença admin. adM e adN: só pertença.
    INSERT INTO public.user_roles (user_id, role) VALUES (adA, 'admin'), (adB, 'admin'), (adC, 'admin');
    INSERT INTO public.company_memberships (company_id, user_id, role, origin, status)
    VALUES (kA, adA, 'admin', 'convite', 'ativo'), (kB, adB, 'admin', 'convite', 'ativo'),
           (kC, adC, 'admin', 'convite', 'ativo'), (kA, adM, 'admin', 'convite', 'ativo'),
           (kA, adN, 'admin', 'convite', 'ativo')
    ON CONFLICT (company_id, user_id) DO UPDATE SET role = 'admin', status = 'ativo';
    INSERT INTO public.platform_admins (user_id, active, mfa_required) VALUES (sa, true, false);
    -- Grupo de UI com is_super_admin (o caminho de escalada conhecido).
    INSERT INTO public.admin_groups (name, is_super_admin) VALUES ('ZZ ISO Super ' || v_nif, true) RETURNING id INTO gSuper;

    -- Dados por empresa.
    INSERT INTO public.absences (employee_id, company_id, absence_type, start_date, end_date, status)
    VALUES (eA, kA, 'vacation', current_date + 40, current_date + 41, 'pending') RETURNING id INTO abA;
    INSERT INTO public.absences (employee_id, company_id, absence_type, start_date, end_date, status)
    VALUES (eB, kB, 'vacation', current_date + 40, current_date + 41, 'pending') RETURNING id INTO abB;
    INSERT INTO public.absences (employee_id, company_id, absence_type, start_date, end_date, status)
    VALUES (eC, kC, 'vacation', current_date + 40, current_date + 41, 'pending') RETURNING id INTO abC;
    INSERT INTO public.absence_periods (absence_id, start_date, end_date, business_days)
    VALUES (abA, current_date + 40, current_date + 41, 2), (abB, current_date + 40, current_date + 41, 2),
           (abC, current_date + 40, current_date + 41, 2);
    INSERT INTO public.employee_monthly_finances (employee_id, year, month, valor_recebido) VALUES (eA, 2099, 1, 1000) RETURNING id INTO fA;
    INSERT INTO public.employee_monthly_finances (employee_id, year, month, valor_recebido) VALUES (eB, 2099, 1, 1000) RETURNING id INTO fB;
    INSERT INTO public.employee_monthly_finances (employee_id, year, month, valor_recebido) VALUES (eC, 2099, 1, 1000) RETURNING id INTO fC;
    INSERT INTO public.employee_documents (employee_id, file_name, file_path, file_size, mime_type, uploaded_by) VALUES (eA, 'a.pdf', 'zz/a.pdf', 1, 'application/pdf', adA) RETURNING id INTO dA;
    INSERT INTO public.employee_documents (employee_id, file_name, file_path, file_size, mime_type, uploaded_by) VALUES (eB, 'b.pdf', 'zz/b.pdf', 1, 'application/pdf', adB) RETURNING id INTO dB;
    INSERT INTO public.employee_documents (employee_id, file_name, file_path, file_size, mime_type, uploaded_by) VALUES (eC, 'c.pdf', 'zz/c.pdf', 1, 'application/pdf', adC) RETURNING id INTO dC;
    INSERT INTO public.time_clock_entries (employee_id, company_id, entry_type, source) VALUES (eA, kA, 'in', 'admin') RETURNING id INTO tA;
    INSERT INTO public.time_clock_entries (employee_id, company_id, entry_type, source) VALUES (eB, kB, 'in', 'admin') RETURNING id INTO tB;
    INSERT INTO public.time_clock_entries (employee_id, company_id, entry_type, source) VALUES (eC, kC, 'in', 'admin') RETURNING id INTO tC;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (kA, cA, 'ZZ A toda', 'company') RETURNING id INTO pA;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (kB, cB, 'ZZ B toda', 'company') RETURNING id INTO pB;
    INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (kC, cC, 'ZZ C toda', 'company') RETURNING id INTO pC;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FP_BEGIN%FP_END',
      'ERRO NA PREPARACAO: ' || regexp_replace(translate(SQLERRM, '<>"', '   '), '[^ -~]', '?', 'g');
  END;

  -- ---------------------------------------------------------------- testes
  -- Cada linha: 1 nome, 2 quem chama (uuid), 3 tipo (f = executar; q = consulta booleana),
  -- 4 papel, 5 esperado (ok, true, false, ERR ou SQLSTATE), 6 SQL.
  v_defs := ARRAY[
    -- ===== [CTRL] controlos positivos
    ARRAY['[CTRL] adA le a propria empresa e as fichas de A', adA::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = %L) AND EXISTS (SELECT 1 FROM public.employees WHERE id = %L)', kA, eA)],
    ARRAY['[CTRL] adA le financas, documentos e ponto de A', adA::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.employee_monthly_finances WHERE id = %L) AND EXISTS (SELECT 1 FROM public.employee_documents WHERE id = %L) AND EXISTS (SELECT 1 FROM public.time_clock_entries WHERE id = %L)', fA, dA, tA)],
    ARRAY['[CTRL] adA gere ausencias de A (aprovar)', adA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.absences SET status = ''approved'' WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', abA)],
    ARRAY['[CTRL] adM (so pertenca admin, sem user_roles) gere A', adM::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.employee_monthly_finances WHERE id = %L) AND EXISTS (SELECT 1 FROM public.employees WHERE id = %L)', fA, eA)],
    ARRAY['[CTRL] colaborador cA le a propria ficha e a propria ausencia', cA::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.employees WHERE id = %L) AND EXISTS (SELECT 1 FROM public.absences WHERE id = %L)', eA, abA)],
    ARRAY['[CTRL] colaborador cA ve o feed da propria empresa', cA::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pA)],
    ARRAY['[CTRL] adC (externa) gere a propria empresa C', adC::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.employee_monthly_finances WHERE id = %L) AND EXISTS (SELECT 1 FROM public.employees WHERE id = %L)', fC, eC)],

    -- ===== [ISOL] leitura: admin de A nao le a empresa externa C (nem financas/documentos do par B)
    ARRAY['[ISOL] adA nao ve a empresa C', adA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = %L)', kC)],
    ARRAY['[ISOL] adA nao ve fichas de C', adA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.employees WHERE company_id = %L)', kC)],
    ARRAY['[ISOL] adA nao ve ausencias de C', adA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.absences WHERE company_id = %L) OR EXISTS (SELECT 1 FROM public.absence_periods WHERE absence_id = %L)', kC, abC)],
    ARRAY['[ISOL] adA nao ve financas de C', adA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.employee_monthly_finances WHERE employee_id = %L)', eC)],
    ARRAY['[ISOL] adA nao ve documentos de C', adA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.employee_documents WHERE employee_id = %L)', eC)],
    ARRAY['[ISOL] adA nao ve ponto de C', adA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.time_clock_entries WHERE company_id = %L)', kC)],
    ARRAY['[ISOL] adA nao ve o feed de C', adA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pC)],
    ARRAY['[ISOL] adA nao ve user_roles nem pertencas de C', adA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = %L) OR EXISTS (SELECT 1 FROM public.company_memberships WHERE company_id = %L)', adC, kC)],
    -- par B (mesmo grupo: so o feed e partilhado)
    ARRAY['[ISOL] adA nao ve fichas do par B (grupo so partilha o feed)', adA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.employees WHERE company_id = %L)', kB)],
    ARRAY['[ISOL] adA nao ve financas nem documentos do par B', adA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.employee_monthly_finances WHERE id = %L) OR EXISTS (SELECT 1 FROM public.employee_documents WHERE id = %L)', fB, dB)],
    ARRAY['[ISOL] adA nao ve ausencias nem ponto do par B', adA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.absences WHERE id = %L) OR EXISTS (SELECT 1 FROM public.time_clock_entries WHERE id = %L)', abB, tB)],
    -- colaborador A
    ARRAY['[ISOL] colaborador cA nao ve fichas de C', cA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.employees WHERE company_id = %L)', kC)],
    ARRAY['[ISOL] colaborador cA nao ve ausencias, financas, documentos nem ponto de C', cA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.absences WHERE id = %L) OR EXISTS (SELECT 1 FROM public.employee_monthly_finances WHERE id = %L) OR EXISTS (SELECT 1 FROM public.employee_documents WHERE id = %L) OR EXISTS (SELECT 1 FROM public.time_clock_entries WHERE id = %L)', abC, fC, dC, tC)],
    ARRAY['[ISOL] colaborador cA nao ve fichas, ausencias, financas nem ponto do par B', cA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.employees WHERE company_id = %L) OR EXISTS (SELECT 1 FROM public.absences WHERE id = %L) OR EXISTS (SELECT 1 FROM public.employee_monthly_finances WHERE id = %L) OR EXISTS (SELECT 1 FROM public.time_clock_entries WHERE id = %L)', kB, abB, fB, tB)],
    ARRAY['[ISOL] colaborador cA nao ve o feed de C', cA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pC)],
    ARRAY['[ISOL] colaborador cA nao ve user_roles de outros', cA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id IN (%L, %L))', adA, adC)],
    -- sentido inverso: C nao ve A nem B
    ARRAY['[ISOL] adC nao ve fichas, ausencias, financas, documentos nem ponto de A e B', adC::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.employees WHERE company_id IN (%L,%L)) OR EXISTS (SELECT 1 FROM public.absences WHERE company_id IN (%L,%L)) OR EXISTS (SELECT 1 FROM public.employee_monthly_finances WHERE id IN (%L,%L)) OR EXISTS (SELECT 1 FROM public.employee_documents WHERE id IN (%L,%L)) OR EXISTS (SELECT 1 FROM public.time_clock_entries WHERE company_id IN (%L,%L))', kA, kB, kA, kB, fA, fB, dA, dB, kA, kB)],
    ARRAY['[ISOL] adC nao ve as empresas A e B', adC::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.companies WHERE id IN (%L,%L))', kA, kB)],
    ARRAY['[ISOL] adC nao ve user_roles nem pertencas de A e B', adC::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id IN (%L,%L)) OR EXISTS (SELECT 1 FROM public.company_memberships WHERE company_id IN (%L,%L))', adA, adB, kA, kB)],

    -- ===== [ISOL] escrita cross-empresa
    ARRAY['[ISOL] adA nao altera a empresa C (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.companies SET name = ''HACK'' WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', kC)],
    ARRAY['[ISOL] adA nao apaga a empresa C (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH d AS (DELETE FROM public.companies WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM d', kC)],
    ARRAY['[ISOL] adA nao apaga a empresa B do par (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH d AS (DELETE FROM public.companies WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM d', kB)],
    ARRAY['[ISOL] adA nao altera fichas de C (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.employees SET name = ''HACK'' WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', eC)],
    ARRAY['[ISOL] adA nao altera fichas do par B (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.employees SET name = ''HACK'' WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', eB)],
    ARRAY['[ISOL] adA nao apaga fichas de C (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH d AS (DELETE FROM public.employees WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM d', eC)],
    ARRAY['[ISOL] adA nao cria ficha em C', adA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.employees (company_id, name, email, department) VALUES (%L, ''Intruso'', ''zz-iso-x@invalid.example'', ''X'')', kC)],
    ARRAY['[ISOL] adA nao decide ausencias de C (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.absences SET status = ''approved'' WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', abC)],
    ARRAY['[ISOL] adA nao decide ausencias do par B (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.absences SET status = ''approved'' WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', abB)],
    ARRAY['[ISOL] adA nao cria ausencia em C', adA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.absences (employee_id, company_id, absence_type, start_date, end_date) VALUES (%L, %L, ''vacation'', current_date + 90, current_date + 91)', eC, kC)],
    ARRAY['[ISOL] adA nao altera financas de C (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.employee_monthly_finances SET valor_recebido = 1 WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', fC)],
    ARRAY['[ISOL] adA nao apaga documentos de C (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH d AS (DELETE FROM public.employee_documents WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM d', dC)],
    ARRAY['[ISOL] adA nao anula ponto de C (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.time_clock_entries SET status = ''voided'' WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', tC)],
    ARRAY['[ISOL] adA nao cria ponto em C', adA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.time_clock_entries (employee_id, company_id, entry_type, source) VALUES (%L, %L, ''in'', ''admin'')', eC, kC)],
    ARRAY['[ISOL] adA nao publica no feed de C', adA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (%L, %L, ''intruso'', ''company'')', kC, adA)],
    ARRAY['[ISOL] colaborador cA nao altera a ficha de C (0 linhas)', cA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.employees SET name = ''HACK'' WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', eC)],
    ARRAY['[ISOL] colaborador cA nao cria ausencia em nome de colega de C', cA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.absences (employee_id, company_id, absence_type, start_date, end_date) VALUES (%L, %L, ''vacation'', current_date + 90, current_date + 91)', eC, kC)],
    ARRAY['[ISOL] adC nao altera fichas, ausencias nem financas de A e B (0 linhas)', adC::text, 'q', 'authenticated', 'true',
      format('WITH u1 AS (UPDATE public.employees SET name = ''HACK'' WHERE id IN (%L,%L) RETURNING 1), u2 AS (UPDATE public.absences SET status = ''approved'' WHERE id IN (%L,%L) RETURNING 1), u3 AS (UPDATE public.employee_monthly_finances SET valor_recebido = 1 WHERE id IN (%L,%L) RETURNING 1) SELECT (SELECT count(*) FROM u1) + (SELECT count(*) FROM u2) + (SELECT count(*) FROM u3) = 0', eA, eB, abA, abB, fA, fB)],

    -- ===== [ESC] escalada de privilegios
    ARRAY['[ESC] adA nao da role admin a conta de C (user_roles)', adA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.user_roles (user_id, role) VALUES (%L, ''admin'')', cC)],
    ARRAY['[ESC] adA nao da role admin global a conta da propria empresa (so por pertenca)', adA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.user_roles (user_id, role) VALUES (%L, ''admin'')', cA)],
    ARRAY['[ESC] adA nao retira o role do admin de C (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH d AS (DELETE FROM public.user_roles WHERE user_id = %L RETURNING 1) SELECT count(*) = 0 FROM d', adC)],
    ARRAY['[ESC] adA nao se poe no grupo is_super_admin (admin_group_members)', adA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.admin_group_members (group_id, user_id) VALUES (%L, %L)', gSuper, adA)],
    ARRAY['[ESC] adA nao cria grupo de admin com is_super_admin', adA::text, 'f', 'authenticated', '42501',
      'INSERT INTO public.admin_groups (name, is_super_admin) VALUES (''ZZ ISO hack'', true)'],
    ARRAY['[ESC] adA nao promove um grupo existente a is_super_admin (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.admin_groups SET is_super_admin = true WHERE id <> %L RETURNING 1) SELECT count(*) = 0 FROM u', gSuper)],
    ARRAY['[ESC] adA nao apaga o grupo is_super_admin (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH d AS (DELETE FROM public.admin_groups WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM d', gSuper)],
    ARRAY['[ESC] adA nao da permissoes a grupos de admin', adA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.admin_group_permissions (group_id, module_key, can_view, can_edit) VALUES (%L, ''zz'', true, true)', gSuper)],
    ARRAY['[ESC] adA nao se promove a super admin (platform_admins)', adA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.platform_admins (user_id, active, mfa_required) VALUES (%L, true, false)', adA)],
    ARRAY['[ESC] adA nao e super admin (rz_is_super_admin)', adA::text, 'q', 'authenticated', 'false',
      'SELECT public.rz_is_super_admin()'],
    ARRAY['[ESC] adA nao se junta como admin a empresa C (company_memberships)', adA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES (%L, %L, ''admin'', ''convite'', ''ativo'')', kC, adA)],
    ARRAY['[ESC] adA nao altera pertencas de C (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.company_memberships SET role = ''colaborador'' WHERE company_id = %L RETURNING 1) SELECT count(*) = 0 FROM u', kC)],
    ARRAY['[ESC] adA nao faz admin de C via rz_add_company_admin', adA::text, 'f', 'authenticated', 'ERR',
      format('SELECT public.rz_add_company_admin(%L, %L, ''admin'')', kC, cA)],
    ARRAY['[ESC] adA nao faz admin do par B via rz_add_company_admin', adA::text, 'f', 'authenticated', 'ERR',
      format('SELECT public.rz_add_company_admin(%L, %L, ''admin'')', kB, cA)],
    ARRAY['[ESC] adA nao remove admin de C via rz_remove_company_admin', adA::text, 'f', 'authenticated', 'ERR',
      format('SELECT public.rz_remove_company_admin(%L, %L)', kC, adC)],
    ARRAY['[ESC] adA nao cria empresa (insert direto)', adA::text, 'f', 'authenticated', '42501',
      'INSERT INTO public.companies (name, nif, email) VALUES (''ZZ ISO hack'', ''ZZHACK0001'', ''h@invalid.example'')'],
    ARRAY['[ESC] adA nao cria empresa (rz_create_company)', adA::text, 'f', 'authenticated', 'ERR',
      format('SELECT public.rz_create_company(''ZZ ISO X'', %L, ''x@invalid.example'', NULL, NULL, %L)', v_nif || 'X1', adA)],
    ARRAY['[ESC] adA nao cria grupo de empresas', adA::text, 'f', 'authenticated', 'ERR',
      format('SELECT public.rz_create_group(''ZZ ISO GX'', ARRAY[%L,%L]::uuid[], ARRAY[''feed.read'']::text[])', kC, kD)],
    ARRAY['[ESC] adA nao muda membros de grupos (rz_set_group_members)', adA::text, 'f', 'authenticated', 'ERR',
      format('SELECT public.rz_set_group_members(%L, ARRAY[%L,%L,%L]::uuid[])', gShare, kA, kB, kC)],
    ARRAY['[ESC] adA nao dissolve grupos (rz_dissolve_group)', adA::text, 'f', 'authenticated', 'ERR',
      format('SELECT public.rz_dissolve_group(%L)', gShare)],
    ARRAY['[ESC] adA nao altera company_groups (0 linhas)', adA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.company_groups SET default_capabilities = ARRAY[''feed.read'',''employees.read''] WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', gShare)],
    ARRAY['[ESC] colaborador cA nao cria empresa', cA::text, 'f', 'authenticated', 'ERR',
      format('SELECT public.rz_create_company(''ZZ ISO Y'', %L, ''y@invalid.example'', NULL, NULL, %L)', v_nif || 'Y1', cA)],
    ARRAY['[ESC] colaborador cA nao se da admin (user_roles)', cA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.user_roles (user_id, role) VALUES (%L, ''admin'')', cA)],
    ARRAY['[ESC] colaborador cA nao se faz admin (company_memberships, 0 linhas)', cA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.company_memberships SET role = ''admin'' WHERE company_id = %L AND user_id = %L RETURNING 1) SELECT count(*) = 0 FROM u', kA, cA)],
    ARRAY['[ESC] adC (externa) nao faz admin de A', adC::text, 'f', 'authenticated', 'ERR',
      format('SELECT public.rz_add_company_admin(%L, %L, ''admin'')', kA, cC)],

    -- ===== [SUPER] super admin
    ARRAY['[SUPER] sa e super admin', sa::text, 'q', 'authenticated', 'true', 'SELECT public.rz_is_super_admin()'],
    ARRAY['[SUPER] sa ve as 3 empresas', sa::text, 'q', 'authenticated', 'true',
      format('SELECT (SELECT count(*) FROM public.companies WHERE id IN (%L,%L,%L)) = 3', kA, kB, kC)],
    ARRAY['[SUPER] sa ve fichas, ausencias, financas, documentos, ponto e feed de todas', sa::text, 'q', 'authenticated', 'true',
      format('SELECT (SELECT count(*) FROM public.employees WHERE company_id IN (%L,%L,%L)) = 6 AND (SELECT count(*) FROM public.absences WHERE id IN (%L,%L,%L)) = 3 AND (SELECT count(*) FROM public.employee_monthly_finances WHERE id IN (%L,%L,%L)) = 3 AND (SELECT count(*) FROM public.employee_documents WHERE id IN (%L,%L,%L)) = 3 AND (SELECT count(*) FROM public.time_clock_entries WHERE id IN (%L,%L,%L)) = 3 AND (SELECT count(*) FROM public.feed_posts WHERE id IN (%L,%L,%L)) = 3', kA, kB, kC, abA, abB, abC, fA, fB, fC, dA, dB, dC, tA, tB, tC, pA, pB, pC)],
    ARRAY['[SUPER] sa altera uma ficha de qualquer empresa', sa::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.employees SET department = ''Novo'' WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', eC)],
    ARRAY['[SUPER] sa cria empresa externa e o 1.o admin fica ligado a ela (company_memberships)', sa::text, 'f', 'authenticated', 'ok',
      format('DO $x$ BEGIN PERFORM public.rz_create_company(''ZZ ISO NOVA'', %L, ''n@invalid.example'', NULL, NULL, %L); IF NOT EXISTS (SELECT 1 FROM public.company_memberships m JOIN public.companies c ON c.id = m.company_id WHERE c.nif = %L AND m.user_id = %L AND m.role = ''admin'' AND m.status = ''ativo'') THEN RAISE EXCEPTION ''empresa sem admin''; END IF; END $x$',
        v_nif || 'N1', adN, v_nif || 'N1', adN)],
    ARRAY['[SUPER] sa cria grupo de empresas', sa::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_create_group(''ZZ ISO G2'', ARRAY[%L,%L]::uuid[], ARRAY[''feed.read'']::text[])', kC, kD)],
    ARRAY['[SUPER] sa nomeia admin de empresa (rz_add_company_admin)', sa::text, 'f', 'authenticated', 'ok',
      format('SELECT public.rz_add_company_admin(%L, %L, ''admin'')', kB, cB)],
    ARRAY['[SUPER] sa edita grupos de admin', sa::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.admin_groups SET description = ''x'' WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', gSuper)],

    -- ===== [GRUPO] A e B partilham o feed em leitura, e so isso
    ARRAY['[GRUPO] cA ve a publicacao de B', cA::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pB)],
    ARRAY['[GRUPO] cB ve a publicacao de A (simetrico)', cB::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pA)],
    ARRAY['[GRUPO] adA ve a publicacao de B', adA::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pB)],
    ARRAY['[GRUPO] feed_list_posts de cA traz A e B mas nao C', cA::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_list_posts(NULL, 200) p WHERE p.id = %L) AND EXISTS (SELECT 1 FROM public.feed_list_posts(NULL, 200) p WHERE p.id = %L) AND NOT EXISTS (SELECT 1 FROM public.feed_list_posts(NULL, 200) p WHERE p.id = %L)', pA, pB, pC)],
    ARRAY['[GRUPO] cA nao comenta em B (so leitura)', cA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.feed_comments (post_id, author_id, body) VALUES (%L, %L, ''ola'')', pB, cA)],
    ARRAY['[GRUPO] cA nao publica no feed de B', cA::text, 'f', 'authenticated', '42501',
      format('INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (%L, %L, ''intruso'', ''company'')', kB, cA)],
    ARRAY['[GRUPO] o par nao edita nem apaga a publicacao de B (0 linhas)', cA::text, 'q', 'authenticated', 'true',
      format('WITH u AS (UPDATE public.feed_posts SET body = ''x'' WHERE id = %L RETURNING 1), d AS (DELETE FROM public.feed_posts WHERE id = %L RETURNING 1) SELECT (SELECT count(*) FROM u) + (SELECT count(*) FROM d) = 0', pB, pB)],
    ARRAY['[GRUPO] adN (admin de A sem ficha) ve o feed de A', adN::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pA)],
    ARRAY['[GRUPO] adN (admin de A sem ficha) ve o feed do par B', adN::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pB)],

    -- ===== [EXT] empresa externa
    ARRAY['[EXT] cC ve so o feed de C', cC::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L) AND NOT EXISTS (SELECT 1 FROM public.feed_posts WHERE id IN (%L,%L))', pC, pA, pB)],
    ARRAY['[EXT] adC ve so o feed de C', adC::text, 'q', 'authenticated', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L) AND NOT EXISTS (SELECT 1 FROM public.feed_posts WHERE id IN (%L,%L))', pC, pA, pB)],
    ARRAY['[EXT] feed_list_posts de adC nao traz A nem B', adC::text, 'q', 'authenticated', 'true',
      format('SELECT NOT EXISTS (SELECT 1 FROM public.feed_list_posts(NULL, 200) p WHERE p.id IN (%L,%L)) AND EXISTS (SELECT 1 FROM public.feed_list_posts(NULL, 200) p WHERE p.id = %L)', pA, pB, pC)],
    ARRAY['[EXT] A e B nao veem o feed de C', cA::text, 'q', 'authenticated', 'false',
      format('SELECT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = %L)', pC)],
    ARRAY['[EXT] organograma de C: cC so ve fichas de C', cC::text, 'q', 'authenticated', 'true',
      format('SELECT (SELECT count(*) FROM public.employees WHERE company_id = %L) >= 1 AND NOT EXISTS (SELECT 1 FROM public.employees WHERE company_id <> %L)', kC, kC)],
    ARRAY['[EXT] organograma de C: adC so ve fichas de C', adC::text, 'q', 'authenticated', 'true',
      format('SELECT (SELECT count(*) FROM public.employees WHERE company_id = %L) >= 2 AND NOT EXISTS (SELECT 1 FROM public.employees WHERE company_id <> %L)', kC, kC)],
    ARRAY['[EXT] organograma de A: cA so ve fichas de A', cA::text, 'q', 'authenticated', 'true',
      format('SELECT (SELECT count(*) FROM public.employees WHERE company_id = %L) >= 1 AND NOT EXISTS (SELECT 1 FROM public.employees WHERE company_id <> %L)', kA, kA)],
    ARRAY['[EXT] adC publica no feed de C', adC::text, 'f', 'authenticated', 'ok',
      format('INSERT INTO public.feed_posts (company_id, author_id, body, audience) VALUES (%L, %L, ''ola C'', ''company'')', kC, adC)],

    -- ===== [FORMA] estado das policies (diagnostico; falha enquanto sobrar a policy global antiga)
    ARRAY['[FORMA] companies sem policy FOR ALL assente em has_role admin global', '', 'q', '', 'true',
      'SELECT NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = ''public.companies''::regclass AND polcmd = ''*'' AND pg_get_expr(polqual, polrelid) LIKE ''%has_role(%'' AND pg_get_expr(polqual, polrelid) NOT LIKE ''%rz_%'')'],
    ARRAY['[FORMA] user_roles sem policy de gestao assente so em has_role admin', '', 'q', '', 'true',
      'SELECT NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = ''public.user_roles''::regclass AND polcmd IN (''*'',''a'',''w'',''d'') AND pg_get_expr(polqual, polrelid) LIKE ''%has_role(%'' AND pg_get_expr(polqual, polrelid) NOT LIKE ''%rz_%'')'],
    ARRAY['[FORMA] admin_groups* sem policy FOR ALL assente em has_role admin global', '', 'q', '', 'true',
      'SELECT NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid IN (''public.admin_groups''::regclass, ''public.admin_group_members''::regclass, ''public.admin_group_permissions''::regclass) AND polcmd = ''*'' AND pg_get_expr(polqual, polrelid) LIKE ''%has_role(%'' AND pg_get_expr(polqual, polrelid) NOT LIKE ''%rz_%'')'],
    ARRAY['[FORMA] employees e absences sem policy FOR ALL assente em has_role admin global', '', 'q', '', 'true',
      'SELECT NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid IN (''public.employees''::regclass, ''public.absences''::regclass) AND polcmd = ''*'' AND pg_get_expr(polqual, polrelid) LIKE ''%has_role(%'' AND pg_get_expr(polqual, polrelid) NOT LIKE ''%rz_%'')'],
    ARRAY['[FORMA] funcoes rz_ SECURITY DEFINER com search_path fixo', '', 'q', '', 'true',
      'SELECT coalesce(bool_and(coalesce(p.proconfig::text, '''') LIKE ''%search_path%''), true) FROM pg_proc p WHERE p.pronamespace = ''public''::regnamespace AND p.proname LIKE ''rz\_%'' AND p.prosecdef']
  ];

  FOR v_i IN 1 .. array_length(v_defs, 1) LOOP
    v_name := v_defs[v_i][1];
    v_who := nullif(v_defs[v_i][2], '')::uuid;
    v_expect := v_defs[v_i][5];
    v_claims := CASE WHEN v_who IS NULL THEN '{}'
      ELSE '{"sub":"' || v_who::text || '","role":"authenticated","amr":[{"method":"password","timestamp":'
           || floor(extract(epoch FROM now()))::bigint::text || '}]}' END;
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
      -- Desfaz o efeito do teste (savepoint do bloco) para não contaminar os seguintes.
      RAISE EXCEPTION 'FP_UNDO';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'FP_UNDO' THEN
        v_got := SQLSTATE;
      END IF;
    END;
    IF v_got = v_expect OR (v_expect = 'ERR' AND v_got NOT IN ('ok', 'true', 'false')) THEN
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
    E'\nRESULTADO MATRIZ ISOLAMENTO: ' || v_pass || ' ok, ' || v_fail || ' falhas, ' || array_length(v_defs, 1) || ' testes' ||
    E'\n' || regexp_replace(translate(v_rep, '<>"', '   '), '[^ -~' || E'\n' || ']', '?', 'g');
END
$t$;
