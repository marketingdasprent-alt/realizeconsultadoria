-- Multiempresa, Fase C1: funções para atribuir/mover colaboradores e gerir administradores.
--
--   1. rz_transfer_employee   - mover um colaborador para outra empresa (atómica, auditada)
--   2. rz_transfer_employees  - o mesmo em massa (uma ficha má não aborta as outras)
--   3. Políticas RLS ADITIVAS de SELECT: o colaborador vê sempre o próprio histórico de ausências
--   4. rz_add_company_admin / rz_remove_company_admin - gestão de administradores de uma empresa
--   5. rz_create_company      - só super admin: empresa + primeiro administrador + grupo, numa operação
--
-- Idempotente. Não altera nem remove nenhuma política ou função existente. Sem dados de produção.
-- Pressupõe a Fase B aplicada (gatilho employees_sync_membership, índice
-- company_memberships_one_active_employee_uq, rz_membership_guard em UPDATE e DELETE).
-- Auditoria: rz_audit_cross com action 'write' (a lista fechada do CHECK não muda) e
-- resource_type 'employee_transfer' / 'company_admin' / 'company_create'.
-- Reversão: supabase/rollbacks/20261118110000_multiempresa_fase_c_funcoes_rollback.sql

-- ============================================================================================
-- 1. rz_transfer_employee
--    Quem chama tem de ser admin da empresa de origem E da de destino (super admin passa).
--    Faz só UPDATE employees SET company_id: o gatilho employees_sync_membership trata das
--    pertenças. NÃO toca em absences, absence_periods, ponto nem saldos (mantêm o company_id de
--    origem). p_note é devolvido no resultado mas não é guardado (a auditoria não tem texto livre).
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.rz_transfer_employee(p_employee uuid, p_to_company uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user      uuid := public.rz_uid();
  v_e         public.employees%ROWTYPE;
  v_from      uuid;
  v_to_status text;
  v_tasks_assigned integer;
  v_tasks_part     integer;
  v_events_att     integer;
  v_events_own     integer;
  v_folders        integer;
  v_chats          integer;
BEGIN
  IF p_employee IS NULL OR p_to_company IS NULL THEN
    PERFORM public.rz_fail('invalid_argument', 'Indique o colaborador e a empresa de destino.');
  END IF;

  -- Leitura sem bloqueio: quem não administra a empresa da ficha não a vê (nem sabe se existe).
  SELECT * INTO v_e FROM public.employees WHERE id = p_employee;
  IF NOT FOUND OR NOT public.rz_is_company_admin_for(v_user, v_e.company_id) THEN
    PERFORM public.rz_fail('not_found', 'Colaborador não encontrado.');
  END IF;

  -- Já com autorização: bloqueia a ficha e relê-a.
  SELECT * INTO v_e FROM public.employees WHERE id = p_employee FOR UPDATE;
  v_from := v_e.company_id;

  IF v_from = p_to_company THEN
    PERFORM public.rz_fail('invalid_argument', 'O colaborador já pertence à empresa de destino.');
  END IF;

  -- Administra as duas empresas (super admin passa; a rz_assert_admin audita o acesso fora da sua).
  PERFORM public.rz_assert_admin(v_from);
  PERFORM public.rz_assert_admin(p_to_company);

  SELECT c.status INTO v_to_status FROM public.companies c WHERE c.id = p_to_company;
  IF NOT FOUND THEN
    PERFORM public.rz_fail('not_found', 'Empresa de destino não encontrada.');
  END IF;
  IF v_to_status IS DISTINCT FROM 'ativa' THEN
    PERFORM public.rz_fail('invalid_argument', 'A empresa de destino não está ativa.');
  END IF;

  IF NOT v_e.is_active THEN
    PERFORM public.rz_fail('invalid_argument', 'A ficha do colaborador não está ativa.');
  END IF;
  IF v_e.user_id IS NULL THEN
    PERFORM public.rz_fail('invalid_argument',
      'O colaborador ainda não tem conta de utilizador. Crie a conta antes de o mover.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.employees x
              WHERE x.company_id = p_to_company AND x.id <> v_e.id
                AND lower(x.email) = lower(v_e.email)) THEN
    PERFORM public.rz_fail('invalid_argument',
      'Já existe um colaborador com este email na empresa de destino.');
  END IF;

  -- Regra "uma só empresa": erros amigáveis em vez do 23505 do índice.
  IF EXISTS (SELECT 1 FROM public.employees x
              WHERE x.user_id = v_e.user_id AND x.id <> v_e.id AND x.is_active) THEN
    PERFORM public.rz_fail('invalid_argument',
      'Esta conta de utilizador tem outra ficha de colaborador ativa. Desative-a primeiro.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_memberships m
              WHERE m.user_id = v_e.user_id AND m.role = 'colaborador' AND m.status = 'ativo'
                AND m.company_id <> v_from) THEN
    PERFORM public.rz_fail('invalid_argument',
      'Esta conta de utilizador já é colaborador ativo noutra empresa.');
  END IF;

  BEGIN
    UPDATE public.employees SET company_id = p_to_company WHERE id = v_e.id;
  EXCEPTION WHEN unique_violation THEN
    PERFORM public.rz_fail('invalid_argument',
      'Não foi possível mover: já existe um colaborador igual na empresa de destino.');
  END;

  -- Efeitos pendentes (só contagens, nada é alterado). Tudo referido à empresa de ORIGEM.
  SELECT count(*) INTO v_tasks_assigned FROM public.tasks t
   WHERE t.company_id = v_from AND t.status <> 'done' AND t.assignee_id = v_e.user_id;
  SELECT count(*) INTO v_tasks_part FROM public.tasks t
   WHERE t.company_id = v_from AND t.status <> 'done' AND t.assignee_id IS DISTINCT FROM v_e.user_id
     AND EXISTS (SELECT 1 FROM public.task_participants p WHERE p.task_id = t.id AND p.user_id = v_e.user_id);
  SELECT count(*) INTO v_events_att FROM public.calendar_events ev
   WHERE ev.company_id = v_from AND ev.starts_at > now() AND ev.owner_id <> v_e.user_id
     AND EXISTS (SELECT 1 FROM public.calendar_event_attendees a WHERE a.event_id = ev.id AND a.user_id = v_e.user_id);
  SELECT count(*) INTO v_events_own FROM public.calendar_events ev
   WHERE ev.company_id = v_from AND ev.starts_at > now() AND ev.owner_id = v_e.user_id;
  SELECT count(*) INTO v_folders FROM public.folder_assignments f WHERE f.employee_id = v_e.id;
  SELECT count(*) INTO v_chats
    FROM public.chat_members m
    JOIN public.chat_conversations c ON c.id = m.conversation_id
   WHERE m.user_id = v_e.user_id AND c.company_id = v_from AND NOT c.is_default;

  -- Uma linha por empresa, para o admin de cada uma a ver na sua auditoria.
  PERFORM public.rz_audit_cross(v_user, v_from, v_from, NULL, 'write', 'employee_transfer', v_e.id);
  PERFORM public.rz_audit_cross(v_user, v_from, p_to_company, NULL, 'write', 'employee_transfer', v_e.id);

  RETURN jsonb_build_object(
    'employee_id', v_e.id,
    'from_company', v_from,
    'to_company', p_to_company,
    'note', left(p_note, 500),
    'pending_effects', jsonb_build_object(
      'tasks_open_assigned', v_tasks_assigned,
      'tasks_open_participant', v_tasks_part,
      'events_future_attending', v_events_att,
      'events_future_owned', v_events_own,
      'folders_assigned', v_folders,
      'chat_conversations_origin', v_chats
    )
  );
END;
$function$;

-- ============================================================================================
-- 2. rz_transfer_employees: em massa. Cada ficha corre num bloco próprio: uma ficha má falha
--    sozinha (desfaz só essa) e as outras seguem. A autorização sobre o destino é verificada
--    primeiro, para falhar logo se quem chama não o administra.
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.rz_transfer_employees(p_employees uuid[], p_to_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user    uuid := public.rz_uid();
  v_ids     uuid[];
  v_id      uuid;
  v_res     jsonb;
  v_results jsonb := '[]'::jsonb;
  v_ok      integer := 0;
  v_failed  integer := 0;
  v_code    text;
  v_detail  text;
BEGIN
  IF p_to_company IS NULL OR p_employees IS NULL OR cardinality(p_employees) = 0 THEN
    PERFORM public.rz_fail('invalid_argument', 'Indique os colaboradores e a empresa de destino.');
  END IF;
  SELECT coalesce(array_agg(DISTINCT x), ARRAY[]::uuid[]) INTO v_ids
    FROM unnest(p_employees) AS x WHERE x IS NOT NULL;
  IF cardinality(v_ids) = 0 OR cardinality(v_ids) > 200 THEN
    PERFORM public.rz_fail('invalid_argument', 'Indique entre 1 e 200 colaboradores.');
  END IF;

  PERFORM public.rz_assert_admin(p_to_company);

  FOREACH v_id IN ARRAY v_ids LOOP
    BEGIN
      v_res := public.rz_transfer_employee(v_id, p_to_company);
      v_ok := v_ok + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('employee_id', v_id, 'ok', true, 'result', v_res));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
      v_code := SQLERRM;
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('employee_id', v_id, 'ok', false, 'error', v_code, 'detail', v_detail));
    END;
  END LOOP;

  RETURN jsonb_build_object('total', cardinality(v_ids), 'ok', v_ok, 'failed', v_failed, 'results', v_results);
END;
$function$;

-- ============================================================================================
-- 3. Histórico que acompanha a pessoa (políticas ADITIVAS, só SELECT; nenhuma existente muda).
--    A política "Employees can view company absences" usa company_id = empresa atual; depois de
--    mover o colaborador, as ausências antigas (company_id de origem) deixariam de lhe aparecer.
--    Já cobertos por employee_id (nada a acrescentar): time_clock_entries ("Employees view own
--    time entries"), employee_vacation_balances ("Employees can view own vacation balance") e
--    absence_documents ("Employees can view own absence documents").
-- ============================================================================================
DROP POLICY IF EXISTS "Colaborador vê as suas ausências (qualquer empresa)" ON public.absences;
CREATE POLICY "Colaborador vê as suas ausências (qualquer empresa)" ON public.absences
  FOR SELECT TO authenticated
  USING (employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Colaborador vê os seus períodos de ausência (qualquer empresa)" ON public.absence_periods;
CREATE POLICY "Colaborador vê os seus períodos de ausência (qualquer empresa)" ON public.absence_periods
  FOR SELECT TO authenticated
  USING (absence_id IN (
    SELECT a.id FROM public.absences a
     WHERE a.employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = (SELECT auth.uid()))));

-- ============================================================================================
-- 4. Administradores de uma empresa
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.rz_add_company_admin(p_company uuid, p_user uuid, p_role text DEFAULT 'admin'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid;
  v_prev   text;
BEGIN
  v_caller := public.rz_assert_admin(p_company);
  IF p_role IS NULL OR p_role NOT IN ('admin', 'gestor') THEN
    PERFORM public.rz_fail('invalid_argument', 'O papel tem de ser admin ou gestor.');
  END IF;
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user) THEN
    PERFORM public.rz_fail('not_found', 'Utilizador não encontrado.');
  END IF;

  SELECT m.role INTO v_prev FROM public.company_memberships m
   WHERE m.company_id = p_company AND m.user_id = p_user FOR UPDATE;

  -- Uma só pertença por (empresa, conta): se já era colaborador, promove-a em vez de duplicar.
  -- A origem da pertença existente mantém-se.
  INSERT INTO public.company_memberships (company_id, user_id, role, origin, status, created_by)
  VALUES (p_company, p_user, p_role, 'convite', 'ativo', v_caller)
  ON CONFLICT (company_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'ativo';

  PERFORM public.rz_audit_cross(v_caller, p_company, p_company, NULL, 'write', 'company_admin', p_user);
  RETURN jsonb_build_object('company_id', p_company, 'user_id', p_user, 'role', p_role,
                            'previous_role', v_prev);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_remove_company_admin(p_company uuid, p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid;
  v_m      public.company_memberships%ROWTYPE;
  v_still_employee boolean;
  v_new_role   text;
  v_new_status text;
BEGIN
  v_caller := public.rz_assert_admin(p_company);
  IF p_user IS NULL THEN
    PERFORM public.rz_fail('invalid_argument', 'Indique o utilizador.');
  END IF;

  SELECT * INTO v_m FROM public.company_memberships m
   WHERE m.company_id = p_company AND m.user_id = p_user FOR UPDATE;
  IF NOT FOUND OR v_m.role NOT IN ('admin', 'gestor') OR v_m.status = 'removido' THEN
    PERFORM public.rz_fail('not_found', 'Este utilizador não é administrador desta empresa.');
  END IF;

  -- Mensagem clara quando o próprio retira o seu acesso e a empresa ficaria sem administrador.
  IF v_m.role = 'admin' AND v_m.status = 'ativo'
     AND NOT EXISTS (SELECT 1 FROM public.company_memberships o
                      WHERE o.company_id = p_company AND o.role = 'admin' AND o.status = 'ativo'
                        AND o.id <> v_m.id) THEN
    IF p_user = v_caller THEN
      PERFORM public.rz_fail('last_admin',
        'Não pode retirar o seu próprio acesso: a empresa ficaria sem administrador.');
    ELSE
      PERFORM public.rz_fail('last_admin',
        'Não pode retirar o último administrador da empresa. Adicione outro administrador primeiro.');
    END IF;
  END IF;

  -- Se a pessoa é também colaborador ativo desta empresa, passa a colaborador (não perde o acesso
  -- como colaborador); caso contrário a pertença fica 'removido'.
  SELECT EXISTS (SELECT 1 FROM public.employees e
                  WHERE e.company_id = p_company AND e.user_id = p_user AND e.is_active)
    INTO v_still_employee;
  IF v_still_employee THEN
    v_new_role := 'colaborador'; v_new_status := 'ativo';
  ELSE
    v_new_role := v_m.role;      v_new_status := 'removido';
  END IF;

  -- O gatilho rz_membership_guard volta a recusar com last_admin se for o último (corrida).
  UPDATE public.company_memberships
     SET role = v_new_role, status = v_new_status
   WHERE id = v_m.id;

  PERFORM public.rz_audit_cross(v_caller, p_company, p_company, NULL, 'write', 'company_admin', p_user);
  RETURN jsonb_build_object('company_id', p_company, 'user_id', p_user,
                            'previous_role', v_m.role, 'role', v_new_role, 'status', v_new_status);
END;
$function$;

-- ============================================================================================
-- 5. rz_create_company: só super admin. A empresa nasce com o primeiro administrador (e,
--    opcionalmente, num grupo) numa só operação. p_admin_user leva DEFAULT NULL porque o Postgres
--    não permite um parâmetro sem valor por omissão depois de um com; é validado como obrigatório.
-- ============================================================================================
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
    INSERT INTO public.company_group_members (group_id, company_id, origin)
    VALUES (v_group, v_company, 'pedido');
  END IF;

  PERFORM public.rz_audit_cross(v_caller, v_company, v_company, NULL, 'write', 'company_create', v_company);
  RETURN jsonb_build_object('company_id', v_company, 'group_id', v_group, 'admin_user_id', p_admin_user);
END;
$function$;

-- ============================================================================================
-- 6. Permissões: authenticated e service_role; nunca PUBLIC nem anon.
-- ============================================================================================
DO $acl$
DECLARE
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'rz_transfer_employee(uuid, uuid, text)',
    'rz_transfer_employees(uuid[], uuid)',
    'rz_add_company_admin(uuid, uuid, text)',
    'rz_remove_company_admin(uuid, uuid)',
    'rz_create_company(text, text, text, uuid, text, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', s);
  END LOOP;
END
$acl$;
