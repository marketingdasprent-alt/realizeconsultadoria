-- Ensaio PR5 multi-organização (Realize Mail por empresa). NÃO altera nada de forma permanente: o bloco cria
-- dados sintéticos, testa as regras e termina SEMPRE com RAISE EXCEPTION, o que anula a transação inteira. O
-- relatório vem na mensagem do erro, entre FP_BEGIN e FP_END. A mensagem vermelha é o relatório, não um erro.
--
-- ORDEM: ensaio ANTES da migração 20261124100000 (falham os casos de âmbito); depois da migração -> tudo ok.
-- Cenário: empresas A e B; adA / adB = admins de cada uma (pertença admin + papel admin antigo); sa = super
-- admin; plain = conta sem admin. Clientes de email: cliA (empresa A), cliB (empresa B), cliN (sem empresa).
-- Caixas de email (acessos): accA, accB, accN (sem empresa). Postos: p1 (caixa de A), p2 (caixa de B),
-- p3 (caixas de A e de B). Tudo sintético (@invalid.example, empresas ZZ).

DO $t$
DECLARE
  v_ids uuid[] := ARRAY[]::uuid[];
  v_k integer;
  sa uuid; adA uuid; adB uuid; plain uuid; cliA uuid; cliB uuid; cliN uuid; pu1 uuid; pu2 uuid; pu3 uuid;
  kA uuid; kB uuid; cat uuid; accA uuid; accB uuid; accN uuid; p1 uuid; p2 uuid; p3 uuid;
  v_nif text := 'ZZ' || substr(upper(md5(gen_random_uuid()::text)), 1, 8);
  v_defs text[];
  v_who uuid;
  v_i integer;
  v_got text;
  v_rep text := '';
  v_pass integer := 0;
  v_fail integer := 0;
  v_claims text;
  v_parts text[];
  v_name text;
  v_role text;
  v_sql text;
  v_expect text;
  v_names text[] := ARRAY['sa','adA','adB','plain','cliA','cliB','cliN','pu1','pu2','pu3'];
BEGIN
  FOR v_k IN 1 .. array_length(v_names, 1) LOOP
    v_ids := v_ids || gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
    VALUES (v_ids[v_k], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'zz-p5-' || v_names[v_k] || '@invalid.example', now(), now());
  END LOOP;
  sa := v_ids[1]; adA := v_ids[2]; adB := v_ids[3]; plain := v_ids[4];
  cliA := v_ids[5]; cliB := v_ids[6]; cliN := v_ids[7]; pu1 := v_ids[8]; pu2 := v_ids[9]; pu3 := v_ids[10];

  INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P5 A', v_nif || 'A', 'a@invalid.example') RETURNING id INTO kA;
  INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P5 B', v_nif || 'B', 'b@invalid.example') RETURNING id INTO kB;
  INSERT INTO public.platform_admins (user_id, active, mfa_required) VALUES (sa, true, false);
  INSERT INTO public.company_memberships (company_id, user_id, role, origin, status)
  VALUES (kA, adA, 'admin', 'convite', 'ativo'), (kB, adB, 'admin', 'convite', 'ativo');
  INSERT INTO public.user_roles (user_id, role) VALUES (sa, 'admin'), (adA, 'admin'), (adB, 'admin');

  INSERT INTO public.mail_app_users (user_id, mailbox, company_id) VALUES
    (cliA, 'zz-p5-clia@invalid.example', kA), (cliB, 'zz-p5-clib@invalid.example', kB),
    (cliN, 'zz-p5-clin@invalid.example', NULL);

  INSERT INTO public.access_categories (name) VALUES ('ZZ P5 Email') RETURNING id INTO cat;
  INSERT INTO public.accesses (title, username, password, company_id, category_id)
  VALUES ('ZZ caixa A', 'zz-p5-a@invalid.example', 'x', kA, cat) RETURNING id INTO accA;
  INSERT INTO public.accesses (title, username, password, company_id, category_id)
  VALUES ('ZZ caixa B', 'zz-p5-b@invalid.example', 'x', kB, cat) RETURNING id INTO accB;
  INSERT INTO public.accesses (title, username, password, company_id, category_id)
  VALUES ('ZZ caixa N', 'zz-p5-n@invalid.example', 'x', NULL, cat) RETURNING id INTO accN;

  INSERT INTO public.mail_postos (name, user_id, created_by) VALUES ('ZZ p1', pu1, adA) RETURNING id INTO p1;
  INSERT INTO public.mail_postos (name, user_id, created_by) VALUES ('ZZ p2', pu2, adB) RETURNING id INTO p2;
  INSERT INTO public.mail_postos (name, user_id, created_by) VALUES ('ZZ p3', pu3, adA) RETURNING id INTO p3;
  INSERT INTO public.mail_posto_boxes (posto_id, access_id) VALUES (p1, accA), (p2, accB), (p3, accA), (p3, accB);

  -- nome ~ quem ~ papel (authenticated|postgres) ~ SQL que devolve texto ~ esperado (valor ou SQLSTATE)
  v_defs := ARRAY[
    'ctrl super admin vê os 3 clientes~sa~authenticated~SELECT count(*)::text FROM jsonb_array_elements(public.admin_mail_clients()) c WHERE c->>''mailbox'' LIKE ''zz-p5-cli%''~3',
    'isol admin de A vê só o cliente de A~adA~authenticated~SELECT count(*)::text FROM jsonb_array_elements(public.admin_mail_clients()) c WHERE c->>''mailbox'' LIKE ''zz-p5-cli%''~1',
    'isol admin de B vê só o cliente de B~adB~authenticated~SELECT string_agg(c->>''mailbox'', '','') FROM jsonb_array_elements(public.admin_mail_clients()) c WHERE c->>''mailbox'' LIKE ''zz-p5-cli%''~zz-p5-clib@invalid.example',
    'ctrl conta sem admin é recusada~plain~authenticated~SELECT public.admin_mail_clients()::text~P0001',
    'isol admin de A não muda a empresa do cliente de B~adA~authenticated~SELECT public.admin_mail_client_set_company(''' || cliB || ''', ''' || kA || ''')::text~P0001',
    'isol admin de A não leva o seu cliente para a empresa B~adA~authenticated~SELECT public.admin_mail_client_set_company(''' || cliA || ''', ''' || kB || ''')::text~P0001',
    'isol admin de A não tira a empresa ao seu cliente~adA~authenticated~SELECT public.admin_mail_client_set_company(''' || cliA || ''', NULL)::text~P0001',
    'ctrl admin de A muda o seu cliente dentro de A~adA~authenticated~SELECT ''ok'' FROM (SELECT public.admin_mail_client_set_company(''' || cliA || ''', ''' || kA || ''')) q~ok',
    'isol admin de A não desliga o cliente de B~adA~authenticated~SELECT public.admin_mail_client_set_disabled(''' || cliB || ''', true)::text~P0001',
    'ctrl admin de A desliga o seu cliente~adA~authenticated~SELECT ''ok'' FROM (SELECT public.admin_mail_client_set_disabled(''' || cliA || ''', true)) q~ok',
    'isol admin de A não mexe no cliente sem empresa~adA~authenticated~SELECT public.admin_mail_client_set_disabled(''' || cliN || ''', true)::text~P0001',
    'super super admin desliga o cliente sem empresa~sa~authenticated~SELECT ''ok'' FROM (SELECT public.admin_mail_client_set_disabled(''' || cliN || ''', true)) q~ok',
    'super super admin atribui empresa a cliente sem empresa~sa~authenticated~SELECT ''ok'' FROM (SELECT public.admin_mail_client_set_company(''' || cliN || ''', ''' || kB || ''')) q~ok',
    'ctrl super admin vê as 3 caixas de email~sa~authenticated~SELECT count(*)::text FROM jsonb_array_elements(public.admin_mail_posto_accesses()) c WHERE c->>''email'' LIKE ''zz-p5-%''~3',
    'isol admin de A vê só a caixa de A~adA~authenticated~SELECT string_agg(c->>''email'', '','') FROM jsonb_array_elements(public.admin_mail_posto_accesses()) c WHERE c->>''email'' LIKE ''zz-p5-%''~zz-p5-a@invalid.example',
    'isol admin de A recebe o companyId das caixas~adA~authenticated~SELECT ((c->>''companyId'')::uuid = ''' || kA || ''')::text FROM jsonb_array_elements(public.admin_mail_posto_accesses()) c WHERE c->>''email'' = ''zz-p5-a@invalid.example''~true',
    'ctrl super admin vê os 3 postos~sa~authenticated~SELECT count(*)::text FROM jsonb_array_elements(public.admin_mail_postos()) c WHERE c->>''name'' LIKE ''ZZ p%''~3',
    'isol admin de A vê só o posto só de A (não o misto)~adA~authenticated~SELECT string_agg(c->>''name'', '','') FROM jsonb_array_elements(public.admin_mail_postos()) c WHERE c->>''name'' LIKE ''ZZ p%''~ZZ p1',
    'isol admin de B vê só o posto de B~adB~authenticated~SELECT string_agg(c->>''name'', '','') FROM jsonb_array_elements(public.admin_mail_postos()) c WHERE c->>''name'' LIKE ''ZZ p%''~ZZ p2',
    'isol admin não chama a função da edge function (sem EXECUTE)~adA~authenticated~SELECT public.rz_mail_access_ok_for(''' || adA || ''', ''' || accA || ''')::text~42501',
    'edge admin de A administra a caixa de A~adA~postgres~SELECT public.rz_mail_access_ok_for(''' || adA || ''', ''' || accA || ''')::text~true',
    'edge admin de A não administra a caixa de B~adA~postgres~SELECT public.rz_mail_access_ok_for(''' || adA || ''', ''' || accB || ''')::text~false',
    'edge admin de A não administra a caixa sem empresa~adA~postgres~SELECT public.rz_mail_access_ok_for(''' || adA || ''', ''' || accN || ''')::text~false',
    'edge super admin administra a caixa sem empresa~sa~postgres~SELECT public.rz_mail_access_ok_for(''' || sa || ''', ''' || accN || ''')::text~true',
    'edge admin de A mexe no posto só de A~adA~postgres~SELECT public.rz_mail_posto_ok_for(''' || adA || ''', ''' || p1 || ''')::text~true',
    'edge admin de A não mexe no posto de B~adA~postgres~SELECT public.rz_mail_posto_ok_for(''' || adA || ''', ''' || p2 || ''')::text~false',
    'edge admin de A não mexe no posto misto (A e B)~adA~postgres~SELECT public.rz_mail_posto_ok_for(''' || adA || ''', ''' || p3 || ''')::text~false',
    'edge super admin mexe no posto misto~sa~postgres~SELECT public.rz_mail_posto_ok_for(''' || sa || ''', ''' || p3 || ''')::text~true'
  ];

  FOR v_i IN 1 .. array_length(v_defs, 1) LOOP
    v_parts := string_to_array(v_defs[v_i], '~');
    v_name := v_parts[1];
    v_role := v_parts[3];
    v_sql := v_parts[4];
    v_expect := v_parts[5];
    v_who := CASE v_parts[2]
      WHEN 'sa' THEN sa WHEN 'adA' THEN adA WHEN 'adB' THEN adB WHEN 'plain' THEN plain END;
    v_claims := '{"sub":"' || v_who::text || '","role":"authenticated","amr":[{"method":"password","timestamp":'
                || extract(epoch FROM now())::bigint::text || '}]}';
    PERFORM set_config('request.jwt.claim.sub', v_who::text, true);
    PERFORM set_config('request.jwt.claims', v_claims, true);
    v_got := NULL;
    BEGIN
      IF v_role = 'authenticated' THEN EXECUTE 'SET LOCAL ROLE authenticated'; END IF;
      EXECUTE v_sql INTO v_got;
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
  RAISE EXCEPTION 'FP_BEGIN%FP_END', E'\n' || v_rep || 'TOTAL ok=' || v_pass || ' falhas=' || v_fail || E'\n';
END
$t$;
