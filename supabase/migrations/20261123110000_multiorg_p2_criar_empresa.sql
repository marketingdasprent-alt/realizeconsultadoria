-- Multi-organização, PR2: criar e apagar empresas só pelas funções do super admin.
--
-- Antes: a UI inseria direto em companies (a empresa nascia sem administrador e sem grupo) e apagava direto.
-- Agora:
--   1. companies deixa de ter policies de INSERT e DELETE: só as RPC (SECURITY DEFINER) criam/apagam.
--   2. rz_create_company (já existia) passa a juntar a empresa ao grupo com origem 'manual' (grupo escolhido
--      ou criado pelo super admin; com 'pedido' o Feed do grupo ignorava-o, Lote 3).
--   3. rz_delete_company(p_company): só super admin, só empresas SEM colaboradores (não apaga fichas em
--      cascata), regista na auditoria.
--   4. Um administrador só gere UMA empresa: o gatilho company_memberships_one_admin recusa tornar admin ativo
--      de uma empresa quem já é admin ativo de outra (o super admin não está sujeito). Só vale para pertenças
--      novas ou que passam a admin ativo: as que já existem não são tocadas.
-- Dados: nenhuma linha é alterada.
-- Aplicar numa única chamada.

DROP POLICY IF EXISTS "Empresas: só o super admin cria" ON public.companies;
DROP POLICY IF EXISTS "Empresas: só o super admin apaga" ON public.companies;

-- ------------------------------------------------------------------ um administrador, uma empresa
CREATE OR REPLACE FUNCTION public.rz_membership_one_admin_company()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ids uuid[];
  v_id  uuid;
BEGIN
  IF NEW.role <> 'admin' OR NEW.status <> 'ativo' THEN
    RETURN NEW;
  END IF;
  -- Só quando passa a admin ativo (pertença nova, ou promovida/reativada). Num INSERT ... ON CONFLICT que
  -- vai atualizar uma pertença que já era admin ativa nada muda: não conta como "outra empresa".
  IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND OLD.status = 'ativo' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND EXISTS (
       SELECT 1 FROM public.company_memberships m
       WHERE m.company_id = NEW.company_id AND m.user_id = NEW.user_id
         AND m.role = 'admin' AND m.status = 'ativo') THEN
    RETURN NEW;
  END IF;
  -- As identidades da pessoa, nos dois sentidos: a conta, a(s) conta(s) de admin ligada(s) à ficha e as
  -- contas de colaborador que apontam para esta conta de admin.
  v_ids := public.rz_identity_ids(NEW.user_id)
    || coalesce((SELECT array_agg(e.user_id) FROM public.employees e
                  WHERE e.admin_user_id = ANY (public.rz_identity_ids(NEW.user_id))
                    AND e.user_id IS NOT NULL), ARRAY[]::uuid[]);
  -- Serializa por pessoa (em ordem, sem deadlock): duas promoções simultâneas não passam as duas.
  FOR v_id IN SELECT DISTINCT x FROM unnest(v_ids) AS x ORDER BY x LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('rz_one_admin:' || v_id::text, 0));
  END LOOP;
  IF NOT public.rz_is_super_admin_for(NEW.user_id)
     AND EXISTS (
       SELECT 1 FROM public.company_memberships m
       WHERE m.user_id = ANY (v_ids)
         AND m.role = 'admin' AND m.status = 'ativo'
         AND m.company_id <> NEW.company_id
     ) THEN
    RAISE EXCEPTION 'admin_other_company'
      USING ERRCODE = '23514',
            DETAIL = 'Esta conta já administra outra empresa. Um administrador só gere uma empresa.';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.rz_membership_one_admin_company() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS company_memberships_one_admin ON public.company_memberships;
CREATE TRIGGER company_memberships_one_admin
  BEFORE INSERT OR UPDATE ON public.company_memberships
  FOR EACH ROW EXECUTE FUNCTION public.rz_membership_one_admin_company();

-- ------------------------------------------------------------------ criar empresa (grupo com origem 'manual')
CREATE OR REPLACE FUNCTION public.rz_create_company(p_name text, p_nif text, p_email text, p_group uuid DEFAULT NULL::uuid, p_group_name text DEFAULT NULL::text, p_admin_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := public.rz_uid();
  v_name   text := btrim(coalesce(p_name, ''));
  v_nif    text := btrim(coalesce(p_nif, ''));
  v_email  text := btrim(coalesce(p_email, ''));
  v_gname  text := btrim(coalesce(p_group_name, ''));
  v_company uuid;
  v_group   uuid;
BEGIN
  IF NOT public.rz_is_super_admin() THEN
    PERFORM public.rz_fail('not_platform_admin');
  END IF;
  IF v_name = '' OR v_nif = '' OR v_email = '' OR position('@' IN v_email) = 0 THEN
    PERFORM public.rz_fail('invalid_argument', 'Indique o nome, o NIF e um email válido.');
  END IF;
  IF v_nif !~ '^[0-9]{9}$' THEN
    PERFORM public.rz_fail('invalid_argument', 'O NIF tem de ter 9 dígitos.');
  END IF;
  IF length(v_name) > 200 OR length(v_email) > 254 OR length(v_gname) > 200 THEN
    PERFORM public.rz_fail('invalid_argument', 'Algum dos textos é demasiado longo.');
  END IF;
  IF p_admin_user IS NULL THEN
    PERFORM public.rz_fail('invalid_argument', 'Indique o primeiro administrador da empresa.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_admin_user) THEN
    PERFORM public.rz_fail('not_found', 'O utilizador escolhido para administrador não existe.');
  END IF;
  IF p_group IS NOT NULL AND v_gname <> '' THEN
    PERFORM public.rz_fail('invalid_argument',
      'Indique o grupo existente ou o nome de um grupo novo, não os dois.');
  END IF;
  IF p_group IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.company_groups g WHERE g.id = p_group) THEN
    PERFORM public.rz_fail('not_found', 'Grupo não encontrado.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.companies c WHERE c.nif = v_nif) THEN
    PERFORM public.rz_fail('invalid_argument', 'Já existe uma empresa com este NIF.');
  END IF;
  BEGIN
    INSERT INTO public.companies (name, nif, email, status, registered_at)
    VALUES (v_name, v_nif, v_email, 'ativa', now())
    RETURNING id INTO v_company;
  EXCEPTION WHEN unique_violation THEN
    PERFORM public.rz_fail('invalid_argument', 'Já existe uma empresa com este NIF.');
  END;
  INSERT INTO public.company_memberships (company_id, user_id, role, origin, status, created_by)
  VALUES (v_company, p_admin_user, 'admin', 'convite', 'ativo', v_caller);
  IF p_group IS NOT NULL THEN
    v_group := p_group;
  ELSIF v_gname <> '' THEN
    INSERT INTO public.company_groups (name, created_by_company_id)
    VALUES (v_gname, v_company)
    RETURNING id INTO v_group;
  END IF;
  IF v_group IS NOT NULL THEN
    -- Grupo escolhido ou criado pelo super admin: origem 'manual' (partilha o Feed, Lote 3).
    INSERT INTO public.company_group_members (group_id, company_id, origin)
    VALUES (v_group, v_company, 'manual');
  END IF;
  PERFORM public.rz_audit_cross(v_caller, v_company, v_company, NULL, 'write', 'company_create', v_company);
  RETURN jsonb_build_object('company_id', v_company, 'group_id', v_group, 'admin_user_id', p_admin_user);
END;
$function$;

-- ------------------------------------------------------------------ apagar empresa (só sem colaboradores)
CREATE OR REPLACE FUNCTION public.rz_delete_company(p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := public.rz_uid();
  v_table  text;
  v_has    boolean;
  -- Tabelas com dados da empresa que o DELETE apagaria em cascata (ou travaria): só se apaga uma empresa
  -- que nunca teve dados. Para o resto há a desativação.
  v_tables text[] := ARRAY['employees', 'absences', 'accesses', 'phones', 'equipments', 'assignments',
    'support_tickets', 'time_clock_entries', 'time_clock_locations', 'legal_clients', 'feed_posts',
    'tasks', 'calendar_events', 'notifications', 'marketing_emails', 'recurring_services',
    'appreciations', 'chat_conversations', 'mail_accounts'];
BEGIN
  IF NOT public.rz_is_super_admin() THEN
    PERFORM public.rz_fail('not_platform_admin');
  END IF;
  -- Bloqueia a empresa até ao fim: ninguém lhe acrescenta dados entre a verificação e o DELETE.
  PERFORM 1 FROM public.companies c WHERE c.id = p_company FOR UPDATE;
  IF p_company IS NULL OR NOT FOUND THEN
    PERFORM public.rz_fail('not_found', 'Empresa não encontrada.');
  END IF;
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns ic
         WHERE ic.table_schema = 'public' AND ic.table_name = v_table AND ic.column_name = 'company_id') THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE company_id = $1)', v_table)
        INTO STRICT v_has USING p_company;
      IF v_has THEN
        PERFORM public.rz_fail('invalid_argument',
          'A empresa já tem dados (colaboradores, ausências, ponto, ...). Desative-a em vez de a eliminar.');
      END IF;
    END IF;
  END LOOP;
  PERFORM public.rz_audit_cross(v_caller, p_company, p_company, NULL, 'write', 'company_delete', p_company);
  DELETE FROM public.companies WHERE id = p_company;
  RETURN jsonb_build_object('company_id', p_company, 'deleted', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.rz_delete_company(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_delete_company(uuid) TO authenticated, service_role;
