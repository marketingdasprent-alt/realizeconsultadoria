-- Ensaio da Fase C1 (multiempresa). NÃO altera nada de forma permanente: o bloco cria dados
-- sintéticos, testa cada função e cada erro, e termina SEMPRE com RAISE EXCEPTION, o que anula a
-- transação inteira. O relatório vem na mensagem do erro, entre FP_BEGIN e FP_END (ASCII simples).
--
-- Pré-requisitos: migrações até 20261118110000 aplicadas (incluindo o gatilho
-- employees_sync_membership da Fase B; sem ele os testes de pertenças falham, e o relatório avisa).
-- Correr numa única chamada (um só pedido / uma só transação). Sem ids nem emails de pessoas:
--   * utilizadores: ids lidos de user_roles que ainda não têm ficha nem pertenças; os que faltarem
--     são criados em auth.users com email @invalid.example (tudo anulado no fim);
--   * empresas sintéticas com NIF ZZ...; super admin sintético (linha em platform_admins, anulada).

DO $t$
DECLARE
  v_users uuid[] := ARRAY[]::uuid[];
  v_real  integer := 0;
  v_u     uuid;
  v_n     integer;
  a1 uuid; a2 uuid; o1 uuid; sp uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid;
  cA uuid; cB uuid; cC uuid; cD uuid; cE uuid;
  eMove uuid; eDup uuid; eDupB uuid; eNoUser uuid; eInact uuid; eX uuid; eForeign uuid;
  eB1 uuid; eB2 uuid;
  v_abs uuid;
  v_nif text := 'ZZ' || substr(upper(md5(gen_random_uuid()::text)), 1, 8);
  v_nif_new text := 'ZZ' || substr(upper(md5(gen_random_uuid()::text)), 1, 8);
  v_sync boolean;
  v_defs text[];
  v_i integer;
  v_who uuid;
  v_got text;
  v_bool boolean;
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
         -- sem papel admin global: senão a RLS antiga "admin vê tudo" falseava os testes de RLS
         AND NOT EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id = ur.user_id AND x.role = 'admin')
       LIMIT 10
    LOOP
      v_users := v_users || v_u;
    END LOOP;
    v_real := cardinality(v_users);
    v_n := 0;
    WHILE cardinality(v_users) < 10 LOOP
      v_n := v_n + 1;
      INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'zz-fp-' || v_n || '@invalid.example', now(), now())
      RETURNING id INTO v_u;
      v_users := v_users || v_u;
    END LOOP;
    a1 := v_users[1]; a2 := v_users[2]; o1 := v_users[3]; sp := v_users[4];
    c1 := v_users[5]; c2 := v_users[6]; c3 := v_users[7]; c4 := v_users[8]; c5 := v_users[9]; c6 := v_users[10];

    v_sync := EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'employees_sync_membership' AND NOT tgisinternal);

    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ Ensaio A', v_nif || 'A', 'a@invalid.example') RETURNING id INTO cA;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ Ensaio B', v_nif || 'B', 'b@invalid.example') RETURNING id INTO cB;
    INSERT INTO public.companies (name, nif, email, status) VALUES ('ZZ Ensaio C', v_nif || 'C', 'c@invalid.example', 'suspensa') RETURNING id INTO cC;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ Ensaio D', v_nif || 'D', 'd@invalid.example') RETURNING id INTO cD;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ Ensaio E', v_nif || 'E', 'e@invalid.example') RETURNING id INTO cE;

    -- a1 administra A, B, C, D; a2 só A.
    INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES
      (cA, a1, 'admin', 'convite', 'ativo'), (cB, a1, 'admin', 'convite', 'ativo'),
      (cC, a1, 'admin', 'convite', 'ativo'), (cD, a1, 'admin', 'convite', 'ativo'),
      (cA, a2, 'admin', 'convite', 'ativo');

    INSERT INTO public.platform_admins (user_id, active, mfa_required) VALUES (sp, true, false);

    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, c1, 'ZZ Move', 'zz-move@invalid.example') RETURNING id INTO eMove;
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, c2, 'ZZ Dup', 'zz-dup@invalid.example') RETURNING id INTO eDup;
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cB, NULL, 'ZZ Dup B', 'zz-dup@invalid.example') RETURNING id INTO eDupB;
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, NULL, 'ZZ SemConta', 'zz-nouser@invalid.example') RETURNING id INTO eNoUser;
    INSERT INTO public.employees (company_id, user_id, name, email, is_active) VALUES (cA, c6, 'ZZ Inativo', 'zz-inact@invalid.example', false) RETURNING id INTO eInact;
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, c3, 'ZZ Outra', 'zz-x@invalid.example') RETURNING id INTO eX;
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cE, NULL, 'ZZ Estranha', 'zz-foreign@invalid.example') RETURNING id INTO eForeign;
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, c4, 'ZZ Massa 1', 'zz-b1@invalid.example') RETURNING id INTO eB1;
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, c5, 'ZZ Massa 2', 'zz-b2@invalid.example') RETURNING id INTO eB2;

    -- c3 passa a ter outra pertença de colaborador ativa (E); a de A suspende-se só para não
    -- violar o índice da Fase B ao preparar o cenário.
    UPDATE public.company_memberships SET status = 'suspenso' WHERE company_id = cA AND user_id = c3;
    INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES (cE, c3, 'colaborador', 'migracao', 'ativo');

    -- Histórico do colaborador a mover (futuro e tipo que dispensa o prazo de aviso).
    INSERT INTO public.absences (employee_id, company_id, absence_type, start_date, end_date, status)
    VALUES (eMove, cA, 'sick_leave', CURRENT_DATE + 400, CURRENT_DATE + 401, 'approved') RETURNING id INTO v_abs;
    INSERT INTO public.absence_periods (absence_id, start_date, end_date, business_days)
    VALUES (v_abs, CURRENT_DATE + 400, CURRENT_DATE + 401, 1);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FP_BEGIN%FP_END',
      'ERRO NA PREPARACAO: ' || regexp_replace(translate(SQLERRM, '<>"', '   '), '[^ -~]', '?', 'g');
  END;

  -- ---------------------------------------------------------------- testes
  -- Cada linha: nome, quem chama (uuid ou vazio), tipo (f = executar; q = consulta booleana),
  -- papel (authenticated para provar RLS), esperado (ok, true, false ou SQLSTATE), SQL.
  v_defs := ARRAY[
    ARRAY['sem permissao: estranho tenta mover', o1::text, 'f', '', '02000',
      format('SELECT public.rz_transfer_employee(%L,%L)', eMove, cB)],
    ARRAY['sem permissao no destino', a2::text, 'f', '', '42501',
      format('SELECT public.rz_transfer_employee(%L,%L)', eMove, cB)],
    ARRAY['ficha de outra empresa', a1::text, 'f', '', '02000',
      format('SELECT public.rz_transfer_employee(%L,%L)', eForeign, cB)],
    ARRAY['destino igual a origem', a1::text, 'f', '', '22023',
      format('SELECT public.rz_transfer_employee(%L,%L)', eMove, cA)],
    ARRAY['destino suspenso', a1::text, 'f', '', '22023',
      format('SELECT public.rz_transfer_employee(%L,%L)', eMove, cC)],
    ARRAY['ficha sem conta de utilizador', a1::text, 'f', '', '22023',
      format('SELECT public.rz_transfer_employee(%L,%L)', eNoUser, cB)],
    ARRAY['ficha inativa', a1::text, 'f', '', '22023',
      format('SELECT public.rz_transfer_employee(%L,%L)', eInact, cB)],
    ARRAY['email duplicado no destino', a1::text, 'f', '', '22023',
      format('SELECT public.rz_transfer_employee(%L,%L)', eDup, cB)],
    ARRAY['utilizador com outra empresa ativa', a1::text, 'f', '', '22023',
      format('SELECT public.rz_transfer_employee(%L,%L)', eX, cB)],
    ARRAY['mover com sucesso', a1::text, 'f', '', 'ok',
      format('SELECT public.rz_transfer_employee(%L,%L,%L)', eMove, cB, 'ensaio')],
    ARRAY['ficha ficou na empresa de destino', '', 'q', '', 'true',
      format('SELECT company_id = %L FROM public.employees WHERE id = %L', cB, eMove)],
    ARRAY['pertenca antiga removida e nova ativa', '', 'q', '', 'true',
      format('SELECT (SELECT status FROM public.company_memberships WHERE company_id = %L AND user_id = %L) = %L AND (SELECT status FROM public.company_memberships WHERE company_id = %L AND user_id = %L) = %L',
             cA, c1, 'removido', cB, c1, 'ativo')],
    ARRAY['ausencia antiga mantem a empresa de origem', '', 'q', '', 'true',
      format('SELECT company_id = %L FROM public.absences WHERE id = %L', cA, v_abs)],
    ARRAY['RLS: colaborador ve o historico depois de mover', c1::text, 'q', 'authenticated', 'true',
      format('SELECT count(*) = 1 FROM public.absences WHERE employee_id = %L', eMove)],
    ARRAY['RLS: colaborador ve os periodos depois de mover', c1::text, 'q', 'authenticated', 'true',
      format('SELECT count(*) = 1 FROM public.absence_periods WHERE absence_id = %L', v_abs)],
    ARRAY['RLS: estranho nao ve o historico', o1::text, 'q', 'authenticated', 'true',
      format('SELECT count(*) = 0 FROM public.absences WHERE employee_id = %L', eMove)],
    ARRAY['em massa: 2 ok e 1 falha', a1::text, 'q', '', 'true',
      format('WITH r AS (SELECT public.rz_transfer_employees(ARRAY[%L,%L,%L]::uuid[], %L) AS j) SELECT (j ->> %L)::int = 2 AND (j ->> %L)::int = 1 FROM r',
             eB1, eDup, eB2, cB, 'ok', 'failed')],
    ARRAY['em massa: as boas foram movidas', '', 'q', '', 'true',
      format('SELECT count(*) = 2 FROM public.employees WHERE id IN (%L,%L) AND company_id = %L', eB1, eB2, cB)],
    ARRAY['admin: adicionar gestor', a1::text, 'f', '', 'ok',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cB, o1, 'gestor')],
    ARRAY['admin: adicionar sem ser admin da empresa', a2::text, 'f', '', '42501',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cB, c2, 'admin')],
    ARRAY['admin: papel invalido', a1::text, 'f', '', '22023',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cB, c2, 'x')],
    ARRAY['admin: utilizador inexistente', a1::text, 'f', '', '02000',
      format('SELECT public.rz_add_company_admin(%L,gen_random_uuid(),%L)', cB, 'admin')],
    ARRAY['admin: promover colaborador sem duplicar', a1::text, 'f', '', 'ok',
      format('SELECT public.rz_add_company_admin(%L,%L,%L)', cB, c4, 'admin')],
    ARRAY['admin: uma so pertenca, agora admin', '', 'q', '', 'true',
      format('SELECT count(*) = 1 AND bool_and(role = %L) FROM public.company_memberships WHERE company_id = %L AND user_id = %L', 'admin', cB, c4)],
    ARRAY['admin: remover gestor', a1::text, 'f', '', 'ok',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cB, o1)],
    ARRAY['admin: gestor ficou removido', '', 'q', '', 'true',
      format('SELECT status = %L FROM public.company_memberships WHERE company_id = %L AND user_id = %L', 'removido', cB, o1)],
    ARRAY['admin: remover admin que e colaborador ativo', a1::text, 'f', '', 'ok',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cB, c4)],
    ARRAY['admin: passou a colaborador ativo', '', 'q', '', 'true',
      format('SELECT role = %L AND status = %L FROM public.company_memberships WHERE company_id = %L AND user_id = %L', 'colaborador', 'ativo', cB, c4)],
    ARRAY['ultimo admin: nao pode retirar-se (B)', a1::text, 'f', '', '55000',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cB, a1)],
    ARRAY['admin: retirar admin de empresa que nao administra', a2::text, 'f', '', '42501',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cB, a1)],
    ARRAY['admin: retirar quem nao e admin', a1::text, 'f', '', '02000',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cA, o1)],
    ARRAY['admin: com 2 admins, retirar um', a1::text, 'f', '', 'ok',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cA, a2)],
    ARRAY['ultimo admin: nao pode retirar-se (A)', a1::text, 'f', '', '55000',
      format('SELECT public.rz_remove_company_admin(%L,%L)', cA, a1)],
    ARRAY['guarda: apagar a pertenca do ultimo admin', '', 'f', '', '55000',
      format('DELETE FROM public.company_memberships WHERE company_id = %L AND user_id = %L', cC, a1)],
    ARRAY['criar empresa: so super admin', a1::text, 'f', '', '42501',
      format('SELECT public.rz_create_company(%L,%L,%L,NULL::uuid,%L,%L)', 'ZZ Nova', v_nif_new, 'nova@invalid.example', 'ZZ Grupo Ensaio', c5)],
    ARRAY['criar empresa com grupo novo', sp::text, 'f', '', 'ok',
      format('SELECT public.rz_create_company(%L,%L,%L,NULL::uuid,%L,%L)', 'ZZ Nova', v_nif_new, 'nova@invalid.example', 'ZZ Grupo Ensaio', c5)],
    ARRAY['criar empresa: empresa, admin e grupo existem', '', 'q', '', 'true',
      format('SELECT EXISTS (SELECT 1 FROM public.companies c JOIN public.company_memberships m ON m.company_id = c.id AND m.role = %L AND m.status = %L AND m.user_id = %L JOIN public.company_group_members g ON g.company_id = c.id JOIN public.company_groups cg ON cg.id = g.group_id AND cg.name = %L WHERE c.nif = %L)',
             'admin', 'ativo', c5, 'ZZ Grupo Ensaio', v_nif_new)],
    ARRAY['criar empresa num grupo existente', sp::text, 'f', '', 'ok',
      format('SELECT public.rz_create_company(%L,%L,%L,(SELECT id FROM public.company_groups WHERE name = %L LIMIT 1),NULL::text,%L)',
             'ZZ Nova 2', v_nif_new || '2', 'nova2@invalid.example', 'ZZ Grupo Ensaio', c4)],
    ARRAY['criar empresa: NIF duplicado', sp::text, 'f', '', '22023',
      format('SELECT public.rz_create_company(%L,%L,%L,NULL::uuid,NULL::text,%L)', 'ZZ Nova', v_nif_new, 'nova@invalid.example', c5)],
    ARRAY['criar empresa: sem administrador', sp::text, 'f', '', '22023',
      format('SELECT public.rz_create_company(%L,%L,%L,NULL::uuid,NULL::text,NULL::uuid)', 'ZZ Nova 3', v_nif_new || '3', 'nova3@invalid.example')],
    ARRAY['criar empresa: administrador inexistente', sp::text, 'f', '', '02000',
      format('SELECT public.rz_create_company(%L,%L,%L,NULL::uuid,NULL::text,gen_random_uuid())', 'ZZ Nova 4', v_nif_new || '4', 'nova4@invalid.example')],
    ARRAY['apagar empresa com o ultimo admin e permitido', '', 'f', '', 'ok',
      format('DELETE FROM public.companies WHERE id = %L', cD)]
  ];

  FOR v_i IN 1 .. array_length(v_defs, 1) LOOP
    v_name := v_defs[v_i][1];
    v_who := nullif(v_defs[v_i][2], '')::uuid;
    v_expect := v_defs[v_i][5];
    PERFORM set_config('request.jwt.claim.sub', coalesce(v_who::text, ''), true);
    PERFORM set_config('request.jwt.claims',
      CASE WHEN v_who IS NULL THEN '{}'
           ELSE '{"sub":"' || v_who::text || '","role":"authenticated"}' END, true);
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
    E'\nRESULTADO: ' || v_pass || ' ok, ' || v_fail || ' falhas, ' || array_length(v_defs, 1) || ' testes' ||
    E'\nutilizadores reais usados: ' || v_real || ' de 10 (os restantes sinteticos)' ||
    E'\ngatilho employees_sync_membership: ' || CASE WHEN v_sync THEN 'presente' ELSE 'AUSENTE (os testes de pertencas podem falhar)' END ||
    E'\n' || regexp_replace(translate(v_rep, '<>"', '   '), '[^ -~' || E'\n' || ']', '?', 'g');
END
$t$;
