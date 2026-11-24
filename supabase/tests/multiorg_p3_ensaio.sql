-- Ensaio PR3 multi-organização (âmbito por empresa nos dados). NÃO altera nada de forma permanente: o bloco cria dados sintéticos, testa a regra e
-- termina SEMPRE com RAISE EXCEPTION, o que anula a transação inteira. O relatório vem na mensagem do
-- erro, entre FP_BEGIN e FP_END. A mensagem vermelha é o relatório, não um erro a corrigir.
--
-- ORDEM: ensaio ANTES das migrações PR1, PR2 e PR3 (20261123100000, 110000, 120000) -> muitas falhas; depois
-- das três -> todos ok. A transição dos super admins (20261123130000) não faz parte deste cenário: aqui o
-- super admin é sintético.
-- Cenário: A e B no mesmo grupo (feed.read), X externa. adA/adB/ext admins por pertença, emA/emB/emX
-- colaboradores, rhA (grupo RH, ficha em A), leg (só user_roles admin), sa super admin. Cada empresa tem
-- ficha, ausência, acesso, telefone, equipamento, atribuição, ticket, aviso, documento, finanças, ponto,
-- cliente jurídico e um ficheiro no storage.
--
-- Sem dados de pessoas reais: tudo é sintético (auth.users com email @invalid.example, empresas ZZ).

DO $t$
DECLARE
  sa uuid; adA uuid; adB uuid; ext uuid; emA uuid; emB uuid; emX uuid; rhA uuid; leg uuid;
  cA uuid; cB uuid; cX uuid; gG uuid; gRH uuid; gJ uuid;
  eA uuid; eB uuid; eX uuid; eR uuid;
  abA uuid; abB uuid; pdA uuid; pdB uuid; acA uuid; acB uuid; phA uuid; phB uuid; eqA uuid; eqB uuid;
  asA uuid; asB uuid; tkA uuid; tkB uuid; ntA uuid; ntB uuid; ntG uuid; ntP uuid; dcA uuid; dcB uuid;
  fnA uuid; fnB uuid; tcA uuid; tcB uuid; lcA uuid; lcB uuid; stA uuid; stB uuid; acN uuid; sdT uuid; tkX uuid; tkM uuid;
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
    FOR v_k IN 1 .. 9 LOOP
      v_ids := v_ids || gen_random_uuid();
      INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
      VALUES (v_ids[v_k], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'zz-p3-' || v_k || '@invalid.example', now(), now());
    END LOOP;
    sa := v_ids[1]; adA := v_ids[2]; adB := v_ids[3]; ext := v_ids[4]; emA := v_ids[5]; emB := v_ids[6]; emX := v_ids[7]; rhA := v_ids[8]; leg := v_ids[9];

    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P3 A', v_nif || 'A', 'a@invalid.example') RETURNING id INTO cA;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P3 B', v_nif || 'B', 'b@invalid.example') RETURNING id INTO cB;
    INSERT INTO public.companies (name, nif, email) VALUES ('ZZ P3 X externa', v_nif || 'X', 'x@invalid.example') RETURNING id INTO cX;
    INSERT INTO public.platform_admins (user_id, active, mfa_required) VALUES (sa, true, false);
    INSERT INTO public.company_memberships (company_id, user_id, role, origin, status) VALUES
      (cA, adA, 'admin', 'convite', 'ativo'), (cB, adB, 'admin', 'convite', 'ativo'), (cX, ext, 'admin', 'convite', 'ativo');
    INSERT INTO public.company_groups (name, default_capabilities) VALUES ('ZZ P3 grupo', ARRAY['feed.read']) RETURNING id INTO gG;
    INSERT INTO public.company_group_members (group_id, company_id, origin) VALUES (gG, cA, 'manual'), (gG, cB, 'manual');

    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, emA, 'ZZ Colab A', 'zz-p3-5@invalid.example') RETURNING id INTO eA;
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cB, emB, 'ZZ Colab B', 'zz-p3-6@invalid.example') RETURNING id INTO eB;
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cX, emX, 'ZZ Colab X', 'zz-p3-7@invalid.example') RETURNING id INTO eX;
    INSERT INTO public.employees (company_id, user_id, name, email) VALUES (cA, rhA, 'ZZ RH A', 'zz-p3-8@invalid.example') RETURNING id INTO eR;
    INSERT INTO public.user_roles (user_id, role) VALUES (leg, 'admin');
    INSERT INTO public.profiles (user_id, name, email) VALUES (emA, 'ZZ A', 'zz-p3-5@invalid.example'), (emB, 'ZZ B', 'zz-p3-6@invalid.example');
    SELECT id INTO gRH FROM public.admin_groups WHERE name = 'RH' AND is_active;
    IF gRH IS NULL THEN
      INSERT INTO public.admin_groups (name, is_super_admin, is_active) VALUES ('RH', false, true) RETURNING id INTO gRH;
      INSERT INTO public.admin_group_permissions (group_id, module_key, can_view, can_edit, can_execute) VALUES (gRH, 'employees', true, true, true);
    END IF;
    INSERT INTO public.admin_group_members (group_id, user_id) VALUES (gRH, rhA);
    INSERT INTO public.admin_groups (name, is_super_admin, is_active) VALUES ('ZZ P3 juridico', false, true) RETURNING id INTO gJ;
    INSERT INTO public.admin_group_permissions (group_id, module_key, can_view, can_edit, can_execute) VALUES (gJ, 'legal', true, true, true);
    INSERT INTO public.admin_group_members (group_id, user_id) VALUES (gJ, rhA);

    INSERT INTO public.absences (employee_id, company_id, absence_type, start_date, end_date) VALUES (eA, cA, 'vacation', current_date + 30, current_date + 30) RETURNING id INTO abA;
    INSERT INTO public.absences (employee_id, company_id, absence_type, start_date, end_date) VALUES (eB, cB, 'vacation', current_date + 30, current_date + 30) RETURNING id INTO abB;
    INSERT INTO public.absence_periods (absence_id, start_date, end_date) VALUES (abA, current_date + 30, current_date + 30) RETURNING id INTO pdA;
    INSERT INTO public.absence_periods (absence_id, start_date, end_date) VALUES (abB, current_date + 30, current_date + 30) RETURNING id INTO pdB;
    INSERT INTO public.accesses (company_id, employee_id, title, username, password) VALUES (cA, eA, 'ZZ acesso A', 'u', 'p') RETURNING id INTO acA;
    INSERT INTO public.accesses (company_id, employee_id, title, username, password) VALUES (cB, eB, 'ZZ acesso B', 'u', 'p') RETURNING id INTO acB;
    INSERT INTO public.accesses (company_id, employee_id, title, username, password) VALUES (NULL, NULL, 'ZZ acesso sem empresa', 'u', 'p') RETURNING id INTO acN;
    INSERT INTO public.support_departments (name) VALUES ('ZZ P3 suporte') RETURNING id INTO sdT;
    INSERT INTO public.support_department_teams (support_department_id, department) VALUES (sdT, 'ZZ P3 Equipa');
    UPDATE public.employees SET department = 'ZZ P3 Equipa' WHERE id IN (eX, eR);
    INSERT INTO public.phones (company_id, phone_number) VALUES (cA, '910000001') RETURNING id INTO phA;
    INSERT INTO public.phones (company_id, phone_number) VALUES (cB, '910000002') RETURNING id INTO phB;
    INSERT INTO public.equipments (company_id, brand) VALUES (cA, 'ZZ marca A') RETURNING id INTO eqA;
    INSERT INTO public.equipments (company_id, brand) VALUES (cB, 'ZZ marca B') RETURNING id INTO eqB;
    INSERT INTO public.assignments (employee_id, company_id) VALUES (eA, cA) RETURNING id INTO asA;
    INSERT INTO public.assignments (employee_id, company_id) VALUES (eB, cB) RETURNING id INTO asB;
    INSERT INTO public.support_tickets (company_id, employee_id, subject, message) VALUES (cA, eA, 'ZZ ticket A', 'm') RETURNING id INTO tkA;
    INSERT INTO public.support_tickets (company_id, employee_id, subject, message) VALUES (cB, eB, 'ZZ ticket B', 'm') RETURNING id INTO tkB;
    INSERT INTO public.support_tickets (company_id, employee_id, subject, message, requester_name, requester_email, requester_user_id, department_id) VALUES (cA, NULL, 'ZZ ticket mail', 'm', 'ZZ Cliente Mail', 'zz-cliente@invalid.example', emB, NULL) RETURNING id INTO tkM;
    UPDATE public.support_tickets SET department_id = sdT WHERE id IN (tkA, tkB);
    UPDATE public.support_tickets SET department_id = sdT WHERE id = tkM;
    INSERT INTO public.notifications (title, message, created_by, company_id) VALUES ('ZZ aviso A', 'm', sa, cA) RETURNING id INTO ntA;
    INSERT INTO public.notifications (title, message, created_by, company_id) VALUES ('ZZ aviso B', 'm', sa, cB) RETURNING id INTO ntB;
    INSERT INTO public.notifications (title, message, created_by, company_id, employee_id) VALUES ('ZZ aviso pessoal B', 'm', sa, NULL, eB) RETURNING id INTO ntP;
    INSERT INTO public.employee_documents (employee_id, file_name, file_path, file_size, mime_type, uploaded_by) VALUES (eA, 'a.pdf', eA::text || '/documents/a.pdf', 1, 'application/pdf', sa) RETURNING id INTO dcA;
    INSERT INTO public.employee_documents (employee_id, file_name, file_path, file_size, mime_type, uploaded_by) VALUES (eB, 'b.pdf', eB::text || '/documents/b.pdf', 1, 'application/pdf', sa) RETURNING id INTO dcB;
    INSERT INTO public.employee_monthly_finances (employee_id, year, month) VALUES (eA, 2090, 1) RETURNING id INTO fnA;
    INSERT INTO public.employee_monthly_finances (employee_id, year, month) VALUES (eB, 2090, 1) RETURNING id INTO fnB;
    INSERT INTO public.time_clock_entries (employee_id, company_id, entry_type, source) VALUES (eA, cA, 'in', 'admin') RETURNING id INTO tcA;
    INSERT INTO public.time_clock_entries (employee_id, company_id, entry_type, source) VALUES (eB, cB, 'in', 'admin') RETURNING id INTO tcB;
    INSERT INTO public.legal_clients (company_id, name) VALUES (cA, 'ZZ cliente A') RETURNING id INTO lcA;
    INSERT INTO public.legal_clients (company_id, name) VALUES (cB, 'ZZ cliente B') RETURNING id INTO lcB;
    INSERT INTO storage.objects (bucket_id, name) VALUES ('employee-files', eA::text || '/documents/zz.pdf') RETURNING id INTO stA;
    INSERT INTO storage.objects (bucket_id, name) VALUES ('employee-files', eB::text || '/documents/zz.pdf') RETURNING id INTO stB;
    INSERT INTO storage.objects (bucket_id, name) VALUES ('absence-documents', emA::text || '/' || abA::text || '/zz.pdf'), ('absence-documents', emB::text || '/' || abB::text || '/zz.pdf'), ('employee-files', 'company/' || cA::text || '/bulk/zz.pdf'), ('employee-files', 'company/' || cB::text || '/bulk/zz.pdf');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FP_BEGIN%FP_END',
      'ERRO NA PREPARACAO: ' || regexp_replace(translate(SQLERRM, '<>"', '   '), '[^ -~]', '?', 'g');
  END;

  v_defs := ARRAY[
    ARRAY['employees: adA ve a sua e nao a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.employees WHERE id = %L) = 1 AND (SELECT count(*) FROM public.employees WHERE id = %L) = 0', eA, eB), '', ''],
    ARRAY['employees: adB ve a sua e nao a de outra empresa', adB::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.employees WHERE id = %L) = 1 AND (SELECT count(*) FROM public.employees WHERE id = %L) = 0', eB, eA), '', ''],
    ARRAY['employees: adA altera a da sua empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.employees SET name = name WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', eA), '', ''],
    ARRAY['employees: adA nao altera a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.employees SET name = name WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', eB), '', ''],
    ARRAY['employees: ext nao ve nada', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.employees WHERE id IN (%L,%L)) = 0', eA, eB), '', ''],
    ARRAY['employees: leg nao ve nada', leg::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.employees WHERE id IN (%L,%L)) = 0', eA, eB), '', ''],
    ARRAY['absences: adA ve a sua e nao a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.absences WHERE id = %L) = 1 AND (SELECT count(*) FROM public.absences WHERE id = %L) = 0', abA, abB), '', ''],
    ARRAY['absences: adB ve a sua e nao a de outra empresa', adB::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.absences WHERE id = %L) = 1 AND (SELECT count(*) FROM public.absences WHERE id = %L) = 0', abB, abA), '', ''],
    ARRAY['absences: adA altera a da sua empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.absences SET end_date = end_date WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', abA), '', ''],
    ARRAY['absences: adA nao altera a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.absences SET end_date = end_date WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', abB), '', ''],
    ARRAY['absences: ext nao ve nada', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.absences WHERE id IN (%L,%L)) = 0', abA, abB), '', ''],
    ARRAY['absences: leg nao ve nada', leg::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.absences WHERE id IN (%L,%L)) = 0', abA, abB), '', ''],
    ARRAY['absence_periods: adA ve a sua e nao a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.absence_periods WHERE id = %L) = 1 AND (SELECT count(*) FROM public.absence_periods WHERE id = %L) = 0', pdA, pdB), '', ''],
    ARRAY['absence_periods: adB ve a sua e nao a de outra empresa', adB::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.absence_periods WHERE id = %L) = 1 AND (SELECT count(*) FROM public.absence_periods WHERE id = %L) = 0', pdB, pdA), '', ''],
    ARRAY['absence_periods: adA altera a da sua empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.absence_periods SET end_date = end_date WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', pdA), '', ''],
    ARRAY['absence_periods: adA nao altera a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.absence_periods SET end_date = end_date WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', pdB), '', ''],
    ARRAY['absence_periods: ext nao ve nada', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.absence_periods WHERE id IN (%L,%L)) = 0', pdA, pdB), '', ''],
    ARRAY['absence_periods: leg nao ve nada', leg::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.absence_periods WHERE id IN (%L,%L)) = 0', pdA, pdB), '', ''],
    ARRAY['accesses: adA ve a sua e nao a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.accesses WHERE id = %L) = 1 AND (SELECT count(*) FROM public.accesses WHERE id = %L) = 0', acA, acB), '', ''],
    ARRAY['accesses: adB ve a sua e nao a de outra empresa', adB::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.accesses WHERE id = %L) = 1 AND (SELECT count(*) FROM public.accesses WHERE id = %L) = 0', acB, acA), '', ''],
    ARRAY['accesses: adA altera a da sua empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.accesses SET title = title WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', acA), '', ''],
    ARRAY['accesses: adA nao altera a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.accesses SET title = title WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', acB), '', ''],
    ARRAY['accesses: ext nao ve nada', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.accesses WHERE id IN (%L,%L)) = 0', acA, acB), '', ''],
    ARRAY['accesses: leg nao ve nada', leg::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.accesses WHERE id IN (%L,%L)) = 0', acA, acB), '', ''],
    ARRAY['phones: adA ve a sua e nao a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.phones WHERE id = %L) = 1 AND (SELECT count(*) FROM public.phones WHERE id = %L) = 0', phA, phB), '', ''],
    ARRAY['phones: adB ve a sua e nao a de outra empresa', adB::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.phones WHERE id = %L) = 1 AND (SELECT count(*) FROM public.phones WHERE id = %L) = 0', phB, phA), '', ''],
    ARRAY['phones: adA altera a da sua empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.phones SET phone_number = phone_number WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', phA), '', ''],
    ARRAY['phones: adA nao altera a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.phones SET phone_number = phone_number WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', phB), '', ''],
    ARRAY['phones: ext nao ve nada', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.phones WHERE id IN (%L,%L)) = 0', phA, phB), '', ''],
    ARRAY['phones: leg nao ve nada', leg::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.phones WHERE id IN (%L,%L)) = 0', phA, phB), '', ''],
    ARRAY['equipments: adA ve a sua e nao a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.equipments WHERE id = %L) = 1 AND (SELECT count(*) FROM public.equipments WHERE id = %L) = 0', eqA, eqB), '', ''],
    ARRAY['equipments: adB ve a sua e nao a de outra empresa', adB::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.equipments WHERE id = %L) = 1 AND (SELECT count(*) FROM public.equipments WHERE id = %L) = 0', eqB, eqA), '', ''],
    ARRAY['equipments: adA altera a da sua empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.equipments SET brand = brand WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', eqA), '', ''],
    ARRAY['equipments: adA nao altera a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.equipments SET brand = brand WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', eqB), '', ''],
    ARRAY['equipments: ext nao ve nada', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.equipments WHERE id IN (%L,%L)) = 0', eqA, eqB), '', ''],
    ARRAY['equipments: leg nao ve nada', leg::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.equipments WHERE id IN (%L,%L)) = 0', eqA, eqB), '', ''],
    ARRAY['assignments: adA ve a sua e nao a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.assignments WHERE id = %L) = 1 AND (SELECT count(*) FROM public.assignments WHERE id = %L) = 0', asA, asB), '', ''],
    ARRAY['assignments: adB ve a sua e nao a de outra empresa', adB::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.assignments WHERE id = %L) = 1 AND (SELECT count(*) FROM public.assignments WHERE id = %L) = 0', asB, asA), '', ''],
    ARRAY['assignments: adA altera a da sua empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.assignments SET id = id WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', asA), '', ''],
    ARRAY['assignments: adA nao altera a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.assignments SET id = id WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', asB), '', ''],
    ARRAY['assignments: ext nao ve nada', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.assignments WHERE id IN (%L,%L)) = 0', asA, asB), '', ''],
    ARRAY['assignments: leg nao ve nada', leg::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.assignments WHERE id IN (%L,%L)) = 0', asA, asB), '', ''],
    ARRAY['support_tickets: adA ve a sua e nao a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.support_tickets WHERE id = %L) = 1 AND (SELECT count(*) FROM public.support_tickets WHERE id = %L) = 0', tkA, tkB), '', ''],
    ARRAY['support_tickets: adB ve a sua e nao a de outra empresa', adB::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.support_tickets WHERE id = %L) = 1 AND (SELECT count(*) FROM public.support_tickets WHERE id = %L) = 0', tkB, tkA), '', ''],
    ARRAY['support_tickets: adA altera a da sua empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.support_tickets SET subject = subject WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', tkA), '', ''],
    ARRAY['support_tickets: adA nao altera a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.support_tickets SET subject = subject WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', tkB), '', ''],
    ARRAY['support_tickets: ext nao ve nada', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.support_tickets WHERE id IN (%L,%L)) = 0', tkA, tkB), '', ''],
    ARRAY['support_tickets: leg nao ve nada', leg::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.support_tickets WHERE id IN (%L,%L)) = 0', tkA, tkB), '', ''],
    ARRAY['employee_documents: adA ve a sua e nao a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.employee_documents WHERE id = %L) = 1 AND (SELECT count(*) FROM public.employee_documents WHERE id = %L) = 0', dcA, dcB), '', ''],
    ARRAY['employee_documents: adB ve a sua e nao a de outra empresa', adB::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.employee_documents WHERE id = %L) = 1 AND (SELECT count(*) FROM public.employee_documents WHERE id = %L) = 0', dcB, dcA), '', ''],
    ARRAY['employee_documents: adA altera a da sua empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.employee_documents SET file_name = file_name WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', dcA), '', ''],
    ARRAY['employee_documents: adA nao altera a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.employee_documents SET file_name = file_name WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', dcB), '', ''],
    ARRAY['employee_documents: ext nao ve nada', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.employee_documents WHERE id IN (%L,%L)) = 0', dcA, dcB), '', ''],
    ARRAY['employee_documents: leg nao ve nada', leg::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.employee_documents WHERE id IN (%L,%L)) = 0', dcA, dcB), '', ''],
    ARRAY['time_clock_entries: adA ve a sua e nao a de outra empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.time_clock_entries WHERE id = %L) = 1 AND (SELECT count(*) FROM public.time_clock_entries WHERE id = %L) = 0', tcA, tcB), '', ''],
    ARRAY['time_clock_entries: adB ve a sua e nao a de outra empresa', adB::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.time_clock_entries WHERE id = %L) = 1 AND (SELECT count(*) FROM public.time_clock_entries WHERE id = %L) = 0', tcB, tcA), '', ''],
    ARRAY['time_clock_entries: ext nao ve nada', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.time_clock_entries WHERE id IN (%L,%L)) = 0', tcA, tcB), '', ''],
    ARRAY['time_clock_entries: leg nao ve nada', leg::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.time_clock_entries WHERE id IN (%L,%L)) = 0', tcA, tcB), '', ''],
    ARRAY['accesses: acesso sem empresa so o super admin ve', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.accesses WHERE id = %L) = 1', acN), '', ''],
    ARRAY['accesses: acesso sem empresa invisivel ao admin de empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.accesses WHERE id = %L) = 0', acN), '', ''],
    ARRAY['accesses: acesso sem empresa invisivel ao admin externo', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.accesses WHERE id = %L) = 0', acN), '', ''],
    ARRAY['accesses: super admin edita acesso sem empresa', sa::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.accesses SET title = title WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', acN), '', ''],
    ARRAY['accesses: admin de empresa nao edita acesso sem empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.accesses SET title = title WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', acN), '', ''],
    ARRAY['support_desk_tickets: colaborador de empresa externa na equipa nao le tickets de outras empresas', emX::text, 'q', 'authenticated', 'true', 'SELECT jsonb_array_length(public.support_desk_tickets()) = 0', '', ''],
    ARRAY['support_desk_tickets: ticket de cliente sem ficha (employee_id NULL, requester_*) continua na fila com nome e email', rhA::text, 'q', 'authenticated', 'true', format('SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(public.support_desk_tickets()) t WHERE t ->> ''id'' = %L AND t -> ''employees'' ->> ''email'' = ''zz-cliente@invalid.example'' AND t -> ''employees'' ->> ''name'' = ''ZZ Cliente Mail'')', tkM), '', ''],
    ARRAY['support_desk_tickets: equipa de A ve so os tickets de A', rhA::text, 'q', 'authenticated', 'true', format('SELECT jsonb_array_length(public.support_desk_tickets()) = 2 AND EXISTS (SELECT 1 FROM jsonb_array_elements(public.support_desk_tickets()) t WHERE t ->> ''id'' = %L) AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.support_desk_tickets()) t WHERE t ->> ''id'' = %L)', tkA, tkB), '', ''],
    ARRAY['absences: colaborador de A nao forja a empresa B (fica a de A)', emA::text, 'q', 'authenticated', 'true', format('WITH i AS (INSERT INTO public.absences (employee_id, company_id, absence_type, start_date, end_date) VALUES (%L, %L, ''vacation'', current_date + 60, current_date + 60) RETURNING company_id) SELECT (SELECT company_id FROM i) = %L', eA, cB, cA), '', ''],
    ARRAY['tickets: colaborador de A nao forja a empresa B (fica a de A)', emA::text, 'q', 'authenticated', 'true', format('WITH i AS (INSERT INTO public.support_tickets (company_id, employee_id, subject, message) VALUES (%L, %L, ''ZZ forjado'', ''m'') RETURNING company_id) SELECT (SELECT company_id FROM i) = %L', cB, eA, cA), '', ''],
    ARRAY['employees: super admin ve as duas empresas', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.employees WHERE id IN (%L, %L)) = 2', eA, eB), '', ''],
    ARRAY['absences: super admin ve as duas empresas', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.absences WHERE id IN (%L, %L)) = 2', abA, abB), '', ''],
    ARRAY['absence_periods: super admin ve as duas empresas', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.absence_periods WHERE id IN (%L, %L)) = 2', pdA, pdB), '', ''],
    ARRAY['accesses: super admin ve as duas empresas', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.accesses WHERE id IN (%L, %L)) = 2', acA, acB), '', ''],
    ARRAY['phones: super admin ve as duas empresas', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.phones WHERE id IN (%L, %L)) = 2', phA, phB), '', ''],
    ARRAY['equipments: super admin ve as duas empresas', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.equipments WHERE id IN (%L, %L)) = 2', eqA, eqB), '', ''],
    ARRAY['assignments: super admin ve as duas empresas', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.assignments WHERE id IN (%L, %L)) = 2', asA, asB), '', ''],
    ARRAY['support_tickets: super admin ve as duas empresas', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.support_tickets WHERE id IN (%L, %L)) = 2', tkA, tkB), '', ''],
    ARRAY['employee_documents: super admin ve as duas empresas', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.employee_documents WHERE id IN (%L, %L)) = 2', dcA, dcB), '', ''],
    ARRAY['time_clock_entries: super admin ve as duas empresas', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.time_clock_entries WHERE id IN (%L, %L)) = 2', tcA, tcB), '', ''],
    ARRAY['legal_clients: super admin ve as duas empresas', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.legal_clients WHERE id IN (%L, %L)) = 2', lcA, lcB), '', ''],
    ARRAY['ponto: admin de A ve so o da sua empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.time_clock_entries WHERE id = %L) = 1 AND (SELECT count(*) FROM public.time_clock_entries WHERE id = %L) = 0', tcA, tcB), '', ''],
    ARRAY['ponto: ext nao ve', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.time_clock_entries WHERE id IN (%L, %L)) = 0', tcA, tcB), '', ''],
    ARRAY['juridico: admin antigo sem pertenca nao ve', leg::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.legal_clients WHERE id IN (%L, %L)) = 0', lcA, lcB), '', ''],
    ARRAY['juridico: grupo com permissao juridica e pertenca em A ve so o de A', rhA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.legal_clients WHERE id = %L) = 1 AND (SELECT count(*) FROM public.legal_clients WHERE id = %L) = 0', lcA, lcB), '', ''],
    ARRAY['juridico: RH sem permissao juridica nao ve (so o grupo juridico)', emA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.legal_clients WHERE id IN (%L, %L)) = 0', lcA, lcB), '', ''],
    ARRAY['juridico: admin de empresa sem grupo nao ve (so super/admin juridico)', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.legal_clients WHERE id IN (%L, %L)) = 0', lcA, lcB), '', ''],
    ARRAY['financas: RH de A ve so as de A', rhA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.employee_monthly_finances WHERE id = %L) = 1 AND (SELECT count(*) FROM public.employee_monthly_finances WHERE id = %L) = 0', fnA, fnB), '', ''],
    ARRAY['financas: RH de A nao escreve na empresa B', rhA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.employee_monthly_finances (employee_id, year, month) VALUES (%L, 2090, 2)', eB), '', ''],
    ARRAY['financas: RH de A escreve na sua empresa', rhA::text, 'f', 'authenticated', 'ok', format('INSERT INTO public.employee_monthly_finances (employee_id, year, month) VALUES (%L, 2090, 2)', eA), '', ''],
    ARRAY['financas: admin de empresa ve as da sua empresa e nao as de outra', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.employee_monthly_finances WHERE id = %L) = 1 AND (SELECT count(*) FROM public.employee_monthly_finances WHERE id = %L) = 0', fnA, fnB), '', ''],
    ARRAY['financas: admin de A nao escreve na empresa B', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.employee_monthly_finances (employee_id, year, month) VALUES (%L, 2090, 5)', eB), '', ''],
    ARRAY['financas: admin da externa nao ve', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.employee_monthly_finances WHERE id IN (%L, %L)) = 0', fnA, fnB), '', ''],
    ARRAY['financas: super admin ve e escreve', sa::text, 'f', 'authenticated', 'ok', format('INSERT INTO public.employee_monthly_finances (employee_id, year, month) VALUES (%L, 2090, 3)', eB), '', ''],
    ARRAY['avisos: admin de A ve o da sua empresa (e o do par do grupo, so leitura)', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.notifications WHERE id = %L) = 1', ntA), '', ''],
    ARRAY['avisos: admin de A nao altera o aviso do par B', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.notifications SET title = ''ZZ hack'' WHERE id = %L RETURNING 1) SELECT count(*) = 0 FROM u', ntB), '', ''],
    ARRAY['avisos: admin de A altera o aviso da sua empresa', adA::text, 'q', 'authenticated', 'true', format('WITH u AS (UPDATE public.notifications SET title = ''ZZ ok'' WHERE id = %L RETURNING 1) SELECT count(*) = 1 FROM u', ntA), '', ''],
    ARRAY['avisos: admin de A nao ve o aviso pessoal de colaborador de B', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.notifications WHERE id = %L) = 0', ntP), '', ''],
    ARRAY['avisos: admin de B ve o pessoal do seu colaborador', adB::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.notifications WHERE id = %L) = 1', ntP), '', ''],
    ARRAY['avisos: colaborador do par (B, mesmo grupo) ve o aviso de A', emB::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.notifications WHERE id = %L) = 1', ntA), '', ''],
    ARRAY['avisos: colaborador de empresa externa nao ve o aviso de A', emX::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.notifications WHERE id IN (%L, %L)) = 0', ntA, ntB), '', ''],
    ARRAY['avisos: admin de A nao cria aviso para B', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.notifications (title, message, created_by, company_id) VALUES (''ZZ x'', ''m'', %L, %L)', adA, cB), '', ''],
    ARRAY['avisos: admin de A cria aviso para A', adA::text, 'f', 'authenticated', 'ok', format('INSERT INTO public.notifications (title, message, created_by, company_id) VALUES (''ZZ y'', ''m'', %L, %L)', adA, cA), '', ''],
    ARRAY['departamentos: admin de empresa nao escreve', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.departments (name) VALUES (''ZZ dep'')'), '', ''],
    ARRAY['departamentos: super admin escreve', sa::text, 'f', 'authenticated', 'ok', format('INSERT INTO public.departments (name) VALUES (''ZZ dep'')'), '', ''],
    ARRAY['departamentos: equipa antiga (rz_is_admin) escreve', leg::text, 'f', 'authenticated', 'ok', format('INSERT INTO public.departments (name) VALUES (''ZZ dep2'')'), '', ''],
    ARRAY['departamentos: todos leem', emX::text, 'q', 'authenticated', 'true', format('SELECT count(*) >= 0 FROM public.departments'), '', ''],
    ARRAY['definicoes: admin de empresa nao escreve', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.system_settings (key, value) VALUES (''zz_p3'', ''x'')'), '', ''],
    ARRAY['feriados: admin de empresa nao escreve', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.holidays (date, name, year) VALUES (current_date, ''ZZ'', 2090)'), '', ''],
    ARRAY['feriados: todos leem', emX::text, 'q', 'authenticated', 'true', format('SELECT count(*) >= 0 FROM public.holidays'), '', ''],
    ARRAY['perfis: admin de A ve o perfil do seu colaborador e nao o de B', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM public.profiles WHERE user_id = %L) = 1 AND (SELECT count(*) FROM public.profiles WHERE user_id = %L) = 0', emA, emB), '', ''],
    ARRAY['tickets: admin de A responde ao ticket de A', adA::text, 'f', 'authenticated', 'ok', format('INSERT INTO public.support_ticket_replies (ticket_id, user_id, sender_role, message) VALUES (%L, %L, ''admin'', ''ok'')', tkA, adA), '', ''],
    ARRAY['tickets: admin de A nao responde ao ticket de B', adA::text, 'f', 'authenticated', '42501', format('INSERT INTO public.support_ticket_replies (ticket_id, user_id, sender_role, message) VALUES (%L, %L, ''admin'', ''ok'')', tkB, adA), '', ''],
    ARRAY['tickets: rz_can_handle_ticket so da propria empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT public.rz_can_handle_ticket(%L) AND NOT public.rz_can_handle_ticket(%L)', tkA, tkB), '', ''],
    ARRAY['ficheiros: admin de A ve o ficheiro da ficha de A e nao o de B', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM storage.objects WHERE id = %L) = 1 AND (SELECT count(*) FROM storage.objects WHERE id = %L) = 0', stA, stB), '', ''],
    ARRAY['ficheiros: admin da externa nao ve nenhum', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM storage.objects WHERE id IN (%L, %L)) = 0', stA, stB), '', ''],
    ARRAY['ficheiros: super admin ve os dois', sa::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM storage.objects WHERE id IN (%L, %L)) = 2', stA, stB), '', ''],
    ARRAY['access_password: admin de A le a palavra-passe da sua empresa', adA::text, 'f', 'authenticated', 'ok', format('SELECT public.access_password(%L)', acA), '', ''],
    ARRAY['access_password: admin de A nao le a de B', adA::text, 'f', 'authenticated', '42501', format('SELECT public.access_password(%L)', acB), '', ''],
    ARRAY['access_password: admin da externa nao le', ext::text, 'f', 'authenticated', '42501', format('SELECT public.access_password(%L)', acA), '', ''],
    ARRAY['phone_codes: admin de A nao ve os codigos de B', adA::text, 'f', 'authenticated', '42501', format('SELECT * FROM public.phone_codes(ARRAY[%L]::uuid[])', phB), '', ''],
    ARRAY['phone_codes: admin de A ve os da sua empresa', adA::text, 'f', 'authenticated', 'ok', format('SELECT * FROM public.phone_codes(ARRAY[%L]::uuid[])', phA), '', ''],
    ARRAY['last_sign_in: admin de A so ve colaboradores da sua empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT NOT EXISTS (SELECT 1 FROM public.admin_employee_last_sign_in() WHERE employee_id IN (%L, %L)) = false AND NOT EXISTS (SELECT 1 FROM public.admin_employee_last_sign_in() WHERE employee_id = %L)', eA, eR, eB), '', ''],
    ARRAY['rever documento: admin de A nao revê o de B', adA::text, 'f', 'authenticated', '42501', format('SELECT public.review_employee_document(%L, ''rejected'', NULL, NULL, NULL, NULL, NULL, ''motivo'')', dcB), '', ''],
    ARRAY['storage: documentos de ausencia (pasta = conta do colaborador): admin de A ve so os da sua empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM storage.objects WHERE bucket_id = ''absence-documents'' AND name = %L) = 1 AND (SELECT count(*) FROM storage.objects WHERE bucket_id = ''absence-documents'' AND name = %L) = 0', emA::text || '/' || abA::text || '/zz.pdf', emB::text || '/' || abB::text || '/zz.pdf'), '', ''],
    ARRAY['storage: envio em massa (company/<empresa>/bulk): admin de A ve so o da sua empresa', adA::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM storage.objects WHERE bucket_id = ''employee-files'' AND name = %L) = 1 AND (SELECT count(*) FROM storage.objects WHERE bucket_id = ''employee-files'' AND name = %L) = 0', 'company/' || cA::text || '/bulk/zz.pdf', 'company/' || cB::text || '/bulk/zz.pdf'), '', ''],
    ARRAY['storage: admin da externa nao ve documentos de ausencia nem envios em massa', ext::text, 'q', 'authenticated', 'true', format('SELECT (SELECT count(*) FROM storage.objects WHERE bucket_id IN (''absence-documents'') OR name LIKE ''company/%%'') = 0'), '', ''],
    ARRAY['mail_client tem EXECUTE nas funcoes das suas policies', '', 'q', '', 'true', format('SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ''mail_client'') OR (has_function_privilege(''mail_client'', ''public.rz_admin_of_ticket(uuid)'', ''EXECUTE'') AND has_function_privilege(''mail_client'', ''public.rz_admin_of_mail_account(uuid)'', ''EXECUTE''))'), '', ''],
    ARRAY['ponto (RPC): admin de B nao altera o registo de A', adB::text, 'f', 'authenticated', '42501', format('SELECT public.time_clock_admin_set_status(%L, ''voided'', ''zz'')', tcA), '', ''],
    ARRAY['tarefas (RPC): admin de A nao lista pessoas de B', adA::text, 'f', 'authenticated', 'P0001', format('SELECT * FROM public.admin_task_people(%L)', cB), '', ''],
    ARRAY['funcoes de ambito: anon sem EXECUTE', '', 'q', '', 'true', format('SELECT NOT has_function_privilege(''anon'', ''public.rz_admin_of_employee(uuid)'', ''EXECUTE'') AND NOT has_function_privilege(''anon'', ''public.rz_is_platform_staff()'', ''EXECUTE'') AND has_function_privilege(''authenticated'', ''public.rz_admin_of_employee(uuid)'', ''EXECUTE'')'), '', ''],
    ARRAY['rz_path_uuid: extrai o id do colaborador (tambem com prefixo)', '', 'q', '', 'true', format('SELECT public.rz_path_uuid(''11111111-1111-1111-1111-111111111111/documents/a.pdf'') = ''11111111-1111-1111-1111-111111111111''::uuid AND public.rz_path_uuid('' (1).11111111-1111-1111-1111-111111111111/documents/a.pdf'') = ''11111111-1111-1111-1111-111111111111''::uuid AND public.rz_path_uuid(''sem-uuid.pdf'') IS NULL'), '', '']
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
RESULTADO PR3: ' || v_pass || ' ok, ' || v_fail || ' falhas, ' || array_length(v_defs, 1) || ' testes' ||
    E'
' || regexp_replace(translate(v_rep, '<>"', '   '), '[^ -~' || E'
' || ']', '?', 'g');
END
$t$;
