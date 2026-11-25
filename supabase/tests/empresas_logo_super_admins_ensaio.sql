-- Ensaio "Empresas: logo e super admins". NÃO altera nada de forma permanente: corre DEPOIS da migração
-- 20261125100000 na MESMA chamada (cat migração ensaio | node scripts/run-sql.mjs), cria dados sintéticos
-- (@invalid.example, empresas ZZ), testa as regras e termina SEMPRE com RAISE EXCEPTION, que anula a transação
-- inteira (migração incluída). O relatório vem na mensagem do erro, entre FP_BEGIN e FP_END.
--
-- Papéis: sa/sb = super admins sintéticos; adA/adB = administradores das empresas A/B; adC = administrador
-- de A (candidato a promoção); plain = conta sem papel. Sessões: aal2 (MFA, login recente), aal1, stale
-- (aal2 mas com a confirmação com mais de 10 minutos). A corrida do advisory lock entre dois super admins não se
-- testa numa só transação: a segunda chamada a rz_super_admin_assert depois do lock está no código.
-- O ramo last_super_admin é só defesa: quem age está ativo e é diferente do alvo, logo sobra sempre alguém.

DO $t$
DECLARE
  v_ids uuid[] := ARRAY[]::uuid[];
  v_k integer;
  sa uuid; sb uuid; adA uuid; adB uuid; adC uuid; plain uuid; adBan uuid; adUnc uuid; adNoMfa uuid;
  kA uuid; kB uuid; empA uuid;
  v_nif text := 'ZZ' || substr(upper(md5(gen_random_uuid()::text)), 1, 8);
  v_names text[] := ARRAY['sa','sb','adA','adB','adC','plain','adBan','adUnc','adNoMfa'];
  r record;
  v_i integer := 0;
  v_who uuid;
  v_got text;
  v_msg text;
  v_claims text;
  v_now bigint := extract(epoch FROM now())::bigint;
  v_rep text := '';
  v_pass integer := 0;
  v_fail integer := 0;
  v_ok boolean;
  v_real integer;
  empP uuid;
BEGIN
  SELECT count(*) INTO v_real FROM public.platform_admins WHERE active;
  -- Função temporária (só existe nesta sessão) para provar o TRUNCATE sem tocar em nada fora da transação.
  EXECUTE 'CREATE FUNCTION pg_temp.ensaio_truncate() RETURNS text LANGUAGE plpgsql AS $f$ BEGIN TRUNCATE public.platform_admins; RETURN ''ok''; END $f$';
  FOR v_k IN 1 .. array_length(v_names, 1) LOOP
    v_ids := v_ids || gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, banned_until, created_at, updated_at)
    VALUES (v_ids[v_k], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'zz-emp-' || v_names[v_k] || '@invalid.example',
            CASE WHEN v_names[v_k] = 'adUnc' THEN NULL ELSE now() END,
            CASE WHEN v_names[v_k] = 'adBan' THEN now() + interval '1 day' ELSE NULL END, now(), now());
  END LOOP;
  sa := v_ids[1]; sb := v_ids[2]; adA := v_ids[3]; adB := v_ids[4]; adC := v_ids[5]; plain := v_ids[6];
  adBan := v_ids[7]; adUnc := v_ids[8]; adNoMfa := v_ids[9];

  INSERT INTO public.companies (name, nif, email) VALUES ('ZZ EMP A', v_nif || 'A', 'a@invalid.example') RETURNING id INTO kA;
  INSERT INTO public.companies (name, nif, email) VALUES ('ZZ EMP B', v_nif || 'B', 'b@invalid.example') RETURNING id INTO kB;
  INSERT INTO public.platform_admins (user_id, active, mfa_required) VALUES (sa, true, false), (sb, true, false);
  INSERT INTO public.company_memberships (company_id, user_id, role, origin, status)
  VALUES (kA, adA, 'admin', 'convite', 'ativo'), (kB, adB, 'admin', 'convite', 'ativo'),
         (kA, adC, 'admin', 'convite', 'ativo'), (kA, adBan, 'admin', 'convite', 'ativo'),
         (kA, adUnc, 'admin', 'convite', 'ativo'), (kA, adNoMfa, 'admin', 'convite', 'ativo');
  INSERT INTO public.user_roles (user_id, role) VALUES (sa, 'admin'), (sb, 'admin'), (adA, 'admin'), (adB, 'admin'), (adC, 'admin');
  INSERT INTO public.employees (name, email, company_id) VALUES ('ZZ Func A', 'zz-func-a@invalid.example', kA) RETURNING id INTO empA;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('company-logos', kA::text || '/seed.webp');
  -- sb tem o segundo passo (TOTP) verificado; sa não. Os candidatos têm-no (exigência para promover), menos adNoMfa.
  INSERT INTO auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
  VALUES (gen_random_uuid(), sb, 'totp', 'verified', now(), now()),
         (gen_random_uuid(), adC, 'totp', 'verified', now(), now()),
         (gen_random_uuid(), adBan, 'totp', 'verified', now(), now()),
         (gen_random_uuid(), adUnc, 'totp', 'verified', now(), now());

  FOR r IN
    SELECT * FROM (VALUES
      -- ---------------- logo: configuração e escrita no storage
      ('bucket: público, 1 MiB, só webp/png/jpeg (sem SVG)', 'pg', 'aal1', 'true/1048576/image/webp,image/png,image/jpeg',
        'SELECT public::text || ''/'' || file_size_limit || ''/'' || array_to_string(allowed_mime_types, '','') FROM storage.buckets WHERE id = ''company-logos'''),
      ('logo: admin de A envia para a pasta de A', 'adA', 'aal1', 'ok',
        'WITH i AS (INSERT INTO storage.objects (bucket_id, name, owner) VALUES (''company-logos'', ''' || kA || '/a.webp'', auth.uid()) RETURNING 1) SELECT ''ok'' FROM i'),
      ('logo: admin de A NÃO envia para a pasta de B', 'adA', 'aal1', '42501',
        'WITH i AS (INSERT INTO storage.objects (bucket_id, name, owner) VALUES (''company-logos'', ''' || kB || '/a.webp'', auth.uid()) RETURNING 1) SELECT ''ok'' FROM i'),
      ('logo: admin de A NÃO envia para subpasta de A', 'adA', 'aal1', '42501',
        'WITH i AS (INSERT INTO storage.objects (bucket_id, name, owner) VALUES (''company-logos'', ''' || kA || '/x/a.webp'', auth.uid()) RETURNING 1) SELECT ''ok'' FROM i'),
      ('logo: pasta que não é um id é recusada', 'adA', 'aal1', '42501',
        'WITH i AS (INSERT INTO storage.objects (bucket_id, name, owner) VALUES (''company-logos'', ''abc/a.webp'', auth.uid()) RETURNING 1) SELECT ''ok'' FROM i'),
      ('logo: ficheiro solto na raiz é recusado', 'adA', 'aal1', '42501',
        'WITH i AS (INSERT INTO storage.objects (bucket_id, name, owner) VALUES (''company-logos'', ''a.webp'', auth.uid()) RETURNING 1) SELECT ''ok'' FROM i'),
      ('logo: colaborador sem papel NÃO envia', 'plain', 'aal1', '42501',
        'WITH i AS (INSERT INTO storage.objects (bucket_id, name, owner) VALUES (''company-logos'', ''' || kA || '/p.webp'', auth.uid()) RETURNING 1) SELECT ''ok'' FROM i'),
      ('logo: super admin envia para a pasta de B', 'sa', 'aal1', 'ok',
        'WITH i AS (INSERT INTO storage.objects (bucket_id, name, owner) VALUES (''company-logos'', ''' || kB || '/s.webp'', auth.uid()) RETURNING 1) SELECT ''ok'' FROM i'),
      ('logo: admin de B NÃO apaga a logo de A', 'adB', 'aal1', '0',
        'WITH d AS (DELETE FROM storage.objects WHERE bucket_id = ''company-logos'' AND name = ''' || kA || '/seed.webp'' RETURNING 1) SELECT count(*)::text FROM d'),
      ('logo: admin de A NÃO substitui a logo de B', 'adA', 'aal1', '0',
        'WITH u AS (UPDATE storage.objects SET name = name WHERE bucket_id = ''company-logos'' AND name = ''' || kB || '/s.webp'' RETURNING 1) SELECT count(*)::text FROM u'),
      ('logo: admin de A NÃO muda o nome do seu ficheiro para a pasta de B (WITH CHECK)', 'adA', 'aal1', '42501',
        'WITH u AS (UPDATE storage.objects SET name = ''' || kB || '/x.webp'' WHERE bucket_id = ''company-logos'' AND name = ''' || kA || '/a.webp'' RETURNING 1) SELECT count(*)::text FROM u'),
      ('logo: admin de A substitui o seu próprio ficheiro', 'adA', 'aal1', '1',
        'WITH u AS (UPDATE storage.objects SET name = ''' || kA || '/b.webp'' WHERE bucket_id = ''company-logos'' AND name = ''' || kA || '/a.webp'' RETURNING 1) SELECT count(*)::text FROM u'),
      ('logo: extensão .svg recusada mesmo com o tipo declarado png', 'adA', 'aal1', '42501',
        'WITH i AS (INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES (''company-logos'', ''' || kA || '/x.svg'', auth.uid(), ''{"mimetype":"image/png"}''::jsonb) RETURNING 1) SELECT ''ok'' FROM i'),
      ('logo: nome com .. recusado', 'adA', 'aal1', '42501',
        'WITH i AS (INSERT INTO storage.objects (bucket_id, name, owner) VALUES (''company-logos'', ''' || kA || '/a..webp'', auth.uid()) RETURNING 1) SELECT ''ok'' FROM i'),
      ('logo: admin de B não lista nem vê as pastas de A', 'adB', 'aal1', '0',
        'SELECT count(*)::text FROM storage.objects WHERE bucket_id = ''company-logos'' AND name LIKE ''' || kA || '/%'''),
      ('logo: admin de A vê os seus ficheiros', 'adA', 'aal1', 'true',
        'SELECT (count(*) >= 1)::text FROM storage.objects WHERE bucket_id = ''company-logos'' AND name LIKE ''' || kA || '/%'''),
      ('logo: admin de A apaga a logo de A', 'adA', 'aal1', '1',
        'WITH d AS (DELETE FROM storage.objects WHERE bucket_id = ''company-logos'' AND name = ''' || kA || '/seed.webp'' RETURNING 1) SELECT count(*)::text FROM d'),
      -- ---------------- logo: coluna companies.logo_path
      ('coluna: admin de A define a logo de A', 'adA', 'aal1', '1',
        'WITH u AS (UPDATE public.companies SET logo_path = ''' || kA || '/a.webp'' WHERE id = ''' || kA || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('coluna: caminho de outra empresa é recusado (CHECK)', 'adA', 'aal1', '23514',
        'WITH u AS (UPDATE public.companies SET logo_path = ''' || kB || '/a.webp'' WHERE id = ''' || kA || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('coluna: caminho com .. é recusado', 'adA', 'aal1', '23514',
        'WITH u AS (UPDATE public.companies SET logo_path = ''' || kA || '/../' || kB || '/a.webp'' WHERE id = ''' || kA || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('coluna: caminho com ? ou # é recusado', 'adA', 'aal1', '23514',
        'WITH u AS (UPDATE public.companies SET logo_path = ''' || kA || '/a.webp?x=1'' WHERE id = ''' || kA || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('coluna: subpasta é recusada', 'adA', 'aal1', '23514',
        'WITH u AS (UPDATE public.companies SET logo_path = ''' || kA || '/x/a.webp'' WHERE id = ''' || kA || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('coluna: o guarda continua a recusar o NIF a um admin de empresa', 'adA', 'aal1', '42501',
        'WITH u AS (UPDATE public.companies SET nif = ''' || v_nif || 'X'' WHERE id = ''' || kA || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('coluna: o super admin muda o NIF', 'sa', 'aal1', '1',
        'WITH u AS (UPDATE public.companies SET nif = ''' || v_nif || 'Y'' WHERE id = ''' || kA || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('coluna: admin de A NÃO altera a empresa B', 'adA', 'aal1', '0',
        'WITH u AS (UPDATE public.companies SET logo_path = ''' || kB || '/a.webp'' WHERE id = ''' || kB || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('coluna: sem papel NÃO altera nenhuma empresa', 'plain', 'aal1', '0',
        'WITH u AS (UPDATE public.companies SET logo_path = NULL WHERE id = ''' || kA || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      -- ---------------- super admins: leitura
      ('lista: super admin vê os dois super admins sintéticos', 'sa', 'aal1', 'true',
        'SELECT (count(*) FILTER (WHERE user_id IN (''' || sa || ''', ''' || sb || ''')) = 2)::text FROM public.rz_list_super_admins()'),
      ('lista: MFA ativo só em quem tem fator verificado', 'sa', 'aal1', 'false/true',
        'SELECT (SELECT mfa_enabled::text FROM public.rz_list_super_admins() WHERE user_id = ''' || sa || ''') || ''/'' || (SELECT mfa_enabled::text FROM public.rz_list_super_admins() WHERE user_id = ''' || sb || ''')'),
      ('lista: admin de empresa NÃO vê os super admins', 'adA', 'aal2', '42501', 'SELECT count(*)::text FROM public.rz_list_super_admins()'),
      ('lista: conta sem papel NÃO vê os super admins', 'plain', 'aal2', '42501', 'SELECT count(*)::text FROM public.rz_list_super_admins()'),
      ('candidatos: admin de empresa NÃO vê', 'adA', 'aal2', '42501', 'SELECT count(*)::text FROM public.rz_super_admin_candidates()'),
      ('candidatos: super admin vê o admin de A e não vê super admins', 'sa', 'aal1', 'true/false',
        'SELECT (count(*) FILTER (WHERE user_id = ''' || adC || ''') = 1)::text || ''/'' || (count(*) FILTER (WHERE user_id = ''' || sa || ''') > 0)::text FROM public.rz_super_admin_candidates()'),
      -- ---------------- super admins: escalada (nada disto pode funcionar)
      ('escalada: admin de A NÃO se promove', 'adA', 'aal2', '42501', 'SELECT public.rz_add_super_admin(''' || adA || ''')::text'),
      ('escalada: admin de A NÃO promove outro', 'adA', 'aal2', '42501', 'SELECT public.rz_add_super_admin(''' || adC || ''')::text'),
      ('escalada: admin de A NÃO retira um super admin', 'adA', 'aal2', '42501', 'SELECT public.rz_remove_super_admin(''' || sb || ''')::text'),
      ('escalada: sem papel NÃO se promove', 'plain', 'aal2', '42501', 'SELECT public.rz_add_super_admin(''' || plain || ''')::text'),
      ('escalada: INSERT direto em platform_admins recusado', 'adA', 'aal2', '42501',
        'WITH i AS (INSERT INTO public.platform_admins (user_id) VALUES (''' || adA || ''') RETURNING 1) SELECT count(*)::text FROM i'),
      ('escalada: UPDATE direto em platform_admins recusado', 'sa', 'aal2', '42501',
        'WITH u AS (UPDATE public.platform_admins SET active = false WHERE user_id = ''' || sb || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('escalada: ligar a ficha de A a um super admin (admin_user_id) é recusado pelo guarda', 'adA', 'aal2', '42501',
        'WITH u AS (UPDATE public.employees SET admin_user_id = ''' || sa || ''' WHERE id = ''' || empA || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('escalada: anon não chama a função', 'anon', 'aal2', '42501', 'SELECT public.rz_add_super_admin(''' || adC || ''')::text'),
      ('escalada: ninguém chama o auxiliar interno', 'sa', 'aal2', '42501', 'SELECT public.rz_super_admin_assert()::text'),
      -- ---------------- super admins: exigências da operação
      ('operação: sessão aal1 é recusada (precisa de MFA)', 'sa', 'aal1', 'RZ402', 'SELECT public.rz_add_super_admin(''' || adC || ''')::text'),
      ('operação: aal2 com confirmação antiga é recusado', 'sa', 'stale', 'RZ401', 'SELECT public.rz_add_super_admin(''' || adC || ''')::text'),
      ('operação: remover também exige aal2', 'sa', 'aal1', 'RZ402', 'SELECT public.rz_remove_super_admin(''' || sb || ''')::text'),
      ('operação: só quem já administra uma empresa pode ser promovido', 'sa', 'aal2', '22023', 'SELECT public.rz_add_super_admin(''' || plain || ''')::text'),
      ('operação: argumento nulo recusado', 'sa', 'aal2', '22023', 'SELECT public.rz_add_super_admin(NULL)::text'),
      ('operação: quem já é super admin não se duplica', 'sa', 'aal2', 'P0001:already_super_admin', 'SELECT public.rz_add_super_admin(''' || sb || ''')::text'),
      ('email: o admin de A vê o NOME do super admin na ficha da empresa mas não o email', 'adA', 'aal1', 'true/true',
        'SELECT (count(*) FILTER (WHERE kind = ''super_admin'') >= 1)::text || ''/'' || (count(*) FILTER (WHERE kind = ''super_admin'' AND email <> '''') = 0)::text FROM public.rz_company_viewers(''' || kA || ''')'),
      ('email: o super admin continua a ver o email', 'sa', 'aal1', 'true',
        'SELECT (count(*) FILTER (WHERE kind = ''super_admin'' AND email <> '''') >= 1)::text FROM public.rz_company_viewers(''' || kA || ''')'),
      ('candidatos: banido e por confirmar não aparecem', 'sa', 'aal1', '0',
        'SELECT count(*)::text FROM public.rz_super_admin_candidates() WHERE user_id IN (''' || adBan || ''', ''' || adUnc || ''')'),
      -- ---------------- super admins: elegibilidade de quem se promove
      ('elegível: conta banida é recusada', 'sa', 'aal2', 'P0001:account_not_eligible', 'SELECT public.rz_add_super_admin(''' || adBan || ''')::text'),
      ('elegível: email por confirmar é recusado', 'sa', 'aal2', 'P0001:account_not_eligible', 'SELECT public.rz_add_super_admin(''' || adUnc || ''')::text'),
      ('elegível: sem segundo passo verificado é recusado', 'sa', 'aal2', 'P0001:mfa_not_enabled', 'SELECT public.rz_add_super_admin(''' || adNoMfa || ''')::text'),
      ('elegível: nada ficou gravado para os recusados', 'pg', 'aal1', '0',
        'SELECT count(*)::text FROM public.platform_admins WHERE user_id IN (''' || adBan || ''', ''' || adUnc || ''', ''' || adNoMfa || ''')'),
      -- ---------------- super admins: adicionar e retirar
      ('adicionar: super admin promove o admin de A', 'sa', 'aal2', 'ok', 'SELECT ''ok'' FROM (SELECT public.rz_add_super_admin(''' || adC || ''')) q'),
      ('adicionar: fica ativo, com MFA obrigatório e quem o adicionou', 'pg', 'aal1', 'true/true/true',
        'SELECT active::text || ''/'' || mfa_required::text || ''/'' || (created_by = ''' || sa || ''')::text FROM public.platform_admins WHERE user_id = ''' || adC || ''''),
      ('adicionar: fica na auditoria', 'pg', 'aal1', '1',
        'SELECT count(*)::text FROM public.cross_company_audit WHERE action = ''super_admin_add'' AND resource_id = ''' || adC || ''' AND actor_user_id = ''' || sa || ''''),
      ('adicionar: já aparece na lista', 'sa', 'aal1', 'true',
        'SELECT (count(*) FILTER (WHERE user_id = ''' || adC || ''') = 1)::text FROM public.rz_list_super_admins()'),
      ('mfa_required: o promovido em aal1 NÃO tem poder de super admin', 'adC', 'aal1', '42501', 'SELECT count(*)::text FROM public.rz_list_super_admins()'),
      ('mfa_required: o promovido em aal2 tem', 'adC', 'aal2', 'true', 'SELECT (count(*) >= 3)::text FROM public.rz_list_super_admins()'),
      ('retirar: um super admin não se retira a si próprio', 'sa', 'aal2', '22023', 'SELECT public.rz_remove_super_admin(''' || sa || ''')::text'),
      ('retirar: quem não é super admin dá "não encontrado"', 'sa', 'aal2', '02000', 'SELECT public.rz_remove_super_admin(''' || plain || ''')::text'),
      ('retirar: super admin retira o promovido', 'sa', 'aal2', 'ok', 'SELECT ''ok'' FROM (SELECT public.rz_remove_super_admin(''' || adC || ''')) q'),
      ('retirar: fica inativo (não apagado) e na auditoria', 'pg', 'aal1', 'false/1',
        'SELECT (SELECT active::text FROM public.platform_admins WHERE user_id = ''' || adC || ''') || ''/'' || (SELECT count(*)::text FROM public.cross_company_audit WHERE action = ''super_admin_remove'' AND resource_id = ''' || adC || ''')'),
      ('retirar: o retirado já não tem poder de super admin', 'pg', 'aal1', 'false',
        'SELECT public.rz_is_super_admin_for(''' || adC || ''')::text'),
      ('re-promover: o mesmo utilizador volta a ser adicionado', 'sa', 'aal2', 'ok', 'SELECT ''ok'' FROM (SELECT public.rz_add_super_admin(''' || adC || '''))  q'),
      ('re-promover: fica ativo outra vez, com MFA obrigatório e a nova autoria', 'pg', 'aal1', 'true/true/true',
        'SELECT active::text || ''/'' || mfa_required::text || ''/'' || (created_by = ''' || sa || ''')::text FROM public.platform_admins WHERE user_id = ''' || adC || ''''),
      ('re-promover: a auditoria tem 2 registos de adicionar', 'pg', 'aal1', '2',
        'SELECT count(*)::text FROM public.cross_company_audit WHERE action = ''super_admin_add'' AND resource_id = ''' || adC || ''''),
      ('re-promover: retirado de novo', 'sa', 'aal2', 'ok', 'SELECT ''ok'' FROM (SELECT public.rz_remove_super_admin(''' || adC || ''')) q'),
      ('retirar: o retirado deixa de gerir super admins', 'adC', 'aal2', '42501', 'SELECT public.rz_add_super_admin(''' || adC || ''')::text'),
      ('real: os super admins reais continuam ativos e intactos', 'pg', 'aal1', v_real::text,
        'SELECT count(*)::text FROM public.platform_admins WHERE active AND user_id NOT IN (''' || sa || ''', ''' || sb || ''', ''' || adC || ''')'),
      ('trigger (conjunto): desativar TODOS os super admins numa só instrução é recusado', 'pg', 'aal1', 'P0001:last_super_admin',
        'WITH u AS (UPDATE public.platform_admins SET active = false WHERE active RETURNING 1) SELECT count(*)::text FROM u'),
      ('trigger (conjunto): apagar TODOS os super admins numa só instrução é recusado', 'pg', 'aal1', 'P0001:last_super_admin',
        'WITH d AS (DELETE FROM public.platform_admins WHERE active RETURNING 1) SELECT count(*)::text FROM d'),
      ('trigger (conjunto): nenhum super admin ativo foi perdido', 'pg', 'aal1', 'true',
        'SELECT (count(*) >= 4)::text FROM public.platform_admins WHERE active'),
      ('preparação do "último": só sa e sb ativos (os reais ficam desativados só nesta transação)', 'pg', 'aal1', 'ok',
        'WITH u AS (UPDATE public.platform_admins SET active = false WHERE active AND user_id NOT IN (''' || sa || ''', ''' || sb || ''') RETURNING 1) SELECT ''ok'' FROM (SELECT count(*) FROM u) q'),
      ('último: sb retira sa', 'sb', 'aal2', 'ok', 'SELECT ''ok'' FROM (SELECT public.rz_remove_super_admin(''' || sa || ''')) q'),
      ('último: ficou exatamente 1 super admin ativo (sb)', 'pg', 'aal1', '1',
        'SELECT count(*)::text FROM public.platform_admins WHERE active'),
      ('último: quem fica sozinho não se retira a si próprio', 'sb', 'aal2', '22023', 'SELECT public.rz_remove_super_admin(''' || sb || ''')::text')
      ,
      ('identidade: preparação, a conta de colaborador fica ligada ao super admin sb', 'pg', 'aal1', 'ok',
        'WITH i AS (INSERT INTO public.employees (name, email, company_id, user_id, admin_user_id) VALUES (''ZZ Ligado'', ''zz-ligado@invalid.example'', ''' || kA || ''', ''' || plain || ''', ''' || sb || ''') RETURNING 1) SELECT ''ok'' FROM i'),
      ('identidade: a conta ligada ao super admin NÃO gere super admins (só vale a conta própria)', 'plain', 'aal2', '42501', 'SELECT public.rz_remove_super_admin(''' || sb || ''')::text'),
      ('identidade: a conta ligada ao super admin NÃO vê a lista', 'plain', 'aal2', '42501', 'SELECT count(*)::text FROM public.rz_list_super_admins()'),
      ('identidade: a conta ligada ao super admin NÃO vê os candidatos', 'plain', 'aal2', '42501', 'SELECT count(*)::text FROM public.rz_super_admin_candidates()'),
      -- ---------------- o trigger de platform_admins vale para qualquer caminho (service_role, SQL direto, cascade)
      ('trigger: o SQL direto não desativa o último super admin', 'pg', 'aal1', 'P0001:last_super_admin',
        'WITH u AS (UPDATE public.platform_admins SET active = false WHERE user_id = ''' || sb || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('trigger: o SQL direto não apaga o último super admin', 'pg', 'aal1', 'P0001:last_super_admin',
        'WITH d AS (DELETE FROM public.platform_admins WHERE user_id = ''' || sb || ''' RETURNING 1) SELECT count(*)::text FROM d'),
      ('trigger: o SQL direto não muda o user_id do último', 'pg', 'aal1', 'P0001:last_super_admin',
        'WITH u AS (UPDATE public.platform_admins SET user_id = ''' || plain || ''' WHERE user_id = ''' || sb || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('trigger: TRUNCATE é recusado', 'pg', 'aal1', 'P0001:last_super_admin', 'SELECT pg_temp.ensaio_truncate()'),
      ('trigger: apagar a conta do último (cascade) é recusado', 'pg', 'aal1', 'P0001:last_super_admin',
        'WITH d AS (DELETE FROM auth.users WHERE id = ''' || sb || ''' RETURNING 1) SELECT count(*)::text FROM d'),
      ('trigger: sb continua ativo depois de tudo isto', 'pg', 'aal1', 'true',
        'SELECT active::text FROM public.platform_admins WHERE user_id = ''' || sb || ''''),
      ('trigger: reativar não é bloqueado (sa volta)', 'pg', 'aal1', '1',
        'WITH u AS (UPDATE public.platform_admins SET active = true WHERE user_id = ''' || sa || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('trigger: com outro utilizável, desativar passa', 'pg', 'aal1', '1',
        'WITH u AS (UPDATE public.platform_admins SET active = false WHERE user_id = ''' || sa || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('trigger: preparação, sa volta e sb é banido', 'pg', 'aal1', 'ok',
        'WITH u AS (UPDATE public.platform_admins SET active = true WHERE user_id = ''' || sa || ''' RETURNING 1), b AS (UPDATE auth.users SET banned_until = now() + interval ''1 day'' WHERE id = ''' || sb || ''' RETURNING 1) SELECT ''ok'' FROM u, b'),
      ('trigger: com o outro banido, desativar o único utilizável é recusado', 'pg', 'aal1', 'P0001:last_super_admin',
        'WITH u AS (UPDATE public.platform_admins SET active = false WHERE user_id = ''' || sa || ''' RETURNING 1) SELECT count(*)::text FROM u'),
      ('utilizável: com MFA obrigatório e sem fator TOTP não conta (adNoMfa promovido à força só nesta transação)', 'pg', 'aal1', 'ok',
        'WITH i AS (INSERT INTO public.platform_admins (user_id, active, mfa_required) VALUES (''' || adNoMfa || ''', true, true) RETURNING 1) SELECT ''ok'' FROM i'),
      ('utilizável: sem ninguém que chegue a aal2 (sb banido, adNoMfa sem fator) não se desativa o último', 'pg', 'aal1', 'P0001:last_super_admin',
        'WITH u AS (UPDATE public.platform_admins SET active = false WHERE user_id = ''' || sa || ''' RETURNING 1), v AS (UPDATE public.platform_admins SET active = false WHERE user_id = ''' || sb || ''' RETURNING 1) SELECT count(*)::text FROM u, v'),
      ('banido: um super admin banido já não gere super admins (sessão ainda válida)', 'sb', 'aal2', '42501',
        'SELECT public.rz_remove_super_admin(''' || sa || ''')::text')
    ) AS t(nm, who, variant, expect, sql)
  LOOP
    v_i := v_i + 1;
    v_who := CASE r.who WHEN 'sa' THEN sa WHEN 'sb' THEN sb WHEN 'adA' THEN adA WHEN 'adB' THEN adB
                        WHEN 'adC' THEN adC WHEN 'plain' THEN plain ELSE NULL END;
    v_claims := CASE
      WHEN v_who IS NULL THEN '{"role":"' || CASE r.who WHEN 'anon' THEN 'anon' ELSE 'postgres' END || '"}'
      WHEN r.variant = 'aal2' THEN '{"sub":"' || v_who || '","role":"authenticated","aal":"aal2","amr":[{"method":"password","timestamp":' || v_now || '},{"method":"totp","timestamp":' || v_now || '}]}'
      WHEN r.variant = 'stale' THEN '{"sub":"' || v_who || '","role":"authenticated","aal":"aal2","amr":[{"method":"password","timestamp":' || (v_now - 3600) || '},{"method":"totp","timestamp":' || (v_now - 3600) || '}]}'
      ELSE '{"sub":"' || v_who || '","role":"authenticated","aal":"aal1","amr":[{"method":"password","timestamp":' || v_now || '}]}'
    END;
    -- A API do storage apaga com este indicador ligado (o SQL direto é bloqueado por um trigger do Supabase).
    PERFORM set_config('storage.allow_delete_query', 'true', true);
    PERFORM set_config('request.jwt.claim.sub', coalesce(v_who::text, ''), true);
    PERFORM set_config('request.jwt.claims', v_claims, true);
    v_got := NULL;
    BEGIN
      IF r.who = 'anon' THEN EXECUTE 'SET LOCAL ROLE anon';
      ELSIF v_who IS NOT NULL THEN EXECUTE 'SET LOCAL ROLE authenticated';
      END IF;
      EXECUTE r.sql INTO v_got;
      EXECUTE 'RESET ROLE';
    EXCEPTION WHEN OTHERS THEN
      v_got := SQLSTATE;
      v_msg := SQLSTATE || ':' || SQLERRM;
      EXECUTE 'RESET ROLE';
    END;
    -- Esperado: o SQLSTATE ('42501') ou, para distinguir erros com o mesmo código, 'SQLSTATE:mensagem'.
    v_ok := (v_got = r.expect) OR (v_msg = r.expect) OR (r.expect = '*ERR' AND v_got ~ '^[0-9A-Z]{5}$');
    v_msg := NULL;
    IF v_ok THEN
      v_pass := v_pass + 1;
      v_rep := v_rep || 'OK    ' || v_i || ' ' || r.nm || E'\n';
    ELSE
      v_fail := v_fail + 1;
      v_rep := v_rep || 'FALHA ' || v_i || ' ' || r.nm || ' esperado=' || r.expect || ' obtido=' || coalesce(v_got, 'null') || E'\n';
    END IF;
  END LOOP;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  RAISE EXCEPTION 'FP_BEGIN%FP_END', E'\n' || v_rep || 'TOTAL ok=' || v_pass || ' falhas=' || v_fail || E'\n';
END
$t$;
